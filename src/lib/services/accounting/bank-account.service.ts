// src/lib/services/accounting/bank-account.service.ts
// F2-13: Gestión de Cuentas Bancarias — CRUD.
//
// Una BankAccount vincula un estado de cuenta físico del banco
// con una cuenta contable tipo ASSET del plan de cuentas.

import basePrisma from '@/lib/db/prisma';
import { createTenantPrisma } from '@/lib/db/tenant-extension';
import type { BankAccountType } from '@prisma/client';
import {
  createBankAccountSchema,
  updateBankAccountSchema,
  type CreateBankAccountInput,
  type UpdateBankAccountInput,
} from '@/lib/validations/bank.schema';

export interface BankAccountRow {
  id: string;
  name: string;
  bankName: string;
  accountNumber: string;
  accountType: BankAccountType;
  ledgerAccountId: string;
  ledgerAccountCode: string;
  ledgerAccountName: string;
  currencyCode: string;
  currentBalance: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toRow(ba: any): BankAccountRow {
  return {
    id: ba.id,
    name: ba.name,
    bankName: ba.bankName,
    accountNumber: ba.accountNumber,
    accountType: ba.accountType,
    ledgerAccountId: ba.ledgerAccountId,
    ledgerAccountCode: ba.ledgerAccount?.code ?? '',
    ledgerAccountName: ba.ledgerAccount?.name ?? '',
    currencyCode: ba.currencyCode,
    currentBalance: ba.currentBalance.toString(),
    isActive: ba.isActive,
    createdAt: ba.createdAt,
    updatedAt: ba.updatedAt,
  };
}

const BANK_ACCOUNT_INCLUDE = {
  ledgerAccount: { select: { code: true, name: true } },
} as const;

export const bankAccountService = {
  async listBankAccounts(companyId: string, activeOnly = true): Promise<BankAccountRow[]> {
    const db = createTenantPrisma(basePrisma, companyId);
    const accounts = await db.bankAccount.findMany({
      where: { companyId, ...(activeOnly ? { isActive: true } : {}) },
      include: BANK_ACCOUNT_INCLUDE,
      orderBy: { name: 'asc' },
    });
    return accounts.map(toRow);
  },

  async getBankAccount(companyId: string, id: string): Promise<BankAccountRow> {
    const db = createTenantPrisma(basePrisma, companyId);
    const ba = await db.bankAccount.findFirst({
      where: { id, companyId },
      include: BANK_ACCOUNT_INCLUDE,
    });
    if (!ba) throw new Error('Cuenta bancaria no encontrada');
    return toRow(ba);
  },

  async createBankAccount(
    companyId: string,
    input: CreateBankAccountInput,
  ): Promise<BankAccountRow> {
    const data = createBankAccountSchema.parse(input);
    const db = createTenantPrisma(basePrisma, companyId);

    // Validate ledger account exists and is type ASSET
    const ledgerAccount = await db.account.findFirst({
      where: { id: data.ledgerAccountId, companyId, isActive: true },
    });
    if (!ledgerAccount) {
      throw new Error('Cuenta contable no encontrada o no está activa');
    }
    if (ledgerAccount.accountType !== 'ASSET') {
      throw new Error(
        `La cuenta contable "${ledgerAccount.code} — ${ledgerAccount.name}" no es de tipo ASSET. Las cuentas bancarias deben estar asociadas a cuentas de Activo.`,
      );
    }

    // Check duplicate account number within company
    const existing = await db.bankAccount.findFirst({
      where: { companyId, accountNumber: data.accountNumber },
    });
    if (existing) {
      throw new Error(
        `Ya existe una cuenta bancaria con el número "${data.accountNumber}" en esta empresa`,
      );
    }

    const ba = await (basePrisma as typeof basePrisma).$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.current_company_id', ${companyId}, true)`;
      return tx.bankAccount.create({
        data: {
          companyId,
          name: data.name,
          bankName: data.bankName,
          accountNumber: data.accountNumber,
          accountType: data.accountType,
          ledgerAccountId: data.ledgerAccountId,
          currencyCode: data.currencyCode,
          currentBalance: data.currentBalance,
        },
        include: BANK_ACCOUNT_INCLUDE,
      });
    });

    return toRow(ba);
  },

  async updateBankAccount(
    companyId: string,
    id: string,
    input: UpdateBankAccountInput,
  ): Promise<BankAccountRow> {
    const data = updateBankAccountSchema.parse(input);
    const db = createTenantPrisma(basePrisma, companyId);

    const existing = await db.bankAccount.findFirst({ where: { id, companyId } });
    if (!existing) throw new Error('Cuenta bancaria no encontrada');

    const ba = await db.bankAccount.update({
      where: { id },
      data: {
        name: data.name,
        bankName: data.bankName,
        accountNumber: data.accountNumber,
        accountType: data.accountType,
        currentBalance: data.currentBalance !== undefined ? data.currentBalance : undefined,
        isActive: data.isActive,
      },
      include: BANK_ACCOUNT_INCLUDE,
    });

    return toRow(ba);
  },

  async deactivateBankAccount(companyId: string, id: string): Promise<BankAccountRow> {
    const db = createTenantPrisma(basePrisma, companyId);
    const existing = await db.bankAccount.findFirst({ where: { id, companyId } });
    if (!existing) throw new Error('Cuenta bancaria no encontrada');

    const ba = await db.bankAccount.update({
      where: { id },
      data: { isActive: false },
      include: BANK_ACCOUNT_INCLUDE,
    });
    return toRow(ba);
  },
};
