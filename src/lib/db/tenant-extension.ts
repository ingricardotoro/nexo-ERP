/**
 * Prisma Client Extension para Multi-Tenant Filtering (company_id)
 *
 * CONTEXT:
 * - DAR-DBA-003: Workaround para limitación de Prisma + RLS
 * - SET LOCAL requiere ejecutarse en la misma transacción que la query
 * - La extensión usa prisma.$transaction para garantizar co-localización
 *   de set_config y la query en la misma conexión PostgreSQL
 * - PostgreSQL RLS activo como defensa secundaria (defense-in-depth) ✅
 *
 * Esta extensión inyecta `company_id` automáticamente en todas las queries
 * a tablas de negocio (business tables que tienen company_id).
 * Para tablas con FORCE ROW LEVEL SECURITY, además establece la variable
 * de sesión `app.current_company_id` dentro de una transacción.
 *
 * USAGE (Tests):
 * ```typescript
 * const prismaWithTenant = createTenantPrisma(prisma, companyId);
 * const users = await prismaWithTenant.user.findMany(); // WHERE injected automatically
 * ```
 *
 * SECURITY LAYERS:
 * 1. Application (esta extensión): Filtra company_id en Prisma queries ✅
 * 2. Database (RLS policies): Filtra company_id en PostgreSQL via app.current_company_id ✅
 * 3. API middleware: Valida company_id del JWT antes de queries ✅
 *
 * @see DAR-DBA-003 en ARCHITECTURE.md
 */

import type { PrismaClient } from '@prisma/client';

/**
 * Tablas que requieren filtro por company_id (business tables)
 * Actualizar esta lista cuando se agreguen nuevos módulos
 * NOTA: Nombres en PascalCase como aparecen en el schema Prisma
 */
const BUSINESS_MODELS = [
  // Core
  'User',
  'CompanyModule',
  // Contacts (Fase 2)
  'Contact',
  'ContactAddress',
  'ContactPerson',
  'PaymentTerms',
  // Accounting (Fase 2 — F2-04) — Currency NO va (tabla de plataforma sin companyId)
  'Account',
  'FiscalYear',
  'FiscalPeriod',
  'Journal',
  'JournalEntry',
  'JournalEntryLine',
  'JournalSequence',
  // ExchangeRate NO va — companyId nullable (tasas globales tienen NULL).
  // Filtrado manual en el servicio; RLS cubre: company_id IS NULL OR company_id = current_setting
  // Invoicing (Fase 3 — F3-01)
  'CAI',
  'TaxRate',
  'InvoiceSequence',
  'Invoice',
  'InvoiceLine',
  'SupplierInvoice',
  'SupplierInvoiceLine',
  // Purchasing (Fase 4 Sprint S2)
  'PurchaseOrder',
  'PurchaseOrderLine',
  // Sales (Fase 4 Sprint S3)
  'SalesOrder',
  'SalesOrderLine',
  // Inventory (Fase 4)
  'ProductCategory',
  'UnitOfMeasure',
  'Product',
  'Warehouse',
  'Location',
  'Lot',
  'StockQuant',
  'StockMove',
  'StockMoveLine',
  'ReorderRule',
] as const;
type BusinessModel = (typeof BUSINESS_MODELS)[number];

/**
 * Modelos con FORCE ROW LEVEL SECURITY que requieren la variable de sesión
 * `app.current_company_id` establecida en PostgreSQL antes de ejecutar queries.
 *
 * Para estos modelos la extensión usa prisma.$transaction + set_config(local=true)
 * para garantizar que la variable persiste en la misma conexión que la query,
 * sin riesgo de filtración entre tenants en el connection pool.
 *
 * Fuente: verificado con pg_class.relforcerowsecurity = true en la BD.
 */
const FORCE_RLS_MODELS = [
  'User',
  // Accounting (Fase 2)
  'Account',
  'FiscalYear',
  'FiscalPeriod',
  'Journal',
  'JournalEntry',
  'JournalEntryLine',
  // Invoicing (Fase 3)
  'CAI',
  'TaxRate',
  'InvoiceSequence',
  'Invoice',
  'InvoiceLine',
  'SupplierInvoice',
  'SupplierInvoiceLine',
  // Purchasing (Fase 4 Sprint S2)
  'PurchaseOrder',
  'PurchaseOrderLine',
  // Sales (Fase 4 Sprint S3)
  'SalesOrder',
  'SalesOrderLine',
  // Inventory (Fase 4)
  'ProductCategory',
  'UnitOfMeasure',
  'Product',
  'Warehouse',
  'Location',
  'Lot',
  'StockQuant',
  'StockMove',
  'StockMoveLine',
  'ReorderRule',
] as const;
type ForceRlsModel = (typeof FORCE_RLS_MODELS)[number];

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
          // findMany/findFirst/count/aggregate/groupBy admiten AND en where
          const isReadOperationWithAnd = [
            'findMany',
            'findFirst',
            'findFirstOrThrow',
            'count',
            'aggregate',
            'groupBy',
          ].includes(operation);
          // findUnique/findUniqueOrThrow NO admiten AND — solo acepta campos únicos exactos.
          // No se inyecta companyId: seguridad por FORCE RLS transaction + UUID global únicos.
          const isUpdateOperation = ['update', 'updateMany', 'delete', 'deleteMany'].includes(
            operation,
          );

          // DEBUG: Solo en desarrollo con DEBUG_TENANT_EXTENSION=true
          const DEBUG = process.env.DEBUG_TENANT_EXTENSION === 'true';
          if (DEBUG && model === 'User') {
            console.log('[Extension DEBUG] Operation:', operation);
            console.log('[Extension DEBUG] Model:', model);
            console.log('[Extension DEBUG] Args BEFORE injection:', JSON.stringify(args, null, 2));
            console.log('[Extension DEBUG] isReadOperationWithAnd:', isReadOperationWithAnd);
            console.log('[Extension DEBUG] isUpdateOperation:', isUpdateOperation);
            console.log('[Extension DEBUG] "where" in args:', 'where' in args);
          }

          if (isReadOperationWithAnd || isUpdateOperation) {
            // SELECT/UPDATE/DELETE con AND: inyectar companyId en WHERE usando AND
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

          // Para modelos con FORCE RLS: ejecutar dentro de una transacción que primero
          // establece app.current_company_id como variable de sesión local.
          // Esto garantiza que la RLS policy ve el companyId correcto sin filtración
          // entre tenants en el connection pool (set_config local=true solo persiste
          // durante la transacción actual).
          //
          // La query se despacha directamente sobre `tx` (base Prisma client, sin extensión)
          // con los `args` ya modificados (WHERE/data inyectados arriba).
          // Esto evita recursión infinita ya que `tx` no tiene la extensión aplicada.
          if (FORCE_RLS_MODELS.includes(model as ForceRlsModel)) {
            return prisma.$transaction(async (tx) => {
              await tx.$executeRaw`SELECT set_config('app.current_company_id', ${companyId}, true)`;

              const modelKey = model.charAt(0).toLowerCase() + model.slice(1);
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              return (tx as any)[modelKey][operation](args);
            });
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
