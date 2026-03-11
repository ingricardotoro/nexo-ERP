// src/lib/db/prisma.ts
// Prisma Client singleton para NexoERP.
//
// En desarrollo, evita crear múltiples instancias cuando Next.js
// hace Fast Refresh (HMR).
//
// En Fase 1 se agregarán Client Extensions para:
//   - Filtro automático por company_id (multi-tenant) — DAR-001
//   - Auditoría automática (AuditLog)
//
// @see prisma/schema/ para los modelos

import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export default prisma;
