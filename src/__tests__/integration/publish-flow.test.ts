// src/__tests__/integration/publish-flow.test.ts
/**
 * Tests de integración — Flujo completo publish de factura (F3-A3)
 *
 * Verifica el ciclo DRAFT → PUBLISHED end-to-end contra BD real:
 *
 *  1. publishInvoice: asigna número SAR correlativo del CAI
 *  2. publishInvoice: genera asiento contable POSTED con débito/crédito cuadrado
 *  3. publishInvoice: asiento contiene líneas correctas (AR débito, Ingresos crédito, ISV crédito)
 *  4. publishInvoice: aislamiento multi-tenant — Empresa B no puede publicar factura de Empresa A
 *  5. publishInvoice: lanza error si CAI expirado
 *  6. cancelInvoice: genera asiento de reversión y marca factura CANCELLED
 *  7. cancelInvoice: asiento de reversión tiene débito/crédito invertidos (cuadrado)
 *  8. Secuencia: dos facturas publicadas obtienen números correlativos distintos
 *
 * Prerrequisitos en BD:
 *  - Empresa de test con plan de cuentas NIIF (seed o previo)
 *  - CAI activo con rango suficiente
 *  - Diario de ventas (SALES) activo
 *  - Período fiscal OPEN que cubra la fecha de emisión
 *
 * Requiere: .env.local con DATABASE_URL
 */

import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { invoiceService } from '@/lib/services/invoicing/invoice.service';
import { withRLSContext } from '../helpers/rls-session';

const prismaOwner = new PrismaClient();

// ─── IDs de fixtures ─────────────────────────────────────────────────────────

const IDS = {
  companyA: '00000000-0000-0000-0005-000000000001',
  companyB: '00000000-0000-0000-0005-000000000002',
  caiActive: '00000000-0000-0000-0005-000000000010',
  // caiExpiredNC: CAI expirado para tipo '03' (NOTA_CREDITO), activo pero vencido.
  // Usado para verificar que getActiveCai lanza error de CAI vencido sin interferir con tipo '01'.
  caiExpiredNC: '00000000-0000-0000-0005-000000000011',
  taxRate: '00000000-0000-0000-0005-000000000020',
  contact: '00000000-0000-0000-0005-000000000030',
  invoice1: '00000000-0000-0000-0005-000000000040',
  invoice2: '00000000-0000-0000-0005-000000000041',
  invoiceExpiredCai: '00000000-0000-0000-0005-000000000042',
  invoiceForCancel: '00000000-0000-0000-0005-000000000043',
  // CAI for NC (tipo 03, válido)
  caiNC: '00000000-0000-0000-0005-000000000012',
  // Factura base para NC
  invoiceForNC: '00000000-0000-0000-0005-000000000044',
  // Contabilidad
  journalSales: '00000000-0000-0000-0005-000000000050',
  fiscalYear: '00000000-0000-0000-0005-000000000060',
  fiscalPeriodMar: '00000000-0000-0000-0005-000000000070',
  // Período de Abril — necesario para que cancelInvoice cree el asiento de reversión
  // (cancelInvoice busca un período OPEN para "hoy", y hoy es 2026-04-01)
  fiscalPeriodApr: '00000000-0000-0000-0005-000000000071',
  accountAR: '00000000-0000-0000-0005-000000000080', // 1103
  accountISV: '00000000-0000-0000-0005-000000000081', // 2102
  accountRevenue: '00000000-0000-0000-0005-000000000082', // 4101
};

const USER_A = 'publish-flow-test-user';
const ISSUE_DATE = new Date('2026-03-15');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeInvoiceData(id: string, caiId: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    companyId: IDS.companyA,
    caiId,
    invoiceType: 'FACTURA' as const,
    status: 'DRAFT' as const,
    issueDate: ISSUE_DATE,
    contactId: IDS.contact,
    currencyCode: 'HNL',
    exchangeRate: '1.000000',
    subtotal: '1000.00',
    taxAmount: '150.00',
    total: '1150.00',
    createdBy: USER_A,
    ...overrides,
    lines: {
      create: [
        {
          companyId: IDS.companyA,
          lineNumber: 1,
          description: 'Servicio de consultoría',
          quantity: '10.0000',
          unitPrice: '100.0000',
          discountPct: '0.00',
          subtotal: '1000.00',
          taxRateId: IDS.taxRate,
          taxAmount: '150.00',
          total: '1150.00',
          accountId: IDS.accountRevenue,
        },
      ],
    },
  };
}

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeAll(async () => {
  // Cleanup previo (orden FK: lines → invoices → sequences → journals → periods → year → accounts → cais → contacts → companies)
  const rawDelete = (sql: string) => prismaOwner.$executeRawUnsafe(sql).catch(() => {});
  const ids = `'${IDS.companyA}','${IDS.companyB}'`;

  await rawDelete(`DELETE FROM journal_entry_lines WHERE company_id IN (${ids})`);
  await rawDelete(`DELETE FROM journal_entries WHERE company_id IN (${ids})`);
  await rawDelete(`DELETE FROM journal_sequences WHERE company_id IN (${ids})`);
  await rawDelete(`DELETE FROM invoice_lines WHERE company_id IN (${ids})`);
  await rawDelete(`DELETE FROM invoices WHERE company_id IN (${ids})`);
  await rawDelete(`DELETE FROM invoice_sequences WHERE company_id IN (${ids})`);
  await rawDelete(`DELETE FROM tax_rates WHERE company_id IN (${ids})`);
  await rawDelete(`DELETE FROM cais WHERE company_id IN (${ids})`);
  await rawDelete(`DELETE FROM journals WHERE company_id IN (${ids})`);
  await rawDelete(`DELETE FROM fiscal_periods WHERE company_id IN (${ids})`);
  await rawDelete(`DELETE FROM fiscal_years WHERE company_id IN (${ids})`);
  await rawDelete(`DELETE FROM accounts WHERE company_id IN (${ids})`);
  await rawDelete(`DELETE FROM contacts WHERE id = '${IDS.contact}'`);
  await rawDelete(`DELETE FROM companies WHERE id IN (${ids})`);

  // Monedas base
  await prismaOwner.currency.upsert({
    where: { code: 'HNL' },
    update: {},
    create: { code: 'HNL', name: 'Lempira hondureño', symbol: 'L', isActive: true, isBase: true },
  });

  // Empresa A (la que tiene facturas)
  await prismaOwner.company.create({
    data: {
      id: IDS.companyA,
      legalName: 'Empresa Publish Test A',
      tradeName: 'Pub A',
      rtn: '0801-PUB-00001',
      maxUsers: 5,
    },
  });

  // Empresa B (tenant intruso)
  await prismaOwner.company.create({
    data: {
      id: IDS.companyB,
      legalName: 'Empresa Publish Test B',
      tradeName: 'Pub B',
      rtn: '0501-PUB-00002',
      maxUsers: 5,
    },
  });

  // Contacto (cliente) en Empresa A
  await withRLSContext(prismaOwner, IDS.companyA, (tx) =>
    tx.contact.create({
      data: {
        id: IDS.contact,
        companyId: IDS.companyA,
        contactType: 'JURIDICAL',
        legalName: 'Cliente Publish Test S.A.',
        isCustomer: true,
        isSupplier: false,
      },
    }),
  );

  // Plan de cuentas mínimo para el asiento automático
  const accountsData = [
    {
      id: IDS.accountAR,
      companyId: IDS.companyA,
      code: '1103',
      name: 'Cuentas por Cobrar Clientes',
      accountType: 'ASSET' as const,
      accountNature: 'DEBIT' as const,
      systemPurpose: 'ACCOUNTS_RECEIVABLE' as const,
      allowDirectEntry: true,
      isActive: true,
    },
    {
      id: IDS.accountISV,
      companyId: IDS.companyA,
      code: '2102',
      name: 'ISV por Pagar',
      accountType: 'LIABILITY' as const,
      accountNature: 'CREDIT' as const,
      systemPurpose: 'ISV_PAYABLE' as const,
      allowDirectEntry: true,
      isActive: true,
    },
    {
      id: IDS.accountRevenue,
      companyId: IDS.companyA,
      code: '4101',
      name: 'Ventas',
      accountType: 'INCOME' as const,
      accountNature: 'CREDIT' as const,
      systemPurpose: 'SALES_REVENUE' as const,
      allowDirectEntry: true,
      isActive: true,
    },
  ];

  for (const acc of accountsData) {
    await withRLSContext(prismaOwner, IDS.companyA, (tx) => tx.account.create({ data: acc }));
  }

  // Año fiscal 2026
  await withRLSContext(prismaOwner, IDS.companyA, (tx) =>
    tx.fiscalYear.create({
      data: {
        id: IDS.fiscalYear,
        companyId: IDS.companyA,
        year: 2026,
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-12-31'),
        status: 'OPEN',
      },
    }),
  );

  // Período fiscal Marzo 2026 (cubre ISSUE_DATE = 2026-03-15)
  await withRLSContext(prismaOwner, IDS.companyA, (tx) =>
    tx.fiscalPeriod.create({
      data: {
        id: IDS.fiscalPeriodMar,
        companyId: IDS.companyA,
        fiscalYearId: IDS.fiscalYear,
        periodNumber: 3,
        name: 'Marzo 2026',
        startDate: new Date('2026-03-01'),
        endDate: new Date('2026-03-31'),
        status: 'OPEN',
      },
    }),
  );

  // Período fiscal Abril 2026 (cubre la fecha de cancelación — "hoy" = 2026-04-01)
  // cancelInvoice busca un período OPEN para "today" al crear el asiento de reversión.
  await withRLSContext(prismaOwner, IDS.companyA, (tx) =>
    tx.fiscalPeriod.create({
      data: {
        id: IDS.fiscalPeriodApr,
        companyId: IDS.companyA,
        fiscalYearId: IDS.fiscalYear,
        periodNumber: 4,
        name: 'Abril 2026',
        startDate: new Date('2026-04-01'),
        endDate: new Date('2026-04-30'),
        status: 'OPEN',
      },
    }),
  );

  // Diario de ventas (SALES)
  await withRLSContext(prismaOwner, IDS.companyA, (tx) =>
    tx.journal.create({
      data: {
        id: IDS.journalSales,
        companyId: IDS.companyA,
        code: 'LV',
        name: 'Libro de Ventas',
        journalType: 'SALES',
        isActive: true,
      },
    }),
  );

  // CAI activo (rango 1-9999)
  await withRLSContext(prismaOwner, IDS.companyA, (tx) =>
    tx.cAI.create({
      data: {
        id: IDS.caiActive,
        companyId: IDS.companyA,
        caiCode: 'PUBACT-PUBACT-PUBACT-PUBACT-PUBACT-AA',
        establishmentCode: '001',
        emissionPointCode: '001',
        documentType: '01',
        rangeFrom: 1,
        rangeTo: 9999,
        issuedAt: new Date('2026-01-01'),
        expiresAt: new Date('2027-12-31'),
        isActive: true,
      },
    }),
  );

  // CAI expirado para NOTA_DEBITO (tipo '04') — activo pero vencido.
  // Usamos tipo '04' para no interferir con el CAI válido de tipo '03' (caiNC).
  // Al publicar la invoiceExpiredCai (NOTA_DEBITO), getActiveCai('04') lo encuentra y lanza "CAI vencido".
  await withRLSContext(prismaOwner, IDS.companyA, (tx) =>
    tx.cAI.create({
      data: {
        id: IDS.caiExpiredNC,
        companyId: IDS.companyA,
        caiCode: 'PUBEXP-PUBEXP-PUBEXP-PUBEXP-PUBEXP-EE',
        establishmentCode: '002',
        emissionPointCode: '001',
        documentType: '04',
        rangeFrom: 1,
        rangeTo: 9999,
        issuedAt: new Date('2025-01-01'),
        expiresAt: new Date('2025-12-31'), // Expirado
        isActive: true,
      },
    }),
  );

  // CAI válido para NOTA_CREDITO (tipo '03') — usado por los tests F3-08.
  await withRLSContext(prismaOwner, IDS.companyA, (tx) =>
    tx.cAI.create({
      data: {
        id: IDS.caiNC,
        companyId: IDS.companyA,
        caiCode: 'PUBNC0-PUBNC0-PUBNC0-PUBNC0-PUBNC0-NC',
        establishmentCode: '001',
        emissionPointCode: '001',
        documentType: '03',
        rangeFrom: 1,
        rangeTo: 9999,
        issuedAt: new Date('2026-01-01'),
        expiresAt: new Date('2027-12-31'),
        isActive: true,
      },
    }),
  );

  // Tax rate ISV 15%
  await withRLSContext(prismaOwner, IDS.companyA, (tx) =>
    tx.taxRate.create({
      data: {
        id: IDS.taxRate,
        companyId: IDS.companyA,
        code: 'ISV15_PUB',
        name: 'ISV 15% Publish Test',
        rate: '0.1500',
        isActive: true,
      },
    }),
  );

  // Facturas de test (DRAFT)
  // Facturas tipo FACTURA (usan caiActive, tipo '01')
  for (const id of [IDS.invoice1, IDS.invoice2, IDS.invoiceForCancel, IDS.invoiceForNC]) {
    await withRLSContext(prismaOwner, IDS.companyA, (tx) =>
      tx.invoice.create({ data: makeInvoiceData(id, IDS.caiActive) }),
    );
  }

  // Factura tipo NOTA_DEBITO (usa caiExpiredNC, tipo '04', expirado).
  // Al publicar, getActiveCai('04') encuentra el CAI vencido y lanza error.
  await withRLSContext(prismaOwner, IDS.companyA, (tx) =>
    tx.invoice.create({
      data: makeInvoiceData(IDS.invoiceExpiredCai, IDS.caiExpiredNC, {
        invoiceType: 'NOTA_DEBITO',
      }),
    }),
  );
}, 30_000);

afterAll(async () => {
  const rawDelete = (sql: string) => prismaOwner.$executeRawUnsafe(sql).catch(() => {});
  const ids = `'${IDS.companyA}','${IDS.companyB}'`;

  await rawDelete(`DELETE FROM journal_entry_lines WHERE company_id IN (${ids})`);
  await rawDelete(`DELETE FROM journal_entries WHERE company_id IN (${ids})`);
  await rawDelete(`DELETE FROM journal_sequences WHERE company_id IN (${ids})`);
  await rawDelete(`DELETE FROM invoice_lines WHERE company_id IN (${ids})`);
  await rawDelete(`DELETE FROM invoices WHERE company_id IN (${ids})`);
  await rawDelete(`DELETE FROM invoice_sequences WHERE company_id IN (${ids})`);
  await rawDelete(`DELETE FROM tax_rates WHERE company_id IN (${ids})`);
  await rawDelete(`DELETE FROM cais WHERE company_id IN (${ids})`);
  await rawDelete(`DELETE FROM journals WHERE company_id IN (${ids})`);
  await rawDelete(`DELETE FROM fiscal_periods WHERE company_id IN (${ids})`);
  await rawDelete(`DELETE FROM fiscal_years WHERE company_id IN (${ids})`);
  await rawDelete(`DELETE FROM accounts WHERE company_id IN (${ids})`);
  await rawDelete(`DELETE FROM contacts WHERE id = '${IDS.contact}'`);
  await prismaOwner.company
    .deleteMany({ where: { id: { in: [IDS.companyA, IDS.companyB] } } })
    .catch(() => {});
  await prismaOwner.$disconnect();
}, 20_000);

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('publishInvoice — end-to-end con BD real', () => {
  it('asigna número SAR correlativo al publicar', async () => {
    const result = await invoiceService.publishInvoice(IDS.companyA, IDS.invoice1, USER_A);

    expect(result.status).toBe('PUBLISHED');
    expect(result.invoiceNumber).toMatch(/^\d{3}-\d{3}-\d{2}-\d{8}$/); // PPP-PPP-TT-NNNNNNNN
    expect(result.sequenceNumber).toBeGreaterThanOrEqual(1);
    expect(result.issuedBy).toBe(USER_A);
    expect(result.issuedAt).not.toBeNull();
  });

  it('genera asiento contable POSTED con débito = crédito', async () => {
    const result = await invoiceService.publishInvoice(IDS.companyA, IDS.invoice2, USER_A);

    expect(result.journalEntryId).not.toBeNull();

    // Verify the journal entry in DB
    const entry = await prismaOwner.journalEntry.findUnique({
      where: { id: result.journalEntryId! },
      include: { lines: { orderBy: { lineNumber: 'asc' } } },
    });

    expect(entry).not.toBeNull();
    expect(entry!.status).toBe('POSTED');

    const totalDebit = entry!.lines.reduce((s, l) => s + Number(l.debit), 0);
    const totalCredit = entry!.lines.reduce((s, l) => s + Number(l.credit), 0);
    expect(totalDebit).toBeCloseTo(totalCredit, 2);
  });

  it('asiento contiene líneas correctas: AR débito, Ingresos crédito, ISV crédito', async () => {
    // invoice2 was just published — reuse its journal entry
    const invoice = await prismaOwner.invoice.findUnique({
      where: { id: IDS.invoice2 },
    });
    const entry = await prismaOwner.journalEntry.findUnique({
      where: { id: invoice!.journalEntryId! },
      include: { lines: { orderBy: { lineNumber: 'asc' } } },
    });

    // Line 1: AR debit = L1,150 (total)
    const arLine = entry!.lines.find((l) => l.accountId === IDS.accountAR);
    expect(arLine).toBeDefined();
    expect(Number(arLine!.debit)).toBeCloseTo(1150, 2);
    expect(Number(arLine!.credit)).toBe(0);

    // Line 2: Revenue credit = L1,000 (subtotal)
    const revLine = entry!.lines.find((l) => l.accountId === IDS.accountRevenue);
    expect(revLine).toBeDefined();
    expect(Number(revLine!.credit)).toBeCloseTo(1000, 2);
    expect(Number(revLine!.debit)).toBe(0);

    // Line 3: ISV payable credit = L150 (taxAmount)
    const isvLine = entry!.lines.find((l) => l.accountId === IDS.accountISV);
    expect(isvLine).toBeDefined();
    expect(Number(isvLine!.credit)).toBeCloseTo(150, 2);
    expect(Number(isvLine!.debit)).toBe(0);
  });

  it('dos facturas publicadas obtienen números SAR correlativos distintos', async () => {
    const inv1 = await prismaOwner.invoice.findUnique({ where: { id: IDS.invoice1 } });
    const inv2 = await prismaOwner.invoice.findUnique({ where: { id: IDS.invoice2 } });

    expect(inv1!.sequenceNumber).not.toBeNull();
    expect(inv2!.sequenceNumber).not.toBeNull();
    expect(inv1!.sequenceNumber).not.toBe(inv2!.sequenceNumber);
    expect(Math.abs(inv1!.sequenceNumber! - inv2!.sequenceNumber!)).toBe(1);
  });

  it('lanza error al publicar NOTA_DEBITO cuando el único CAI activo para tipo 04 está vencido', async () => {
    // caiExpiredNC es activo (isActive=true, tipo '04') pero expiresAt=2025-12-31.
    // getActiveCai('04') lo encuentra y lanza "El CAI activo... está vencido".
    await expect(
      invoiceService.publishInvoice(IDS.companyA, IDS.invoiceExpiredCai, USER_A),
    ).rejects.toThrow(/vencido|expirado/i);
  });

  it('aislamiento multi-tenant: Empresa B no puede publicar factura de Empresa A', async () => {
    // invoice1 is already PUBLISHED — use a fresh DRAFT in companyA's name but accessed from companyB
    await expect(invoiceService.publishInvoice(IDS.companyB, IDS.invoice1, USER_A)).rejects.toThrow(
      'Factura no encontrada',
    );
  });
});

describe('cancelInvoice — end-to-end con BD real', () => {
  it('cancela factura publicada y genera asiento de reversión', async () => {
    // First publish
    const published = await invoiceService.publishInvoice(
      IDS.companyA,
      IDS.invoiceForCancel,
      USER_A,
    );
    expect(published.status).toBe('PUBLISHED');

    // Then cancel
    const cancelled = await invoiceService.cancelInvoice(
      IDS.companyA,
      IDS.invoiceForCancel,
      USER_A,
      'Error en datos del cliente',
    );

    expect(cancelled.status).toBe('CANCELLED');
    expect(cancelled.cancelledBy).toBe(USER_A);
    expect(cancelled.cancelReason).toBe('Error en datos del cliente');
  });

  it('asiento de reversión tiene débito y crédito cuadrados e invertidos', async () => {
    const invoice = await prismaOwner.invoice.findUnique({
      where: { id: IDS.invoiceForCancel },
    });
    expect(invoice?.journalEntryId).not.toBeNull();

    // The original journal entry
    const original = await prismaOwner.journalEntry.findUnique({
      where: { id: invoice!.journalEntryId! },
      include: { lines: { orderBy: { lineNumber: 'asc' } } },
    });
    expect(original).not.toBeNull();
    expect(original!.status).toBe('CANCELLED');

    // The reversal entry points back to original via cancelledById
    const reversalEntry = await prismaOwner.journalEntry.findFirst({
      where: { cancelledById: original!.id },
      include: { lines: { orderBy: { lineNumber: 'asc' } } },
    });
    expect(reversalEntry).not.toBeNull();
    expect(reversalEntry!.status).toBe('POSTED');

    // Reversal debit/credit are swapped from original
    expect(Number(reversalEntry!.totalDebit)).toBeCloseTo(Number(original!.totalCredit), 2);
    expect(Number(reversalEntry!.totalCredit)).toBeCloseTo(Number(original!.totalDebit), 2);

    // Reversal lines: each line has debit/credit swapped
    const totalDebit = reversalEntry!.lines.reduce((s, l) => s + Number(l.debit), 0);
    const totalCredit = reversalEntry!.lines.reduce((s, l) => s + Number(l.credit), 0);
    expect(totalDebit).toBeCloseTo(totalCredit, 2);

    // AR line in reversal: original was debit=1150, credit=0 → reversal: debit=0, credit=1150
    const arLine = reversalEntry!.lines.find((l) => l.accountId === IDS.accountAR);
    expect(arLine).toBeDefined();
    expect(Number(arLine!.credit)).toBeCloseTo(1150, 2);
    expect(Number(arLine!.debit)).toBe(0);
  });

  it('lanza error si no hay período fiscal abierto para la fecha de cancelación', async () => {
    // Close the April period so today has no open period
    await prismaOwner.$executeRawUnsafe(
      `UPDATE fiscal_periods SET status = 'CLOSED' WHERE id = '${IDS.fiscalPeriodApr}'`,
    );

    // Create and publish a new invoice to cancel
    const invData = {
      invoiceType: 'FACTURA' as const,
      issueDate: '2026-03-15',
      contactId: IDS.contact,
      currencyCode: 'HNL',
      exchangeRate: 1,
      lines: [
        {
          lineNumber: 1,
          description: 'Item para test cancelación sin período',
          quantity: 1,
          unitPrice: 500,
          discountPct: 0,
          taxRateId: IDS.taxRate,
        },
      ],
    };
    const created = await invoiceService.createInvoice(IDS.companyA, USER_A, invData);
    await invoiceService.publishInvoice(IDS.companyA, created.id, USER_A);

    // Try to cancel — should throw because April fiscal period is CLOSED
    await expect(
      invoiceService.cancelInvoice(IDS.companyA, created.id, USER_A, 'Test sin período'),
    ).rejects.toThrow(/período fiscal abierto/i);

    // Restore the period for cleanup
    await prismaOwner.$executeRawUnsafe(
      `UPDATE fiscal_periods SET status = 'OPEN' WHERE id = '${IDS.fiscalPeriodApr}'`,
    );
  });
});

// ─── Tests: Notas de Crédito (F3-08) ─────────────────────────────────────────

describe('Nota de Crédito — flujo completo F3-08', () => {
  // We'll create invoices via service in these tests (not pre-seeded)
  // to test the createInvoice validation rules.

  const ncInput = {
    invoiceType: 'NOTA_CREDITO' as const,
    issueDate: '2026-03-20',
    contactId: IDS.contact,
    currencyCode: 'HNL',
    exchangeRate: 1,
    originalInvoiceId: IDS.invoiceForNC, // set after publish in each test
    lines: [
      {
        lineNumber: 1,
        description: 'Devolución parcial de servicio',
        quantity: 3,
        unitPrice: 100,
        discountPct: 0,
        taxRateId: IDS.taxRate,
        accountId: IDS.accountRevenue,
      },
    ],
  };

  it('lanza error al crear NC sin originalInvoiceId', async () => {
    const input = { ...ncInput, originalInvoiceId: undefined };
    await expect(invoiceService.createInvoice(IDS.companyA, USER_A, input)).rejects.toThrow(
      /notas de crédito requieren una factura original/i,
    );
  });

  it('lanza error al crear NC con factura original en DRAFT', async () => {
    // invoiceForNC is still DRAFT at this point
    await expect(invoiceService.createInvoice(IDS.companyA, USER_A, ncInput)).rejects.toThrow(
      /facturas emitidas o pagadas/i,
    );
  });

  it('permite crear NC contra factura PUBLISHED y publicarla con asiento invertido', async () => {
    // Step 1: Publish the base invoice
    const published = await invoiceService.publishInvoice(IDS.companyA, IDS.invoiceForNC, USER_A);
    expect(published.status).toBe('PUBLISHED');

    // Step 2: Create NC against it
    const nc = await invoiceService.createInvoice(IDS.companyA, USER_A, {
      ...ncInput,
      originalInvoiceId: IDS.invoiceForNC,
    });
    expect(nc.status).toBe('DRAFT');
    expect(nc.invoiceType).toBe('NOTA_CREDITO');
    expect(nc.originalInvoiceId).toBe(IDS.invoiceForNC);

    // Step 3: Publish the NC
    const publishedNC = await invoiceService.publishInvoice(IDS.companyA, nc.id, USER_A);
    expect(publishedNC.status).toBe('PUBLISHED');
    expect(publishedNC.invoiceNumber).toMatch(/^\d{3}-\d{3}-03-\d{8}$/); // tipo 03
    expect(publishedNC.journalEntryId).not.toBeNull();

    // Step 4: Verify journal entry is a credit entry (AR credited, Revenue debited)
    const entry = await prismaOwner.journalEntry.findUnique({
      where: { id: publishedNC.journalEntryId! },
      include: { lines: { orderBy: { lineNumber: 'asc' } } },
    });

    expect(entry).not.toBeNull();
    expect(entry!.status).toBe('POSTED');

    // Balanced
    const totalDebit = entry!.lines.reduce((s, l) => s + Number(l.debit), 0);
    const totalCredit = entry!.lines.reduce((s, l) => s + Number(l.credit), 0);
    expect(totalDebit).toBeCloseTo(totalCredit, 2);

    // NOTA_CREDITO: AR is credited (not debited) — reversal of normal sale
    const arLine = entry!.lines.find((l) => l.accountId === IDS.accountAR);
    expect(arLine).toBeDefined();
    expect(Number(arLine!.credit)).toBeGreaterThan(0); // AR credited
    expect(Number(arLine!.debit)).toBe(0);

    // Revenue line is debited (reducing income)
    const revLine = entry!.lines.find((l) => l.accountId === IDS.accountRevenue);
    expect(revLine).toBeDefined();
    expect(Number(revLine!.debit)).toBeGreaterThan(0); // Revenue debited
    expect(Number(revLine!.credit)).toBe(0);
  });

  it('NC aparece en Libro de Ventas del período con montos correctos', async () => {
    const { salesBookService } = await import('@/lib/services/invoicing/sales-book.service');

    const book = await salesBookService.getSalesBook(IDS.companyA, IDS.fiscalPeriodMar);

    // Find the NC line (documentType '03')
    const ncLine = book.lines.find((l) => l.documentType === '03');
    expect(ncLine).toBeDefined();
    expect(ncLine!.isCancelled).toBe(false);

    // 3 × 100 = 300 subtotal; ISV 15% = 45; total = 345
    expect(ncLine!.taxedSales15).toBe('300.00');
    expect(ncLine!.isv15).toBe('45.00');
    expect(ncLine!.total).toBe('345.00');
  });

  it('lanza error al crear NC que excede saldo de factura original', async () => {
    // invoiceForNC total = 1150. NC of 345 already issued. Remaining = 805.
    // Try to create a NC for 10 × 100 = 1000 subtotal + ISV → total 1150 > 805
    const oversizedNC = {
      ...ncInput,
      originalInvoiceId: IDS.invoiceForNC,
      lines: [
        {
          lineNumber: 1,
          description: 'NC excesiva',
          quantity: 10,
          unitPrice: 100,
          discountPct: 0,
          taxRateId: IDS.taxRate,
        },
      ],
    };

    await expect(invoiceService.createInvoice(IDS.companyA, USER_A, oversizedNC)).rejects.toThrow(
      /excede el saldo disponible/i,
    );
  });
});
