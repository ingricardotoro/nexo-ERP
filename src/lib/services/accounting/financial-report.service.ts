// src/lib/services/accounting/financial-report.service.ts
import type { AccountType } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import basePrisma from '@/lib/db/prisma';
import { createTenantPrisma } from '@/lib/db/tenant-extension';
import type {
  BalanceSheetQuery,
  IncomeStatementQuery,
} from '@/lib/validations/financial-report.schema';

// ─── Shared internal types ────────────────────────────────────────────────────

interface AccountRow {
  id: string;
  code: string;
  name: string;
  parentId: string | null;
  accountType: AccountType;
  accountNature: 'DEBIT' | 'CREDIT';
  isParent: boolean;
  totalDebit: string; // sum of debit movements (base currency)
  totalCredit: string; // sum of credit movements (base currency)
  balance: string; // net balance (positive = normal balance)
  level: number; // depth in tree (1 = root)
}

interface ReportSection {
  accountType: AccountType;
  label: string;
  accounts: AccountRow[];
  total: string;
}

// ─── Public types ─────────────────────────────────────────────────────────────

export interface BalanceSheetReport {
  asOfDate: string;
  sections: ReportSection[];
  totalAssets: string;
  totalLiabilities: string;
  totalEquity: string;
  totalLiabilitiesAndEquity: string;
  isBalanced: boolean; // totalAssets ≈ totalLiabilitiesAndEquity
}

export interface IncomeStatementReport {
  dateFrom: string;
  dateTo: string;
  sections: ReportSection[];
  totalRevenue: string;
  totalCost: string;
  grossProfit: string;
  totalExpenses: string;
  netIncome: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Convierte Decimal | null a string decimal (sin notación científica) */
function dec(value: Decimal | null | undefined): string {
  return (value ?? new Decimal(0)).toFixed(2);
}

/** Suma segura de strings decimales */
function addDec(a: string, b: string): string {
  return new Decimal(a).plus(new Decimal(b)).toFixed(2);
}

/** Resta segura de strings decimales */
function subDec(a: string, b: string): string {
  return new Decimal(a).minus(new Decimal(b)).toFixed(2);
}

/**
 * Obtiene los saldos agregados de líneas de asiento para un conjunto de entradas POSTED.
 * Retorna un Map<accountId, { totalDebit, totalCredit }>.
 */
async function getMovements(
  companyId: string,
  entryIds: string[],
): Promise<Map<string, { totalDebit: string; totalCredit: string }>> {
  if (entryIds.length === 0) return new Map();

  const movements = await basePrisma.journalEntryLine.groupBy({
    by: ['accountId'],
    where: {
      companyId,
      journalEntryId: { in: entryIds },
    },
    _sum: { debit: true, credit: true },
  });

  return new Map(
    movements.map((m) => [
      m.accountId,
      {
        totalDebit: dec(m._sum.debit),
        totalCredit: dec(m._sum.credit),
      },
    ]),
  );
}

/**
 * Calcula el balance de cada cuenta usando los movimientos del período.
 * Para parent accounts, propaga la suma de los hijos (bottom-up).
 */
function buildAccountRows(
  accounts: {
    id: string;
    code: string;
    name: string;
    parentId: string | null;
    accountType: AccountType;
    accountNature: string;
    isParent: boolean;
  }[],
  movements: Map<string, { totalDebit: string; totalCredit: string }>,
): AccountRow[] {
  // Calcular profundidad de cada cuenta en el árbol
  const depthMap = new Map<string, number>();
  const parentMap = new Map<string, string | null>(accounts.map((a) => [a.id, a.parentId]));

  function getDepth(id: string): number {
    if (depthMap.has(id)) return depthMap.get(id)!;
    const parentId = parentMap.get(id);
    const depth = parentId ? getDepth(parentId) + 1 : 1;
    depthMap.set(id, depth);
    return depth;
  }
  accounts.forEach((a) => getDepth(a.id));

  // Calcular balance neto de cada cuenta hoja
  const leafBalances = new Map<string, { debit: string; credit: string; balance: string }>();

  for (const acc of accounts) {
    if (!acc.isParent) {
      const mov = movements.get(acc.id) ?? { totalDebit: '0.00', totalCredit: '0.00' };
      const balance =
        acc.accountNature === 'DEBIT'
          ? subDec(mov.totalDebit, mov.totalCredit)
          : subDec(mov.totalCredit, mov.totalDebit);
      leafBalances.set(acc.id, {
        debit: mov.totalDebit,
        credit: mov.totalCredit,
        balance,
      });
    }
  }

  // Propagar sumas hacia los parents (bottom-up)
  const computedParents = new Map<string, { debit: string; credit: string; balance: string }>();

  function getParentBalance(id: string): { debit: string; credit: string; balance: string } {
    if (computedParents.has(id)) return computedParents.get(id)!;

    const acc = accounts.find((a) => a.id === id)!;
    if (!acc.isParent) {
      return leafBalances.get(id) ?? { debit: '0.00', credit: '0.00', balance: '0.00' };
    }

    const children = accounts.filter((a) => a.parentId === id);
    let debit = '0.00';
    let credit = '0.00';
    let balance = '0.00';

    for (const child of children) {
      const childBalance = getParentBalance(child.id);
      debit = addDec(debit, childBalance.debit);
      credit = addDec(credit, childBalance.credit);
      balance = addDec(balance, childBalance.balance);
    }

    const result = { debit, credit, balance };
    computedParents.set(id, result);
    return result;
  }

  accounts.forEach((a) => {
    if (a.isParent) getParentBalance(a.id);
  });

  // Construir filas finales
  return accounts.map((acc): AccountRow => {
    const data = acc.isParent
      ? (computedParents.get(acc.id) ?? { debit: '0.00', credit: '0.00', balance: '0.00' })
      : (leafBalances.get(acc.id) ?? { debit: '0.00', credit: '0.00', balance: '0.00' });

    return {
      id: acc.id,
      code: acc.code,
      name: acc.name,
      parentId: acc.parentId,
      accountType: acc.accountType,
      accountNature: acc.accountNature as 'DEBIT' | 'CREDIT',
      isParent: acc.isParent,
      totalDebit: data.debit,
      totalCredit: data.credit,
      balance: data.balance,
      level: depthMap.get(acc.id) ?? 1,
    };
  });
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const financialReportService = {
  /**
   * Balance General (Balance Sheet) al corte de una fecha.
   * Solo considera asientos POSTED con entryDate ≤ asOfDate.
   */
  async getBalanceSheet(companyId: string, query: BalanceSheetQuery): Promise<BalanceSheetReport> {
    const { asOfDate } = query;
    const db = createTenantPrisma(basePrisma, companyId);

    // 1. Cuentas del Balance (Activo, Pasivo, Patrimonio) — solo las marcadas para reportes
    const accounts = await db.account.findMany({
      where: {
        isActive: true,
        showInReports: true,
        accountType: { in: ['ASSET', 'LIABILITY', 'EQUITY'] },
      },
      orderBy: { code: 'asc' },
    });

    // 2. IDs de asientos POSTED ≤ asOfDate
    const postedEntries = await db.journalEntry.findMany({
      where: {
        status: 'POSTED',
        entryDate: { lte: new Date(asOfDate) },
      },
      select: { id: true },
    });

    const entryIds = postedEntries.map((e) => e.id);
    const movements = await getMovements(companyId, entryIds);

    // 3. Calcular balances y armar secciones
    const allRows = buildAccountRows(accounts, movements);

    const sectionDefs: { type: AccountType; label: string }[] = [
      { type: 'ASSET', label: 'Activos' },
      { type: 'LIABILITY', label: 'Pasivos' },
      { type: 'EQUITY', label: 'Patrimonio' },
    ];

    const sections: ReportSection[] = sectionDefs.map(({ type, label }) => {
      const rows = allRows.filter((r) => r.accountType === type);
      const total = rows
        .filter((r) => r.parentId === null) // solo raíces para el total
        .reduce((sum, r) => addDec(sum, r.balance), '0.00');
      return { accountType: type, label, accounts: rows, total };
    });

    const totalAssets = sections.find((s) => s.accountType === 'ASSET')?.total ?? '0.00';
    const totalLiabilities = sections.find((s) => s.accountType === 'LIABILITY')?.total ?? '0.00';
    const totalEquity = sections.find((s) => s.accountType === 'EQUITY')?.total ?? '0.00';
    const totalLiabilitiesAndEquity = addDec(totalLiabilities, totalEquity);

    const diff = new Decimal(totalAssets).minus(new Decimal(totalLiabilitiesAndEquity)).abs();
    const isBalanced = diff.lessThan(new Decimal('0.01'));

    return {
      asOfDate,
      sections,
      totalAssets,
      totalLiabilities,
      totalEquity,
      totalLiabilitiesAndEquity,
      isBalanced,
    };
  },

  /**
   * Estado de Resultados (Income Statement) para un rango de fechas.
   * Solo considera asientos POSTED dentro del período.
   */
  async getIncomeStatement(
    companyId: string,
    query: IncomeStatementQuery,
  ): Promise<IncomeStatementReport> {
    const { dateFrom, dateTo } = query;
    const db = createTenantPrisma(basePrisma, companyId);

    // 1. Cuentas de Resultados (Ingresos, Costos, Gastos) — solo las marcadas para reportes
    const accounts = await db.account.findMany({
      where: {
        isActive: true,
        showInReports: true,
        accountType: { in: ['INCOME', 'COST', 'EXPENSE'] },
      },
      orderBy: { code: 'asc' },
    });

    // 2. IDs de asientos POSTED dentro del rango
    const postedEntries = await db.journalEntry.findMany({
      where: {
        status: 'POSTED',
        entryDate: {
          gte: new Date(dateFrom),
          lte: new Date(dateTo),
        },
      },
      select: { id: true },
    });

    const entryIds = postedEntries.map((e) => e.id);
    const movements = await getMovements(companyId, entryIds);

    // 3. Calcular balances y armar secciones
    const allRows = buildAccountRows(accounts, movements);

    const sectionDefs: { type: AccountType; label: string }[] = [
      { type: 'INCOME', label: 'Ingresos' },
      { type: 'COST', label: 'Costo de Ventas' },
      { type: 'EXPENSE', label: 'Gastos Operativos' },
    ];

    const sections: ReportSection[] = sectionDefs.map(({ type, label }) => {
      const rows = allRows.filter((r) => r.accountType === type);
      const total = rows
        .filter((r) => r.parentId === null)
        .reduce((sum, r) => addDec(sum, r.balance), '0.00');
      return { accountType: type, label, accounts: rows, total };
    });

    const totalRevenue = sections.find((s) => s.accountType === 'INCOME')?.total ?? '0.00';
    const totalCost = sections.find((s) => s.accountType === 'COST')?.total ?? '0.00';
    const totalExpenses = sections.find((s) => s.accountType === 'EXPENSE')?.total ?? '0.00';
    const grossProfit = subDec(totalRevenue, totalCost);
    const netIncome = subDec(grossProfit, totalExpenses);

    return {
      dateFrom,
      dateTo,
      sections,
      totalRevenue,
      totalCost,
      grossProfit,
      totalExpenses,
      netIncome,
    };
  },
};
