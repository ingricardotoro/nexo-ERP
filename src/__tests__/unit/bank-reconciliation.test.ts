// src/__tests__/unit/bank-reconciliation.test.ts
/**
 * Tests unitarios de los servicios de conciliación bancaria (F2-13).
 *
 * Cubre:
 * - parseHondurasBankCsv: parsea CSV pipe-delimited con débito/crédito
 * - parseHondurasBankCsv: parsea CSV con campo monto con signo
 * - parseHondurasBankCsv: lanza error si CSV tiene menos de 2 líneas
 * - parseHondurasBankCsv: lanza error si no hay columnas de monto
 * - bankAccountService.createBankAccount: lanza error si cuenta no es ASSET
 * - bankAccountService.createBankAccount: lanza error si número de cuenta duplicado
 * - bankAccountService.createBankAccount: lanza error si cuenta contable no existe
 * - bankStatementService.importStatement: lanza error si cuenta bancaria no existe
 * - bankStatementService.importStatement: lanza error si período ya importado
 * - bankStatementService.matchTransaction: lanza error si transacción no existe
 * - bankStatementService.matchTransaction: lanza error si línea ya asociada
 * - bankStatementService.unmatchTransaction: lanza error si transacción ya conciliada
 * - bankReconciliationService.finalizeReconciliation: lanza error si hay pendientes
 * - bankReconciliationService.finalizeReconciliation: lanza error si diferencia > 0.01
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Decimal } from '@prisma/client/runtime/library';

// ─── Mock de Prisma ───────────────────────────────────────────────────────────

const { prismaMock } = vi.hoisted(() => {
  const txMock = {
    bankAccount: { create: vi.fn(), update: vi.fn(), findFirst: vi.fn() },
    bankStatement: { create: vi.fn(), findFirst: vi.fn() },
    bankTransaction: { update: vi.fn(), updateMany: vi.fn(), findFirst: vi.fn() },
    bankReconciliation: { upsert: vi.fn(), findFirst: vi.fn() },
    journalEntryLine: { findMany: vi.fn(), findFirst: vi.fn() },
    $executeRaw: vi.fn().mockResolvedValue(0),
    $queryRaw: vi.fn(),
  };

  return {
    prismaMock: {
      bankAccount: { findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn() },
      bankStatement: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
      },
      bankTransaction: {
        findFirst: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
      },
      bankReconciliation: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
        upsert: vi.fn(),
      },
      account: { findFirst: vi.fn() },
      journalEntryLine: { findMany: vi.fn(), findFirst: vi.fn() },
      $executeRaw: vi.fn().mockResolvedValue(0),
      $queryRaw: vi.fn(),
      $transaction: vi.fn().mockImplementation((fn) => {
        if (typeof fn === 'function') return fn(txMock);
        return Promise.all(fn);
      }),
      _txMock: txMock,
    },
  };
});

vi.mock('@/lib/db/prisma', () => ({ default: prismaMock }));
vi.mock('@/lib/db/tenant-extension', () => ({
  createTenantPrisma: () => prismaMock,
}));

import { parseHondurasBankCsv } from '@/lib/services/accounting/bank-statement.service';
import { bankAccountService } from '@/lib/services/accounting/bank-account.service';
import { bankStatementService } from '@/lib/services/accounting/bank-statement.service';
import { bankReconciliationService } from '@/lib/services/accounting/bank-reconciliation.service';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const COMPANY = '00000000-0000-0000-0000-000000000001';
const BANK_ACCOUNT_ID = '00000000-0000-0000-0000-000000000010';
const LEDGER_ACCOUNT_ID = '00000000-0000-0000-0000-000000000020';
const STATEMENT_ID = '00000000-0000-0000-0000-000000000030';
const TX_ID = '00000000-0000-0000-0000-000000000040';
const LINE_ID = '00000000-0000-0000-0000-000000000050';

function makeBankAccount(overrides: Record<string, unknown> = {}) {
  return {
    id: BANK_ACCOUNT_ID,
    companyId: COMPANY,
    name: 'Banco Atlántida — CTA CTE',
    bankName: 'Banco Atlántida',
    accountNumber: '001-12345-6789',
    accountType: 'CHECKING',
    ledgerAccountId: LEDGER_ACCOUNT_ID,
    currencyCode: 'HNL',
    currentBalance: new Decimal('0.00'),
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ledgerAccount: { code: '1101', name: 'Banco Atlántida CTA CTE' },
    ...overrides,
  };
}

function makeStatement() {
  return {
    id: STATEMENT_ID,
    companyId: COMPANY,
    bankAccountId: BANK_ACCOUNT_ID,
    statementDate: new Date('2026-03-31'),
    periodFrom: new Date('2026-03-01'),
    periodTo: new Date('2026-03-31'),
    beginningBalance: new Decimal('10000.00'),
    endingBalance: new Decimal('11150.00'),
    importedFileName: 'marzo_2026.csv',
    importedAt: new Date(),
    importedBy: 'user-1',
    createdAt: new Date(),
    bankAccount: { name: 'Banco Atlántida' },
    transactions: [
      {
        id: TX_ID,
        status: 'PENDING',
        amount: new Decimal('1150.00'),
        transactionDate: new Date('2026-03-15'),
        description: 'Depósito cliente',
        reference: null,
        journalEntryLineId: null,
        matchNotes: null,
        journalEntryLine: null,
      },
    ],
  };
}

// ─── Tests: parseHondurasBankCsv ──────────────────────────────────────────────

describe('parseHondurasBankCsv', () => {
  it('parsea CSV pipe-delimited con columnas Débito y Crédito', () => {
    const csv = [
      'Fecha|Descripción|Referencia|Débito|Crédito',
      '15/03/2026|Depósito cliente|REF001|0|1150.00',
      '20/03/2026|Pago proveedor|CHQ001|500.00|0',
    ].join('\n');

    const rows = parseHondurasBankCsv(csv);
    expect(rows).toHaveLength(2);
    expect(rows[0].transactionDate).toBe('2026-03-15');
    expect(rows[0].amount).toBe(1150.0); // crédito positivo
    expect(rows[1].amount).toBe(-500.0); // débito negativo
  });

  it('parsea CSV con columna Monto con signo', () => {
    const csv = [
      'Fecha,Descripción,Monto',
      '2026-03-15,Depósito,1150.00',
      '2026-03-20,Pago,-500.00',
    ].join('\n');

    const rows = parseHondurasBankCsv(csv);
    expect(rows).toHaveLength(2);
    expect(rows[0].amount).toBe(1150.0);
    expect(rows[1].amount).toBe(-500.0);
  });

  it('lanza error si el CSV tiene menos de 2 líneas', () => {
    expect(() => parseHondurasBankCsv('Fecha|Descripción|Monto')).toThrow(
      /al menos una fila de encabezado/,
    );
  });

  it('lanza error si el CSV no tiene columnas de monto', () => {
    const csv = 'Fecha|Descripción|Referencia\n15/03/2026|Test|REF001';
    expect(() => parseHondurasBankCsv(csv)).toThrow(/columnas de Débito\/Crédito o Monto/);
  });

  it('convierte fecha DD/MM/YYYY a YYYY-MM-DD', () => {
    const csv = 'Fecha|Descripción|Monto\n01/03/2026|Test|100.00';
    const rows = parseHondurasBankCsv(csv);
    expect(rows[0].transactionDate).toBe('2026-03-01');
  });

  it('extrae la referencia cuando existe la columna', () => {
    const csv = 'Fecha|Descripción|Referencia|Monto\n15/03/2026|Pago|CHQ-001|500.00';
    const rows = parseHondurasBankCsv(csv);
    expect(rows[0].reference).toBe('CHQ-001');
  });
});

// ─── Tests: bankAccountService.createBankAccount ──────────────────────────────

describe('bankAccountService.createBankAccount', () => {
  beforeEach(() => vi.clearAllMocks());

  it('lanza error si cuenta contable no existe o no está activa', async () => {
    prismaMock.account.findFirst.mockResolvedValue(null);

    await expect(
      bankAccountService.createBankAccount(COMPANY, {
        name: 'Banco Test',
        bankName: 'Banco Test',
        accountNumber: '001-001',
        accountType: 'CHECKING',
        ledgerAccountId: LEDGER_ACCOUNT_ID,
        currencyCode: 'HNL',
        currentBalance: 0,
      }),
    ).rejects.toThrow(/no encontrada o no está activa/);
  });

  it('lanza error si cuenta contable no es tipo ASSET', async () => {
    prismaMock.account.findFirst.mockResolvedValue({
      id: LEDGER_ACCOUNT_ID,
      code: '4101',
      name: 'Ventas',
      accountType: 'INCOME',
      isActive: true,
    });

    await expect(
      bankAccountService.createBankAccount(COMPANY, {
        name: 'Banco Test',
        bankName: 'Banco Test',
        accountNumber: '001-001',
        accountType: 'CHECKING',
        ledgerAccountId: LEDGER_ACCOUNT_ID,
        currencyCode: 'HNL',
        currentBalance: 0,
      }),
    ).rejects.toThrow(/tipo ASSET/);
  });

  it('lanza error si número de cuenta duplicado en la empresa', async () => {
    prismaMock.account.findFirst.mockResolvedValue({
      id: LEDGER_ACCOUNT_ID,
      code: '1101',
      name: 'Banco Test',
      accountType: 'ASSET',
      isActive: true,
    });
    prismaMock.bankAccount.findFirst.mockResolvedValue(makeBankAccount());

    await expect(
      bankAccountService.createBankAccount(COMPANY, {
        name: 'Banco Test',
        bankName: 'Banco Test',
        accountNumber: '001-12345-6789',
        accountType: 'CHECKING',
        ledgerAccountId: LEDGER_ACCOUNT_ID,
        currencyCode: 'HNL',
        currentBalance: 0,
      }),
    ).rejects.toThrow(/Ya existe una cuenta bancaria/);
  });
});

// ─── Tests: bankStatementService.importStatement ─────────────────────────────

describe('bankStatementService.importStatement', () => {
  beforeEach(() => vi.clearAllMocks());

  it('lanza error si cuenta bancaria no existe', async () => {
    prismaMock.bankAccount.findFirst.mockResolvedValue(null);

    await expect(
      bankStatementService.importStatement(COMPANY, 'user-1', {
        bankAccountId: BANK_ACCOUNT_ID,
        periodFrom: '2026-03-01',
        periodTo: '2026-03-31',
        beginningBalance: 10000,
        endingBalance: 11150,
        transactions: [{ transactionDate: '2026-03-15', description: 'Test', amount: 1150 }],
      }),
    ).rejects.toThrow(/no encontrada o inactiva/);
  });

  it('lanza error si ya existe estado de cuenta para el período', async () => {
    prismaMock.bankAccount.findFirst.mockResolvedValue(makeBankAccount());
    prismaMock.bankStatement.findFirst.mockResolvedValue(makeStatement());

    await expect(
      bankStatementService.importStatement(COMPANY, 'user-1', {
        bankAccountId: BANK_ACCOUNT_ID,
        periodFrom: '2026-03-01',
        periodTo: '2026-03-31',
        beginningBalance: 10000,
        endingBalance: 11150,
        transactions: [{ transactionDate: '2026-03-15', description: 'Test', amount: 1150 }],
      }),
    ).rejects.toThrow(/Ya existe un estado de cuenta/);
  });
});

// ─── Tests: bankStatementService matching ────────────────────────────────────

describe('bankStatementService.matchTransaction', () => {
  beforeEach(() => vi.clearAllMocks());

  it('lanza error si transacción bancaria no existe', async () => {
    prismaMock.bankTransaction.findFirst.mockResolvedValue(null);

    await expect(bankStatementService.matchTransaction(COMPANY, TX_ID, LINE_ID)).rejects.toThrow(
      'Transacción bancaria no encontrada',
    );
  });

  it('lanza error si transacción no está en PENDING', async () => {
    prismaMock.bankTransaction.findFirst.mockResolvedValue({
      id: TX_ID,
      companyId: COMPANY,
      status: 'RECONCILED',
    });

    await expect(bankStatementService.matchTransaction(COMPANY, TX_ID, LINE_ID)).rejects.toThrow(
      /Solo las transacciones pendientes/,
    );
  });

  it('lanza error si la línea ya está asociada a otra transacción', async () => {
    prismaMock.bankTransaction.findFirst
      .mockResolvedValueOnce({ id: TX_ID, companyId: COMPANY, status: 'PENDING' })
      .mockResolvedValueOnce({ id: 'other-tx' }); // already matched check

    prismaMock.journalEntryLine.findFirst.mockResolvedValue({ id: LINE_ID });

    await expect(bankStatementService.matchTransaction(COMPANY, TX_ID, LINE_ID)).rejects.toThrow(
      /ya está asociada a otra transacción/,
    );
  });
});

describe('bankStatementService.unmatchTransaction', () => {
  beforeEach(() => vi.clearAllMocks());

  it('lanza error si transacción ya está conciliada', async () => {
    prismaMock.bankTransaction.findFirst.mockResolvedValue({
      id: TX_ID,
      companyId: COMPANY,
      status: 'RECONCILED',
    });

    await expect(bankStatementService.unmatchTransaction(COMPANY, TX_ID)).rejects.toThrow(
      /Anule la conciliación primero/,
    );
  });
});

// ─── Tests: bankReconciliationService ────────────────────────────────────────

describe('bankReconciliationService.finalizeReconciliation', () => {
  beforeEach(() => vi.clearAllMocks());

  it('lanza error si hay transacciones pendientes', async () => {
    // Mock getReconciliationSummary dependencies
    prismaMock.bankAccount.findFirst.mockResolvedValue(makeBankAccount());
    prismaMock.bankStatement.findFirst.mockResolvedValue({
      ...makeStatement(),
      transactions: [{ id: TX_ID, status: 'PENDING', amount: new Decimal('1150.00') }],
    });
    prismaMock.journalEntryLine.findMany.mockResolvedValue([]);

    await expect(
      bankReconciliationService.finalizeReconciliation(
        COMPANY,
        BANK_ACCOUNT_ID,
        STATEMENT_ID,
        'user-1',
      ),
    ).rejects.toThrow(/1 transacción\(es\) sin conciliar/);
  });

  it('lanza error si la diferencia entre saldo bancario y contable supera 0.01', async () => {
    // All transactions matched, but ledger balance doesn't match statement
    prismaMock.bankAccount.findFirst.mockResolvedValue(makeBankAccount());
    prismaMock.bankStatement.findFirst.mockResolvedValue({
      ...makeStatement(),
      transactions: [
        { id: TX_ID, status: 'MATCHED', amount: new Decimal('1000.00') }, // matched
      ],
    });
    // Ledger shows only 500 net movement → balance = 10000 + 500 = 10500 ≠ 11150
    prismaMock.journalEntryLine.findMany.mockResolvedValue([
      { debit: new Decimal('500.00'), credit: new Decimal('0.00') },
    ]);

    await expect(
      bankReconciliationService.finalizeReconciliation(
        COMPANY,
        BANK_ACCOUNT_ID,
        STATEMENT_ID,
        'user-1',
      ),
    ).rejects.toThrow(/diferencia/);
  });

  it('lanza error si ya fue conciliado', async () => {
    // All matched, balanced
    prismaMock.bankAccount.findFirst.mockResolvedValue(makeBankAccount());
    prismaMock.bankStatement.findFirst.mockResolvedValue({
      ...makeStatement(),
      beginningBalance: new Decimal('10000.00'),
      endingBalance: new Decimal('11150.00'),
      transactions: [{ id: TX_ID, status: 'MATCHED', amount: new Decimal('1150.00') }],
    });
    prismaMock.journalEntryLine.findMany.mockResolvedValue([
      { debit: new Decimal('1150.00'), credit: new Decimal('0.00') },
    ]);
    prismaMock.bankReconciliation.findFirst.mockResolvedValue({
      id: 'rec-1',
      status: 'RECONCILED',
    });

    await expect(
      bankReconciliationService.finalizeReconciliation(
        COMPANY,
        BANK_ACCOUNT_ID,
        STATEMENT_ID,
        'user-1',
      ),
    ).rejects.toThrow(/ya fue conciliado/);
  });
});
