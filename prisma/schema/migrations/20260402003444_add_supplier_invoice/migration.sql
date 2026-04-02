-- CreateEnum
CREATE TYPE "SupplierInvoiceType" AS ENUM ('FACTURA_COMPRA', 'NOTA_CREDITO_COMPRA');

-- CreateTable
CREATE TABLE "supplier_invoices" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "invoice_type" "SupplierInvoiceType" NOT NULL DEFAULT 'FACTURA_COMPRA',
    "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "supplier_invoice_number" TEXT,
    "issue_date" DATE NOT NULL,
    "due_date" DATE,
    "contact_id" UUID NOT NULL,
    "payment_terms_id" UUID,
    "currency_code" TEXT NOT NULL DEFAULT 'HNL',
    "exchange_rate" DECIMAL(12,6) NOT NULL DEFAULT 1,
    "subtotal" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "tax_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "journal_entry_id" UUID,
    "original_invoice_id" UUID,
    "created_by" TEXT NOT NULL,
    "posted_by" TEXT,
    "posted_at" TIMESTAMP(3),
    "cancelled_by" TEXT,
    "cancelled_at" TIMESTAMP(3),
    "cancel_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "supplier_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_invoice_lines" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "invoice_id" UUID NOT NULL,
    "line_number" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(12,4) NOT NULL,
    "unit_price" DECIMAL(18,4) NOT NULL,
    "discount_pct" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "subtotal" DECIMAL(18,2) NOT NULL,
    "tax_rate_id" UUID NOT NULL,
    "tax_amount" DECIMAL(18,2) NOT NULL,
    "total" DECIMAL(18,2) NOT NULL,
    "account_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supplier_invoice_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "supplier_invoices_journal_entry_id_key" ON "supplier_invoices"("journal_entry_id");

-- CreateIndex
CREATE INDEX "supplier_invoices_company_id_status_idx" ON "supplier_invoices"("company_id", "status");

-- CreateIndex
CREATE INDEX "supplier_invoices_company_id_invoice_type_status_idx" ON "supplier_invoices"("company_id", "invoice_type", "status");

-- CreateIndex
CREATE INDEX "supplier_invoices_company_id_contact_id_idx" ON "supplier_invoices"("company_id", "contact_id");

-- CreateIndex
CREATE INDEX "supplier_invoices_company_id_issue_date_idx" ON "supplier_invoices"("company_id", "issue_date");

-- CreateIndex
CREATE INDEX "supplier_invoice_lines_company_id_invoice_id_idx" ON "supplier_invoice_lines"("company_id", "invoice_id");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_invoice_lines_invoice_id_line_number_key" ON "supplier_invoice_lines"("invoice_id", "line_number");

-- AddForeignKey
ALTER TABLE "supplier_invoices" ADD CONSTRAINT "supplier_invoices_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_invoices" ADD CONSTRAINT "supplier_invoices_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_invoices" ADD CONSTRAINT "supplier_invoices_payment_terms_id_fkey" FOREIGN KEY ("payment_terms_id") REFERENCES "payment_terms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_invoices" ADD CONSTRAINT "supplier_invoices_currency_code_fkey" FOREIGN KEY ("currency_code") REFERENCES "currencies"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_invoices" ADD CONSTRAINT "supplier_invoices_journal_entry_id_fkey" FOREIGN KEY ("journal_entry_id") REFERENCES "journal_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_invoices" ADD CONSTRAINT "supplier_invoices_original_invoice_id_fkey" FOREIGN KEY ("original_invoice_id") REFERENCES "supplier_invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_invoice_lines" ADD CONSTRAINT "supplier_invoice_lines_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_invoice_lines" ADD CONSTRAINT "supplier_invoice_lines_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "supplier_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_invoice_lines" ADD CONSTRAINT "supplier_invoice_lines_tax_rate_id_fkey" FOREIGN KEY ("tax_rate_id") REFERENCES "tax_rates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_invoice_lines" ADD CONSTRAINT "supplier_invoice_lines_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
