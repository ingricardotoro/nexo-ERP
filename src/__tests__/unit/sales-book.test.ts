// src/__tests__/unit/sales-book.test.ts
/**
 * Tests unitarios del salesBookService (F3-10/F3-11).
 *
 * Cubre:
 * - getSalesBook: lanza error si período fiscal no existe
 * - getSalesBook: retorna libro vacío si no hay facturas
 * - getSalesBook: clasifica correctamente ventas exentas, gravadas 15% y 18%
 * - getSalesBook: facturas anuladas aparecen con montos en cero
 * - getSalesBook: calcula totales de resumen correctamente
 * - generateDetCsv: genera formato pipe-delimited correcto
 * - generateDetCsv: lanza error si empresa no existe
 * - generateDetCsv: maneja RTN de cliente null (extranjero)
 *
 * Sin conexión real a BD — Prisma mockeado con vi.hoisted.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Decimal } from '@prisma/client/runtime/library';

// ─── Mock de Prisma ───────────────────────────────────────────────────────────

const { prismaMock } = vi.hoisted(() => {
  return {
    prismaMock: {
      fiscalPeriod: { findFirst: vi.fn() },
      invoice: { findMany: vi.fn() },
      company: { findFirst: vi.fn() },
    },
  };
});

vi.mock('@/lib/db/prisma', () => ({ default: prismaMock }));
vi.mock('@/lib/db/tenant-extension', () => ({
  createTenantPrisma: () => prismaMock,
}));

// ─── Imports ──────────────────────────────────────────────────────────────────

import { salesBookService } from '@/lib/services/invoicing/sales-book.service';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const COMPANY = '00000000-0000-0000-0000-000000000001';
const PERIOD_ID = '00000000-0000-0000-0000-000000000060';

const PERIOD = {
  id: PERIOD_ID,
  name: 'Marzo 2026',
  startDate: new Date('2026-03-01'),
  endDate: new Date('2026-03-31'),
};

function makeInvoice(overrides: Record<string, unknown> = {}) {
  return {
    id: '00000000-0000-0000-0000-000000000010',
    companyId: COMPANY,
    invoiceType: 'FACTURA',
    status: 'PUBLISHED',
    invoiceNumber: '001-001-01-00000001',
    sequenceNumber: 1,
    issueDate: new Date('2026-03-15'),
    total: new Decimal('1150.00'),
    contact: { legalName: 'Cliente Test S.A.', rtn: '08011985123456' },
    lines: [
      {
        subtotal: new Decimal('1000.00'),
        taxAmount: new Decimal('150.00'),
        taxRate: { rate: new Decimal('0.1500') },
      },
    ],
    ...overrides,
  };
}

function makeExemptInvoice() {
  return makeInvoice({
    id: '00000000-0000-0000-0000-000000000011',
    invoiceNumber: '001-001-01-00000002',
    sequenceNumber: 2,
    total: new Decimal('500.00'),
    lines: [
      {
        subtotal: new Decimal('500.00'),
        taxAmount: new Decimal('0.00'),
        taxRate: { rate: new Decimal('0.0000') },
      },
    ],
  });
}

function makeInvoice18() {
  return makeInvoice({
    id: '00000000-0000-0000-0000-000000000012',
    invoiceNumber: '001-001-01-00000003',
    sequenceNumber: 3,
    total: new Decimal('590.00'),
    lines: [
      {
        subtotal: new Decimal('500.00'),
        taxAmount: new Decimal('90.00'),
        taxRate: { rate: new Decimal('0.1800') },
      },
    ],
  });
}

function makeCancelledInvoice() {
  return makeInvoice({
    id: '00000000-0000-0000-0000-000000000013',
    invoiceNumber: '001-001-01-00000004',
    sequenceNumber: 4,
    status: 'CANCELLED',
    total: new Decimal('1150.00'),
  });
}

// ─── Tests: getSalesBook ─────────────────────────────────────────────────────

describe('salesBookService.getSalesBook', () => {
  beforeEach(() => vi.clearAllMocks());

  it('lanza error si período fiscal no existe', async () => {
    prismaMock.fiscalPeriod.findFirst.mockResolvedValue(null);

    await expect(salesBookService.getSalesBook(COMPANY, PERIOD_ID)).rejects.toThrow(
      'Período fiscal no encontrado',
    );
  });

  it('retorna libro vacío si no hay facturas en el período', async () => {
    prismaMock.fiscalPeriod.findFirst.mockResolvedValue(PERIOD);
    prismaMock.invoice.findMany.mockResolvedValue([]);

    const result = await salesBookService.getSalesBook(COMPANY, PERIOD_ID);

    expect(result.lines).toHaveLength(0);
    expect(result.summary.documentCount).toBe(0);
    expect(result.summary.grandTotal).toBe('0.00');
  });

  it('clasifica correctamente ventas gravadas 15%', async () => {
    prismaMock.fiscalPeriod.findFirst.mockResolvedValue(PERIOD);
    prismaMock.invoice.findMany.mockResolvedValue([makeInvoice()]);

    const result = await salesBookService.getSalesBook(COMPANY, PERIOD_ID);

    expect(result.lines).toHaveLength(1);
    const line = result.lines[0];
    expect(line.taxedSales15).toBe('1000.00');
    expect(line.isv15).toBe('150.00');
    expect(line.exemptSales).toBe('0.00');
    expect(line.taxedSales18).toBe('0.00');
    expect(line.total).toBe('1150.00');
  });

  it('clasifica correctamente ventas exentas', async () => {
    prismaMock.fiscalPeriod.findFirst.mockResolvedValue(PERIOD);
    prismaMock.invoice.findMany.mockResolvedValue([makeExemptInvoice()]);

    const result = await salesBookService.getSalesBook(COMPANY, PERIOD_ID);

    const line = result.lines[0];
    expect(line.exemptSales).toBe('500.00');
    expect(line.taxedSales15).toBe('0.00');
    expect(line.isv15).toBe('0.00');
    expect(line.total).toBe('500.00');
  });

  it('clasifica correctamente ventas gravadas 18%', async () => {
    prismaMock.fiscalPeriod.findFirst.mockResolvedValue(PERIOD);
    prismaMock.invoice.findMany.mockResolvedValue([makeInvoice18()]);

    const result = await salesBookService.getSalesBook(COMPANY, PERIOD_ID);

    const line = result.lines[0];
    expect(line.taxedSales18).toBe('500.00');
    expect(line.isv18).toBe('90.00');
    expect(line.taxedSales15).toBe('0.00');
    expect(line.total).toBe('590.00');
  });

  it('facturas anuladas aparecen con montos en cero', async () => {
    prismaMock.fiscalPeriod.findFirst.mockResolvedValue(PERIOD);
    prismaMock.invoice.findMany.mockResolvedValue([makeCancelledInvoice()]);

    const result = await salesBookService.getSalesBook(COMPANY, PERIOD_ID);

    const line = result.lines[0];
    expect(line.isCancelled).toBe(true);
    expect(line.exemptSales).toBe('0.00');
    expect(line.taxedSales15).toBe('0.00');
    expect(line.isv15).toBe('0.00');
    expect(line.total).toBe('0.00');
    expect(result.summary.cancelledCount).toBe(1);
  });

  it('calcula totales de resumen con múltiples facturas mixtas', async () => {
    prismaMock.fiscalPeriod.findFirst.mockResolvedValue(PERIOD);
    prismaMock.invoice.findMany.mockResolvedValue([
      makeInvoice(), // 1000 gravada 15%, 150 ISV
      makeExemptInvoice(), // 500 exenta
      makeInvoice18(), // 500 gravada 18%, 90 ISV
      makeCancelledInvoice(), // anulada → 0
    ]);

    const result = await salesBookService.getSalesBook(COMPANY, PERIOD_ID);

    expect(result.summary.documentCount).toBe(4);
    expect(result.summary.cancelledCount).toBe(1);
    expect(result.summary.totalExemptSales).toBe('500.00');
    expect(result.summary.totalTaxedSales15).toBe('1000.00');
    expect(result.summary.totalTaxedSales18).toBe('500.00');
    expect(result.summary.totalIsv15).toBe('150.00');
    expect(result.summary.totalIsv18).toBe('90.00');
    // grandTotal = 1150 + 500 + 590 + 0 = 2240
    expect(result.summary.grandTotal).toBe('2240.00');
  });
});

// ─── Tests: generateDetCsv ──────────────────────────────────────────────────

describe('salesBookService.generateDetCsv', () => {
  beforeEach(() => vi.clearAllMocks());

  it('lanza error si empresa no existe', async () => {
    prismaMock.company.findFirst.mockResolvedValue(null);

    await expect(salesBookService.generateDetCsv(COMPANY, PERIOD_ID)).rejects.toThrow(
      'Empresa no encontrada',
    );
  });

  it('genera CSV pipe-delimited con formato correcto', async () => {
    prismaMock.company.findFirst.mockResolvedValue({ rtn: '08019999123456' });
    prismaMock.fiscalPeriod.findFirst.mockResolvedValue(PERIOD);
    prismaMock.invoice.findMany.mockResolvedValue([makeInvoice()]);

    const csv = await salesBookService.generateDetCsv(COMPANY, PERIOD_ID);
    const fields = csv.split('|');

    expect(fields).toHaveLength(13);
    expect(fields[0]).toBe('08019999123456'); // RTN emisor
    expect(fields[1]).toBe('202603'); // Período
    expect(fields[2]).toBe('01'); // Tipo doc
    expect(fields[3]).toBe('001-001-01-00000001'); // Número SAR
    expect(fields[4]).toBe('15/03/2026'); // Fecha emisión
    expect(fields[5]).toBe('08011985123456'); // RTN cliente
    expect(fields[6]).toBe('Cliente Test S.A.'); // Nombre cliente
    expect(fields[7]).toBe('0.00'); // Vta exenta
    expect(fields[8]).toBe('1000.00'); // Vta gravada 15%
    expect(fields[9]).toBe('0.00'); // Vta gravada 18%
    expect(fields[10]).toBe('150.00'); // ISV 15%
    expect(fields[11]).toBe('0.00'); // ISV 18%
    expect(fields[12]).toBe('1150.00'); // Total
  });

  it('maneja RTN de cliente null (extranjero)', async () => {
    const foreignInvoice = makeInvoice({
      contact: { legalName: 'Foreign Corp', rtn: null },
    });
    prismaMock.company.findFirst.mockResolvedValue({ rtn: '08019999123456' });
    prismaMock.fiscalPeriod.findFirst.mockResolvedValue(PERIOD);
    prismaMock.invoice.findMany.mockResolvedValue([foreignInvoice]);

    const csv = await salesBookService.generateDetCsv(COMPANY, PERIOD_ID);
    const fields = csv.split('|');

    expect(fields[5]).toBe(''); // RTN vacío para extranjero
    expect(fields[6]).toBe('Foreign Corp');
  });

  it('genera múltiples líneas separadas por newline', async () => {
    prismaMock.company.findFirst.mockResolvedValue({ rtn: '08019999123456' });
    prismaMock.fiscalPeriod.findFirst.mockResolvedValue(PERIOD);
    prismaMock.invoice.findMany.mockResolvedValue([makeInvoice(), makeExemptInvoice()]);

    const csv = await salesBookService.generateDetCsv(COMPANY, PERIOD_ID);
    const lines = csv.split('\n');

    expect(lines).toHaveLength(2);
    // Second line should have exempt sale
    const fields2 = lines[1].split('|');
    expect(fields2[7]).toBe('500.00'); // Vta exenta
    expect(fields2[8]).toBe('0.00'); // Vta gravada 15%
  });
});
