import { z } from 'zod';

const contactTypeValues = ['NATURAL', 'JURIDICAL'] as const;

/**
 * Validación de RTN Honduras.
 * Formato: DDDD-DDDD-DDDDD (4-4-5 dígitos) para personas jurídicas
 * Formato: DDDD-DDDD-DDDDD o DDDDDDDDDDDDDD (14 dígitos) para personas naturales
 * Nullable: contactos extranjeros pueden no tener RTN (DA-CONT-03)
 */
const rtnSchema = z
  .string()
  .trim()
  .refine((val) => {
    if (!val) return true; // nullable permitido
    // Aceptar con o sin guiones: 0801-1990-00001 o 08011990000011
    const clean = val.replace(/-/g, '');
    return /^\d{13,14}$/.test(clean);
  }, 'RTN inválido. Formato esperado: DDDD-DDDD-DDDDD (ej: 0801-1990-00001)')
  .nullable()
  .optional();

export const createContactSchema = z
  .object({
    contactType: z.enum(contactTypeValues).default('NATURAL'),
    legalName: z
      .string()
      .min(2, 'El nombre/razón social debe tener al menos 2 caracteres')
      .max(255)
      .trim(),
    tradeName: z.string().max(255).trim().optional().or(z.literal('')),
    rtn: rtnSchema,
    isCustomer: z.boolean().default(false),
    isSupplier: z.boolean().default(false),
    email: z.string().email('Email inválido').toLowerCase().trim().optional().or(z.literal('')),
    phone: z.string().max(20).trim().optional().or(z.literal('')),
    website: z.string().url('URL inválida').optional().or(z.literal('')),
    paymentTermsId: z.string().uuid('ID de términos de pago inválido').nullable().optional(),
    isActive: z.boolean().default(true),
    notes: z.string().max(1000).trim().optional().or(z.literal('')),
  })
  .refine((data) => data.isCustomer || data.isSupplier, {
    message: 'El contacto debe ser al menos cliente o proveedor',
    path: ['isCustomer'],
  });

export const updateContactSchema = createContactSchema
  .innerType()
  .partial()
  .extend({
    id: z.string().uuid('ID inválido'),
  })
  .refine(
    (data) => Object.keys(data).some((key) => key !== 'id'),
    'Debes proporcionar al menos un campo para actualizar',
  );

export const contactFiltersSchema = z.object({
  search: z.string().trim().optional(),
  type: z.enum(contactTypeValues).optional(),
  role: z.enum(['customer', 'supplier', 'both']).optional(),
  isActive: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
  paymentTermsId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  orderBy: z.enum(['legalName', 'createdAt', 'updatedAt']).default('legalName'),
  orderDir: z.enum(['asc', 'desc']).default('asc'),
});

export type CreateContactInput = z.input<typeof createContactSchema>;
export type UpdateContactInput = z.input<typeof updateContactSchema>;
export type ContactFilters = z.output<typeof contactFiltersSchema>;
export type ContactType = (typeof contactTypeValues)[number];

export function getContactTypeLabel(type: ContactType): string {
  return type === 'NATURAL' ? 'Persona Natural' : 'Persona Jurídica';
}

export function getContactTypeVariant(type: ContactType): 'default' | 'secondary' {
  return type === 'JURIDICAL' ? 'default' : 'secondary';
}

export function getContactRoleLabel(isCustomer: boolean, isSupplier: boolean): string {
  if (isCustomer && isSupplier) return 'Cliente / Proveedor';
  if (isCustomer) return 'Cliente';
  return 'Proveedor';
}

export function getContactRoleBadgeVariant(
  isCustomer: boolean,
  isSupplier: boolean,
): 'default' | 'secondary' | 'outline' {
  if (isCustomer && isSupplier) return 'default';
  if (isCustomer) return 'secondary';
  return 'outline';
}

/**
 * Normaliza el RTN eliminando guiones para comparación o almacenamiento.
 * Retorna null si el valor está vacío.
 */
export function normalizeRtn(rtn: string | null | undefined): string | null {
  if (!rtn) return null;
  const clean = rtn.replace(/-/g, '');
  return clean || null;
}

/**
 * Formatea el RTN con guiones para presentación.
 * "08011990000011" → "0801-1990-00001" (14 dígitos) o "0801-1990-000011" (15)
 */
export function formatRtn(rtn: string | null | undefined): string {
  if (!rtn) return '—';
  const clean = rtn.replace(/-/g, '');
  if (clean.length === 14) {
    return `${clean.slice(0, 4)}-${clean.slice(4, 8)}-${clean.slice(8)}`;
  }
  return rtn;
}
