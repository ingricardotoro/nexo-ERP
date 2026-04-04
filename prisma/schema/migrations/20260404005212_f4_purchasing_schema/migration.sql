-- =========================================================
-- Migración: f4_purchasing_rls
-- RLS para tablas de compras (Fase 4 Sprint S2)
-- =========================================================

ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_orders FORCE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_select" ON purchase_orders
  FOR SELECT
  USING (company_id = current_setting('app.current_company_id', TRUE)::uuid);

CREATE POLICY "tenant_isolation_insert" ON purchase_orders
  FOR INSERT
  WITH CHECK (company_id = current_setting('app.current_company_id', TRUE)::uuid);

CREATE POLICY "tenant_isolation_update" ON purchase_orders
  FOR UPDATE
  USING (company_id = current_setting('app.current_company_id', TRUE)::uuid);

CREATE POLICY "tenant_isolation_delete" ON purchase_orders
  FOR DELETE
  USING (company_id = current_setting('app.current_company_id', TRUE)::uuid);

-- ---

ALTER TABLE purchase_order_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_order_lines FORCE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_select" ON purchase_order_lines
  FOR SELECT
  USING (company_id = current_setting('app.current_company_id', TRUE)::uuid);

CREATE POLICY "tenant_isolation_insert" ON purchase_order_lines
  FOR INSERT
  WITH CHECK (company_id = current_setting('app.current_company_id', TRUE)::uuid);

CREATE POLICY "tenant_isolation_update" ON purchase_order_lines
  FOR UPDATE
  USING (company_id = current_setting('app.current_company_id', TRUE)::uuid);

CREATE POLICY "tenant_isolation_delete" ON purchase_order_lines
  FOR DELETE
  USING (company_id = current_setting('app.current_company_id', TRUE)::uuid);
