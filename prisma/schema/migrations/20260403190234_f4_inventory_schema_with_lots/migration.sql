-- =========================================================
-- Migración: f4_inventory_rls_and_supplier_invoice_rls
-- RLS para tablas de inventario (Fase 4) y corrección de
-- SupplierInvoice/SupplierInvoiceLine que faltaban en Fase 3.
--
-- Estrategia (DAR-DBA-003):
--   - FORCE ROW LEVEL SECURITY aplica al owner también
--   - Variable de sesión: app.current_company_id
--   - 4 políticas por tabla: SELECT, INSERT, UPDATE, DELETE
-- =========================================================

-- ===========================================================
-- Fase 3 retroactivo: supplier_invoices + supplier_invoice_lines
-- (estaban en la extensión Prisma pero sin RLS en la BD)
-- ===========================================================

ALTER TABLE supplier_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_invoices FORCE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_select" ON supplier_invoices
  FOR SELECT
  USING (company_id = current_setting('app.current_company_id', TRUE)::uuid);

CREATE POLICY "tenant_isolation_insert" ON supplier_invoices
  FOR INSERT
  WITH CHECK (company_id = current_setting('app.current_company_id', TRUE)::uuid);

CREATE POLICY "tenant_isolation_update" ON supplier_invoices
  FOR UPDATE
  USING (company_id = current_setting('app.current_company_id', TRUE)::uuid);

CREATE POLICY "tenant_isolation_delete" ON supplier_invoices
  FOR DELETE
  USING (company_id = current_setting('app.current_company_id', TRUE)::uuid);

-- ---

ALTER TABLE supplier_invoice_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_invoice_lines FORCE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_select" ON supplier_invoice_lines
  FOR SELECT
  USING (company_id = current_setting('app.current_company_id', TRUE)::uuid);

CREATE POLICY "tenant_isolation_insert" ON supplier_invoice_lines
  FOR INSERT
  WITH CHECK (company_id = current_setting('app.current_company_id', TRUE)::uuid);

CREATE POLICY "tenant_isolation_update" ON supplier_invoice_lines
  FOR UPDATE
  USING (company_id = current_setting('app.current_company_id', TRUE)::uuid);

CREATE POLICY "tenant_isolation_delete" ON supplier_invoice_lines
  FOR DELETE
  USING (company_id = current_setting('app.current_company_id', TRUE)::uuid);

-- ===========================================================
-- Inventario (Fase 4): product_categories
-- ===========================================================

ALTER TABLE product_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_categories FORCE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_select" ON product_categories
  FOR SELECT
  USING (company_id = current_setting('app.current_company_id', TRUE)::uuid);

CREATE POLICY "tenant_isolation_insert" ON product_categories
  FOR INSERT
  WITH CHECK (company_id = current_setting('app.current_company_id', TRUE)::uuid);

CREATE POLICY "tenant_isolation_update" ON product_categories
  FOR UPDATE
  USING (company_id = current_setting('app.current_company_id', TRUE)::uuid);

CREATE POLICY "tenant_isolation_delete" ON product_categories
  FOR DELETE
  USING (company_id = current_setting('app.current_company_id', TRUE)::uuid);

-- ===========================================================
-- Inventario: units_of_measure
-- ===========================================================

ALTER TABLE units_of_measure ENABLE ROW LEVEL SECURITY;
ALTER TABLE units_of_measure FORCE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_select" ON units_of_measure
  FOR SELECT
  USING (company_id = current_setting('app.current_company_id', TRUE)::uuid);

CREATE POLICY "tenant_isolation_insert" ON units_of_measure
  FOR INSERT
  WITH CHECK (company_id = current_setting('app.current_company_id', TRUE)::uuid);

CREATE POLICY "tenant_isolation_update" ON units_of_measure
  FOR UPDATE
  USING (company_id = current_setting('app.current_company_id', TRUE)::uuid);

CREATE POLICY "tenant_isolation_delete" ON units_of_measure
  FOR DELETE
  USING (company_id = current_setting('app.current_company_id', TRUE)::uuid);

-- ===========================================================
-- Inventario: products
-- ===========================================================

ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE products FORCE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_select" ON products
  FOR SELECT
  USING (company_id = current_setting('app.current_company_id', TRUE)::uuid);

CREATE POLICY "tenant_isolation_insert" ON products
  FOR INSERT
  WITH CHECK (company_id = current_setting('app.current_company_id', TRUE)::uuid);

CREATE POLICY "tenant_isolation_update" ON products
  FOR UPDATE
  USING (company_id = current_setting('app.current_company_id', TRUE)::uuid);

CREATE POLICY "tenant_isolation_delete" ON products
  FOR DELETE
  USING (company_id = current_setting('app.current_company_id', TRUE)::uuid);

-- ===========================================================
-- Inventario: warehouses
-- ===========================================================

ALTER TABLE warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE warehouses FORCE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_select" ON warehouses
  FOR SELECT
  USING (company_id = current_setting('app.current_company_id', TRUE)::uuid);

CREATE POLICY "tenant_isolation_insert" ON warehouses
  FOR INSERT
  WITH CHECK (company_id = current_setting('app.current_company_id', TRUE)::uuid);

CREATE POLICY "tenant_isolation_update" ON warehouses
  FOR UPDATE
  USING (company_id = current_setting('app.current_company_id', TRUE)::uuid);

CREATE POLICY "tenant_isolation_delete" ON warehouses
  FOR DELETE
  USING (company_id = current_setting('app.current_company_id', TRUE)::uuid);

-- ===========================================================
-- Inventario: locations
-- ===========================================================

ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations FORCE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_select" ON locations
  FOR SELECT
  USING (company_id = current_setting('app.current_company_id', TRUE)::uuid);

CREATE POLICY "tenant_isolation_insert" ON locations
  FOR INSERT
  WITH CHECK (company_id = current_setting('app.current_company_id', TRUE)::uuid);

CREATE POLICY "tenant_isolation_update" ON locations
  FOR UPDATE
  USING (company_id = current_setting('app.current_company_id', TRUE)::uuid);

CREATE POLICY "tenant_isolation_delete" ON locations
  FOR DELETE
  USING (company_id = current_setting('app.current_company_id', TRUE)::uuid);

-- ===========================================================
-- Inventario: lots
-- ===========================================================

ALTER TABLE lots ENABLE ROW LEVEL SECURITY;
ALTER TABLE lots FORCE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_select" ON lots
  FOR SELECT
  USING (company_id = current_setting('app.current_company_id', TRUE)::uuid);

CREATE POLICY "tenant_isolation_insert" ON lots
  FOR INSERT
  WITH CHECK (company_id = current_setting('app.current_company_id', TRUE)::uuid);

CREATE POLICY "tenant_isolation_update" ON lots
  FOR UPDATE
  USING (company_id = current_setting('app.current_company_id', TRUE)::uuid);

CREATE POLICY "tenant_isolation_delete" ON lots
  FOR DELETE
  USING (company_id = current_setting('app.current_company_id', TRUE)::uuid);

-- ===========================================================
-- Inventario: stock_quants
-- Nota: partial unique index para productos NONE (lot_id IS NULL)
-- El @@unique de Prisma no garantiza unicidad cuando lot_id = NULL
-- porque NULL != NULL en SQL. Este índice parcial lo cierra.
-- ===========================================================

ALTER TABLE stock_quants ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_quants FORCE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_select" ON stock_quants
  FOR SELECT
  USING (company_id = current_setting('app.current_company_id', TRUE)::uuid);

CREATE POLICY "tenant_isolation_insert" ON stock_quants
  FOR INSERT
  WITH CHECK (company_id = current_setting('app.current_company_id', TRUE)::uuid);

CREATE POLICY "tenant_isolation_update" ON stock_quants
  FOR UPDATE
  USING (company_id = current_setting('app.current_company_id', TRUE)::uuid);

CREATE POLICY "tenant_isolation_delete" ON stock_quants
  FOR DELETE
  USING (company_id = current_setting('app.current_company_id', TRUE)::uuid);

-- Partial unique index: garantiza un solo quant por (company, product, location)
-- cuando no hay lote (tracking_type = NONE)
CREATE UNIQUE INDEX uq_stock_quant_no_lot
  ON stock_quants (company_id, product_id, location_id)
  WHERE lot_id IS NULL;

-- ===========================================================
-- Inventario: stock_moves
-- ===========================================================

ALTER TABLE stock_moves ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_moves FORCE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_select" ON stock_moves
  FOR SELECT
  USING (company_id = current_setting('app.current_company_id', TRUE)::uuid);

CREATE POLICY "tenant_isolation_insert" ON stock_moves
  FOR INSERT
  WITH CHECK (company_id = current_setting('app.current_company_id', TRUE)::uuid);

CREATE POLICY "tenant_isolation_update" ON stock_moves
  FOR UPDATE
  USING (company_id = current_setting('app.current_company_id', TRUE)::uuid);

CREATE POLICY "tenant_isolation_delete" ON stock_moves
  FOR DELETE
  USING (company_id = current_setting('app.current_company_id', TRUE)::uuid);

-- ===========================================================
-- Inventario: stock_move_lines
-- ===========================================================

ALTER TABLE stock_move_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_move_lines FORCE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_select" ON stock_move_lines
  FOR SELECT
  USING (company_id = current_setting('app.current_company_id', TRUE)::uuid);

CREATE POLICY "tenant_isolation_insert" ON stock_move_lines
  FOR INSERT
  WITH CHECK (company_id = current_setting('app.current_company_id', TRUE)::uuid);

CREATE POLICY "tenant_isolation_update" ON stock_move_lines
  FOR UPDATE
  USING (company_id = current_setting('app.current_company_id', TRUE)::uuid);

CREATE POLICY "tenant_isolation_delete" ON stock_move_lines
  FOR DELETE
  USING (company_id = current_setting('app.current_company_id', TRUE)::uuid);

-- ===========================================================
-- Inventario: reorder_rules
-- ===========================================================

ALTER TABLE reorder_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE reorder_rules FORCE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_select" ON reorder_rules
  FOR SELECT
  USING (company_id = current_setting('app.current_company_id', TRUE)::uuid);

CREATE POLICY "tenant_isolation_insert" ON reorder_rules
  FOR INSERT
  WITH CHECK (company_id = current_setting('app.current_company_id', TRUE)::uuid);

CREATE POLICY "tenant_isolation_update" ON reorder_rules
  FOR UPDATE
  USING (company_id = current_setting('app.current_company_id', TRUE)::uuid);

CREATE POLICY "tenant_isolation_delete" ON reorder_rules
  FOR DELETE
  USING (company_id = current_setting('app.current_company_id', TRUE)::uuid);
