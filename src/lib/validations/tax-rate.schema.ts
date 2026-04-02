// src/lib/validations/tax-rate.schema.ts
import { z } from 'zod';

export const createTaxRateSchema = z.object({
  code: z
    .string()
    .min(1, 'El código es requerido')
    .max(20)
    .toUpperCase()
    .regex(/^[A-Z0-9_]+$/, 'Solo letras mayúsculas, números y guión bajo'),
  name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres').max(100),
  rate: z
    .number()
    .min(0, 'La tasa no puede ser negativa')
    .max(1, 'La tasa debe ser un decimal entre 0 y 1 (ej: 0.15 para 15%)'),
});

export const updateTaxRateSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  rate: z.number().min(0).max(1).optional(),
  isActive: z.boolean().optional(),
});

export type CreateTaxRateInput = z.infer<typeof createTaxRateSchema>;
export type UpdateTaxRateInput = z.infer<typeof updateTaxRateSchema>;
