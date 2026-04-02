// src/__tests__/unit/supplier-invoice-service.test.ts
/**
 * Tests unitarios del supplierInvoiceService (F3-07).
 *
 * Cubre:
 * - createSupplierInvoice: lanza error si contacto no es proveedor
 * - createSupplierInvoice: lanza error si tasa de impuesto no existe
 * - createSupplierInvoice: calcula correctamente subtotal, ISV 15% y total
 * - createSupplierInvoice: lanza error si NOTA_CREDITO_COMPRA sin originalInvoiceId
 * - createSupplierInvoice: lanza error si FACTURA_COMPRA tiene originalInvoiceId
 * - postSupplierInvoice: lanza error si no está en DRAFT
 * - postSupplierInvoice: lanza error si no hay diario de compras activo
 * - postSupplierInvoice: lanza error si no hay período fiscal abierto
 * - postSupplierInvoice: lanza error si no hay cuenta de Cuentas por Pagar
 * - cancelSupplierInvoice: lanza error si no está en POSTED
 * - cancelSupplierInvoice: lanza error si motivo está vacío
 * - deleteDraftSupplierInvoice: elimina en DRAFT sin error
 * - deleteDraftSupplierInvoice: lanza error si no está en DRAFT
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Mock de Prisma ───────────────────────────────────────────────────────────

const { prismaMock } = vi.hoisted(() => {
  const txMock = {
    supplierInvoice: { create: vi.fn(), update: vi.fn(), findUnique: vi.fn() },
    supplierInvoiceLine: { deleteMany: vi.fn() },
    journalEntry: { create: vi.fn(), update: vi.fn(), findUnique: vi.fn() },
    fiscalPeriod: { findFirst: vi.fn() },
    $queryRaw: vi.fn().mockResolvedValue([{ last_number: 1 }]),
    $executeRaw: vi.fn().mockResolvedValue(0),
  };

  return {
    prismaMock: {
      supplierInvoice: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      supplierInvoiceLine: { deleteMany: vi.fn() },
      contact: { findFirst: vi.fn() },
      taxRate: { findMany: vi.fn() },
      journal: { findFirst: vi.fn() },
      fiscalPeriod: { findFirst: vi.fn() },
      account: { findFirst: vi.fn() },
      journalEntry: {
        create: vi.fn(),
        update: vi.fn(),
        findUnique: vi.fn(),
      },
      $queryRaw: vi.fn().mockResolvedValue([{ last_number: 1 }]),
      $executeRaw: vi.fn().mockResolvedValue(0),
      $transaction: vi.fn().mockImplementation((fn) => {
        if (typeof fn === 'function') return fn(txMock);
        return Promise.all(fn);
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

import { supplierInvoiceService } from '@/lib/services/invoicing/supplier-invoice.service';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const COMPANY = '00000000-0000-0000-0000-000000000001';
const USER_ID = '00000000-0000-0000-0000-000000000099';
const INVOICE_ID = '00000000-0000-0000-0000-000000000010';
const ORIGINAL_ID = '00000000-0000-0000-0000-000000000011';
const TAX_RATE_ID = '00000000-0000-0000-0000-000000000030';
const CONTACT_ID = '00000000-0000-0000-0000-000000000040';
const JOURNAL_ID = '00000000-0000-0000-0000-000000000050';
const _ACCOUNT_AP = '00000000-0000-0000-0000-000000000071';
const ACCOUNT_EXP = '00000000-0000-0000-0000-000000000072';
const _ACCOUNT_ISV = '00000000-0000-0000-0000-000000000073';

function makeSupplierContact() {
  return { id: CONTACT_ID, companyId: COMPANY, legalName: 'Proveedor S.A.', isSupplier: true };
}

function makeTaxRate(rate: string) {
  return { id: TAX_RATE_ID, companyId: COMPANY, code: 'ISV15', name: 'ISV 15%', rate };
}

function makeInvoiceRecord(status = 'DRAFT', overrides: Record<string, unknown> = {}) {
  return {
    id: INVOICE_ID,
    companyId: COMPANY,
    invoiceType: 'FACTURA_COMPRA',
    status,
    supplierInvoiceNumber: 'F-001-001',
    issueDate: new Date('2026-03-01'),
    dueDate: null,
    contactId: CONTACT_ID,
    paymentTermsId: null,
    currencyCode: 'HNL',
    exchangeRate: '1.000000',
    subtotal: '1000.00',
    taxAmount: '150.00',
    total: '1150.00',
    notes: null,
    journalEntryId: null,
    originalInvoiceId: null,
    createdBy: USER_ID,
    postedBy: null,
    postedAt: null,
    cancelledBy: null,
    cancelledAt: null,
    cancelReason: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    contact: { legalName: 'Proveedor S.A.' },
    paymentTerms: null,
    lines: [],
    ...overrides,
  };
}

const VALID_CREATE_INPUT = {
  invoiceType: 'FACTURA_COMPRA' as const,
  issueDate: '2026-03-01',
  contactId: CONTACT_ID,
  currencyCode: 'HNL',
  exchangeRate: 1,
  lines: [
    {
      lineNumber: 1,
      description: 'Compra de materiales',
      quantity: 10,
      unitPrice: 100,
      discountPct: 0,
      taxRateId: TAX_RATE_ID,
      accountId: ACCOUNT_EXP,
    },
  ],
};

// ─── Tests: createSupplierInvoice ─────────────────────────────────────────────

describe('supplierInvoiceService.createSupplierInvoice', () => {
  beforeEach(() => vi.clearAllMocks());

  it('lanza error si contacto no existe o no es proveedor', async () => {
    prismaMock.contact.findFirst.mockResolvedValue(null);

    await expect(
      supplierInvoiceService.createSupplierInvoice(COMPANY, USER_ID, VALID_CREATE_INPUT),
    ).rejects.toThrow(/no está marcado como proveedor/);
  });

  it('lanza error si tasa de impuesto no pertenece a la empresa', async () => {
    prismaMock.contact.findFirst.mockResolvedValue(makeSupplierContact());
    prismaMock.supplierInvoice.findFirst.mockResolvedValue(null); // no original
    prismaMock.taxRate.findMany.mockResolvedValue([]);

    await expect(
      supplierInvoiceService.createSupplierInvoice(COMPANY, USER_ID, VALID_CREATE_INPUT),
    ).rejects.toThrow(/tasas de impuesto/);
  });

  it('calcula correctamente subtotal, ISV 15% y total', async () => {
    prismaMock.contact.findFirst.mockResolvedValue(makeSupplierContact());
    prismaMock.taxRate.findMany.mockResolvedValue([makeTaxRate('0.15')]);

    const created = makeInvoiceRecord();
    prismaMock.$transaction.mockImplementation(async (fn: (tx: typeof prismaMock) => unknown) => {
      prismaMock.supplierInvoice.create.mockResolvedValue(created);
      return fn(prismaMock);
    });

    await supplierInvoiceService.createSupplierInvoice(COMPANY, USER_ID, VALID_CREATE_INPUT);

    const createCall = prismaMock.supplierInvoice.create.mock.calls[0][0];
    expect(Number(createCall.data.subtotal)).toBe(1000);
    expect(Number(createCall.data.taxAmount)).toBe(150);
    expect(Number(createCall.data.total)).toBe(1150);
  });

  it('lanza error si NOTA_CREDITO_COMPRA sin originalInvoiceId', async () => {
    prismaMock.contact.findFirst.mockResolvedValue(makeSupplierContact());

    await expect(
      supplierInvoiceService.createSupplierInvoice(COMPANY, USER_ID, {
        ...VALID_CREATE_INPUT,
        invoiceType: 'NOTA_CREDITO_COMPRA',
      }),
    ).rejects.toThrow(/notas de crédito de compra requieren/);
  });

  it('lanza error si FACTURA_COMPRA tiene originalInvoiceId', async () => {
    prismaMock.contact.findFirst.mockResolvedValue(makeSupplierContact());

    await expect(
      supplierInvoiceService.createSupplierInvoice(COMPANY, USER_ID, {
        ...VALID_CREATE_INPUT,
        originalInvoiceId: ORIGINAL_ID,
      }),
    ).rejects.toThrow(/solo las notas de crédito/i);
  });
});

// ─── Tests: postSupplierInvoice ───────────────────────────────────────────────

describe('supplierInvoiceService.postSupplierInvoice', () => {
  beforeEach(() => vi.clearAllMocks());

  it('lanza error si factura no está en DRAFT', async () => {
    prismaMock.supplierInvoice.findFirst.mockResolvedValue(makeInvoiceRecord('POSTED'));

    await expect(
      supplierInvoiceService.postSupplierInvoice(COMPANY, INVOICE_ID, USER_ID),
    ).rejects.toThrow(/borrador pueden registrarse/);
  });

  it('lanza error si factura no existe', async () => {
    prismaMock.supplierInvoice.findFirst.mockResolvedValue(null);

    await expect(
      supplierInvoiceService.postSupplierInvoice(COMPANY, INVOICE_ID, USER_ID),
    ).rejects.toThrow('Factura de compra no encontrada');
  });

  it('lanza error si no hay diario de compras activo', async () => {
    prismaMock.supplierInvoice.findFirst.mockResolvedValue(
      makeInvoiceRecord('DRAFT', { lines: [], contact: { legalName: 'Proveedor' } }),
    );
    prismaMock.journal.findFirst.mockResolvedValue(null);

    await expect(
      supplierInvoiceService.postSupplierInvoice(COMPANY, INVOICE_ID, USER_ID),
    ).rejects.toThrow(/diario de compras activo/);
  });

  it('lanza error si no hay período fiscal abierto', async () => {
    prismaMock.supplierInvoice.findFirst.mockResolvedValue(
      makeInvoiceRecord('DRAFT', { lines: [], contact: { legalName: 'Proveedor' } }),
    );
    prismaMock.journal.findFirst.mockResolvedValue({
      id: JOURNAL_ID,
      companyId: COMPANY,
      journalType: 'PURCHASES',
      isActive: true,
    });
    prismaMock.fiscalPeriod.findFirst.mockResolvedValue(null);

    await expect(
      supplierInvoiceService.postSupplierInvoice(COMPANY, INVOICE_ID, USER_ID),
    ).rejects.toThrow(/período fiscal abierto/);
  });

  it('lanza error si no hay cuenta de Cuentas por Pagar', async () => {
    prismaMock.supplierInvoice.findFirst.mockResolvedValue(
      makeInvoiceRecord('DRAFT', { lines: [], contact: { legalName: 'Proveedor' } }),
    );
    prismaMock.journal.findFirst.mockResolvedValue({
      id: JOURNAL_ID,
      companyId: COMPANY,
      journalType: 'PURCHASES',
      isActive: true,
    });
    prismaMock.fiscalPeriod.findFirst.mockResolvedValue({
      id: '00000000-0000-0000-0000-000000000060',
      companyId: COMPANY,
      status: 'OPEN',
      startDate: new Date('2026-03-01'),
      endDate: new Date('2026-03-31'),
    });
    // All account lookups return null → AP not found → should throw
    prismaMock.account.findFirst.mockResolvedValue(null);

    await expect(
      supplierInvoiceService.postSupplierInvoice(COMPANY, INVOICE_ID, USER_ID),
    ).rejects.toThrow(/Cuentas por Pagar no encontrada/);
  });
});

// ─── Tests: cancelSupplierInvoice ─────────────────────────────────────────────

describe('supplierInvoiceService.cancelSupplierInvoice', () => {
  beforeEach(() => vi.clearAllMocks());

  it('lanza error si factura no está en POSTED', async () => {
    prismaMock.supplierInvoice.findFirst.mockResolvedValue(makeInvoiceRecord('DRAFT'));

    await expect(
      supplierInvoiceService.cancelSupplierInvoice(COMPANY, INVOICE_ID, USER_ID, 'Error'),
    ).rejects.toThrow(/registradas pueden anularse/);
  });

  it('lanza error si factura no existe', async () => {
    prismaMock.supplierInvoice.findFirst.mockResolvedValue(null);

    await expect(
      supplierInvoiceService.cancelSupplierInvoice(COMPANY, INVOICE_ID, USER_ID, 'Error'),
    ).rejects.toThrow('Factura de compra no encontrada');
  });

  it('lanza error si motivo de anulación está vacío', async () => {
    prismaMock.supplierInvoice.findFirst.mockResolvedValue(makeInvoiceRecord('POSTED'));

    await expect(
      supplierInvoiceService.cancelSupplierInvoice(COMPANY, INVOICE_ID, USER_ID, '   '),
    ).rejects.toThrow(/motivo de anulación/);
  });
});

// ─── Tests: deleteDraftSupplierInvoice ────────────────────────────────────────

describe('supplierInvoiceService.deleteDraftSupplierInvoice', () => {
  beforeEach(() => vi.clearAllMocks());

  it('elimina la factura DRAFT sin error', async () => {
    prismaMock.supplierInvoice.findFirst.mockResolvedValue(makeInvoiceRecord('DRAFT'));
    prismaMock.supplierInvoice.delete.mockResolvedValue({});

    await expect(
      supplierInvoiceService.deleteDraftSupplierInvoice(COMPANY, INVOICE_ID),
    ).resolves.toBeUndefined();
    expect(prismaMock.supplierInvoice.delete).toHaveBeenCalledWith({ where: { id: INVOICE_ID } });
  });

  it('lanza error si factura no está en DRAFT', async () => {
    prismaMock.supplierInvoice.findFirst.mockResolvedValue(makeInvoiceRecord('POSTED'));

    await expect(
      supplierInvoiceService.deleteDraftSupplierInvoice(COMPANY, INVOICE_ID),
    ).rejects.toThrow(/registradas deben anularse/);
  });

  it('lanza error si factura no existe', async () => {
    prismaMock.supplierInvoice.findFirst.mockResolvedValue(null);

    await expect(
      supplierInvoiceService.deleteDraftSupplierInvoice(COMPANY, INVOICE_ID),
    ).rejects.toThrow('Factura de compra no encontrada');
  });
});
