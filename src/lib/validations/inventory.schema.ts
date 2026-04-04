// src/lib/validations/inventory.schema.ts
import { z } from 'zod';

// ─── ProductCategory ──────────────────────────────────────────────────────────

export const createProductCategorySchema = z.object({
  name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres').max(100),
  code: z.string().max(20).optional(),
  parentId: z.string().uuid('ID de categoría padre inválido').optional(),
});

export const updateProductCategorySchema = z.object({
  name: z.string().min(2).max(100).optional(),
  code: z.string().max(20).optional(),
  parentId: z.string().uuid().nullable().optional(),
  isActive: z.boolean().optional(),
});

export type CreateProductCategoryInput = z.infer<typeof createProductCategorySchema>;
export type UpdateProductCategoryInput = z.infer<typeof updateProductCategorySchema>;

// ─── UnitOfMeasure ────────────────────────────────────────────────────────────

export const createUnitOfMeasureSchema = z.object({
  name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres').max(100),
  symbol: z
    .string()
    .min(1)
    .max(10)
    .regex(/^[a-zA-Z0-9/]+$/, 'Solo letras, números y /'),
});

export const updateUnitOfMeasureSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  isActive: z.boolean().optional(),
});

export type CreateUnitOfMeasureInput = z.infer<typeof createUnitOfMeasureSchema>;
export type UpdateUnitOfMeasureInput = z.infer<typeof updateUnitOfMeasureSchema>;

// ─── Product ──────────────────────────────────────────────────────────────────

export const createProductSchema = z.object({
  code: z
    .string()
    .min(1, 'El código (SKU) es requerido')
    .max(50)
    .toUpperCase()
    .regex(/^[A-Z0-9\-_]+$/, 'Solo letras mayúsculas, números, guión y guión bajo'),
  name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres').max(200),
  description: z.string().max(500).optional(),
  barcode: z.string().max(50).optional(),
  unitOfMeasureId: z.string().uuid('Unidad de medida requerida'),
  categoryId: z.string().uuid().optional(),
  trackingType: z.enum(['NONE', 'LOT', 'SERIAL']).default('NONE'),
  costPrice: z.number().min(0).default(0),
  salePrice: z.number().min(0).default(0),
  inventoryAccountId: z.string().uuid().optional(),
  cogsAccountId: z.string().uuid().optional(),
});

export const updateProductSchema = z.object({
  name: z.string().min(2).max(200).optional(),
  description: z.string().max(500).optional(),
  barcode: z.string().max(50).optional(),
  categoryId: z.string().uuid().nullable().optional(),
  trackingType: z.enum(['NONE', 'LOT', 'SERIAL']).optional(),
  costPrice: z.number().min(0).optional(),
  salePrice: z.number().min(0).optional(),
  inventoryAccountId: z.string().uuid().nullable().optional(),
  cogsAccountId: z.string().uuid().nullable().optional(),
  isActive: z.boolean().optional(),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;

// ─── Warehouse ────────────────────────────────────────────────────────────────

export const createWarehouseSchema = z.object({
  code: z
    .string()
    .min(1)
    .max(10)
    .toUpperCase()
    .regex(/^[A-Z0-9]+$/, 'Solo letras mayúsculas y números'),
  name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres').max(200),
  address: z.string().max(300).optional(),
  city: z.string().max(100).optional(),
});

export const updateWarehouseSchema = z.object({
  name: z.string().min(2).max(200).optional(),
  address: z.string().max(300).optional(),
  city: z.string().max(100).optional(),
  isActive: z.boolean().optional(),
});

export type CreateWarehouseInput = z.infer<typeof createWarehouseSchema>;
export type UpdateWarehouseInput = z.infer<typeof updateWarehouseSchema>;
