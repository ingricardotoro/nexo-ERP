/**
 * Helpers para configurar sesiones RLS en tests multi-tenant
 *
 * DAR-DBA-003: Prisma Client Extension Approach (Workaround para limitación Prisma + RLS)
 *
 * PROBLEMA IDENTIFICADO:
 * - Prisma Query Engine usa connection pooling interno donde SET LOCAL no persiste
 * - $executeRawUnsafe() y queries ORM subsecuentes usan conexiones diferentes del pool
 * - PostgreSQL RLS funciona perfectamente (verificado manualmente)
 * - Pero Prisma $transaction() no respeta session variables establecidas con SET LOCAL
 *
 * SOLUCIÓN TEMPORAL (Fase 0):
 * - Usar Prisma Client Extension para inyectar WHERE company_id = ? en queries
 * - Mantener RLS policies como defensa secundaria (defense-in-depth)
 * - En Fase 1, evaluar si Prisma ofrece solución o migrar a pg driver directo
 *
 * Tests manuales PostgreSQL confirmados ✅:
 * - SET LOCAL + SELECT: filtrado correcto (count=1)
 * - SET LOCAL + prepared statements: filtrado correcto
 * - RLS policies aplicadas a app_user: correcto
 * - rowsecurity habilitado: correcto
 *
 * @see src/lib/db/tenant-extension.ts para implementación de la extensión
 * @see DAR-DBA-003 en ARCHITECTURE.md para decisión arquitectónica completa
 */

import { createTenantPrisma, createAdminPrisma } from '@/lib/db/tenant-extension';

import type { PrismaClient } from '@prisma/client';

/**
 * Ejecuta una query dentro de un contexto de tenant específico
 *
 * La extensión Prisma inyecta automáticamente company_id en todas las queries.
 *
 * @example
 * const users = await withRLSContext(prismaAppA, companyAId, async (tx) => {
 *   return tx.user.findMany(); // WHERE company_id = companyAId (inyectado)
 * });
 */
export async function withRLSContext<T>(
  prisma: PrismaClient,
  companyId: string | null,
  callback: (tx: ReturnType<typeof createTenantPrisma>) => Promise<T>,
): Promise<T> {
  if (!companyId) {
    throw new Error('[withRLSContext] companyId is required for tenant context');
  }

  // Crear Prisma Client con tenant extension
  const tenantPrisma = createTenantPrisma(prisma, companyId);

  // Ejecutar callback con el cliente filtrado
  return callback(tenantPrisma);
}

/**
 * Ejecuta operaciones administrativas sin filtro de tenant
 *
 * ⚠️ SOLO usar para:
 * - Fixtures de test (beforeAll, afterAll)
 * - Seeds de base de datos
 * - Cleanup de tests
 *
 * En producción, incluso admins deben operar dentro de un tenant.
 *
 * @example
 * await withAdminContext(prismaOwner, async (tx) => {
 *   await tx.user.deleteMany(); // Sin filtro de company_id
 * });
 */
export async function withAdminContext<T>(
  prisma: PrismaClient,
  callback: (tx: ReturnType<typeof createAdminPrisma>) => Promise<T>,
): Promise<T> {
  const adminPrisma = createAdminPrisma(prisma);
  return callback(adminPrisma);
}
