/**
 * Prisma Client Extension para Multi-Tenant Filtering (company_id)
 *
 * CONTEXT:
 * - DAR-DBA-003: Workaround para limitación de Prisma + RLS
 * - Prisma Query Engine connection pooling hace que SET LOCAL no persista
 *   entre $executeRawUnsafe y queries ORM subsecuentes
 * - PostgreSQL RLS sigue activo como defensa secundaria (defense-in-depth)
 *
 * Esta extensión inyecta `company_id` automáticamente en todas las queries
 * a tablas de negocio (business tables que tienen company_id).
 *
 * USAGE (Tests):
 * ```typescript
 * const prismaWithTenant = createTenantPrisma(prisma, companyId);
 * const users = await prismaWithTenant.user.findMany(); // WHERE injected automatically
 * ```
 *
 * SECURITY LAYERS:
 * 1. Application (esta extensión): Filtra company_id en Prisma queries ✅
 * 2. Database (RLS policies): Filtra company_id en PostgreSQL❗ (actualmente inefectiva con Prisma $transaction)
 * 3. Future (API middleware): Validará company_id del JWT antes de queries
 *
 * @see DAR-DBA-003 en ARCHITECTURE.md
 */

import type { PrismaClient } from '@prisma/client';

/**
 * Tablas que requieren filtro por company_id (business tables)
 * Actualizar esta lista cuando se agreguen nuevos módulos
 * NOTA: Nombres en PascalCase como aparecen en el schema Prisma
 */
const BUSINESS_MODELS = ['User'] as const;
type BusinessModel = (typeof BUSINESS_MODELS)[number];

/**
 * Crea una instancia de Prisma Client con filtro automático de company_id
 *
 * @param prisma - Instancia base de PrismaClient
 * @param companyId - UUID de la empresa para filtrar
 * @returns PrismaClient extendido con tenant filtering
 *
 * @example
 * ```typescript
 * // En tests
 * const prismaA = createTenantPrisma(prisma, companyAId);
 * const users = await prismaA.user.findMany(); // Solo users de Company A
 *
 * // En API routes (Fase 1)
 * const companyId = req.user.company_id; // Del JWT
 * const prismaWithTenant = createTenantPrisma(prisma, companyId);
 * ```
 */
export function createTenantPrisma(prisma: PrismaClient, companyId: string) {
  return prisma.$extends({
    name: 'tenant-filter',
    query: {
      // Inyectar company_id en TODAS las operaciones de tablas de negocio
      $allModels: {
        async $allOperations({ operation, model, args, query }) {
          // Solo aplicar a business models que tienen company_id
          if (!BUSINESS_MODELS.includes(model as BusinessModel)) {
            return query(args);
          }

          // Inyectar companyId en WHERE clause o data según la operación
          const isWriteOperation = ['create', 'createMany', 'upsert'].includes(operation);
          const isReadOperation = [
            'findMany',
            'findFirst',
            'findUnique',
            'count',
            'aggregate',
            'groupBy',
          ].includes(operation);
          const isUpdateOperation = ['update', 'updateMany', 'delete', 'deleteMany'].includes(
            operation,
          );

          // DEBUG: Solo en desarrollo con DEBUG_TENANT_EXTENSION=true
          const DEBUG = process.env.DEBUG_TENANT_EXTENSION === 'true';
          if (DEBUG && model === 'User') {
            console.log('[Extension DEBUG] Operation:', operation);
            console.log('[Extension DEBUG] Model:', model);
            console.log('[Extension DEBUG] Args BEFORE injection:', JSON.stringify(args, null, 2));
            console.log('[Extension DEBUG] isReadOperation:', isReadOperation);
            console.log('[Extension DEBUG] isUpdateOperation:', isUpdateOperation);
            console.log('[Extension DEBUG] "where" in args:', 'where' in args);
          }

          if (isReadOperation || isUpdateOperation) {
            // SELECT/UPDATE/DELETE: inyectar companyId en WHERE
            // Type assertion necesaria para Next.js 16 + TypeScript 5.x (strict union types)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const currentWhere = (args as any).where;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (args as any).where = currentWhere
              ? { AND: [currentWhere, { companyId }] }
              : { companyId };

            // DEBUG
            const DEBUG = process.env.DEBUG_TENANT_EXTENSION === 'true';
            if (DEBUG && model === 'User') {
              console.log(
                '[Extension DEBUG] Args AFTER injection WHERE:',
                JSON.stringify(args, null, 2),
              );
            }
          }

          if (isWriteOperation) {
            // INSERT/UPSERT: inyectar companyId en data
            if (operation === 'create') {
              // Siempre inyectar companyId (el tenant context es autoritativo)
              // Type assertion necesaria para Next.js 16 + TypeScript 5.x
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (args as any).data = { ...args.data, companyId };

              // DEBUG: Solo en desarrollo
              const DEBUG = process.env.DEBUG_TENANT_EXTENSION === 'true';
              if (DEBUG && model === 'User') {
                console.log(
                  '[Extension DEBUG] Args AFTER injection:',
                  JSON.stringify(args, null, 2),
                );
              }
            } else if (operation === 'createMany') {
              // Type assertion necesaria para Next.js 16 + TypeScript 5.x
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (args as any).data = Array.isArray(args.data)
                ? args.data.map((item: any) => ({ ...item, companyId }))
                : { ...args.data, companyId };
            } else if (operation === 'upsert') {
              // Inyectar en create, update y where
              // Type assertions necesarias para Next.js 16 + TypeScript 5.x
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (args as any).create = { ...args.create, companyId };
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (args as any).update = { ...args.update, companyId };
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (args as any).where = { ...args.where, companyId };
            }
          }

          return query(args);
        },
      },
    },
  });
}

/**
 * Crea una instancia Prisma sin filtro de tenant (para operaciones admin/seeds)
 *
 * ⚠️ WARNING: Solo usar en:
 * - Seeds de base de datos
 * - Tests beforeAll/afterAll (fixtures y cleanup)
 * - Operaciones administrativas que necesitan ver todas las empresas
 *
 * En producción, incluso admins deben tener company_id en su sesión.
 *
 * @param prisma - Instancia base de PrismaClient
 * @returns PrismaClient sin tenant filtering
 */
export function createAdminPrisma(prisma: PrismaClient) {
  // En Fase 0, simplemente retorna el prisma original
  // En Fase 1, podríamos agregar logging o auditoría de operaciones admin
  return prisma;
}

/**
 * Type helper: PrismaClient con tenant extension
 */
export type TenantPrismaClient = ReturnType<typeof createTenantPrisma>;

/**
 * Type helper: PrismaClient admin (sin extension)
 */
export type AdminPrismaClient = ReturnType<typeof createAdminPrisma>;
