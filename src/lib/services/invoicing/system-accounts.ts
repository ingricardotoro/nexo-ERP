// src/lib/services/invoicing/system-accounts.ts
//
// Resuelve las cuentas contables del sistema por systemPurpose,
// con fallback por código NIIF estándar.
//
// Usado por publishInvoice para generar asientos automáticos
// sin depender de códigos hardcoded (1103, 2102, 4101).

import type { SystemAccountPurpose } from '@prisma/client';
import type { TenantPrismaClient } from '@/lib/db/tenant-extension';

export interface SystemAccounts {
  accountsReceivable: { id: string; code: string };
  isvPayable: { id: string; code: string } | null;
  salesRevenue: { id: string; code: string } | null;
}

/** Well-known NIIF Honduras codes as fallback when systemPurpose is not set. */
const FALLBACK_CODES: Record<SystemAccountPurpose, string> = {
  ACCOUNTS_RECEIVABLE: '1103',
  ISV_PAYABLE: '2102',
  SALES_REVENUE: '4101',
  ACCOUNTS_PAYABLE: '2103',
  PURCHASE_EXPENSE: '5101',
};

async function findSystemAccount(
  db: TenantPrismaClient,
  companyId: string,
  purpose: SystemAccountPurpose,
): Promise<{ id: string; code: string } | null> {
  // Priority 1: account marked with systemPurpose
  const byPurpose = await db.account.findFirst({
    where: { companyId, systemPurpose: purpose, isActive: true, allowDirectEntry: true },
    select: { id: true, code: true },
  });
  if (byPurpose) return byPurpose;

  // Priority 2: fallback by standard NIIF code
  const fallbackCode = FALLBACK_CODES[purpose];
  const byCode = await db.account.findFirst({
    where: { companyId, code: fallbackCode, isActive: true, allowDirectEntry: true },
    select: { id: true, code: true },
  });
  return byCode;
}

/**
 * Resuelve las cuentas del sistema necesarias para asientos de facturación.
 *
 * Busca por `systemPurpose` primero, luego por código NIIF estándar.
 * Lanza error claro si la cuenta de CxC no se encuentra (obligatoria).
 * ISV y Ventas son opcionales (pueden ser null si no existen).
 */
export async function resolveInvoiceAccounts(
  db: TenantPrismaClient,
  companyId: string,
): Promise<SystemAccounts> {
  const [ar, isv, revenue] = await Promise.all([
    findSystemAccount(db, companyId, 'ACCOUNTS_RECEIVABLE'),
    findSystemAccount(db, companyId, 'ISV_PAYABLE'),
    findSystemAccount(db, companyId, 'SALES_REVENUE'),
  ]);

  if (!ar) {
    throw new Error(
      'Cuenta de Cuentas por Cobrar no encontrada. Asigne systemPurpose=ACCOUNTS_RECEIVABLE a una cuenta, o cree la cuenta 1103.',
    );
  }

  return {
    accountsReceivable: ar,
    isvPayable: isv,
    salesRevenue: revenue,
  };
}
