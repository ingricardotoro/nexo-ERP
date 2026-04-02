-- AlterTable: add unique constraint (company_id, name) to payment_terms
-- Safe: table is empty at this point in development

CREATE UNIQUE INDEX "payment_terms_company_id_name_key" ON "payment_terms"("company_id", "name");
