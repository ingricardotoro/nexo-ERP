// src/lib/validations/invoice.schema.ts
import { z } from 'zod';
import { InvoiceType } from '@prisma/client';

export const invoiceLineSchema = z.object({
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
  discountPct: z
    .number()
    .min(0, 'El descuento no puede ser negativo')
    .max(100, 'El descuento no puede superar el 100%')
    .default(0),
  taxRateId: z.string().uuid('ID de tasa de impuesto inválido'),
  accountId: z.string().uuid('ID de cuenta contable inválido').optional(),
});

export const createInvoiceSchema = z.object({
  invoiceType: z.nativeEnum(InvoiceType, {
    errorMap: () => ({
      message: 'Tipo de documento inválido (FACTURA, NOTA_CREDITO, NOTA_DEBITO)',
    }),
  }),
  issueDate: z.string().date('Fecha de emisión inválida (formato: YYYY-MM-DD)'),
  dueDate: z.string().date('Fecha de vencimiento inválida').optional(),
  contactId: z.string().uuid('ID de contacto inválido'),
  paymentTermsId: z.string().uuid('ID de términos de pago inválido').optional(),
  currencyCode: z.string().length(3, 'Código de moneda debe ser 3 letras').default('HNL'),
  exchangeRate: z.number().positive('El tipo de cambio debe ser mayor a 0').default(1),
  notes: z.string().max(1000).optional(),
  originalInvoiceId: z.string().uuid('ID de factura original inválido').optional(),
  lines: z
    .array(invoiceLineSchema)
    .min(1, 'La factura debe tener al menos una línea')
    .max(50, 'Máximo 50 líneas por factura'),
});

export const updateInvoiceSchema = z.object({
  issueDate: z.string().date().optional(),
  dueDate: z.string().date().optional(),
  contactId: z.string().uuid().optional(),
  paymentTermsId: z.string().uuid().optional(),
  currencyCode: z.string().length(3).optional(),
  exchangeRate: z.number().positive().optional(),
  notes: z.string().max(1000).optional(),
  lines: z
    .array(invoiceLineSchema)
    .min(1, 'La factura debe tener al menos una línea')
    .max(50)
    .optional(),
});

export const listInvoicesSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.string().optional(),
  invoiceType: z.nativeEnum(InvoiceType).optional(),
  contactId: z.string().uuid().optional(),
  dateFrom: z.string().date().optional(),
  dateTo: z.string().date().optional(),
});

export type InvoiceLineInput = z.infer<typeof invoiceLineSchema>;
export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;
export type UpdateInvoiceInput = z.infer<typeof updateInvoiceSchema>;
export type ListInvoicesInput = z.infer<typeof listInvoicesSchema>;
