// src/lib/services/accounting/bank-reconciliation.service.ts
// F2-13: Finalización y reporte de conciliación bancaria.
//
// Una conciliación finaliza cuando:
//   - Todas las transacciones PENDING están en MATCHED o IGNORED
//   - La diferencia entre saldo bancario y saldo contable es cero
//     (o dentro de la tolerancia aceptable)
//
// Al finalizar:
//   1. Todas las transacciones MATCHED pasan a RECONCILED
//   2. Se actualiza el saldo del BankAccount
//   3. Se crea el registro BankReconciliation con status=RECONCILED

import { Decimal } from '@prisma/client/runtime/library';
import basePrisma from '@/lib/db/prisma';
import { createTenantPrisma } from '@/lib/db/tenant-extension';

export interface ReconciliationSummary {
  bankAccountId: string;
  bankAccountName: string;
  statementId: string;
  periodFrom: Date;
  periodTo: Date;
  // Statement figures
  statementBeginningBalance: string;
  statementEndingBalance: string;
  // Matched transactions totals
  totalMatched: string;
  totalIgnored: string;
  totalPending: string;
  // Counts
  matchedCount: number;
  ignoredCount: number;
  pendingCount: number;
  // Ledger balance (from journal entries)
  ledgerBalance: string;
  // Difference (should be 0 for full reconciliation)
  difference: string;
  isBalanced: boolean;
  canFinalize: boolean;
}

export interface BankReconciliationRow {
  id: string;
  bankAccountId: string;
  bankAccountName: string;
  bankStatementId: string;
  status: string;
  statementEndingBalance: string;
  ledgerBalance: string;
  difference: string;
  reconciledAmount: string;
  unreconciledStatementAmount: string;
  unreconciledLedgerAmount: string;
  reconciledBy: string | null;
  reconciledAt: Date | null;
  createdBy: string;
  createdAt: Date;
}

export const bankReconciliationService = {
  /**
   * Calcula el resumen de estado de una conciliación en progreso.
   * Puede llamarse antes de finalizar para ver el estado actual.
   */
  async getReconciliationSummary(
    companyId: string,
    bankAccountId: string,
    statementId: string,
  ): Promise<ReconciliationSummary> {
    const db = createTenantPrisma(basePrisma, companyId);

    const [bankAccount, statement] = await Promise.all([
      db.bankAccount.findFirst({
        where: { id: bankAccountId, companyId },
        include: { ledgerAccount: { select: { id: true, code: true, name: true } } },
      }),
      db.bankStatement.findFirst({
        where: { id: statementId, companyId, bankAccountId },
        include: {
          transactions: {
            select: { id: true, status: true, amount: true },
          },
        },
      }),
    ]);

    if (!bankAccount) throw new Error('Cuenta bancaria no encontrada');
    if (!statement) throw new Error('Estado de cuenta no encontrado');

    // Group transactions by status
    const ZERO = new Decimal(0);
    let totalMatched = ZERO;
    let totalIgnored = ZERO;
    let totalPending = ZERO;
    let matchedCount = 0;
    let ignoredCount = 0;
    let pendingCount = 0;

    for (const tx of statement.transactions) {
      const amt = new Decimal(tx.amount).abs();
      switch (tx.status) {
        case 'MATCHED':
        case 'RECONCILED':
          totalMatched = totalMatched.plus(amt);
          matchedCount++;
          break;
        case 'IGNORED':
          totalIgnored = totalIgnored.plus(amt);
          ignoredCount++;
          break;
        case 'PENDING':
          totalPending = totalPending.plus(amt);
          pendingCount++;
          break;
      }
    }

    // Calculate ledger balance: sum of JournalEntryLines on the bank's ledger account
    // for the statement period (POSTED entries)
    const ledgerLines = await db.journalEntryLine.findMany({
      where: {
        companyId,
        accountId: bankAccount.ledgerAccountId,
        journalEntry: {
          status: 'POSTED',
          entryDate: {
            gte: statement.periodFrom,
            lte: statement.periodTo,
          },
        },
      },
      select: { debit: true, credit: true },
    });

    // Net movement for the period: debits increase the asset (deposits), credits decrease it (withdrawals)
    const ledgerNetMovement = ledgerLines.reduce(
      (sum, l) => sum.plus(new Decimal(l.debit)).minus(new Decimal(l.credit)),
      ZERO,
    );

    // Ledger balance = beginning balance + net movement
    const beginningBalance = new Decimal(statement.beginningBalance);
    const ledgerBalance = beginningBalance.plus(ledgerNetMovement);
    const statementEndingBalance = new Decimal(statement.endingBalance);
    const difference = statementEndingBalance.minus(ledgerBalance);
    const isBalanced = difference.abs().lessThanOrEqualTo(new Decimal('0.01'));
    const canFinalize = pendingCount === 0 && isBalanced;

    return {
      bankAccountId,
      bankAccountName: bankAccount.name,
      statementId,
      periodFrom: statement.periodFrom,
      periodTo: statement.periodTo,
      statementBeginningBalance: statement.beginningBalance.toString(),
      statementEndingBalance: statement.endingBalance.toString(),
      totalMatched: totalMatched.toFixed(2),
      totalIgnored: totalIgnored.toFixed(2),
      totalPending: totalPending.toFixed(2),
      matchedCount,
      ignoredCount,
      pendingCount,
      ledgerBalance: ledgerBalance.toFixed(2),
      difference: difference.toFixed(2),
      isBalanced,
      canFinalize,
    };
  },

  /**
   * Finaliza la conciliación bancaria.
   *
   * Requisitos:
   *  - No hay transacciones PENDING (todas deben estar MATCHED o IGNORED)
   *  - La diferencia entre saldo bancario y contable es ≤ L0.01
   *
   * Al finalizar:
   *  1. Todas las transacciones MATCHED pasan a RECONCILED
   *  2. Se actualiza currentBalance del BankAccount
   *  3. Se crea BankReconciliation con status=RECONCILED
   */
  async finalizeReconciliation(
    companyId: string,
    bankAccountId: string,
    statementId: string,
    userId: string,
  ): Promise<BankReconciliationRow> {
    const summary = await this.getReconciliationSummary(companyId, bankAccountId, statementId);

    if (summary.pendingCount > 0) {
      throw new Error(
        `No se puede finalizar la conciliación: hay ${summary.pendingCount} transacción(es) sin conciliar. ` +
          'Asocie o ignore todas las transacciones pendientes antes de finalizar.',
      );
    }

    if (!summary.isBalanced) {
      throw new Error(
        `No se puede finalizar: la diferencia entre el saldo bancario (${summary.statementEndingBalance}) ` +
          `y el saldo contable (${summary.ledgerBalance}) es ${summary.difference}. ` +
          'Debe ser ≤ L0.01 para poder finalizar.',
      );
    }

    // Check if already reconciled
    const db = createTenantPrisma(basePrisma, companyId);
    const existing = await db.bankReconciliation.findFirst({
      where: { companyId, bankAccountId, bankStatementId: statementId },
    });
    if (existing?.status === 'RECONCILED') {
      throw new Error('Este estado de cuenta ya fue conciliado');
    }

    const reconciliation = await (basePrisma as typeof basePrisma).$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.current_company_id', ${companyId}, true)`;

      // Mark all MATCHED transactions as RECONCILED
      await tx.bankTransaction.updateMany({
        where: { companyId, bankStatementId: statementId, status: 'MATCHED' },
        data: { status: 'RECONCILED' },
      });

      // Update bank account balance
      await tx.bankAccount.update({
        where: { id: bankAccountId },
        data: { currentBalance: summary.statementEndingBalance },
      });

      const unreconciledStatementAmount = new Decimal(summary.totalPending).plus(
        new Decimal(summary.totalIgnored),
      );

      // Create or update reconciliation record
      return tx.bankReconciliation.upsert({
        where: {
          companyId_bankAccountId_bankStatementId: {
            companyId,
            bankAccountId,
            bankStatementId: statementId,
          },
        },
        create: {
          companyId,
          bankAccountId,
          bankStatementId: statementId,
          status: 'RECONCILED',
          statementEndingBalance: summary.statementEndingBalance,
          ledgerBalance: summary.ledgerBalance,
          difference: summary.difference,
          reconciledAmount: summary.totalMatched,
          unreconciledStatementAmount: unreconciledStatementAmount.toFixed(2),
          unreconciledLedgerAmount: '0.00',
          reconciledBy: userId,
          reconciledAt: new Date(),
          createdBy: userId,
        },
        update: {
          status: 'RECONCILED',
          statementEndingBalance: summary.statementEndingBalance,
          ledgerBalance: summary.ledgerBalance,
          difference: summary.difference,
          reconciledAmount: summary.totalMatched,
          unreconciledStatementAmount: unreconciledStatementAmount.toFixed(2),
          reconciledBy: userId,
          reconciledAt: new Date(),
        },
        include: { bankAccount: { select: { name: true } } },
      });
    });

    return {
      id: reconciliation.id,
      bankAccountId: reconciliation.bankAccountId,
      bankAccountName: reconciliation.bankAccount.name,
      bankStatementId: reconciliation.bankStatementId,
      status: reconciliation.status,
      statementEndingBalance: reconciliation.statementEndingBalance.toString(),
      ledgerBalance: reconciliation.ledgerBalance.toString(),
      difference: reconciliation.difference.toString(),
      reconciledAmount: reconciliation.reconciledAmount.toString(),
      unreconciledStatementAmount: reconciliation.unreconciledStatementAmount.toString(),
      unreconciledLedgerAmount: reconciliation.unreconciledLedgerAmount.toString(),
      reconciledBy: reconciliation.reconciledBy,
      reconciledAt: reconciliation.reconciledAt,
      createdBy: reconciliation.createdBy,
      createdAt: reconciliation.createdAt,
    };
  },

  /** Lista las conciliaciones bancarias de una cuenta. */
  async listReconciliations(
    companyId: string,
    bankAccountId: string,
  ): Promise<BankReconciliationRow[]> {
    const db = createTenantPrisma(basePrisma, companyId);
    const recs = await db.bankReconciliation.findMany({
      where: { companyId, bankAccountId },
      include: { bankAccount: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    });

    return recs.map((r) => ({
      id: r.id,
      bankAccountId: r.bankAccountId,
      bankAccountName: r.bankAccount.name,
      bankStatementId: r.bankStatementId,
      status: r.status,
      statementEndingBalance: r.statementEndingBalance.toString(),
      ledgerBalance: r.ledgerBalance.toString(),
      difference: r.difference.toString(),
      reconciledAmount: r.reconciledAmount.toString(),
      unreconciledStatementAmount: r.unreconciledStatementAmount.toString(),
      unreconciledLedgerAmount: r.unreconciledLedgerAmount.toString(),
      reconciledBy: r.reconciledBy,
      reconciledAt: r.reconciledAt,
      createdBy: r.createdBy,
      createdAt: r.createdAt,
    }));
  },
};
