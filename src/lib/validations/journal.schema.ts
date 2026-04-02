// src/lib/validations/journal.schema.ts
import { z } from 'zod';
import { JournalType } from '@prisma/client';

export const createJournalSchema = z.object({
  name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres').max(100),
  code: z
    .string()
    .min(1, 'El código es requerido')
    .max(10, 'El código no puede superar 10 caracteres')
    .toUpperCase()
    .regex(/^[A-Z0-9_-]+$/, 'Solo letras mayúsculas, números, guión y guión bajo'),
  journalType: z.nativeEnum(JournalType, {
    errorMap: () => ({ message: 'Tipo de diario inválido' }),
  }),
});

export const updateJournalSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  isActive: z.boolean().optional(),
});

export type CreateJournalInput = z.infer<typeof createJournalSchema>;
export type UpdateJournalInput = z.infer<typeof updateJournalSchema>;
