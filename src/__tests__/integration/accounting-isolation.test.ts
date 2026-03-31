// src/__tests__/integration/accounting-isolation.test.ts
/**
 * Tests de integración — Aislamiento multi-tenant del módulo contable (F2-15).
 *
 * Verifica que las entidades contables (cuentas, diarios, asientos) de una empresa
 * no son visibles desde otra empresa usando createTenantPrisma (Prisma Extension).
 *
 * Estrategia:
 * - Empresa A y Empresa B con fixtures reales en BD
 * - Crear recursos contables en Empresa A (cuenta, diario, asiento)
 * - Verificar que Empresa B NO puede leerlos ni modificarlos
 * - Cleanup completo en afterAll
 *
 * Requiere: .env.local con DATABASE_URL apuntando a BD de test.
 *
 * @see src/__tests__/multi-tenant-isolation.test.ts — patrón base
 */

import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { TENANT_A, TENANT_B } from '../helpers/multi-tenant';
import { withRLSContext, withAdminContext } from '../helpers/rls-session';

const prismaOwner = new PrismaClient();
const prismaA = new PrismaClient();
const prismaB = new PrismaClient();

// ─── IDs de fixtures ──────────────────────────────────────────────────────────

const IDS = {
  companyA: TENANT_A.id,
  companyB: TENANT_B.id,
  userA: '00000000-0000-0000-0000-0000acc00001',
  userB: '00000000-0000-0000-0000-0000acc00002',
  fiscalYearA: '00000000-0000-0000-0000-0000acc00010',
  fiscalPeriodA: '00000000-0000-0000-0000-0000acc00020',
  journalA: '00000000-0000-0000-0000-0000acc00030',
  accountA: '00000000-0000-0000-0000-0000acc00040',
  entryA: '00000000-0000-0000-0000-0000acc00050',
};

// ─── Setup / Teardown ─────────────────────────────────────────────────────────

beforeAll(async () => {
  // Cleanup previo por si quedaron restos de una ejecución anterior
  await prismaOwner
    .$executeRawUnsafe(
      `DELETE FROM journal_entry_lines WHERE company_id IN ('${IDS.companyA}','${IDS.companyB}')`,
    )
    .catch(() => {});
  await prismaOwner
    .$executeRawUnsafe(
      `DELETE FROM journal_entries WHERE company_id IN ('${IDS.companyA}','${IDS.companyB}')`,
    )
    .catch(() => {});
  await prismaOwner
    .$executeRawUnsafe(
      `DELETE FROM journal_sequences WHERE company_id IN ('${IDS.companyA}','${IDS.companyB}')`,
    )
    .catch(() => {});
  await prismaOwner
    .$executeRawUnsafe(
      `DELETE FROM journals WHERE company_id IN ('${IDS.companyA}','${IDS.companyB}')`,
    )
    .catch(() => {});
  await prismaOwner
    .$executeRawUnsafe(
      `DELETE FROM accounts WHERE company_id IN ('${IDS.companyA}','${IDS.companyB}')`,
    )
    .catch(() => {});
  await prismaOwner
    .$executeRawUnsafe(
      `DELETE FROM fiscal_periods WHERE company_id IN ('${IDS.companyA}','${IDS.companyB}')`,
    )
    .catch(() => {});
  await prismaOwner
    .$executeRawUnsafe(
      `DELETE FROM fiscal_years WHERE company_id IN ('${IDS.companyA}','${IDS.companyB}')`,
    )
    .catch(() => {});
  await prismaOwner
    .$executeRawUnsafe(`DELETE FROM users WHERE id IN ('${IDS.userA}','${IDS.userB}')`)
    .catch(() => {});
  await prismaOwner
    .$executeRawUnsafe(`DELETE FROM companies WHERE id IN ('${IDS.companyA}','${IDS.companyB}')`)
    .catch(() => {});

  // Asegurar que existan las monedas base (la BD de CI no tiene seed)
  await prismaOwner.currency
    .upsert({
      where: { code: 'HNL' },
      update: {},
      create: { code: 'HNL', name: 'Lempira hondureño', symbol: 'L', isActive: true, isBase: true },
    })
    .catch(() => {});

  // Crear empresas
  await prismaOwner.company.create({
    data: {
      id: IDS.companyA,
      legalName: 'Empresa Contable A',
      tradeName: 'A',
      rtn: '0801-ACC-00001',
      maxUsers: 5,
    },
  });
  await prismaOwner.company.create({
    data: {
      id: IDS.companyB,
      legalName: 'Empresa Contable B',
      tradeName: 'B',
      rtn: '0501-ACC-00002',
      maxUsers: 5,
    },
  });

  // Crear usuarios
  await withRLSContext(prismaOwner, IDS.companyA, (tx) =>
    tx.user.create({
      data: {
        id: IDS.userA,
        email: 'acc-a@test.nexoerp.com',
        fullName: 'Contador A',
        cognitoSub: 'acc-cog-a',
        companyId: IDS.companyA,
        role: 'ACCOUNTANT',
      },
    }),
  );
  await withRLSContext(prismaOwner, IDS.companyB, (tx) =>
    tx.user.create({
      data: {
        id: IDS.userB,
        email: 'acc-b@test.nexoerp.com',
        fullName: 'Contador B',
        cognitoSub: 'acc-cog-b',
        companyId: IDS.companyB,
        role: 'ACCOUNTANT',
      },
    }),
  );

  // Crear año fiscal y período en Empresa A
  await withRLSContext(prismaOwner, IDS.companyA, (tx) =>
    tx.fiscalYear.create({
      data: {
        id: IDS.fiscalYearA,
        companyId: IDS.companyA,
        year: 2099,
        startDate: new Date('2099-01-01'),
        endDate: new Date('2099-12-31'),
        status: 'OPEN',
      },
    }),
  );
  await withRLSContext(prismaOwner, IDS.companyA, (tx) =>
    tx.fiscalPeriod.create({
      data: {
        id: IDS.fiscalPeriodA,
        companyId: IDS.companyA,
        fiscalYearId: IDS.fiscalYearA,
        periodNumber: 1,
        name: 'Enero 2099',
        startDate: new Date('2099-01-01'),
        endDate: new Date('2099-01-31'),
        status: 'OPEN',
      },
    }),
  );

  // Crear diario en Empresa A
  await withRLSContext(prismaOwner, IDS.companyA, (tx) =>
    tx.journal.create({
      data: {
        id: IDS.journalA,
        companyId: IDS.companyA,
        code: 'TST',
        name: 'Diario Test A',
        journalType: 'GENERAL',
        isActive: true,
      },
    }),
  );

  // Crear cuenta contable en Empresa A
  await withRLSContext(prismaOwner, IDS.companyA, (tx) =>
    tx.account.create({
      data: {
        id: IDS.accountA,
        companyId: IDS.companyA,
        code: '9999',
        name: 'Cuenta Test A',
        accountType: 'ASSET',
        accountNature: 'DEBIT',
        isParent: false,
        isActive: true,
        allowDirectEntry: true,
      },
    }),
  );

  // Crear asiento en Empresa A
  await withRLSContext(prismaOwner, IDS.companyA, async (tx) => {
    const entry = await tx.journalEntry.create({
      data: {
        id: IDS.entryA,
        companyId: IDS.companyA,
        journalId: IDS.journalA,
        fiscalPeriodId: IDS.fiscalPeriodA,
        entryNumber: 9999,
        entryDate: new Date('2099-01-15'),
        description: 'Asiento aislamiento test',
        status: 'DRAFT',
        currencyCode: 'HNL',
        exchangeRate: 1,
        totalDebit: 500,
        totalCredit: 500,
        createdBy: IDS.userA,
      },
    });
    await tx.journalEntryLine.createMany({
      data: [
        {
          companyId: IDS.companyA,
          journalEntryId: entry.id,
          accountId: IDS.accountA,
          lineNumber: 1,
          debit: 500,
          credit: 0,
          currencyDebit: 500,
          currencyCredit: 0,
        },
        {
          companyId: IDS.companyA,
          journalEntryId: entry.id,
          accountId: IDS.accountA,
          lineNumber: 2,
          debit: 0,
          credit: 500,
          currencyDebit: 0,
          currencyCredit: 500,
        },
      ],
    });
    return entry;
  });
});

afterAll(async () => {
  await withAdminContext(prismaOwner, async (tx) => {
    await tx.journalEntryLine.deleteMany({
      where: { companyId: { in: [IDS.companyA, IDS.companyB] } },
    });
    await tx.journalEntry.deleteMany({
      where: { companyId: { in: [IDS.companyA, IDS.companyB] } },
    });
  });
  await prismaOwner
    .$executeRawUnsafe(
      `DELETE FROM journal_sequences WHERE company_id IN ('${IDS.companyA}','${IDS.companyB}')`,
    )
    .catch(() => {});
  await withAdminContext(prismaOwner, async (tx) => {
    await tx.journal.deleteMany({ where: { companyId: { in: [IDS.companyA, IDS.companyB] } } });
    await tx.account.deleteMany({ where: { companyId: { in: [IDS.companyA, IDS.companyB] } } });
    await tx.fiscalPeriod.deleteMany({
      where: { companyId: { in: [IDS.companyA, IDS.companyB] } },
    });
    await tx.fiscalYear.deleteMany({ where: { companyId: { in: [IDS.companyA, IDS.companyB] } } });
    await tx.user.deleteMany({ where: { id: { in: [IDS.userA, IDS.userB] } } });
    await tx.company.deleteMany({ where: { id: { in: [IDS.companyA, IDS.companyB] } } });
  });

  await prismaOwner.$disconnect();
  await prismaA.$disconnect();
  await prismaB.$disconnect();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Accounting — Aislamiento multi-tenant (RLS + Prisma Extension)', () => {
  describe('Cuentas contables', () => {
    it('Empresa A ve su propia cuenta', async () => {
      const accounts = await withRLSContext(prismaA, IDS.companyA, (tx) =>
        tx.account.findMany({ where: { id: IDS.accountA } }),
      );
      expect(accounts).toHaveLength(1);
      expect(accounts[0]?.companyId).toBe(IDS.companyA);
    });

    it('Empresa B NO ve la cuenta de Empresa A', async () => {
      const accounts = await withRLSContext(prismaB, IDS.companyB, (tx) =>
        tx.account.findMany({ where: { id: IDS.accountA } }),
      );
      expect(accounts).toHaveLength(0);
    });
  });

  describe('Diarios contables', () => {
    it('Empresa A ve su propio diario', async () => {
      const journals = await withRLSContext(prismaA, IDS.companyA, (tx) =>
        tx.journal.findMany({ where: { id: IDS.journalA } }),
      );
      expect(journals).toHaveLength(1);
      expect(journals[0]?.companyId).toBe(IDS.companyA);
    });

    it('Empresa B NO ve el diario de Empresa A', async () => {
      const journals = await withRLSContext(prismaB, IDS.companyB, (tx) =>
        tx.journal.findMany({ where: { id: IDS.journalA } }),
      );
      expect(journals).toHaveLength(0);
    });
  });

  describe('Años y períodos fiscales', () => {
    it('Empresa A ve su año fiscal', async () => {
      const years = await withRLSContext(prismaA, IDS.companyA, (tx) =>
        tx.fiscalYear.findMany({ where: { id: IDS.fiscalYearA } }),
      );
      expect(years).toHaveLength(1);
      expect(years[0]?.companyId).toBe(IDS.companyA);
    });

    it('Empresa B NO ve el año fiscal de Empresa A', async () => {
      const years = await withRLSContext(prismaB, IDS.companyB, (tx) =>
        tx.fiscalYear.findMany({ where: { id: IDS.fiscalYearA } }),
      );
      expect(years).toHaveLength(0);
    });

    it('Empresa B NO ve el período fiscal de Empresa A', async () => {
      const periods = await withRLSContext(prismaB, IDS.companyB, (tx) =>
        tx.fiscalPeriod.findMany({ where: { id: IDS.fiscalPeriodA } }),
      );
      expect(periods).toHaveLength(0);
    });
  });

  describe('Asientos contables', () => {
    it('Empresa A ve su propio asiento', async () => {
      const entries = await withRLSContext(prismaA, IDS.companyA, (tx) =>
        tx.journalEntry.findMany({ where: { id: IDS.entryA } }),
      );
      expect(entries).toHaveLength(1);
      expect(entries[0]?.companyId).toBe(IDS.companyA);
    });

    it('Empresa B NO ve el asiento de Empresa A', async () => {
      const entries = await withRLSContext(prismaB, IDS.companyB, (tx) =>
        tx.journalEntry.findMany({ where: { id: IDS.entryA } }),
      );
      expect(entries).toHaveLength(0);
    });

    it('Empresa B NO puede actualizar asientos de Empresa A', async () => {
      const result = await withRLSContext(prismaB, IDS.companyB, (tx) =>
        tx.journalEntry.updateMany({
          where: { id: IDS.entryA },
          data: { description: 'Hackeado' },
        }),
      );
      // RLS + Prisma Extension: count = 0 (no tiene acceso)
      expect(result.count).toBe(0);

      // Verificar que el asiento A no fue modificado
      const entryA = await withAdminContext(prismaOwner, (tx) =>
        tx.journalEntry.findUnique({ where: { id: IDS.entryA } }),
      );
      expect(entryA?.description).toBe('Asiento aislamiento test');
    });

    it('Empresa B NO puede eliminar asientos de Empresa A', async () => {
      const result = await withRLSContext(prismaB, IDS.companyB, (tx) =>
        tx.journalEntry.deleteMany({ where: { id: IDS.entryA } }),
      );
      expect(result.count).toBe(0);

      // Verificar que sigue existiendo
      const entryA = await withAdminContext(prismaOwner, (tx) =>
        tx.journalEntry.findUnique({ where: { id: IDS.entryA } }),
      );
      expect(entryA).not.toBeNull();
    });
  });

  describe('Líneas de asiento', () => {
    it('Empresa B NO ve las líneas de asientos de Empresa A', async () => {
      const lines = await withRLSContext(prismaB, IDS.companyB, (tx) =>
        tx.journalEntryLine.findMany({ where: { journalEntryId: IDS.entryA } }),
      );
      expect(lines).toHaveLength(0);
    });
  });
});
