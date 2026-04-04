-- RLS policies for sales_orders and sales_order_lines
-- Fase 4 Sprint S3

-- ============================================================
-- ENABLE RLS
-- ============================================================
ALTER TABLE sales_orders       ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_orders       FORCE ROW LEVEL SECURITY;
ALTER TABLE sales_order_lines  ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_order_lines  FORCE ROW LEVEL SECURITY;

-- ============================================================
-- POLICIES — sales_orders
-- ============================================================
CREATE POLICY tenant_isolation_sales_orders
  ON sales_orders
  USING (company_id = current_setting('app.current_company_id', TRUE)::uuid);

CREATE POLICY tenant_isolation_sales_orders_insert
  ON sales_orders
  FOR INSERT
  WITH CHECK (company_id = current_setting('app.current_company_id', TRUE)::uuid);

-- ============================================================
-- POLICIES — sales_order_lines
-- ============================================================
CREATE POLICY tenant_isolation_sales_order_lines
  ON sales_order_lines
  USING (company_id = current_setting('app.current_company_id', TRUE)::uuid);

CREATE POLICY tenant_isolation_sales_order_lines_insert
  ON sales_order_lines
  FOR INSERT
  WITH CHECK (company_id = current_setting('app.current_company_id', TRUE)::uuid);