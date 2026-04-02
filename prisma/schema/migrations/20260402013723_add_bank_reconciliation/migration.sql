-- CreateEnum
CREATE TYPE "BankAccountType" AS ENUM ('CHECKING', 'SAVINGS', 'CREDIT');

-- CreateEnum
CREATE TYPE "BankReconciliationStatus" AS ENUM ('DRAFT', 'RECONCILED');

-- CreateEnum
CREATE TYPE "BankTransactionStatus" AS ENUM ('PENDING', 'MATCHED', 'RECONCILED', 'IGNORED');

-- CreateTable
CREATE TABLE "bank_accounts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "bank_name" TEXT NOT NULL,
    "account_number" TEXT NOT NULL,
    "account_type" "BankAccountType" NOT NULL DEFAULT 'CHECKING',
    "ledger_account_id" UUID NOT NULL,
    "currency_code" TEXT NOT NULL DEFAULT 'HNL',
    "current_balance" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bank_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_statements" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "bank_account_id" UUID NOT NULL,
    "statement_date" DATE NOT NULL,
    "period_from" DATE NOT NULL,
    "period_to" DATE NOT NULL,
    "beginning_balance" DECIMAL(18,2) NOT NULL,
    "ending_balance" DECIMAL(18,2) NOT NULL,
    "imported_file_name" TEXT,
    "imported_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "imported_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bank_statements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_transactions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "bank_statement_id" UUID NOT NULL,
    "transaction_date" DATE NOT NULL,
    "description" TEXT NOT NULL,
    "reference" TEXT,
    "amount" DECIMAL(18,2) NOT NULL,
    "status" "BankTransactionStatus" NOT NULL DEFAULT 'PENDING',
    "journal_entry_line_id" UUID,
    "match_notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bank_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_reconciliations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "bank_account_id" UUID NOT NULL,
    "bank_statement_id" UUID NOT NULL,
    "status" "BankReconciliationStatus" NOT NULL DEFAULT 'DRAFT',
    "statement_ending_balance" DECIMAL(18,2) NOT NULL,
    "ledger_balance" DECIMAL(18,2) NOT NULL,
    "difference" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "reconciled_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "unreconciled_statement_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "unreconciled_ledger_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "reconciled_by" TEXT,
    "reconciled_at" TIMESTAMP(3),
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bank_reconciliations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "bank_accounts_company_id_is_active_idx" ON "bank_accounts"("company_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "bank_accounts_company_id_account_number_key" ON "bank_accounts"("company_id", "account_number");

-- CreateIndex
CREATE INDEX "bank_statements_company_id_bank_account_id_idx" ON "bank_statements"("company_id", "bank_account_id");

-- CreateIndex
CREATE INDEX "bank_statements_company_id_period_from_period_to_idx" ON "bank_statements"("company_id", "period_from", "period_to");

-- CreateIndex
CREATE INDEX "bank_transactions_company_id_bank_statement_id_idx" ON "bank_transactions"("company_id", "bank_statement_id");

-- CreateIndex
CREATE INDEX "bank_transactions_company_id_status_idx" ON "bank_transactions"("company_id", "status");

-- CreateIndex
CREATE INDEX "bank_transactions_company_id_transaction_date_idx" ON "bank_transactions"("company_id", "transaction_date");

-- CreateIndex
CREATE INDEX "bank_reconciliations_company_id_bank_account_id_idx" ON "bank_reconciliations"("company_id", "bank_account_id");

-- CreateIndex
CREATE INDEX "bank_reconciliations_company_id_status_idx" ON "bank_reconciliations"("company_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "bank_reconciliations_company_id_bank_account_id_bank_statem_key" ON "bank_reconciliations"("company_id", "bank_account_id", "bank_statement_id");

-- AddForeignKey
ALTER TABLE "bank_accounts" ADD CONSTRAINT "bank_accounts_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_accounts" ADD CONSTRAINT "bank_accounts_ledger_account_id_fkey" FOREIGN KEY ("ledger_account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_accounts" ADD CONSTRAINT "bank_accounts_currency_code_fkey" FOREIGN KEY ("currency_code") REFERENCES "currencies"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_statements" ADD CONSTRAINT "bank_statements_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_statements" ADD CONSTRAINT "bank_statements_bank_account_id_fkey" FOREIGN KEY ("bank_account_id") REFERENCES "bank_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_transactions" ADD CONSTRAINT "bank_transactions_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_transactions" ADD CONSTRAINT "bank_transactions_bank_statement_id_fkey" FOREIGN KEY ("bank_statement_id") REFERENCES "bank_statements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_transactions" ADD CONSTRAINT "bank_transactions_journal_entry_line_id_fkey" FOREIGN KEY ("journal_entry_line_id") REFERENCES "journal_entry_lines"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_reconciliations" ADD CONSTRAINT "bank_reconciliations_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_reconciliations" ADD CONSTRAINT "bank_reconciliations_bank_account_id_fkey" FOREIGN KEY ("bank_account_id") REFERENCES "bank_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_reconciliations" ADD CONSTRAINT "bank_reconciliations_bank_statement_id_fkey" FOREIGN KEY ("bank_statement_id") REFERENCES "bank_statements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
