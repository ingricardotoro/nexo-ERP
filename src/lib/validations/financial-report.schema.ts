// src/lib/validations/financial-report.schema.ts
import { z } from 'zod';

export const balanceSheetQuerySchema = z.object({
  asOfDate: z.string().date('Fecha de corte inválida'),
  fiscalYearId: z.string().uuid().optional(),
});

export type BalanceSheetQuery = z.infer<typeof balanceSheetQuerySchema>;

export const incomeStatementQuerySchema = z.object({
  dateFrom: z.string().date('Fecha de inicio inválida'),
  dateTo: z.string().date('Fecha de fin inválida'),
  fiscalYearId: z.string().uuid().optional(),
});

export type IncomeStatementQuery = z.infer<typeof incomeStatementQuerySchema>;
