import { z } from 'zod';

export const createContactPersonSchema = z.object({
  fullName: z.string().min(2, 'El nombre debe tener al menos 2 caracteres').max(150).trim(),
  jobTitle: z.string().max(100).trim().optional().or(z.literal('')),
  email: z.string().email('Email inválido').toLowerCase().trim().optional().or(z.literal('')),
  phone: z.string().max(20).trim().optional().or(z.literal('')),
  isPrimary: z.boolean().default(false),
  isActive: z.boolean().default(true),
});

export const updateContactPersonSchema = createContactPersonSchema
  .partial()
  .extend({
    id: z.string().uuid('ID inválido'),
  })
  .refine(
    (data) => Object.keys(data).some((key) => key !== 'id'),
    'Debes proporcionar al menos un campo para actualizar',
  );

export type CreateContactPersonInput = z.input<typeof createContactPersonSchema>;
export type UpdateContactPersonInput = z.input<typeof updateContactPersonSchema>;
