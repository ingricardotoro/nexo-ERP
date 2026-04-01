// src/lib/validations/sales-book.schema.ts
import { z } from 'zod';

export const salesBookQuerySchema = z.object({
  fiscalPeriodId: z.string().uuid('ID de período fiscal inválido'),
});

export type SalesBookQuery = z.infer<typeof salesBookQuerySchema>;
