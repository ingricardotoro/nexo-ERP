import { z } from 'zod';

const addressTypeValues = ['BILLING', 'SHIPPING', 'FISCAL', 'OTHER'] as const;

export const createContactAddressSchema = z.object({
  addressType: z.enum(addressTypeValues).default('BILLING'),
  isDefault: z.boolean().default(false),
  addressLine1: z.string().min(1, 'La dirección es requerida').max(255).trim(),
  addressLine2: z.string().max(255).trim().optional().or(z.literal('')),
  city: z.string().min(1, 'La ciudad es requerida').max(100).trim(),
  department: z.string().max(100).trim().optional().or(z.literal('')),
  country: z.string().length(2, 'Usar código ISO de 2 letras (ej: HN)').default('HN'),
  postalCode: z.string().max(20).trim().optional().or(z.literal('')),
});

export const updateContactAddressSchema = createContactAddressSchema
  .partial()
  .extend({
    id: z.string().uuid('ID inválido'),
  })
  .refine(
    (data) => Object.keys(data).some((key) => key !== 'id'),
    'Debes proporcionar al menos un campo para actualizar',
  );

export type CreateContactAddressInput = z.input<typeof createContactAddressSchema>;
export type UpdateContactAddressInput = z.input<typeof updateContactAddressSchema>;
export type AddressType = (typeof addressTypeValues)[number];

export function getAddressTypeLabel(type: AddressType): string {
  const labels: Record<AddressType, string> = {
    BILLING: 'Facturación',
    SHIPPING: 'Envío',
    FISCAL: 'Fiscal',
    OTHER: 'Otro',
  };
  return labels[type];
}
