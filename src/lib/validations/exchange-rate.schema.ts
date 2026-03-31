// src/lib/validations/exchange-rate.schema.ts
import { z } from 'zod';

export const upsertExchangeRateSchema = z.object({
  currencyCode: z
    .string()
    .min(3, 'Código de moneda requerido')
    .max(3, 'Código de moneda debe tener 3 caracteres')
    .toUpperCase(),
  date: z.string().date('Fecha inválida'),
  rate: z.coerce
    .number()
    .positive('El tipo de cambio debe ser mayor a cero')
    .refine((v) => v !== 1 || true, {}), // permitido para completitud
  source: z.enum(['manual', 'BCH', 'API']),
});

export type UpsertExchangeRateInput = z.infer<typeof upsertExchangeRateSchema>;

export const exchangeRateFiltersSchema = z.object({
  currencyCode: z.string().min(3).max(3).optional(),
  dateFrom: z.string().date().optional(),
  dateTo: z.string().date().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type ExchangeRateFilters = z.infer<typeof exchangeRateFiltersSchema>;
