// src/__tests__/unit/invoice-service.test.ts
/**
 * Tests unitarios del invoiceService (F3-tests).
 *
 * Cubre:
 * - createInvoice: lanza error si no hay CAI activo
 * - createInvoice: lanza error si tasa de impuesto no existe en la empresa
 * - createInvoice: calcula correctamente subtotal, ISV y total (15%)
 * - createInvoice: calcula correctamente con descuento
 * - createInvoice: calcula correctamente con tasa exenta (0%)
 * - updateInvoice: lanza error si factura no está en DRAFT
 * - deleteDraftInvoice: lanza error si factura no está en DRAFT
 * - publishInvoice: lanza error si factura no está en DRAFT
 * - publishInvoice: lanza error si no hay diario de ventas activo
 * - publishInvoice: lanza error si no hay período fiscal abierto
 * - cancelInvoice: lanza error si factura no está en PUBLISHED
 * - cancelInvoice: lanza error si motivo está vacío
 *
 * Sin conexión real a BD — Prisma mockeado con vi.hoisted.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Mock de Prisma ───────────────────────────────────────────────────────────

const { prismaMock } = vi.hoisted(() => {
  const txMock = {
    invoice: { create: vi.fn(), update: vi.fn(), findUnique: vi.fn() },
    invoiceLine: { deleteMany: vi.fn() },
    journalEntry: { create: vi.fn(), update: vi.fn(), findUnique: vi.fn() },
    fiscalPeriod: { findFirst: vi.fn() },
    $queryRaw: vi.fn().mockResolvedValue([{ last_number: 1 }]),
    $executeRaw: vi.fn().mockResolvedValue(0),
  };

  return {
    prismaMock: {
      invoice: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      invoiceLine: { deleteMany: vi.fn() },
      cAI: { findFirst: vi.fn() },
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

// Mock getNextInvoiceNumber to avoid deep CAI resolution in publishInvoice tests
vi.mock('@/lib/services/invoicing/sar-numbering.service', () => ({
  getNextInvoiceNumber: vi.fn().mockResolvedValue({
    invoiceNumber: '001-001-01-00000001',
    sequenceNumber: 1,
    caiId: '00000000-0000-0000-0000-000000000010',
  }),
}));

// ─── Imports ──────────────────────────────────────────────────────────────────

import { invoiceService } from '@/lib/services/invoicing/invoice.service';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const COMPANY = '00000000-0000-0000-0000-000000000001';
const USER_ID = '00000000-0000-0000-0000-000000000099';
const INVOICE_ID = '00000000-0000-0000-0000-000000000010';
const CAI_ID = '00000000-0000-0000-0000-000000000020';
const TAX_RATE_ID = '00000000-0000-0000-0000-000000000030';
const CONTACT_ID = '00000000-0000-0000-0000-000000000040';
const JOURNAL_ID = '00000000-0000-0000-0000-000000000050';
const _PERIOD_ID = '00000000-0000-0000-0000-000000000060';
const _ACCOUNT_AR = '00000000-0000-0000-0000-000000000071';
const _ACCOUNT_ISV = '00000000-0000-0000-0000-000000000072';
const _ACCOUNT_REV = '00000000-0000-0000-0000-000000000073';

function makeActiveCai() {
  return {
    id: CAI_ID,
    companyId: COMPANY,
    documentType: '01',
    rangeFrom: 1,
    rangeTo: 10000,
    isActive: true,
    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 365),
  };
}

function makeTaxRate(rate: string) {
  return { id: TAX_RATE_ID, companyId: COMPANY, code: 'ISV15', name: 'ISV 15%', rate };
}

function makeInvoiceRecord(status = 'DRAFT', overrides: Record<string, unknown> = {}) {
  return {
    id: INVOICE_ID,
    companyId: COMPANY,
    caiId: CAI_ID,
    invoiceType: 'FACTURA',
    status,
    invoiceNumber: status === 'DRAFT' ? null : '001-001-01-00000001',
    sequenceNumber: status === 'DRAFT' ? null : 1,
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
    issuedBy: null,
    issuedAt: null,
    cancelledBy: null,
    cancelledAt: null,
    cancelReason: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    cai: { caiCode: 'ABC123-DEF456-GHI789-JKL012-MNO345-PQ' },
    contact: { legalName: 'Cliente Test S.A.' },
    paymentTerms: null,
    lines: [],
    ...overrides,
  };
}

const ORIGINAL_INVOICE_ID = '00000000-0000-0000-0000-000000000011';

const VALID_CREATE_INPUT = {
  invoiceType: 'FACTURA' as const,
  issueDate: '2026-03-01',
  contactId: CONTACT_ID,
  currencyCode: 'HNL',
  exchangeRate: 1,
  lines: [
    {
      lineNumber: 1,
      description: 'Servicio de consultoría',
      quantity: 10,
      unitPrice: 100,
      discountPct: 0,
      taxRateId: TAX_RATE_ID,
    },
  ],
};

const VALID_NC_INPUT = {
  invoiceType: 'NOTA_CREDITO' as const,
  issueDate: '2026-03-15',
  contactId: CONTACT_ID,
  currencyCode: 'HNL',
  exchangeRate: 1,
  originalInvoiceId: ORIGINAL_INVOICE_ID,
  lines: [
    {
      lineNumber: 1,
      description: 'Devolución parcial',
      quantity: 5,
      unitPrice: 100,
      discountPct: 0,
      taxRateId: TAX_RATE_ID,
    },
  ],
};

// ─── Tests: createInvoice ─────────────────────────────────────────────────────

describe('invoiceService.createInvoice', () => {
  beforeEach(() => vi.clearAllMocks());

  it('lanza error si no hay CAI activo para el tipo de documento', async () => {
    prismaMock.cAI.findFirst.mockResolvedValue(null);

    await expect(
      invoiceService.createInvoice(COMPANY, USER_ID, VALID_CREATE_INPUT),
    ).rejects.toThrow(/No hay un CAI activo/);
  });

  it('lanza error si la tasa de impuesto no pertenece a la empresa', async () => {
    prismaMock.cAI.findFirst.mockResolvedValue(makeActiveCai());
    // Devuelve array vacío → taxRateIds.length !== taxRates.length
    prismaMock.taxRate.findMany.mockResolvedValue([]);

    await expect(
      invoiceService.createInvoice(COMPANY, USER_ID, VALID_CREATE_INPUT),
    ).rejects.toThrow(/tasas de impuesto/);
  });

  it('calcula correctamente subtotal, ISV 15% y total (sin descuento)', async () => {
    // 10 unidades × L100 = L1,000 subtotal; ISV 15% = L150; total = L1,150
    prismaMock.cAI.findFirst.mockResolvedValue(makeActiveCai());
    prismaMock.taxRate.findMany.mockResolvedValue([makeTaxRate('0.15')]);

    const createdInvoice = makeInvoiceRecord();
    prismaMock.$transaction.mockImplementation(async (fn: (tx: typeof prismaMock) => unknown) => {
      prismaMock.invoice.create.mockResolvedValue(createdInvoice);
      return fn(prismaMock);
    });

    await invoiceService.createInvoice(COMPANY, USER_ID, VALID_CREATE_INPUT);

    const createCall = prismaMock.invoice.create.mock.calls[0][0];
    // Use Number() to avoid Decimal trailing-zero differences ('1000' vs '1000.00')
    expect(Number(createCall.data.subtotal)).toBe(1000);
    expect(Number(createCall.data.taxAmount)).toBe(150);
    expect(Number(createCall.data.total)).toBe(1150);
  });

  it('calcula correctamente con descuento del 10%', async () => {
    // 10 × L100 × (1 - 0.10) = L900 subtotal; ISV 15% = L135; total = L1,035
    prismaMock.cAI.findFirst.mockResolvedValue(makeActiveCai());
    prismaMock.taxRate.findMany.mockResolvedValue([makeTaxRate('0.15')]);

    const inputWithDiscount = {
      ...VALID_CREATE_INPUT,
      lines: [{ ...VALID_CREATE_INPUT.lines[0], discountPct: 10 }],
    };

    prismaMock.$transaction.mockImplementation(async (fn: (tx: typeof prismaMock) => unknown) => {
      prismaMock.invoice.create.mockResolvedValue(makeInvoiceRecord());
      return fn(prismaMock);
    });

    await invoiceService.createInvoice(COMPANY, USER_ID, inputWithDiscount);

    const createCall = prismaMock.invoice.create.mock.calls[0][0];
    expect(Number(createCall.data.subtotal)).toBe(900);
    expect(Number(createCall.data.taxAmount)).toBe(135);
    expect(Number(createCall.data.total)).toBe(1035);
  });

  it('calcula correctamente con tasa exenta (0%)', async () => {
    // 10 × L100 = L1,000 subtotal; ISV 0% = L0; total = L1,000
    prismaMock.cAI.findFirst.mockResolvedValue(makeActiveCai());
    prismaMock.taxRate.findMany.mockResolvedValue([makeTaxRate('0.0000')]);

    prismaMock.$transaction.mockImplementation(async (fn: (tx: typeof prismaMock) => unknown) => {
      prismaMock.invoice.create.mockResolvedValue(makeInvoiceRecord());
      return fn(prismaMock);
    });

    await invoiceService.createInvoice(COMPANY, USER_ID, VALID_CREATE_INPUT);

    const createCall = prismaMock.invoice.create.mock.calls[0][0];
    expect(Number(createCall.data.subtotal)).toBe(1000);
    expect(Number(createCall.data.taxAmount)).toBe(0);
    expect(Number(createCall.data.total)).toBe(1000);
  });
});

// ─── Tests: updateInvoice ─────────────────────────────────────────────────────

describe('invoiceService.updateInvoice', () => {
  beforeEach(() => vi.clearAllMocks());

  it('lanza error si la factura no está en DRAFT', async () => {
    prismaMock.invoice.findFirst.mockResolvedValue(makeInvoiceRecord('PUBLISHED'));

    await expect(
      invoiceService.updateInvoice(COMPANY, INVOICE_ID, { notes: 'test' }),
    ).rejects.toThrow(/borrador/);
  });

  it('lanza error si la factura no existe', async () => {
    prismaMock.invoice.findFirst.mockResolvedValue(null);

    await expect(
      invoiceService.updateInvoice(COMPANY, INVOICE_ID, { notes: 'test' }),
    ).rejects.toThrow('Factura no encontrada');
  });
});

// ─── Tests: deleteDraftInvoice ────────────────────────────────────────────────

describe('invoiceService.deleteDraftInvoice', () => {
  beforeEach(() => vi.clearAllMocks());

  it('lanza error si la factura no está en DRAFT', async () => {
    prismaMock.invoice.findFirst.mockResolvedValue(makeInvoiceRecord('PUBLISHED'));

    await expect(invoiceService.deleteDraftInvoice(COMPANY, INVOICE_ID)).rejects.toThrow(
      /emitidas deben anularse/,
    );
  });

  it('lanza error si la factura no existe', async () => {
    prismaMock.invoice.findFirst.mockResolvedValue(null);

    await expect(invoiceService.deleteDraftInvoice(COMPANY, INVOICE_ID)).rejects.toThrow(
      'Factura no encontrada',
    );
  });

  it('elimina la factura DRAFT sin error', async () => {
    prismaMock.invoice.findFirst.mockResolvedValue(makeInvoiceRecord('DRAFT'));
    prismaMock.invoice.delete.mockResolvedValue({});

    await expect(invoiceService.deleteDraftInvoice(COMPANY, INVOICE_ID)).resolves.toBeUndefined();
    expect(prismaMock.invoice.delete).toHaveBeenCalledWith({ where: { id: INVOICE_ID } });
  });
});

// ─── Tests: publishInvoice ────────────────────────────────────────────────────

describe('invoiceService.publishInvoice', () => {
  beforeEach(() => vi.clearAllMocks());

  it('lanza error si la factura no está en DRAFT', async () => {
    prismaMock.invoice.findFirst.mockResolvedValue(makeInvoiceRecord('PUBLISHED'));

    await expect(invoiceService.publishInvoice(COMPANY, INVOICE_ID, USER_ID)).rejects.toThrow(
      /borrador pueden emitirse/,
    );
  });

  it('lanza error si la factura no existe', async () => {
    prismaMock.invoice.findFirst.mockResolvedValue(null);

    await expect(invoiceService.publishInvoice(COMPANY, INVOICE_ID, USER_ID)).rejects.toThrow(
      'Factura no encontrada',
    );
  });

  it('lanza error si no hay diario de ventas activo', async () => {
    prismaMock.invoice.findFirst.mockResolvedValue(
      makeInvoiceRecord('DRAFT', {
        lines: [],
        contact: { legalName: 'Test' },
        cai: { caiCode: 'X' },
      }),
    );
    prismaMock.journal.findFirst.mockResolvedValue(null);

    await expect(invoiceService.publishInvoice(COMPANY, INVOICE_ID, USER_ID)).rejects.toThrow(
      /diario de ventas activo/,
    );
  });

  it('lanza error si no hay período fiscal abierto para la fecha de emisión', async () => {
    prismaMock.invoice.findFirst.mockResolvedValue(
      makeInvoiceRecord('DRAFT', {
        lines: [],
        contact: { legalName: 'Test' },
        cai: { caiCode: 'X' },
      }),
    );
    prismaMock.journal.findFirst.mockResolvedValue({
      id: JOURNAL_ID,
      companyId: COMPANY,
      journalType: 'SALES',
      isActive: true,
    });
    prismaMock.fiscalPeriod.findFirst.mockResolvedValue(null);

    await expect(invoiceService.publishInvoice(COMPANY, INVOICE_ID, USER_ID)).rejects.toThrow(
      /período fiscal abierto/,
    );
  });
});

// ─── Tests: cancelInvoice ─────────────────────────────────────────────────────

describe('invoiceService.cancelInvoice', () => {
  beforeEach(() => vi.clearAllMocks());

  it('lanza error si la factura no está en PUBLISHED', async () => {
    prismaMock.invoice.findFirst.mockResolvedValue(makeInvoiceRecord('DRAFT'));

    await expect(
      invoiceService.cancelInvoice(COMPANY, INVOICE_ID, USER_ID, 'Error en datos'),
    ).rejects.toThrow(/emitidas pueden anularse/);
  });

  it('lanza error si la factura no existe', async () => {
    prismaMock.invoice.findFirst.mockResolvedValue(null);

    await expect(
      invoiceService.cancelInvoice(COMPANY, INVOICE_ID, USER_ID, 'Error en datos'),
    ).rejects.toThrow('Factura no encontrada');
  });

  it('lanza error si el motivo de anulación está vacío', async () => {
    prismaMock.invoice.findFirst.mockResolvedValue(makeInvoiceRecord('PUBLISHED'));

    await expect(invoiceService.cancelInvoice(COMPANY, INVOICE_ID, USER_ID, '   ')).rejects.toThrow(
      /motivo de anulación/,
    );
  });
});

// ─── Tests: Notas de Crédito (F3-08) ────────────────────────────────────────

describe('invoiceService.createInvoice — Notas de Crédito', () => {
  beforeEach(() => vi.clearAllMocks());

  it('lanza error si NOTA_CREDITO no tiene originalInvoiceId', async () => {
    prismaMock.cAI.findFirst.mockResolvedValue(makeActiveCai());

    const input = { ...VALID_NC_INPUT, originalInvoiceId: undefined };
    await expect(invoiceService.createInvoice(COMPANY, USER_ID, input)).rejects.toThrow(
      /notas de crédito requieren una factura original/,
    );
  });

  it('lanza error si NOTA_DEBITO no tiene originalInvoiceId', async () => {
    prismaMock.cAI.findFirst.mockResolvedValue(makeActiveCai());

    const input = {
      ...VALID_NC_INPUT,
      invoiceType: 'NOTA_DEBITO' as const,
      originalInvoiceId: undefined,
    };
    await expect(invoiceService.createInvoice(COMPANY, USER_ID, input)).rejects.toThrow(
      /notas de débito requieren una factura original/,
    );
  });

  it('lanza error si FACTURA tiene originalInvoiceId', async () => {
    prismaMock.cAI.findFirst.mockResolvedValue(makeActiveCai());

    const input = { ...VALID_CREATE_INPUT, originalInvoiceId: ORIGINAL_INVOICE_ID };
    await expect(invoiceService.createInvoice(COMPANY, USER_ID, input)).rejects.toThrow(
      /facturas regulares no deben referenciar/,
    );
  });

  it('lanza error si factura original no existe', async () => {
    prismaMock.cAI.findFirst.mockResolvedValue(makeActiveCai());
    prismaMock.invoice.findFirst.mockResolvedValue(null);

    await expect(invoiceService.createInvoice(COMPANY, USER_ID, VALID_NC_INPUT)).rejects.toThrow(
      'Factura original no encontrada',
    );
  });

  it('lanza error si factura original está en DRAFT', async () => {
    prismaMock.cAI.findFirst.mockResolvedValue(makeActiveCai());
    prismaMock.invoice.findFirst.mockResolvedValue(
      makeInvoiceRecord('DRAFT', { id: ORIGINAL_INVOICE_ID, corrections: [] }),
    );

    await expect(invoiceService.createInvoice(COMPANY, USER_ID, VALID_NC_INPUT)).rejects.toThrow(
      /facturas emitidas o pagadas/,
    );
  });

  it('lanza error si factura original está en CANCELLED', async () => {
    prismaMock.cAI.findFirst.mockResolvedValue(makeActiveCai());
    prismaMock.invoice.findFirst.mockResolvedValue(
      makeInvoiceRecord('CANCELLED', { id: ORIGINAL_INVOICE_ID, corrections: [] }),
    );

    await expect(invoiceService.createInvoice(COMPANY, USER_ID, VALID_NC_INPUT)).rejects.toThrow(
      /facturas emitidas o pagadas/,
    );
  });

  it('permite NC contra factura PUBLISHED', async () => {
    prismaMock.cAI.findFirst.mockResolvedValue(makeActiveCai());
    // First findFirst call: original invoice validation (step 2)
    // Second findFirst call: NC amount validation (step 4b)
    prismaMock.invoice.findFirst
      .mockResolvedValueOnce(
        makeInvoiceRecord('PUBLISHED', { id: ORIGINAL_INVOICE_ID, corrections: [] }),
      )
      .mockResolvedValueOnce(
        makeInvoiceRecord('PUBLISHED', { id: ORIGINAL_INVOICE_ID, corrections: [] }),
      );
    prismaMock.taxRate.findMany.mockResolvedValue([makeTaxRate('0.15')]);

    prismaMock.$transaction.mockImplementation(async (fn: (tx: typeof prismaMock) => unknown) => {
      prismaMock.invoice.create.mockResolvedValue(
        makeInvoiceRecord('DRAFT', { invoiceType: 'NOTA_CREDITO' }),
      );
      return fn(prismaMock);
    });

    await expect(
      invoiceService.createInvoice(COMPANY, USER_ID, VALID_NC_INPUT),
    ).resolves.toBeDefined();
  });

  it('lanza error si NC excede saldo disponible de factura original', async () => {
    prismaMock.cAI.findFirst.mockResolvedValue(makeActiveCai());
    // Original invoice: total = 1150, already credited = 1000
    prismaMock.invoice.findFirst
      .mockResolvedValueOnce(
        makeInvoiceRecord('PUBLISHED', {
          id: ORIGINAL_INVOICE_ID,
          corrections: [],
        }),
      )
      .mockResolvedValueOnce(
        makeInvoiceRecord('PUBLISHED', {
          id: ORIGINAL_INVOICE_ID,
          corrections: [{ total: '1000.00' }],
        }),
      );
    prismaMock.taxRate.findMany.mockResolvedValue([makeTaxRate('0.15')]);

    // NC for 5 units × 100 = 500 subtotal + 75 ISV = 575
    // Remaining = 1150 - 1000 = 150. NC total 575 > 150 → should fail
    await expect(invoiceService.createInvoice(COMPANY, USER_ID, VALID_NC_INPUT)).rejects.toThrow(
      /excede el saldo disponible/,
    );
  });
});
