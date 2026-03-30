// src/__tests__/integration/invoicing-isolation.test.ts
/**
 * Tests de integración — Aislamiento multi-tenant del módulo de Facturación (F3-tests).
 *
 * Verifica que los CAIs, tasas de impuesto y facturas de Empresa A
 * no son visibles desde Empresa B usando createTenantPrisma (Prisma Extension).
 *
 * Estrategia:
 * - Empresa A: CAI + TaxRate + Invoice con líneas en BD real
 * - Empresa B: intenta leer/modificar datos de Empresa A → debe obtener vacío o error
 * - Cleanup completo en afterAll
 *
 * Requiere: .env.local con DATABASE_URL apuntando a BD de test.
 */

import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { withRLSContext, withAdminContext } from '../helpers/rls-session';

const prismaOwner = new PrismaClient();

// ─── IDs de fixtures propios (distintos de TENANT_A/B para evitar conflicto) ─

const IDS = {
  companyA: '00000000-0000-0000-0003-000000000001',
  companyB: '00000000-0000-0000-0003-000000000002',
  caiA: '00000000-0000-0000-0003-000000000010',
  taxRateA: '00000000-0000-0000-0003-000000000020',
  invoiceA: '00000000-0000-0000-0003-000000000030',
  invoiceLineA: '00000000-0000-0000-0003-000000000040',
  contactA: '00000000-0000-0000-0003-000000000050',
};

// ─── Setup / Teardown ─────────────────────────────────────────────────────────

beforeAll(async () => {
  // Cleanup previo (orden por FK)
  await prismaOwner
    .$executeRawUnsafe(
      `DELETE FROM invoice_lines WHERE company_id IN ('${IDS.companyA}','${IDS.companyB}')`,
    )
    .catch(() => {});
  await prismaOwner
    .$executeRawUnsafe(
      `DELETE FROM invoices WHERE company_id IN ('${IDS.companyA}','${IDS.companyB}')`,
    )
    .catch(() => {});
  await prismaOwner
    .$executeRawUnsafe(
      `DELETE FROM invoice_sequences WHERE company_id IN ('${IDS.companyA}','${IDS.companyB}')`,
    )
    .catch(() => {});
  await prismaOwner
    .$executeRawUnsafe(
      `DELETE FROM tax_rates WHERE company_id IN ('${IDS.companyA}','${IDS.companyB}')`,
    )
    .catch(() => {});
  await prismaOwner
    .$executeRawUnsafe(`DELETE FROM cais WHERE company_id IN ('${IDS.companyA}','${IDS.companyB}')`)
    .catch(() => {});
  await prismaOwner
    .$executeRawUnsafe(`DELETE FROM contacts WHERE id = '${IDS.contactA}'`)
    .catch(() => {});
  await prismaOwner
    .$executeRawUnsafe(`DELETE FROM companies WHERE id IN ('${IDS.companyA}','${IDS.companyB}')`)
    .catch(() => {});

  // Crear empresas de test
  await prismaOwner.company.create({
    data: {
      id: IDS.companyA,
      legalName: 'Empresa Facturación A',
      tradeName: 'Inv A',
      rtn: '0801-INV-00001',
      maxUsers: 5,
    },
  });
  await prismaOwner.company.create({
    data: {
      id: IDS.companyB,
      legalName: 'Empresa Facturación B',
      tradeName: 'Inv B',
      rtn: '0501-INV-00002',
      maxUsers: 5,
    },
  });

  // Crear contacto en Empresa A (necesario para FK de invoice)
  await withRLSContext(prismaOwner, IDS.companyA, (tx) =>
    tx.contact.create({
      data: {
        id: IDS.contactA,
        companyId: IDS.companyA,
        contactType: 'JURIDICAL',
        legalName: 'Cliente Facturación Test S.A.',
        isCustomer: true,
        isSupplier: false,
      },
    }),
  );

  // Crear CAI en Empresa A
  await withRLSContext(prismaOwner, IDS.companyA, (tx) =>
    tx.cAI.create({
      data: {
        id: IDS.caiA,
        companyId: IDS.companyA,
        caiCode: 'AAABBB-CCCDDD-EEEfff-GGGHHH-IIIJJJ-KK',
        establishmentCode: '001',
        emissionPointCode: '001',
        documentType: '01',
        rangeFrom: 1,
        rangeTo: 9999,
        issuedAt: new Date('2026-01-01'),
        expiresAt: new Date('2027-01-01'),
        isActive: true,
      },
    }),
  );

  // Crear TaxRate en Empresa A
  await withRLSContext(prismaOwner, IDS.companyA, (tx) =>
    tx.taxRate.create({
      data: {
        id: IDS.taxRateA,
        companyId: IDS.companyA,
        code: 'ISV15_TEST',
        name: 'ISV 15% Test',
        rate: '0.1500',
        isActive: true,
      },
    }),
  );

  // Crear Invoice en Empresa A (DRAFT)
  await withRLSContext(prismaOwner, IDS.companyA, (tx) =>
    tx.invoice.create({
      data: {
        id: IDS.invoiceA,
        companyId: IDS.companyA,
        caiId: IDS.caiA,
        invoiceType: 'FACTURA',
        status: 'DRAFT',
        issueDate: new Date('2026-03-01'),
        contactId: IDS.contactA,
        currencyCode: 'HNL',
        exchangeRate: '1.000000',
        subtotal: '1000.00',
        taxAmount: '150.00',
        total: '1150.00',
        createdBy: 'test-user',
        lines: {
          create: [
            {
              id: IDS.invoiceLineA,
              companyId: IDS.companyA,
              lineNumber: 1,
              description: 'Servicio Test',
              quantity: '10.0000',
              unitPrice: '100.0000',
              discountPct: '0.00',
              subtotal: '1000.00',
              taxRateId: IDS.taxRateA,
              taxAmount: '150.00',
              total: '1150.00',
            },
          ],
        },
      },
    }),
  );
});

afterAll(async () => {
  await withAdminContext(prismaOwner, (tx) =>
    tx.invoiceLine.deleteMany({
      where: { companyId: { in: [IDS.companyA, IDS.companyB] } },
    }),
  );
  await withAdminContext(prismaOwner, (tx) =>
    tx.invoice.deleteMany({
      where: { companyId: { in: [IDS.companyA, IDS.companyB] } },
    }),
  );
  await withAdminContext(prismaOwner, (tx) =>
    tx.taxRate.deleteMany({
      where: { companyId: { in: [IDS.companyA, IDS.companyB] } },
    }),
  );
  await withAdminContext(prismaOwner, (tx) =>
    tx.cAI.deleteMany({
      where: { companyId: { in: [IDS.companyA, IDS.companyB] } },
    }),
  );
  await withAdminContext(prismaOwner, (tx) =>
    tx.contact.deleteMany({ where: { id: IDS.contactA } }),
  );
  await prismaOwner.company
    .deleteMany({
      where: { id: { in: [IDS.companyA, IDS.companyB] } },
    })
    .catch(() => {});
  await prismaOwner.$disconnect();
});

// ─── Tests: CAI isolation ─────────────────────────────────────────────────────

describe('Aislamiento multi-tenant — CAIs', () => {
  it('Empresa B NO puede leer el CAI de Empresa A', async () => {
    const cais = await withRLSContext(prismaOwner, IDS.companyB, (tx) =>
      tx.cAI.findMany({ where: { companyId: IDS.companyA } }),
    );
    expect(cais).toHaveLength(0);
  });

  it('Empresa A SÍ puede leer su propio CAI', async () => {
    const cais = await withRLSContext(prismaOwner, IDS.companyA, (tx) =>
      tx.cAI.findMany({ where: { companyId: IDS.companyA } }),
    );
    expect(cais.length).toBeGreaterThanOrEqual(1);
    expect(cais.find((c) => c.id === IDS.caiA)).toBeDefined();
  });

  it('Empresa B NO puede actualizar el CAI de Empresa A', async () => {
    await withRLSContext(prismaOwner, IDS.companyB, (tx) =>
      tx.cAI.updateMany({
        where: { id: IDS.caiA },
        data: { isActive: false },
      }),
    );
    // Verify CAI is still active (update was silently ignored by RLS extension)
    const cai = await withRLSContext(prismaOwner, IDS.companyA, (tx) =>
      tx.cAI.findFirst({ where: { id: IDS.caiA } }),
    );
    expect(cai?.isActive).toBe(true);
  });
});

// ─── Tests: TaxRate isolation ─────────────────────────────────────────────────

describe('Aislamiento multi-tenant — TaxRates', () => {
  it('Empresa B NO puede leer las tasas de impuesto de Empresa A', async () => {
    const rates = await withRLSContext(prismaOwner, IDS.companyB, (tx) =>
      tx.taxRate.findMany({ where: { companyId: IDS.companyA } }),
    );
    expect(rates).toHaveLength(0);
  });

  it('Empresa A SÍ puede leer sus propias tasas', async () => {
    const rates = await withRLSContext(prismaOwner, IDS.companyA, (tx) =>
      tx.taxRate.findMany({ where: { companyId: IDS.companyA } }),
    );
    expect(rates.length).toBeGreaterThanOrEqual(1);
    expect(rates.find((r) => r.id === IDS.taxRateA)).toBeDefined();
  });
});

// ─── Tests: Invoice isolation ─────────────────────────────────────────────────

describe('Aislamiento multi-tenant — Facturas', () => {
  it('Empresa B NO puede leer las facturas de Empresa A', async () => {
    const invoices = await withRLSContext(prismaOwner, IDS.companyB, (tx) =>
      tx.invoice.findMany({ where: { companyId: IDS.companyA } }),
    );
    expect(invoices).toHaveLength(0);
  });

  it('Empresa A SÍ puede leer su propia factura', async () => {
    const invoices = await withRLSContext(prismaOwner, IDS.companyA, (tx) =>
      tx.invoice.findMany({ where: { companyId: IDS.companyA } }),
    );
    expect(invoices.length).toBeGreaterThanOrEqual(1);
    expect(invoices.find((i) => i.id === IDS.invoiceA)).toBeDefined();
  });

  it('Empresa B NO puede actualizar la factura de Empresa A', async () => {
    await withRLSContext(prismaOwner, IDS.companyB, (tx) =>
      tx.invoice.updateMany({
        where: { id: IDS.invoiceA },
        data: { notes: 'Hackeado por Empresa B' },
      }),
    );
    // Verify notes were NOT changed
    const inv = await withRLSContext(prismaOwner, IDS.companyA, (tx) =>
      tx.invoice.findFirst({ where: { id: IDS.invoiceA } }),
    );
    expect(inv?.notes).toBeNull();
  });

  it('Empresa B NO puede eliminar la factura de Empresa A', async () => {
    await withRLSContext(prismaOwner, IDS.companyB, (tx) =>
      tx.invoice.deleteMany({ where: { id: IDS.invoiceA } }),
    );
    // Verify invoice still exists
    const inv = await withRLSContext(prismaOwner, IDS.companyA, (tx) =>
      tx.invoice.findFirst({ where: { id: IDS.invoiceA } }),
    );
    expect(inv).not.toBeNull();
  });
});

// ─── Tests: InvoiceLine isolation ────────────────────────────────────────────

describe('Aislamiento multi-tenant — Líneas de Factura', () => {
  it('Empresa B NO puede leer las líneas de factura de Empresa A', async () => {
    const lines = await withRLSContext(prismaOwner, IDS.companyB, (tx) =>
      tx.invoiceLine.findMany({ where: { companyId: IDS.companyA } }),
    );
    expect(lines).toHaveLength(0);
  });

  it('Empresa A SÍ puede leer sus propias líneas de factura', async () => {
    const lines = await withRLSContext(prismaOwner, IDS.companyA, (tx) =>
      tx.invoiceLine.findMany({ where: { companyId: IDS.companyA } }),
    );
    expect(lines.length).toBeGreaterThanOrEqual(1);
    expect(lines.find((l) => l.id === IDS.invoiceLineA)).toBeDefined();
  });
});
