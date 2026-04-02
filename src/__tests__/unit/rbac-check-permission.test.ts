// src/__tests__/unit/rbac-check-permission.test.ts
/**
 * Tests unitarios de RBAC — checkPermission (F2-15 / Bloque 0).
 *
 * Cubre:
 * - ForbiddenError cuando auth.role es undefined
 * - ForbiddenError cuando el rol no tiene el permiso en BD
 * - Sin error cuando el rol tiene el permiso en BD
 * - handleApiError retorna 403 para ForbiddenError
 *
 * Sin conexión real a BD — Prisma mockeado con vi.hoisted.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Mock de Prisma ───────────────────────────────────────────────────────────

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    rolePermission: {
      findFirst: vi.fn(),
    },
  },
}));

vi.mock('@/lib/db/prisma', () => ({ default: prismaMock }));

// ─── Imports (después de mocks) ───────────────────────────────────────────────

import { checkPermission, ForbiddenError } from '@/lib/permissions/check-permission';
import { handleApiError } from '@/lib/api/handle-error';
import type { AuthContext } from '@/types/auth';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeAuth(overrides: Partial<AuthContext> = {}): AuthContext {
  return {
    userId: '00000000-0000-0000-0000-000000000001',
    companyId: '00000000-0000-0000-0000-000000000010',
    role: 'ACCOUNTANT',
    tokenUse: 'id',
    claims: {},
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('checkPermission', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('cuando auth.role es undefined', () => {
    it('lanza ForbiddenError sin consultar la BD', async () => {
      const auth = makeAuth({ role: undefined });

      await expect(checkPermission(auth, 'accounting.journal.read')).rejects.toThrow(
        ForbiddenError,
      );
      expect(prismaMock.rolePermission.findFirst).not.toHaveBeenCalled();
    });

    it('el mensaje menciona el permiso requerido', async () => {
      const auth = makeAuth({ role: undefined });

      await expect(checkPermission(auth, 'accounting.journal_entry.post')).rejects.toThrow(
        'Permiso requerido: accounting.journal_entry.post',
      );
    });
  });

  describe('cuando el rol no tiene el permiso en BD', () => {
    it('lanza ForbiddenError cuando findFirst retorna null', async () => {
      prismaMock.rolePermission.findFirst.mockResolvedValue(null);
      const auth = makeAuth({ role: 'SALESPERSON' });

      await expect(checkPermission(auth, 'accounting.journal_entry.create')).rejects.toThrow(
        ForbiddenError,
      );
    });

    it('consulta la BD con el rol y permiso correctos', async () => {
      prismaMock.rolePermission.findFirst.mockResolvedValue(null);
      const auth = makeAuth({ role: 'AUDITOR' });

      await expect(checkPermission(auth, 'accounting.journal_entry.post')).rejects.toThrow(
        ForbiddenError,
      );

      expect(prismaMock.rolePermission.findFirst).toHaveBeenCalledWith({
        where: { role: 'AUDITOR', permissionId: 'accounting.journal_entry.post' },
        select: { role: true },
      });
    });
  });

  describe('cuando el rol tiene el permiso', () => {
    it('no lanza error cuando findFirst retorna un registro', async () => {
      prismaMock.rolePermission.findFirst.mockResolvedValue({ role: 'ACCOUNTANT' });
      const auth = makeAuth({ role: 'ACCOUNTANT' });

      await expect(checkPermission(auth, 'accounting.journal_entry.post')).resolves.toBeUndefined();
    });

    it('ADMIN puede publicar asientos', async () => {
      prismaMock.rolePermission.findFirst.mockResolvedValue({ role: 'ADMIN' });
      const auth = makeAuth({ role: 'ADMIN' });

      await expect(checkPermission(auth, 'accounting.journal_entry.post')).resolves.toBeUndefined();
    });

    it('AUDITOR puede leer asientos', async () => {
      prismaMock.rolePermission.findFirst.mockResolvedValue({ role: 'AUDITOR' });
      const auth = makeAuth({ role: 'AUDITOR' });

      await expect(checkPermission(auth, 'accounting.journal_entry.read')).resolves.toBeUndefined();
    });
  });
});

describe('ForbiddenError', () => {
  it('tiene statusCode 403 y code FORBIDDEN', () => {
    const err = new ForbiddenError('accounting.account.read');
    expect(err.statusCode).toBe(403);
    expect(err.code).toBe('FORBIDDEN');
    expect(err.name).toBe('ForbiddenError');
    expect(err.message).toBe('Permiso requerido: accounting.account.read');
  });
});

describe('handleApiError — ForbiddenError', () => {
  it('retorna 403 con código FORBIDDEN', async () => {
    const err = new ForbiddenError('accounting.report.read');
    const response = handleApiError(err, 'test');
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.success).toBe(false);
    expect(body.code).toBe('FORBIDDEN');
    expect(body.error).toContain('accounting.report.read');
  });

  it('SALESPERSON sin acceso contable recibe 403', async () => {
    prismaMock.rolePermission.findFirst.mockResolvedValue(null);
    const auth = makeAuth({ role: 'SALESPERSON' });

    let caughtError: unknown;
    try {
      await checkPermission(auth, 'accounting.journal_entry.create');
    } catch (err) {
      caughtError = err;
    }

    expect(caughtError).toBeInstanceOf(ForbiddenError);
    const response = handleApiError(caughtError, 'test');
    expect(response.status).toBe(403);
  });
});
