// src/lib/db/prisma.ts
// Prisma Client singleton para NexoERP.
//
// En desarrollo, evita crear múltiples instancias cuando Next.js
// hace Fast Refresh (HMR).
//
// DAR-DBA-002: Dual-Role Pattern para Multi-Tenancy
// - DATABASE_URL (nexoerp): SUPERUSER para migraciones Prisma
// - DATABASE_URL_APP (app_user): NO SUPERUSER para queries de aplicación/tests
//   * Respeta Row Level Security (RLS) enforcement
//   * Valida aislamiento multi-tenant correctamente
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
    // DAR-008: datasourceUrl pasado en constructor (Prisma 6.19+ compatibilidad)
    // DAR-DBA-002: Usa app_user role (respeta RLS) si está disponible, fallback a nexoerp
    datasourceUrl: process.env.DATABASE_URL_APP || process.env.DATABASE_URL,
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

// Debug: Log the datasource URL being used (only first few characters for security)
if (process.env.NODE_ENV === 'development') {
  const url = process.env.DATABASE_URL_APP || process.env.DATABASE_URL;
  const parsedUrl = url?.split('@')[0]?.split('//')[1]; // Extract user from connection string
  console.log('[Prisma Client] Using datasource:', parsedUrl ? `${parsedUrl}@...` : 'unknown');
}

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export default prisma;
