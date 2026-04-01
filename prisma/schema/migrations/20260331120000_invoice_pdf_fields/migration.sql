-- Migration: invoice_pdf_fields
-- Adds PDF generation tracking fields to invoices table (F3-09)

ALTER TABLE "invoices"
  ADD COLUMN IF NOT EXISTS "pdf_s3_key"       TEXT,
  ADD COLUMN IF NOT EXISTS "pdf_generated_at" TIMESTAMPTZ;

COMMENT ON COLUMN "invoices"."pdf_s3_key"
  IS 'S3 object key del PDF generado (documentos/{companyId}/invoices/{year}/{month}/{id}.pdf)';

COMMENT ON COLUMN "invoices"."pdf_generated_at"
  IS 'Timestamp UTC en que el Lambda subió el PDF a S3';
