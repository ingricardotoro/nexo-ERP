-- CreateEnum
CREATE TYPE "JournalType" AS ENUM ('GENERAL', 'SALES', 'PURCHASES', 'CASH', 'BANK', 'PAYROLL', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "JournalEntryStatus" AS ENUM ('DRAFT', 'POSTED', 'CANCELLED');

-- AlterEnum
ALTER TYPE "AccountType" ADD VALUE 'CONTRA';

-- AlterEnum
ALTER TYPE "FiscalPeriodStatus" ADD VALUE 'LOCKED';

-- CreateTable
CREATE TABLE "currencies" (
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_base" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "currencies_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "exchange_rates" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "currency_code" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "rate" DECIMAL(12,6) NOT NULL,
    "source" TEXT,
    "company_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exchange_rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "parent_id" UUID,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "account_type" "AccountType" NOT NULL,
    "account_nature" "AccountNature" NOT NULL,
    "is_parent" BOOLEAN NOT NULL DEFAULT false,
    "allow_direct_entry" BOOLEAN NOT NULL DEFAULT true,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fiscal_years" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "year" INTEGER NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "status" "FiscalPeriodStatus" NOT NULL DEFAULT 'OPEN',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fiscal_years_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fiscal_periods" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "fiscal_year_id" UUID NOT NULL,
    "period_number" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "status" "FiscalPeriodStatus" NOT NULL DEFAULT 'OPEN',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fiscal_periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journals" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "journal_type" "JournalType" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "journals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journal_entries" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "journal_id" UUID NOT NULL,
    "fiscal_period_id" UUID NOT NULL,
    "entry_number" INTEGER NOT NULL,
    "reference" TEXT,
    "description" TEXT NOT NULL,
    "entry_date" DATE NOT NULL,
    "status" "JournalEntryStatus" NOT NULL DEFAULT 'DRAFT',
    "currency_code" TEXT NOT NULL,
    "exchange_rate" DECIMAL(12,6) NOT NULL DEFAULT 1,
    "total_debit" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "total_credit" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "created_by" TEXT NOT NULL,
    "posted_by" TEXT,
    "posted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "journal_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journal_entry_lines" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "journal_entry_id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "line_number" INTEGER NOT NULL,
    "description" TEXT,
    "debit" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "credit" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "currency_debit" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "currency_credit" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "journal_entry_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "exchange_rates_currency_code_date_idx" ON "exchange_rates"("currency_code", "date");

-- CreateIndex
CREATE INDEX "exchange_rates_company_id_currency_code_date_idx" ON "exchange_rates"("company_id", "currency_code", "date");

-- CreateIndex
CREATE UNIQUE INDEX "exchange_rates_currency_code_date_company_id_key" ON "exchange_rates"("currency_code", "date", "company_id");

-- CreateIndex
CREATE INDEX "accounts_company_id_parent_id_idx" ON "accounts"("company_id", "parent_id");

-- CreateIndex
CREATE INDEX "accounts_company_id_account_type_idx" ON "accounts"("company_id", "account_type");

-- CreateIndex
CREATE INDEX "accounts_company_id_is_active_idx" ON "accounts"("company_id", "is_active");

-- CreateIndex
CREATE INDEX "accounts_company_id_allow_direct_entry_idx" ON "accounts"("company_id", "allow_direct_entry");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_company_id_code_key" ON "accounts"("company_id", "code");

-- CreateIndex
CREATE INDEX "fiscal_years_company_id_status_idx" ON "fiscal_years"("company_id", "status");

-- CreateIndex
CREATE INDEX "fiscal_years_company_id_is_active_idx" ON "fiscal_years"("company_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "fiscal_years_company_id_year_key" ON "fiscal_years"("company_id", "year");

-- CreateIndex
CREATE INDEX "fiscal_periods_company_id_fiscal_year_id_idx" ON "fiscal_periods"("company_id", "fiscal_year_id");

-- CreateIndex
CREATE INDEX "fiscal_periods_company_id_status_idx" ON "fiscal_periods"("company_id", "status");

-- CreateIndex
CREATE INDEX "fiscal_periods_company_id_start_date_end_date_idx" ON "fiscal_periods"("company_id", "start_date", "end_date");

-- CreateIndex
CREATE UNIQUE INDEX "fiscal_periods_fiscal_year_id_period_number_key" ON "fiscal_periods"("fiscal_year_id", "period_number");

-- CreateIndex
CREATE INDEX "journals_company_id_journal_type_idx" ON "journals"("company_id", "journal_type");

-- CreateIndex
CREATE INDEX "journals_company_id_is_active_idx" ON "journals"("company_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "journals_company_id_code_key" ON "journals"("company_id", "code");

-- CreateIndex
CREATE INDEX "journal_entries_company_id_journal_id_entry_date_idx" ON "journal_entries"("company_id", "journal_id", "entry_date");

-- CreateIndex
CREATE INDEX "journal_entries_company_id_fiscal_period_id_status_idx" ON "journal_entries"("company_id", "fiscal_period_id", "status");

-- CreateIndex
CREATE INDEX "journal_entries_company_id_status_idx" ON "journal_entries"("company_id", "status");

-- CreateIndex
CREATE INDEX "journal_entries_company_id_entry_date_idx" ON "journal_entries"("company_id", "entry_date");

-- CreateIndex
CREATE INDEX "journal_entries_company_id_created_by_idx" ON "journal_entries"("company_id", "created_by");

-- CreateIndex
CREATE UNIQUE INDEX "journal_entries_company_id_journal_id_entry_number_key" ON "journal_entries"("company_id", "journal_id", "entry_number");

-- CreateIndex
CREATE INDEX "journal_entry_lines_company_id_journal_entry_id_idx" ON "journal_entry_lines"("company_id", "journal_entry_id");

-- CreateIndex
CREATE INDEX "journal_entry_lines_company_id_account_id_idx" ON "journal_entry_lines"("company_id", "account_id");

-- CreateIndex
CREATE INDEX "journal_entry_lines_company_id_account_id_created_at_idx" ON "journal_entry_lines"("company_id", "account_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "journal_entry_lines_journal_entry_id_line_number_key" ON "journal_entry_lines"("journal_entry_id", "line_number");

-- AddForeignKey
ALTER TABLE "exchange_rates" ADD CONSTRAINT "exchange_rates_currency_code_fkey" FOREIGN KEY ("currency_code") REFERENCES "currencies"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exchange_rates" ADD CONSTRAINT "exchange_rates_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fiscal_years" ADD CONSTRAINT "fiscal_years_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fiscal_periods" ADD CONSTRAINT "fiscal_periods_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fiscal_periods" ADD CONSTRAINT "fiscal_periods_fiscal_year_id_fkey" FOREIGN KEY ("fiscal_year_id") REFERENCES "fiscal_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journals" ADD CONSTRAINT "journals_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_journal_id_fkey" FOREIGN KEY ("journal_id") REFERENCES "journals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_fiscal_period_id_fkey" FOREIGN KEY ("fiscal_period_id") REFERENCES "fiscal_periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_currency_code_fkey" FOREIGN KEY ("currency_code") REFERENCES "currencies"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entry_lines" ADD CONSTRAINT "journal_entry_lines_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entry_lines" ADD CONSTRAINT "journal_entry_lines_journal_entry_id_fkey" FOREIGN KEY ("journal_entry_id") REFERENCES "journal_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entry_lines" ADD CONSTRAINT "journal_entry_lines_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- =========================================================================
-- Índice parcial: una sola tasa global por moneda/fecha cuando company_id IS NULL
-- Prisma no genera índices parciales — se crea manualmente (F2-04)
-- =========================================================================
CREATE UNIQUE INDEX "exchange_rates_global_unique_idx"
    ON "exchange_rates"("currency_code", "date")
    WHERE "company_id" IS NULL;

-- =========================================================================
-- Row Level Security (RLS) — tablas de negocio del módulo Accounting
-- Estrategia: FORCE ROW LEVEL SECURITY + 4 políticas por tabla (DAR-DBA)
-- exchange_rates usa política especial (nullable company_id)
-- =========================================================================

-- === accounts ===
ALTER TABLE "accounts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "accounts" FORCE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_select" ON "accounts"
    FOR SELECT USING (company_id = current_setting('app.current_company_id', TRUE)::uuid);

CREATE POLICY "tenant_isolation_insert" ON "accounts"
    FOR INSERT WITH CHECK (company_id = current_setting('app.current_company_id', TRUE)::uuid);

CREATE POLICY "tenant_isolation_update" ON "accounts"
    FOR UPDATE USING (company_id = current_setting('app.current_company_id', TRUE)::uuid);

CREATE POLICY "tenant_isolation_delete" ON "accounts"
    FOR DELETE USING (company_id = current_setting('app.current_company_id', TRUE)::uuid);

-- === fiscal_years ===
ALTER TABLE "fiscal_years" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "fiscal_years" FORCE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_select" ON "fiscal_years"
    FOR SELECT USING (company_id = current_setting('app.current_company_id', TRUE)::uuid);

CREATE POLICY "tenant_isolation_insert" ON "fiscal_years"
    FOR INSERT WITH CHECK (company_id = current_setting('app.current_company_id', TRUE)::uuid);

CREATE POLICY "tenant_isolation_update" ON "fiscal_years"
    FOR UPDATE USING (company_id = current_setting('app.current_company_id', TRUE)::uuid);

CREATE POLICY "tenant_isolation_delete" ON "fiscal_years"
    FOR DELETE USING (company_id = current_setting('app.current_company_id', TRUE)::uuid);

-- === fiscal_periods ===
ALTER TABLE "fiscal_periods" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "fiscal_periods" FORCE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_select" ON "fiscal_periods"
    FOR SELECT USING (company_id = current_setting('app.current_company_id', TRUE)::uuid);

CREATE POLICY "tenant_isolation_insert" ON "fiscal_periods"
    FOR INSERT WITH CHECK (company_id = current_setting('app.current_company_id', TRUE)::uuid);

CREATE POLICY "tenant_isolation_update" ON "fiscal_periods"
    FOR UPDATE USING (company_id = current_setting('app.current_company_id', TRUE)::uuid);

CREATE POLICY "tenant_isolation_delete" ON "fiscal_periods"
    FOR DELETE USING (company_id = current_setting('app.current_company_id', TRUE)::uuid);

-- === journals ===
ALTER TABLE "journals" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "journals" FORCE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_select" ON "journals"
    FOR SELECT USING (company_id = current_setting('app.current_company_id', TRUE)::uuid);

CREATE POLICY "tenant_isolation_insert" ON "journals"
    FOR INSERT WITH CHECK (company_id = current_setting('app.current_company_id', TRUE)::uuid);

CREATE POLICY "tenant_isolation_update" ON "journals"
    FOR UPDATE USING (company_id = current_setting('app.current_company_id', TRUE)::uuid);

CREATE POLICY "tenant_isolation_delete" ON "journals"
    FOR DELETE USING (company_id = current_setting('app.current_company_id', TRUE)::uuid);

-- === journal_entries ===
ALTER TABLE "journal_entries" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "journal_entries" FORCE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_select" ON "journal_entries"
    FOR SELECT USING (company_id = current_setting('app.current_company_id', TRUE)::uuid);

CREATE POLICY "tenant_isolation_insert" ON "journal_entries"
    FOR INSERT WITH CHECK (company_id = current_setting('app.current_company_id', TRUE)::uuid);

CREATE POLICY "tenant_isolation_update" ON "journal_entries"
    FOR UPDATE USING (company_id = current_setting('app.current_company_id', TRUE)::uuid);

CREATE POLICY "tenant_isolation_delete" ON "journal_entries"
    FOR DELETE USING (company_id = current_setting('app.current_company_id', TRUE)::uuid);

-- === journal_entry_lines ===
ALTER TABLE "journal_entry_lines" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "journal_entry_lines" FORCE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_select" ON "journal_entry_lines"
    FOR SELECT USING (company_id = current_setting('app.current_company_id', TRUE)::uuid);

CREATE POLICY "tenant_isolation_insert" ON "journal_entry_lines"
    FOR INSERT WITH CHECK (company_id = current_setting('app.current_company_id', TRUE)::uuid);

CREATE POLICY "tenant_isolation_update" ON "journal_entry_lines"
    FOR UPDATE USING (company_id = current_setting('app.current_company_id', TRUE)::uuid);

CREATE POLICY "tenant_isolation_delete" ON "journal_entry_lines"
    FOR DELETE USING (company_id = current_setting('app.current_company_id', TRUE)::uuid);

-- === exchange_rates (política especial: company_id nullable) ===
-- NULL = tasa global de plataforma; visible para cualquier tenant autenticado
ALTER TABLE "exchange_rates" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "exchange_rates" FORCE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_select" ON "exchange_rates"
    FOR SELECT USING (
        company_id IS NULL
        OR company_id = current_setting('app.current_company_id', TRUE)::uuid
    );

CREATE POLICY "tenant_isolation_insert" ON "exchange_rates"
    FOR INSERT WITH CHECK (
        company_id IS NULL
        OR company_id = current_setting('app.current_company_id', TRUE)::uuid
    );

CREATE POLICY "tenant_isolation_update" ON "exchange_rates"
    FOR UPDATE USING (
        company_id IS NULL
        OR company_id = current_setting('app.current_company_id', TRUE)::uuid
    );

CREATE POLICY "tenant_isolation_delete" ON "exchange_rates"
    FOR DELETE USING (
        company_id IS NULL
        OR company_id = current_setting('app.current_company_id', TRUE)::uuid
    );
