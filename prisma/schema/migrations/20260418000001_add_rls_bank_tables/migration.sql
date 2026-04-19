-- RLS policies for bank_accounts, bank_statements, bank_transactions, bank_reconciliations
-- Fase 5 — Banking / Reconciliation

-- ============================================================
-- ENABLE RLS
-- ============================================================
ALTER TABLE bank_accounts        ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_accounts        FORCE ROW LEVEL SECURITY;
ALTER TABLE bank_statements      ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_statements      FORCE ROW LEVEL SECURITY;
ALTER TABLE bank_transactions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_transactions    FORCE ROW LEVEL SECURITY;
ALTER TABLE bank_reconciliations ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_reconciliations FORCE ROW LEVEL SECURITY;

-- ============================================================
-- POLICIES — bank_accounts
-- ============================================================
CREATE POLICY tenant_isolation_bank_accounts
  ON bank_accounts
  USING (company_id = current_setting('app.current_company_id', TRUE)::uuid);

CREATE POLICY tenant_isolation_bank_accounts_insert
  ON bank_accounts
  FOR INSERT
  WITH CHECK (company_id = current_setting('app.current_company_id', TRUE)::uuid);

-- ============================================================
-- POLICIES — bank_statements
-- ============================================================
CREATE POLICY tenant_isolation_bank_statements
  ON bank_statements
  USING (company_id = current_setting('app.current_company_id', TRUE)::uuid);

CREATE POLICY tenant_isolation_bank_statements_insert
  ON bank_statements
  FOR INSERT
  WITH CHECK (company_id = current_setting('app.current_company_id', TRUE)::uuid);

-- ============================================================
-- POLICIES — bank_transactions
-- ============================================================
CREATE POLICY tenant_isolation_bank_transactions
  ON bank_transactions
  USING (company_id = current_setting('app.current_company_id', TRUE)::uuid);

CREATE POLICY tenant_isolation_bank_transactions_insert
  ON bank_transactions
  FOR INSERT
  WITH CHECK (company_id = current_setting('app.current_company_id', TRUE)::uuid);

-- ============================================================
-- POLICIES — bank_reconciliations
-- ============================================================
CREATE POLICY tenant_isolation_bank_reconciliations
  ON bank_reconciliations
  USING (company_id = current_setting('app.current_company_id', TRUE)::uuid);

CREATE POLICY tenant_isolation_bank_reconciliations_insert
  ON bank_reconciliations
  FOR INSERT
  WITH CHECK (company_id = current_setting('app.current_company_id', TRUE)::uuid);
