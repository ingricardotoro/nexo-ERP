// src/lib/validations/cai.schema.ts
import { z } from 'zod';

// CAI format: XXXXXX-XXXXXX-XXXXXX-XXXXXX-XXXXXX-XX (alphanumeric blocks)
const CAI_REGEX = /^[A-Z0-9]{6}-[A-Z0-9]{6}-[A-Z0-9]{6}-[A-Z0-9]{6}-[A-Z0-9]{6}-[A-Z0-9]{2}$/;

// Document type codes for Honduras SAR
const DOCUMENT_TYPES = ['01', '03', '04'] as const;

export const createCaiSchema = z
  .object({
    caiCode: z
      .string()
      .toUpperCase()
      .regex(CAI_REGEX, 'Formato de CAI inválido. Debe ser: XXXXXX-XXXXXX-XXXXXX-XXXXXX-XXXXXX-XX'),
    establishmentCode: z
      .string()
      .length(3, 'El código de establecimiento debe tener exactamente 3 dígitos')
      .regex(/^\d{3}$/, 'El código de establecimiento debe ser numérico'),
    emissionPointCode: z
      .string()
      .length(3, 'El código de punto de emisión debe tener exactamente 3 dígitos')
      .regex(/^\d{3}$/, 'El código de punto de emisión debe ser numérico'),
    documentType: z.enum(DOCUMENT_TYPES, {
      errorMap: () => ({ message: 'Tipo de documento inválido. Valores válidos: 01, 03, 04' }),
    }),
    rangeFrom: z.number().int().min(1, 'El número inicial del rango debe ser mayor a 0'),
    rangeTo: z.number().int().min(1, 'El número final del rango debe ser mayor a 0'),
    issuedAt: z.string().date('Fecha de emisión inválida (formato: YYYY-MM-DD)'),
    expiresAt: z.string().date('Fecha de vencimiento inválida (formato: YYYY-MM-DD)'),
  })
  .refine((data) => data.rangeTo >= data.rangeFrom, {
    message: 'El número final del rango debe ser mayor o igual al número inicial',
    path: ['rangeTo'],
  })
  .refine((data) => new Date(data.expiresAt) > new Date(data.issuedAt), {
    message: 'La fecha de vencimiento debe ser posterior a la fecha de emisión',
    path: ['expiresAt'],
  });

export const updateCaiSchema = z.object({
  isActive: z.boolean(),
});

export type CreateCaiInput = z.infer<typeof createCaiSchema>;
export type UpdateCaiInput = z.infer<typeof updateCaiSchema>;
