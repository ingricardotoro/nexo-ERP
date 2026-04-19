import { defineFunction } from '@aws-amplify/backend';

/**
 * Lambda Function Resource — Generación de PDF de Facturas (F3-09)
 *
 * Triggered by SQS queue (nexoerp-invoice-pdf).
 * Genera un PDF SAR-compliant con pdfkit, lo sube a S3,
 * y actualiza el campo pdf_s3_key en la tabla invoices.
 *
 * Memory: 1024 MB (pdfkit + Prisma Client)
 * Timeout: 120 seg (fetch DB + render PDF + S3 upload)
 *
 * Permisos necesarios (otorgados en backend.ts):
 * - sqs:ReceiveMessage / DeleteMessage (via SQS event source)
 * - s3:PutObject en el bucket de documentos
 */
export const generateInvoicePdf = defineFunction({
  name: 'generate-invoice-pdf',
  entry: './handler.ts',
  runtime: 20,
  timeoutSeconds: 120,
  memoryMB: 1024,
  environment: {
    DATABASE_URL: process.env.DATABASE_URL ?? '',
    S3_BUCKET_DOCUMENTS: process.env.S3_BUCKET_DOCUMENTS ?? '',
    AWS_REGION_TARGET: process.env.AWS_REGION ?? 'us-east-1',
  },
});
