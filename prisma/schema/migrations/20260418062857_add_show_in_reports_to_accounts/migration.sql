-- AlterTable
ALTER TABLE "accounts" ADD COLUMN     "show_in_reports" BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex
CREATE INDEX "accounts_company_id_show_in_reports_idx" ON "accounts"("company_id", "show_in_reports");
