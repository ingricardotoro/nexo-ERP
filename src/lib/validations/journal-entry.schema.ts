// src/lib/validations/journal-entry.schema.ts
import { z } from 'zod';

// ─── Line schema ──────────────────────────────────────────────────────────────

export const journalEntryLineSchema = z
  .object({
    accountId: z.string().uuid('ID de cuenta inválido'),
    description: z.string().max(255).optional(),
    debit: z.coerce.number().min(0, 'El débito no puede ser negativo'),
    credit: z.coerce.number().min(0, 'El crédito no puede ser negativo'),
  })
  .refine((line) => line.debit > 0 || line.credit > 0, {
    message: 'Cada línea debe tener débito o crédito mayor a cero',
  })
  .refine((line) => !(line.debit > 0 && line.credit > 0), {
    message: 'Una línea no puede tener débito y crédito simultáneamente',
  });

export type JournalEntryLineInput = z.infer<typeof journalEntryLineSchema>;

// ─── Create schema ────────────────────────────────────────────────────────────

export const createJournalEntrySchema = z.object({
  journalId: z.string().uuid('ID de diario inválido'),
  fiscalPeriodId: z.string().uuid('ID de período fiscal inválido'),
  entryDate: z.string().date('Fecha de asiento inválida'),
  description: z.string().min(1, 'La descripción es requerida').max(500),
  reference: z.string().max(100).optional(),
  currencyCode: z.string().min(3).max(3),
  exchangeRate: z.coerce.number().positive('El tipo de cambio debe ser positivo'),
  lines: z
    .array(journalEntryLineSchema)
    .min(2, 'Un asiento requiere al menos 2 líneas (partida doble)'),
});

export type CreateJournalEntryInput = z.infer<typeof createJournalEntrySchema>;

// ─── Update schema (solo DRAFT) ───────────────────────────────────────────────

export const updateJournalEntrySchema = z.object({
  entryDate: z.string().date().optional(),
  description: z.string().min(1).max(500).optional(),
  reference: z.string().max(100).optional(),
  currencyCode: z.string().min(3).max(3).optional(),
  exchangeRate: z.coerce.number().positive().optional().nullable(),
  lines: z.array(journalEntryLineSchema).min(2, 'Un asiento requiere al menos 2 líneas').optional(),
});

export type UpdateJournalEntryInput = z.infer<typeof updateJournalEntrySchema>;

// ─── List filters ─────────────────────────────────────────────────────────────

export const journalEntryFiltersSchema = z.object({
  journalId: z.string().uuid().optional(),
  fiscalPeriodId: z.string().uuid().optional(),
  status: z.enum(['DRAFT', 'POSTED', 'CANCELLED']).optional(),
  dateFrom: z.string().date().optional(),
  dateTo: z.string().date().optional(),
  search: z.string().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type JournalEntryFilters = z.infer<typeof journalEntryFiltersSchema>;
