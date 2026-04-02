// src/lib/validations/supplier-invoice.schema.ts
import { z } from 'zod';
import { SupplierInvoiceType } from '@prisma/client';

export const supplierInvoiceLineSchema = z.object({
  lineNumber: z.number().int().min(1),
  description: z.string().min(1, 'La descripción es requerida').max(500),
  quantity: z
    .number()
    .positive('La cantidad debe ser mayor a 0')
    .multipleOf(0.0001, 'Máximo 4 decimales'),
  unitPrice: z
    .number()
    .nonnegative('El precio no puede ser negativo')
    .multipleOf(0.0001, 'Máximo 4 decimales'),
  discountPct: z.number().min(0).max(100).default(0),
  taxRateId: z.string().uuid('ID de tasa de impuesto inválido'),
  accountId: z.string().uuid('ID de cuenta contable inválido').optional(),
});

export const createSupplierInvoiceSchema = z.object({
  invoiceType: z.nativeEnum(SupplierInvoiceType).default('FACTURA_COMPRA'),
  supplierInvoiceNumber: z.string().max(50).optional(),
  issueDate: z.string().date('Fecha de emisión inválida (formato: YYYY-MM-DD)'),
  dueDate: z.string().date('Fecha de vencimiento inválida').optional(),
  contactId: z.string().uuid('ID de proveedor inválido'),
  paymentTermsId: z.string().uuid().optional(),
  currencyCode: z.string().length(3).default('HNL'),
  exchangeRate: z.number().positive().default(1),
  notes: z.string().max(1000).optional(),
  originalInvoiceId: z.string().uuid().optional(),
  lines: z
    .array(supplierInvoiceLineSchema)
    .min(1, 'La factura debe tener al menos una línea')
    .max(50, 'Máximo 50 líneas por factura'),
});

export const updateSupplierInvoiceSchema = z.object({
  supplierInvoiceNumber: z.string().max(50).optional(),
  issueDate: z.string().date().optional(),
  dueDate: z.string().date().optional(),
  contactId: z.string().uuid().optional(),
  paymentTermsId: z.string().uuid().optional(),
  currencyCode: z.string().length(3).optional(),
  exchangeRate: z.number().positive().optional(),
  notes: z.string().max(1000).optional(),
  lines: z.array(supplierInvoiceLineSchema).min(1).max(50).optional(),
});

export const listSupplierInvoicesSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.string().optional(),
  invoiceType: z.nativeEnum(SupplierInvoiceType).optional(),
  contactId: z.string().uuid().optional(),
  dateFrom: z.string().date().optional(),
  dateTo: z.string().date().optional(),
});

export type SupplierInvoiceLineInput = z.infer<typeof supplierInvoiceLineSchema>;
export type CreateSupplierInvoiceInput = z.infer<typeof createSupplierInvoiceSchema>;
export type UpdateSupplierInvoiceInput = z.infer<typeof updateSupplierInvoiceSchema>;
export type ListSupplierInvoicesInput = z.infer<typeof listSupplierInvoicesSchema>;
