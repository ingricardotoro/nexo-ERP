// src/lib/services/accounting/aging-report.service.ts
//
// Reportes de Antigüedad de Saldos — CxC (Cuentas por Cobrar) y CxP (Cuentas por Pagar)
//
// Metodología: agrupa movimientos contables de asientos POSTED por tramos de antigüedad
// basados en la fecha del asiento (entry_date → asOfDate).
// Nota: Requiere Fase 3 (Invoicing) para un aging basado en fecha de vencimiento de facturas.
//
import type { AccountType } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import basePrisma from '@/lib/db/prisma';
import { createTenantPrisma } from '@/lib/db/tenant-extension';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AgingBuckets {
  current: string; // 0–30 días
  days31_60: string; // 31–60 días
  days61_90: string; // 61–90 días
  days90plus: string; // > 90 días
  total: string;
}

export interface AgingAccountRow {
  accountId: string;
  accountCode: string;
  accountName: string;
  parentId: string | null;
  isParent: boolean;
  level: number;
  buckets: AgingBuckets;
}

export interface AgingReport {
  asOfDate: string;
  reportType: 'CXC' | 'CXP';
  label: string;
  accounts: AgingAccountRow[]; // incluye solo cuentas con saldo != 0
  totals: AgingBuckets;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function zeroBuckets(): AgingBuckets {
  return {
    current: '0.00',
    days31_60: '0.00',
    days61_90: '0.00',
    days90plus: '0.00',
    total: '0.00',
  };
}

function addToBucket(
  buckets: AgingBuckets,
  bucket: keyof Omit<AgingBuckets, 'total'>,
  amount: string,
): AgingBuckets {
  const updated = { ...buckets };
  updated[bucket] = new Decimal(updated[bucket]).plus(new Decimal(amount)).toFixed(2);
  updated.total = new Decimal(updated.total).plus(new Decimal(amount)).toFixed(2);
  return updated;
}

function getBucketKey(days: number): keyof Omit<AgingBuckets, 'total'> {
  if (days <= 30) return 'current';
  if (days <= 60) return 'days31_60';
  if (days <= 90) return 'days61_90';
  return 'days90plus';
}

function addBuckets(a: AgingBuckets, b: AgingBuckets): AgingBuckets {
  return {
    current: new Decimal(a.current).plus(b.current).toFixed(2),
    days31_60: new Decimal(a.days31_60).plus(b.days31_60).toFixed(2),
    days61_90: new Decimal(a.days61_90).plus(b.days61_90).toFixed(2),
    days90plus: new Decimal(a.days90plus).plus(b.days90plus).toFixed(2),
    total: new Decimal(a.total).plus(b.total).toFixed(2),
  };
}

function daysBetween(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
}

// ─── Core shared function ─────────────────────────────────────────────────────

async function computeAging(
  companyId: string,
  accountTypes: AccountType[],
  asOfDate: string,
  reportType: 'CXC' | 'CXP',
  label: string,
): Promise<AgingReport> {
  const db = createTenantPrisma(basePrisma, companyId);
  const cutDate = new Date(asOfDate);

  // 1. Cuentas activas del tipo solicitado (incluye parents para el árbol)
  const accounts = await db.account.findMany({
    where: { isActive: true, accountType: { in: accountTypes } },
    orderBy: { code: 'asc' },
    select: {
      id: true,
      code: true,
      name: true,
      parentId: true,
      isParent: true,
      accountNature: true,
    },
  });

  if (accounts.length === 0) {
    return { asOfDate, reportType, label, accounts: [], totals: zeroBuckets() };
  }

  const accountIds = accounts.map((a) => a.id);

  // 2. IDs de asientos POSTED ≤ asOfDate
  const postedEntries = await db.journalEntry.findMany({
    where: { status: 'POSTED', entryDate: { lte: cutDate } },
    select: { id: true, entryDate: true },
  });

  // 3. Líneas de esos asientos para las cuentas objetivo
  // Procesamos en lotes para no sobrecargar si hay muchos asientos
  const entryIds = postedEntries.map((e) => e.id);
  const entryDateMap = new Map(postedEntries.map((e) => [e.id, e.entryDate]));

  if (entryIds.length === 0) {
    return { asOfDate, reportType, label, accounts: [], totals: zeroBuckets() };
  }

  const lines = await basePrisma.journalEntryLine.findMany({
    where: { companyId, journalEntryId: { in: entryIds }, accountId: { in: accountIds } },
    select: { accountId: true, journalEntryId: true, debit: true, credit: true },
  });

  // 4. Calcular saldo neto por cuenta y por bucket de antigüedad
  //    CxC (DEBIT nature): saldo = debit - credit   (positivo = pendiente de cobrar)
  //    CxP (CREDIT nature): saldo = credit - debit  (positivo = pendiente de pagar)
  const accountNatureMap = new Map(accounts.map((a) => [a.id, a.accountNature]));
  const leafBuckets = new Map<string, AgingBuckets>();

  for (const line of lines) {
    const entryDate = entryDateMap.get(line.journalEntryId)!;
    const days = daysBetween(entryDate, cutDate);
    const bucket = getBucketKey(days);
    const nature = accountNatureMap.get(line.accountId) ?? 'DEBIT';

    const debit = new Decimal(line.debit.toString());
    const credit = new Decimal(line.credit.toString());
    // El "aporte neto" al saldo pendiente según la naturaleza de la cuenta
    const netAmount = nature === 'DEBIT' ? debit.minus(credit) : credit.minus(debit);

    const current = leafBuckets.get(line.accountId) ?? zeroBuckets();
    leafBuckets.set(line.accountId, addToBucket(current, bucket, netAmount.toString()));
  }

  // 5. Propagar sumas hacia parents (bottom-up)
  const depthMap = new Map<string, number>();
  const parentMap = new Map(accounts.map((a) => [a.id, a.parentId]));

  function getDepth(id: string): number {
    if (depthMap.has(id)) return depthMap.get(id)!;
    const parentId = parentMap.get(id);
    const depth = parentId ? getDepth(parentId) + 1 : 1;
    depthMap.set(id, depth);
    return depth;
  }
  accounts.forEach((a) => getDepth(a.id));

  const computedParents = new Map<string, AgingBuckets>();

  function getParentBuckets(id: string): AgingBuckets {
    if (computedParents.has(id)) return computedParents.get(id)!;
    const acc = accounts.find((a) => a.id === id)!;
    if (!acc.isParent) return leafBuckets.get(id) ?? zeroBuckets();

    const children = accounts.filter((a) => a.parentId === id);
    let result = zeroBuckets();
    for (const child of children) {
      result = addBuckets(result, getParentBuckets(child.id));
    }
    computedParents.set(id, result);
    return result;
  }

  accounts.forEach((a) => {
    if (a.isParent) getParentBuckets(a.id);
  });

  // 6. Construir filas — excluir cuentas con saldo 0 (salvo parents con hijos activos)
  const rows: AgingAccountRow[] = [];

  for (const acc of accounts) {
    const buckets = acc.isParent
      ? (computedParents.get(acc.id) ?? zeroBuckets())
      : (leafBuckets.get(acc.id) ?? zeroBuckets());

    const isZeroBalance = new Decimal(buckets.total).abs().lessThan(new Decimal('0.01'));
    if (isZeroBalance) continue;

    rows.push({
      accountId: acc.id,
      accountCode: acc.code,
      accountName: acc.name,
      parentId: acc.parentId,
      isParent: acc.isParent,
      level: depthMap.get(acc.id) ?? 1,
      buckets,
    });
  }

  // 7. Totales globales
  const totals = rows
    .filter((r) => r.parentId === null || !accounts.some((a) => a.id === r.parentId))
    .reduce((acc, r) => addBuckets(acc, r.buckets), zeroBuckets());

  return { asOfDate, reportType, label, accounts: rows, totals };
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const agingReportService = {
  /**
   * Antigüedad de Cuentas por Cobrar (CxC).
   * Cuentas de tipo ASSET con naturaleza DEBIT (cuentas de clientes, anticipos, etc.)
   */
  async getCxcAging(companyId: string, asOfDate: string): Promise<AgingReport> {
    return computeAging(companyId, ['ASSET'], asOfDate, 'CXC', 'Cuentas por Cobrar');
  },

  /**
   * Antigüedad de Cuentas por Pagar (CxP).
   * Cuentas de tipo LIABILITY con naturaleza CREDIT (cuentas de proveedores).
   */
  async getCxpAging(companyId: string, asOfDate: string): Promise<AgingReport> {
    return computeAging(companyId, ['LIABILITY'], asOfDate, 'CXP', 'Cuentas por Pagar');
  },
};
