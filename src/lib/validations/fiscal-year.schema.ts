// src/lib/validations/fiscal-year.schema.ts
import { z } from 'zod';

export const createFiscalYearSchema = z
  .object({
    year: z
      .number({ required_error: 'El año es requerido' })
      .int()
      .min(2000, 'El año debe ser 2000 o posterior')
      .max(2099, 'El año debe ser 2099 o anterior'),
    startDate: z.string().date('Fecha de inicio inválida'),
    endDate: z.string().date('Fecha de fin inválida'),
  })
  .refine((d) => d.endDate > d.startDate, {
    message: 'La fecha de fin debe ser posterior a la fecha de inicio',
    path: ['endDate'],
  });

export type CreateFiscalYearInput = z.infer<typeof createFiscalYearSchema>;
