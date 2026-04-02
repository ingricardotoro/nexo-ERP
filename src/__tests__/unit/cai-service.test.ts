// src/__tests__/unit/cai-service.test.ts
/**
 * Tests unitarios del caiService (F3-tests).
 *
 * Cubre:
 * - listCais: retorna lista mapeada
 * - getCai: lanza error si no existe
 * - createCai: lanza error si caiCode duplicado
 * - createCai: desactiva CAI anterior del mismo tipo de documento
 * - createCai: crea correctamente
 * - updateCai: lanza error si no existe
 * - updateCai: desactiva hermanos al activar
 * - getActiveCai: lanza error si no hay CAI activo
 * - getActiveCai: lanza error si CAI vencido
 * - getActiveCai: lanza error si rango agotado
 * - getActiveCai: retorna CAI válido
 *
 * Sin conexión real a BD — Prisma mockeado con vi.hoisted.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Mock de Prisma ───────────────────────────────────────────────────────────

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    cAI: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}));

vi.mock('@/lib/db/prisma', () => ({ default: prismaMock }));
vi.mock('@/lib/db/tenant-extension', () => ({
  createTenantPrisma: () => prismaMock,
}));

// ─── Imports ──────────────────────────────────────────────────────────────────

import { caiService } from '@/lib/services/invoicing/cai.service';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const COMPANY = '00000000-0000-0000-0000-000000000001';
const CAI_ID = '00000000-0000-0000-0000-000000000010';

const FUTURE_DATE = new Date(Date.now() + 1000 * 60 * 60 * 24 * 365); // +1 año
const PAST_DATE = new Date(Date.now() - 1000 * 60 * 60 * 24); // ayer

function makeCaiRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: CAI_ID,
    companyId: COMPANY,
    caiCode: 'ABC123-DEF456-GHI789-JKL012-MNO345-PQ',
    establishmentCode: '001',
    emissionPointCode: '001',
    documentType: '01',
    rangeFrom: 1,
    rangeTo: 1000,
    issuedAt: new Date('2026-01-01'),
    expiresAt: FUTURE_DATE,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    _count: { invoices: 0 },
    invoiceSequence: null,
    ...overrides,
  };
}

const VALID_CREATE_INPUT = {
  caiCode: 'ABC123-DEF456-GHI789-JKL012-MNO345-PQ',
  establishmentCode: '001',
  emissionPointCode: '001',
  documentType: '01' as const,
  rangeFrom: 1,
  rangeTo: 1000,
  issuedAt: '2026-01-01',
  expiresAt: '2027-01-01',
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('caiService.listCais', () => {
  beforeEach(() => vi.clearAllMocks());

  it('retorna lista mapeada', async () => {
    prismaMock.cAI.findMany.mockResolvedValue([makeCaiRecord()]);
    const result = await caiService.listCais(COMPANY);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(CAI_ID);
    expect(result[0].isExpired).toBe(false);
    expect(result[0].invoicesCount).toBe(0);
    expect(result[0].lastSequenceNumber).toBe(0);
  });

  it('marca isExpired=true para CAI vencido', async () => {
    prismaMock.cAI.findMany.mockResolvedValue([makeCaiRecord({ expiresAt: PAST_DATE })]);
    const result = await caiService.listCais(COMPANY);
    expect(result[0].isExpired).toBe(true);
  });
});

describe('caiService.getCai', () => {
  beforeEach(() => vi.clearAllMocks());

  it('retorna el CAI cuando existe', async () => {
    prismaMock.cAI.findFirst.mockResolvedValue(makeCaiRecord());
    const result = await caiService.getCai(COMPANY, CAI_ID);
    expect(result.id).toBe(CAI_ID);
  });

  it('lanza error si el CAI no existe', async () => {
    prismaMock.cAI.findFirst.mockResolvedValue(null);
    await expect(caiService.getCai(COMPANY, CAI_ID)).rejects.toThrow('CAI no encontrado');
  });
});

describe('caiService.createCai', () => {
  beforeEach(() => vi.clearAllMocks());

  it('lanza error si el caiCode ya existe en la empresa', async () => {
    prismaMock.cAI.findUnique.mockResolvedValue(makeCaiRecord());
    await expect(caiService.createCai(COMPANY, VALID_CREATE_INPUT)).rejects.toThrow(
      /ya está registrado/,
    );
    expect(prismaMock.cAI.create).not.toHaveBeenCalled();
  });

  it('desactiva el CAI activo anterior del mismo tipo de documento', async () => {
    prismaMock.cAI.findUnique.mockResolvedValue(null);
    prismaMock.cAI.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.cAI.create.mockResolvedValue(makeCaiRecord());

    await caiService.createCai(COMPANY, VALID_CREATE_INPUT);

    expect(prismaMock.cAI.updateMany).toHaveBeenCalledWith({
      where: { companyId: COMPANY, documentType: '01', isActive: true },
      data: { isActive: false },
    });
  });

  it('crea el CAI con isActive=true', async () => {
    prismaMock.cAI.findUnique.mockResolvedValue(null);
    prismaMock.cAI.updateMany.mockResolvedValue({ count: 0 });
    prismaMock.cAI.create.mockResolvedValue(makeCaiRecord());

    const result = await caiService.createCai(COMPANY, VALID_CREATE_INPUT);

    expect(prismaMock.cAI.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ isActive: true, companyId: COMPANY }),
      }),
    );
    expect(result.isActive).toBe(true);
  });
});

describe('caiService.updateCai', () => {
  beforeEach(() => vi.clearAllMocks());

  it('lanza error si el CAI no existe', async () => {
    prismaMock.cAI.findFirst.mockResolvedValue(null);
    await expect(caiService.updateCai(COMPANY, CAI_ID, { isActive: false })).rejects.toThrow(
      'CAI no encontrado',
    );
  });

  it('al activar, desactiva hermanos del mismo tipo de documento', async () => {
    prismaMock.cAI.findFirst.mockResolvedValue(makeCaiRecord({ isActive: false }));
    prismaMock.cAI.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.cAI.update.mockResolvedValue(makeCaiRecord({ isActive: true }));

    await caiService.updateCai(COMPANY, CAI_ID, { isActive: true });

    expect(prismaMock.cAI.updateMany).toHaveBeenCalledWith({
      where: {
        companyId: COMPANY,
        documentType: '01',
        isActive: true,
        id: { not: CAI_ID },
      },
      data: { isActive: false },
    });
  });

  it('al desactivar, NO llama updateMany', async () => {
    prismaMock.cAI.findFirst.mockResolvedValue(makeCaiRecord({ isActive: true }));
    prismaMock.cAI.update.mockResolvedValue(makeCaiRecord({ isActive: false }));

    await caiService.updateCai(COMPANY, CAI_ID, { isActive: false });

    expect(prismaMock.cAI.updateMany).not.toHaveBeenCalled();
  });
});

describe('caiService.getActiveCai', () => {
  beforeEach(() => vi.clearAllMocks());

  it('lanza error cuando no hay CAI activo para el tipo de documento', async () => {
    prismaMock.cAI.findFirst.mockResolvedValue(null);
    await expect(caiService.getActiveCai(COMPANY, '01')).rejects.toThrow(/No hay un CAI activo/);
  });

  it('lanza error cuando el CAI activo está vencido', async () => {
    prismaMock.cAI.findFirst.mockResolvedValue(makeCaiRecord({ expiresAt: PAST_DATE }));
    await expect(caiService.getActiveCai(COMPANY, '01')).rejects.toThrow(/vencido/);
  });

  it('lanza error cuando el rango está agotado (lastNumber >= rangeTo)', async () => {
    prismaMock.cAI.findFirst.mockResolvedValue(
      makeCaiRecord({
        rangeTo: 100,
        invoiceSequence: { lastNumber: 100 },
      }),
    );
    await expect(caiService.getActiveCai(COMPANY, '01')).rejects.toThrow(/agotado/);
  });

  it('retorna el CAI cuando es válido y tiene rango disponible', async () => {
    prismaMock.cAI.findFirst.mockResolvedValue(
      makeCaiRecord({
        invoiceSequence: { lastNumber: 50 },
      }),
    );
    const result = await caiService.getActiveCai(COMPANY, '01');
    expect(result.id).toBe(CAI_ID);
    expect(result.lastSequenceNumber).toBe(50);
  });
});
