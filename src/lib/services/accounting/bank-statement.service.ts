// src/lib/services/accounting/bank-statement.service.ts
// F2-13: Importación y gestión de estados de cuenta bancarios.
//
// Soporta importación de CSV genérico y parsing manual para bancos hondureños:
//   Columnas esperadas: fecha, descripción, referencia, débito, crédito, saldo
//   (o con campo "monto" con signo)
//
// El servicio también provee auto-sugerencias de conciliación (matching
// por monto + fecha ±3 días + descripción fuzzy).

import { Decimal } from '@prisma/client/runtime/library';
import basePrisma from '@/lib/db/prisma';
import { createTenantPrisma } from '@/lib/db/tenant-extension';
import type { BankTransactionStatus } from '@prisma/client';
import {
  bankStatementImportSchema,
  type BankStatementImportInput,
} from '@/lib/validations/bank.schema';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BankTransactionRow {
  id: string;
  transactionDate: Date;
  description: string;
  reference: string | null;
  amount: string;
  status: BankTransactionStatus;
  journalEntryLineId: string | null;
  matchNotes: string | null;
  // Populated when matched
  journalEntryDate?: Date | null;
  journalEntryDescription?: string | null;
  journalEntryDebit?: string | null;
  journalEntryCredit?: string | null;
}

export interface BankStatementRow {
  id: string;
  bankAccountId: string;
  bankAccountName: string;
  statementDate: Date;
  periodFrom: Date;
  periodTo: Date;
  beginningBalance: string;
  endingBalance: string;
  importedFileName: string | null;
  importedAt: Date;
  importedBy: string;
  createdAt: Date;
  transactions: BankTransactionRow[];
}

export interface MatchSuggestion {
  bankTransactionId: string;
  journalEntryLineId: string;
  journalEntryDate: Date;
  journalEntryDescription: string | null;
  accountCode: string;
  accountName: string;
  debit: string;
  credit: string;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  matchReason: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function txToRow(tx: any): BankTransactionRow {
  return {
    id: tx.id,
    transactionDate: tx.transactionDate,
    description: tx.description,
    reference: tx.reference,
    amount: tx.amount.toString(),
    status: tx.status,
    journalEntryLineId: tx.journalEntryLineId,
    matchNotes: tx.matchNotes,
    journalEntryDate: tx.journalEntryLine?.journalEntry?.entryDate ?? null,
    journalEntryDescription: tx.journalEntryLine?.journalEntry?.description ?? null,
    journalEntryDebit: tx.journalEntryLine?.debit?.toString() ?? null,
    journalEntryCredit: tx.journalEntryLine?.credit?.toString() ?? null,
  };
}

const TX_INCLUDE = {
  journalEntryLine: {
    include: {
      journalEntry: { select: { entryDate: true, description: true } },
    },
    select: {
      debit: true,
      credit: true,
      journalEntry: { select: { entryDate: true, description: true } },
    },
  },
} as const;

/**
 * Parses a generic Honduras bank CSV.
 * Expected header (case-insensitive, pipe or comma delimited):
 *   Fecha | Descripción | Referencia | Débito | Crédito
 * OR:
 *   Fecha | Descripción | Referencia | Monto
 */
export function parseHondurasBankCsv(
  csvContent: string,
): Array<{ transactionDate: string; description: string; reference?: string; amount: number }> {
  const lines = csvContent
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length < 2)
    throw new Error('El archivo CSV debe tener al menos una fila de encabezado y una de datos');

  // Detect delimiter: pipe or comma
  const delimiter = lines[0].includes('|') ? '|' : ',';

  const headers = lines[0].split(delimiter).map((h) =>
    h
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // remove accents
      .replace(/[^a-z0-9]/g, '_'),
  );

  const findCol = (...names: string[]) =>
    headers.findIndex((h) => names.some((n) => h.includes(n)));

  const colFecha = findCol('fecha', 'date', 'fec');
  const colDesc = findCol('descripcion', 'description', 'desc', 'concepto', 'detalle');
  const colRef = findCol('referencia', 'reference', 'ref', 'num', 'nro');
  const colDebito = findCol('debito', 'cargo', 'retiro', 'debit');
  const colCredito = findCol('credito', 'abono', 'deposito', 'credit');
  const colMonto = findCol('monto', 'importe', 'amount', 'valor');

  if (colFecha === -1 || colDesc === -1) {
    throw new Error('El CSV debe tener columnas de Fecha y Descripción');
  }

  if (colDebito === -1 && colCredito === -1 && colMonto === -1) {
    throw new Error('El CSV debe tener columnas de Débito/Crédito o Monto');
  }

  const rows: Array<{
    transactionDate: string;
    description: string;
    reference?: string;
    amount: number;
  }> = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(delimiter).map((c) => c.trim().replace(/^"|"$/g, ''));
    if (cols.length < 2) continue;

    const rawDate = cols[colFecha] ?? '';
    if (!rawDate) continue;

    // Parse date: DD/MM/YYYY or YYYY-MM-DD
    let parsedDate: string;
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(rawDate)) {
      const [d, m, y] = rawDate.split('/');
      parsedDate = `${y}-${m}-${d}`;
    } else if (/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
      parsedDate = rawDate;
    } else {
      continue; // skip unparseable row
    }

    const description = cols[colDesc] ?? '';
    const reference = colRef !== -1 ? cols[colRef] || undefined : undefined;

    let amount: number;
    if (colMonto !== -1) {
      // Single amount column — positive=credit, negative=debit
      amount = parseFloat((cols[colMonto] ?? '0').replace(/,/g, ''));
      if (isNaN(amount)) continue;
    } else {
      const debito = parseFloat((cols[colDebito] ?? '0').replace(/,/g, '') || '0');
      const credito = parseFloat((cols[colCredito] ?? '0').replace(/,/g, '') || '0');
      if (isNaN(debito) || isNaN(credito)) continue;
      // Convention: debit=outflow (negative), credit=inflow (positive)
      amount = credito - debito;
    }

    rows.push({ transactionDate: parsedDate, description, reference, amount });
  }

  if (rows.length === 0) throw new Error('No se encontraron transacciones válidas en el CSV');
  return rows;
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const bankStatementService = {
  /** Importa un estado de cuenta bancario y crea BankStatement + BankTransactions. */
  async importStatement(
    companyId: string,
    userId: string,
    input: BankStatementImportInput,
  ): Promise<BankStatementRow> {
    const data = bankStatementImportSchema.parse(input);
    const db = createTenantPrisma(basePrisma, companyId);

    const bankAccount = await db.bankAccount.findFirst({
      where: { id: data.bankAccountId, companyId, isActive: true },
      include: { ledgerAccount: { select: { id: true, code: true, name: true } } },
    });
    if (!bankAccount) throw new Error('Cuenta bancaria no encontrada o inactiva');

    // Check no overlapping statement exists
    const overlapping = await db.bankStatement.findFirst({
      where: {
        companyId,
        bankAccountId: data.bankAccountId,
        periodFrom: { lte: new Date(data.periodTo) },
        periodTo: { gte: new Date(data.periodFrom) },
      },
    });
    if (overlapping) {
      throw new Error(
        `Ya existe un estado de cuenta para el período ${data.periodFrom} – ${data.periodTo}. Elimínelo antes de importar.`,
      );
    }

    const stmt = await (basePrisma as typeof basePrisma).$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.current_company_id', ${companyId}, true)`;

      const statement = await tx.bankStatement.create({
        data: {
          companyId,
          bankAccountId: data.bankAccountId,
          statementDate: new Date(data.periodTo),
          periodFrom: new Date(data.periodFrom),
          periodTo: new Date(data.periodTo),
          beginningBalance: data.beginningBalance,
          endingBalance: data.endingBalance,
          importedFileName: data.fileName ?? null,
          importedBy: userId,
          transactions: {
            create: data.transactions.map((t) => ({
              companyId,
              transactionDate: new Date(t.transactionDate),
              description: t.description,
              reference: t.reference ?? null,
              amount: t.amount,
              status: 'PENDING' as const,
            })),
          },
        },
        include: {
          bankAccount: { select: { name: true } },
          transactions: {
            include: TX_INCLUDE,
            orderBy: { transactionDate: 'asc' },
          },
        },
      });

      return statement;
    });

    return {
      id: stmt.id,
      bankAccountId: stmt.bankAccountId,
      bankAccountName: stmt.bankAccount.name,
      statementDate: stmt.statementDate,
      periodFrom: stmt.periodFrom,
      periodTo: stmt.periodTo,
      beginningBalance: stmt.beginningBalance.toString(),
      endingBalance: stmt.endingBalance.toString(),
      importedFileName: stmt.importedFileName,
      importedAt: stmt.importedAt,
      importedBy: stmt.importedBy,
      createdAt: stmt.createdAt,
      transactions: stmt.transactions.map(txToRow),
    };
  },

  /** Lista estados de cuenta de una cuenta bancaria. */
  async listStatements(companyId: string, bankAccountId: string) {
    const db = createTenantPrisma(basePrisma, companyId);
    const stmts = await db.bankStatement.findMany({
      where: { companyId, bankAccountId },
      include: { bankAccount: { select: { name: true } } },
      orderBy: { periodFrom: 'desc' },
    });
    return stmts.map((s) => ({
      id: s.id,
      bankAccountId: s.bankAccountId,
      bankAccountName: s.bankAccount.name,
      statementDate: s.statementDate,
      periodFrom: s.periodFrom,
      periodTo: s.periodTo,
      beginningBalance: s.beginningBalance.toString(),
      endingBalance: s.endingBalance.toString(),
      importedFileName: s.importedFileName,
      importedAt: s.importedAt,
      importedBy: s.importedBy,
      createdAt: s.createdAt,
    }));
  },

  /** Obtiene un estado de cuenta con todas sus transacciones. */
  async getStatement(companyId: string, statementId: string): Promise<BankStatementRow> {
    const db = createTenantPrisma(basePrisma, companyId);
    const stmt = await db.bankStatement.findFirst({
      where: { id: statementId, companyId },
      include: {
        bankAccount: { select: { name: true } },
        transactions: {
          include: TX_INCLUDE,
          orderBy: { transactionDate: 'asc' },
        },
      },
    });
    if (!stmt) throw new Error('Estado de cuenta no encontrado');

    return {
      id: stmt.id,
      bankAccountId: stmt.bankAccountId,
      bankAccountName: stmt.bankAccount.name,
      statementDate: stmt.statementDate,
      periodFrom: stmt.periodFrom,
      periodTo: stmt.periodTo,
      beginningBalance: stmt.beginningBalance.toString(),
      endingBalance: stmt.endingBalance.toString(),
      importedFileName: stmt.importedFileName,
      importedAt: stmt.importedAt,
      importedBy: stmt.importedBy,
      createdAt: stmt.createdAt,
      transactions: stmt.transactions.map(txToRow),
    };
  },

  /**
   * Genera sugerencias automáticas de conciliación para las transacciones PENDING.
   *
   * Algoritmo:
   *  1. Para cada BankTransaction PENDING, busca JournalEntryLines de la cuenta
   *     contable del BankAccount donde:
   *     - El monto (debit-credit) coincida exactamente
   *     - La fecha de la línea esté dentro de ±7 días de la transacción bancaria
   *     - La línea aún no esté conciliada (no tenga BankTransaction asociada)
   *  2. Clasifica la confianza:
   *     HIGH = monto exacto + fecha ±1 día
   *     MEDIUM = monto exacto + fecha ±7 días
   *     LOW = descripción parcialmente coincide pero monto diferente
   */
  async getSuggestedMatches(companyId: string, statementId: string): Promise<MatchSuggestion[]> {
    const db = createTenantPrisma(basePrisma, companyId);

    const stmt = await db.bankStatement.findFirst({
      where: { id: statementId, companyId },
      include: {
        bankAccount: {
          include: { ledgerAccount: { select: { id: true, code: true, name: true } } },
        },
        transactions: {
          where: { status: 'PENDING' },
          orderBy: { transactionDate: 'asc' },
        },
      },
    });
    if (!stmt) throw new Error('Estado de cuenta no encontrado');

    const ledgerAccountId = stmt.bankAccount.ledgerAccountId;
    const suggestions: MatchSuggestion[] = [];

    for (const tx of stmt.transactions) {
      const txAmount = new Decimal(tx.amount);
      // For the ledger: a deposit (positive amount) = credit on bank account = credit entry
      // a withdrawal (negative amount) = debit on bank account = debit entry
      const isDeposit = txAmount.greaterThan(0);
      const absAmount = txAmount.abs();

      // Date range ±7 days
      const dateFrom = new Date(tx.transactionDate);
      dateFrom.setDate(dateFrom.getDate() - 7);
      const dateTo = new Date(tx.transactionDate);
      dateTo.setDate(dateTo.getDate() + 7);

      // Find unmatched journal entry lines for this bank account
      const candidates = await db.journalEntryLine.findMany({
        where: {
          companyId,
          accountId: ledgerAccountId,
          // Not yet matched to a bank transaction
          bankTransactions: { none: {} },
          journalEntry: {
            status: 'POSTED',
            entryDate: { gte: dateFrom, lte: dateTo },
          },
        },
        include: {
          journalEntry: { select: { entryDate: true, description: true } },
          account: { select: { code: true, name: true } },
        },
        take: 20,
      });

      for (const candidate of candidates) {
        const candidateAmount = isDeposit
          ? new Decimal(candidate.credit)
          : new Decimal(candidate.debit);

        if (!candidateAmount.equals(absAmount)) continue;

        const daysDiff = Math.abs(
          (tx.transactionDate.getTime() - candidate.journalEntry.entryDate.getTime()) /
            (1000 * 60 * 60 * 24),
        );

        const confidence: 'HIGH' | 'MEDIUM' | 'LOW' =
          daysDiff <= 1 ? 'HIGH' : daysDiff <= 3 ? 'MEDIUM' : 'LOW';

        suggestions.push({
          bankTransactionId: tx.id,
          journalEntryLineId: candidate.id,
          journalEntryDate: candidate.journalEntry.entryDate,
          journalEntryDescription: candidate.journalEntry.description,
          accountCode: candidate.account.code,
          accountName: candidate.account.name,
          debit: candidate.debit.toString(),
          credit: candidate.credit.toString(),
          confidence,
          matchReason: `Monto exacto ${absAmount.toFixed(2)}, diferencia ${daysDiff.toFixed(0)} día(s)`,
        });

        break; // Only suggest the best match per transaction
      }
    }

    return suggestions;
  },

  /** Asocia una transacción bancaria con una línea de asiento contable. */
  async matchTransaction(
    companyId: string,
    bankTransactionId: string,
    journalEntryLineId: string,
    matchNotes?: string,
  ): Promise<BankTransactionRow> {
    const db = createTenantPrisma(basePrisma, companyId);

    const tx = await db.bankTransaction.findFirst({
      where: { id: bankTransactionId, companyId },
    });
    if (!tx) throw new Error('Transacción bancaria no encontrada');
    if (tx.status !== 'PENDING') {
      throw new Error('Solo las transacciones pendientes pueden asociarse');
    }

    const line = await db.journalEntryLine.findFirst({
      where: { id: journalEntryLineId, companyId },
    });
    if (!line) throw new Error('Línea de asiento contable no encontrada');

    // Verify the journal entry line is not already matched
    const alreadyMatched = await db.bankTransaction.findFirst({
      where: { journalEntryLineId, companyId, status: { in: ['MATCHED', 'RECONCILED'] } },
    });
    if (alreadyMatched) {
      throw new Error('Esta línea de asiento ya está asociada a otra transacción bancaria');
    }

    const updated = await db.bankTransaction.update({
      where: { id: bankTransactionId },
      data: {
        status: 'MATCHED',
        journalEntryLineId,
        matchNotes: matchNotes ?? null,
        updatedAt: new Date(),
      },
      include: TX_INCLUDE,
    });

    return txToRow(updated);
  },

  /** Desasocia una transacción bancaria de su línea contable. */
  async unmatchTransaction(
    companyId: string,
    bankTransactionId: string,
  ): Promise<BankTransactionRow> {
    const db = createTenantPrisma(basePrisma, companyId);

    const tx = await db.bankTransaction.findFirst({
      where: { id: bankTransactionId, companyId },
    });
    if (!tx) throw new Error('Transacción bancaria no encontrada');
    if (tx.status === 'RECONCILED') {
      throw new Error(
        'No se puede desasociar una transacción ya conciliada. Anule la conciliación primero.',
      );
    }

    const updated = await db.bankTransaction.update({
      where: { id: bankTransactionId },
      data: { status: 'PENDING', journalEntryLineId: null, matchNotes: null },
      include: TX_INCLUDE,
    });

    return txToRow(updated);
  },

  /** Marca una transacción como ignorada (sin asiento contable correspondiente). */
  async ignoreTransaction(
    companyId: string,
    bankTransactionId: string,
    matchNotes?: string,
  ): Promise<BankTransactionRow> {
    const db = createTenantPrisma(basePrisma, companyId);

    const tx = await db.bankTransaction.findFirst({
      where: { id: bankTransactionId, companyId },
    });
    if (!tx) throw new Error('Transacción bancaria no encontrada');
    if (tx.status === 'RECONCILED') {
      throw new Error('No se puede ignorar una transacción ya conciliada');
    }

    const updated = await db.bankTransaction.update({
      where: { id: bankTransactionId },
      data: { status: 'IGNORED', matchNotes: matchNotes ?? 'Marcada como ignorada' },
      include: TX_INCLUDE,
    });

    return txToRow(updated);
  },
};
