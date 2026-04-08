// src/lib/audit/log.ts
//
// Lightweight helper to write AuditLog entries without boilerplate.
// Fires-and-forgets (no await required) — audit failures never block the caller.
//
// Usage:
//   import { logAudit } from '@/lib/audit/log';
//   logAudit(prisma, { companyId, userId, action: 'UPDATE', entity: 'Invoice', entityId: id });

import type { AuditAction, Prisma, PrismaClient } from '@prisma/client';

interface AuditParams {
  companyId: string;
  userId?: string | null;
  action: AuditAction;
  entity: string;
  entityId: string;
  oldValues?: Record<string, unknown> | null;
  newValues?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

/**
 * Creates an AuditLog entry. Errors are swallowed — audit must never crash the caller.
 * Use `await logAudit(...)` if you need to guarantee the write completed.
 */
export async function logAudit(prisma: PrismaClient, params: AuditParams): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        companyId: params.companyId,
        userId: params.userId ?? null,
        action: params.action,
        entity: params.entity,
        entityId: params.entityId,
        oldValues: params.oldValues
          ? (params.oldValues as unknown as Prisma.InputJsonValue)
          : undefined,
        newValues: params.newValues
          ? (params.newValues as unknown as Prisma.InputJsonValue)
          : undefined,
        ipAddress: params.ipAddress ?? null,
        userAgent: params.userAgent ?? null,
      },
    });
  } catch {
    // Intentionally swallowed — audit failures must not interrupt business operations
  }
}
