import { z } from 'zod';

export const createPaymentTermsSchema = z.object({
  name: z
    .string()
    .min(1, 'El nombre es requerido')
    .max(100, 'El nombre no puede exceder 100 caracteres')
    .trim(),
  description: z.string().max(255).trim().optional().or(z.literal('')),
  daysUntilDue: z.coerce
    .number()
    .int('Debe ser un número entero')
    .min(0, 'Los días no pueden ser negativos')
    .max(365, 'Los días no pueden exceder 365'),
  isDefault: z.boolean().default(false),
  isActive: z.boolean().default(true),
});

export const updatePaymentTermsSchema = createPaymentTermsSchema
  .partial()
  .extend({
    id: z.string().uuid('ID inválido'),
  })
  .refine(
    (data) => Object.keys(data).some((key) => key !== 'id'),
    'Debes proporcionar al menos un campo para actualizar',
  );

export const paymentTermsFiltersSchema = z.object({
  isActive: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
});

export type CreatePaymentTermsInput = z.input<typeof createPaymentTermsSchema>;
export type UpdatePaymentTermsInput = z.input<typeof updatePaymentTermsSchema>;
export type PaymentTermsFilters = z.output<typeof paymentTermsFiltersSchema>;

export function getPaymentTermsLabel(daysUntilDue: number, name: string): string {
  if (daysUntilDue === 0) return `${name} (Contado)`;
  return `${name} (${daysUntilDue} días)`;
}
