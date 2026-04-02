// src/lib/validations/bank.schema.ts
import { z } from 'zod';
import { BankAccountType } from '@prisma/client';

export const createBankAccountSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido').max(200),
  bankName: z.string().min(1, 'El nombre del banco es requerido').max(100),
  accountNumber: z.string().min(1, 'El número de cuenta es requerido').max(50),
  accountType: z.nativeEnum(BankAccountType).default('CHECKING'),
  ledgerAccountId: z.string().uuid('ID de cuenta contable inválido'),
  currencyCode: z.string().length(3).default('HNL'),
  currentBalance: z.number().default(0),
});

export const updateBankAccountSchema = createBankAccountSchema
  .partial()
  .omit({ ledgerAccountId: true, currencyCode: true });

// Bank statement import — CSV row from Honduras bank
export const bankStatementImportSchema = z.object({
  bankAccountId: z.string().uuid(),
  periodFrom: z.string().date(),
  periodTo: z.string().date(),
  beginningBalance: z.number(),
  endingBalance: z.number(),
  fileName: z.string().optional(),
  // CSV rows already parsed by the caller
  transactions: z
    .array(
      z.object({
        transactionDate: z.string().date(),
        description: z.string().min(1).max(500),
        reference: z.string().max(100).optional(),
        amount: z.number(), // positive=credit(deposit), negative=debit(withdrawal)
      }),
    )
    .min(1),
});

// Manual transaction matching
export const matchTransactionSchema = z.object({
  bankTransactionId: z.string().uuid(),
  journalEntryLineId: z.string().uuid(),
  matchNotes: z.string().max(500).optional(),
});

export const unmatchTransactionSchema = z.object({
  bankTransactionId: z.string().uuid(),
});

export const ignoreTransactionSchema = z.object({
  bankTransactionId: z.string().uuid(),
  matchNotes: z.string().max(500).optional(),
});

export const finalizeReconciliationSchema = z.object({
  bankAccountId: z.string().uuid(),
  bankStatementId: z.string().uuid(),
});

export type CreateBankAccountInput = z.infer<typeof createBankAccountSchema>;
export type UpdateBankAccountInput = z.infer<typeof updateBankAccountSchema>;
export type BankStatementImportInput = z.infer<typeof bankStatementImportSchema>;
export type MatchTransactionInput = z.infer<typeof matchTransactionSchema>;
export type FinalizeReconciliationInput = z.infer<typeof finalizeReconciliationSchema>;
