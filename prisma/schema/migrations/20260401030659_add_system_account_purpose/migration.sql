-- CreateEnum
CREATE TYPE "SystemAccountPurpose" AS ENUM ('ACCOUNTS_RECEIVABLE', 'ISV_PAYABLE', 'SALES_REVENUE', 'ACCOUNTS_PAYABLE', 'PURCHASE_EXPENSE');

-- AlterTable
ALTER TABLE "accounts" ADD COLUMN     "system_purpose" "SystemAccountPurpose";

-- CreateIndex
CREATE INDEX "accounts_company_id_system_purpose_idx" ON "accounts"("company_id", "system_purpose");
