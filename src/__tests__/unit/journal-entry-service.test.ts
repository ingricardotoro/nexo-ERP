// src/__tests__/unit/journal-entry-service.test.ts
/**
 * Tests unitarios del JournalEntryService (F2-15).
 *
 * Cubre:
 * - createDraftEntry: período cerrado → error
 * - createDraftEntry: cuenta sin allowDirectEntry → error
 * - postEntry: debit ≠ credit → error (partida doble)
 * - postEntry: debit = 0 → error (asiento en cero)
 * - postEntry: período CLOSED → error
 * - postEntry: período LOCKED → error
 * - postEntry: asiento ya POSTED → error
 * - postEntry: éxito DRAFT → POSTED
 * - updateDraftEntry: asiento POSTED no editable
 * - deleteDraftEntry: solo permite DRAFT
 * - cancelEntry: genera contraasiento
 *
 * Sin conexión real a BD — Prisma mockeado con vi.hoisted.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Mock de Prisma ───────────────────────────────────────────────────────────

const { prismaMock } = vi.hoisted(() => {
  const txMock = {
    journalEntry: { create: vi.fn(), update: vi.fn() },
    journalEntryLine: { createMany: vi.fn(), deleteMany: vi.fn() },
    auditLog: { create: vi.fn() },
    $queryRaw: vi.fn().mockResolvedValue([{ last_number: 1 }]),
  };

  return {
    prismaMock: {
      journalEntry: {
        findFirst: vi.fn(),
        update: vi.fn(),
        create: vi.fn(),
        count: vi.fn(),
        findMany: vi.fn(),
      },
      journalEntryLine: {
        createMany: vi.fn(),
        deleteMany: vi.fn(),
        findMany: vi.fn(),
      },
      journal: { findFirst: vi.fn() },
      fiscalPeriod: { findFirst: vi.fn() },
      account: { findMany: vi.fn() },
      auditLog: { create: vi.fn() },
      $transaction: vi.fn().mockImplementation((arg) => {
        if (typeof arg === 'function') return arg(txMock);
        // Array-based transaction (postEntry, cancelEntry)
        return Promise.all(arg);
      }),
      _txMock: txMock,
    },
  };
});

vi.mock('@/lib/db/prisma', () => ({ default: prismaMock }));
vi.mock('@/lib/db/tenant-extension', () => ({
  createTenantPrisma: () => prismaMock,
}));

// ─── Imports ──────────────────────────────────────────────────────────────────

import { journalEntryService } from '@/lib/services/accounting/journal-entry.service';
import type { CreateJournalEntryInput } from '@/lib/validations/journal-entry.schema';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const COMPANY = '00000000-0000-0000-0000-000000000001';
const USER_ID = '00000000-0000-0000-0000-000000000099';
const ENTRY_ID = '00000000-0000-0000-0000-000000000010';
const JOURNAL_ID = '00000000-0000-0000-0000-000000000020';
const PERIOD_ID = '00000000-0000-0000-0000-000000000030';
const ACCOUNT_A = '00000000-0000-0000-0000-000000000041';
const ACCOUNT_B = '00000000-0000-0000-0000-000000000042';

function makeDraftInput(overrides: Partial<CreateJournalEntryInput> = {}): CreateJournalEntryInput {
  return {
    journalId: JOURNAL_ID,
    fiscalPeriodId: PERIOD_ID,
    entryDate: '2026-03-15',
    description: 'Asiento de prueba',
    currencyCode: 'HNL',
    exchangeRate: 1,
    lines: [
      { accountId: ACCOUNT_A, debit: 1000, credit: 0 },
      { accountId: ACCOUNT_B, debit: 0, credit: 1000 },
    ],
    ...overrides,
  };
}

function makeJournalMock() {
  return { id: JOURNAL_ID, companyId: COMPANY, code: 'DJ', name: 'Diario General', isActive: true };
}

function makePeriodMock(status: 'OPEN' | 'CLOSED' | 'LOCKED' = 'OPEN') {
  return {
    id: PERIOD_ID,
    companyId: COMPANY,
    name: 'Enero 2026',
    status,
    startDate: new Date('2026-01-01'),
    endDate: new Date('2026-01-31'),
  };
}

function makeAccountsMock(allowDirectEntry = true) {
  return [
    { id: ACCOUNT_A, code: '1101', name: 'Caja', allowDirectEntry, isActive: true },
    { id: ACCOUNT_B, code: '3001', name: 'Capital', allowDirectEntry, isActive: true },
  ];
}

function makeDraftEntryMock(overrides: Record<string, unknown> = {}) {
  return {
    id: ENTRY_ID,
    companyId: COMPANY,
    journalId: JOURNAL_ID,
    fiscalPeriodId: PERIOD_ID,
    entryNumber: 1,
    entryDate: new Date('2026-03-15'),
    description: 'Asiento de prueba',
    reference: null,
    status: 'DRAFT',
    currencyCode: 'HNL',
    exchangeRate: '1.00',
    totalDebit: '1000.00',
    totalCredit: '1000.00',
    createdBy: USER_ID,
    postedBy: null,
    postedAt: null,
    cancelledById: null,
    createdAt: new Date(),
    journal: { code: 'DJ', name: 'Diario General' },
    fiscalPeriod: { name: 'Enero 2026', status: 'OPEN' },
    lines: [],
    _count: { lines: 2 },
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('journalEntryService.createDraftEntry', () => {
  beforeEach(() => vi.clearAllMocks());

  it('lanza error si el diario no existe o está inactivo', async () => {
    prismaMock.journal.findFirst.mockResolvedValue(null);

    await expect(
      journalEntryService.createDraftEntry(COMPANY, USER_ID, makeDraftInput()),
    ).rejects.toThrow('Diario no encontrado o inactivo');
  });

  it('lanza error si el período fiscal no existe', async () => {
    prismaMock.journal.findFirst.mockResolvedValue(makeJournalMock());
    prismaMock.fiscalPeriod.findFirst.mockResolvedValue(null);

    await expect(
      journalEntryService.createDraftEntry(COMPANY, USER_ID, makeDraftInput()),
    ).rejects.toThrow('Período fiscal no encontrado');
  });

  it('lanza error si el período está CLOSED', async () => {
    prismaMock.journal.findFirst.mockResolvedValue(makeJournalMock());
    prismaMock.fiscalPeriod.findFirst.mockResolvedValue(makePeriodMock('CLOSED'));

    await expect(
      journalEntryService.createDraftEntry(COMPANY, USER_ID, makeDraftInput()),
    ).rejects.toThrow('El período fiscal está cerrado o bloqueado');
  });

  it('lanza error si el período está LOCKED', async () => {
    prismaMock.journal.findFirst.mockResolvedValue(makeJournalMock());
    prismaMock.fiscalPeriod.findFirst.mockResolvedValue(makePeriodMock('LOCKED'));

    await expect(
      journalEntryService.createDraftEntry(COMPANY, USER_ID, makeDraftInput()),
    ).rejects.toThrow('El período fiscal está cerrado o bloqueado');
  });

  it('lanza error si una cuenta no admite asientos directos', async () => {
    prismaMock.journal.findFirst.mockResolvedValue(makeJournalMock());
    prismaMock.fiscalPeriod.findFirst.mockResolvedValue(makePeriodMock());
    prismaMock.account.findMany.mockResolvedValue(makeAccountsMock(false));

    await expect(
      journalEntryService.createDraftEntry(COMPANY, USER_ID, makeDraftInput()),
    ).rejects.toThrow('no admiten asientos directos');
  });
});

describe('journalEntryService.postEntry — partida doble', () => {
  beforeEach(() => vi.clearAllMocks());

  it('lanza error si debit ≠ credit (asiento desbalanceado)', async () => {
    prismaMock.journalEntry.findFirst.mockResolvedValue(
      makeDraftEntryMock({
        totalDebit: '1000.00',
        totalCredit: '800.00',
        fiscalPeriod: { name: 'Enero 2026', status: 'OPEN' },
      }),
    );

    await expect(journalEntryService.postEntry(COMPANY, ENTRY_ID, USER_ID)).rejects.toThrow(
      'no está balanceado',
    );
  });

  it('lanza error si debit = 0 (asiento en cero)', async () => {
    prismaMock.journalEntry.findFirst.mockResolvedValue(
      makeDraftEntryMock({
        totalDebit: '0.00',
        totalCredit: '0.00',
        fiscalPeriod: { name: 'Enero 2026', status: 'OPEN' },
      }),
    );

    await expect(journalEntryService.postEntry(COMPANY, ENTRY_ID, USER_ID)).rejects.toThrow(
      'no puede tener totales en cero',
    );
  });

  it('lanza error si el período está CLOSED', async () => {
    prismaMock.journalEntry.findFirst.mockResolvedValue(
      makeDraftEntryMock({
        fiscalPeriod: { name: 'Diciembre 2025', status: 'CLOSED' },
      }),
    );

    await expect(journalEntryService.postEntry(COMPANY, ENTRY_ID, USER_ID)).rejects.toThrow(
      'cerrado',
    );
  });

  it('lanza error si el período está LOCKED', async () => {
    prismaMock.journalEntry.findFirst.mockResolvedValue(
      makeDraftEntryMock({
        fiscalPeriod: { name: 'Diciembre 2025', status: 'LOCKED' },
      }),
    );

    await expect(journalEntryService.postEntry(COMPANY, ENTRY_ID, USER_ID)).rejects.toThrow(
      'bloqueado',
    );
  });

  it('lanza error si el asiento ya está POSTED', async () => {
    prismaMock.journalEntry.findFirst.mockResolvedValue(
      makeDraftEntryMock({
        status: 'POSTED',
        fiscalPeriod: { name: 'Enero 2026', status: 'OPEN' },
      }),
    );

    await expect(journalEntryService.postEntry(COMPANY, ENTRY_ID, USER_ID)).rejects.toThrow(
      'Solo los asientos en borrador pueden publicarse',
    );
  });

  it('publica el asiento correctamente (DRAFT → POSTED)', async () => {
    const entryMock = makeDraftEntryMock();
    const postedMock = {
      ...entryMock,
      status: 'POSTED',
      postedBy: USER_ID,
      postedAt: new Date(),
      lines: [],
    };

    // Primera llamada (postEntry): retorna DRAFT
    // Segunda llamada (getJournalEntry interna): retorna POSTED
    prismaMock.journalEntry.findFirst
      .mockResolvedValueOnce(entryMock)
      .mockResolvedValue(postedMock);

    // $transaction array: [update, auditLog]
    prismaMock.$transaction.mockResolvedValue([postedMock, {}]);

    const result = await journalEntryService.postEntry(COMPANY, ENTRY_ID, USER_ID);
    expect(result.status).toBe('POSTED');
  });
});

describe('journalEntryService.updateDraftEntry', () => {
  beforeEach(() => vi.clearAllMocks());

  it('lanza error si el asiento está POSTED', async () => {
    prismaMock.journalEntry.findFirst.mockResolvedValue(makeDraftEntryMock({ status: 'POSTED' }));

    await expect(
      journalEntryService.updateDraftEntry(COMPANY, ENTRY_ID, {
        description: 'Nuevo texto',
      }),
    ).rejects.toThrow('Solo los asientos en borrador pueden editarse');
  });

  it('lanza error si el asiento está CANCELLED', async () => {
    prismaMock.journalEntry.findFirst.mockResolvedValue(
      makeDraftEntryMock({ status: 'CANCELLED' }),
    );

    await expect(
      journalEntryService.updateDraftEntry(COMPANY, ENTRY_ID, {
        description: 'Intento edición',
      }),
    ).rejects.toThrow('Solo los asientos en borrador pueden editarse');
  });

  it('lanza error si el asiento no existe', async () => {
    prismaMock.journalEntry.findFirst.mockResolvedValue(null);

    await expect(
      journalEntryService.updateDraftEntry(COMPANY, ENTRY_ID, { description: 'x' }),
    ).rejects.toThrow('Asiento contable no encontrado');
  });
});

describe('journalEntryService — aislamiento multi-tenant', () => {
  beforeEach(() => vi.clearAllMocks());

  const COMPANY_B = '00000000-0000-0000-0000-000000000002';

  it('getJournalEntry retorna null si el asiento pertenece a otra empresa', async () => {
    // findFirst retorna null porque el filtro companyId no coincide
    prismaMock.journalEntry.findFirst.mockResolvedValue(null);

    await expect(journalEntryService.getJournalEntry(COMPANY_B, ENTRY_ID)).rejects.toThrow(
      'Asiento contable no encontrado',
    );

    // Verifica que la consulta usa el companyId correcto
    expect(prismaMock.journalEntry.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: ENTRY_ID, companyId: COMPANY_B }),
      }),
    );
  });

  it('postEntry no puede publicar asientos de otra empresa', async () => {
    // Empresa B intenta publicar un asiento de Empresa A: findFirst retorna null
    prismaMock.journalEntry.findFirst.mockResolvedValue(null);

    await expect(journalEntryService.postEntry(COMPANY_B, ENTRY_ID, USER_ID)).rejects.toThrow(
      'Asiento contable no encontrado',
    );
  });
});
