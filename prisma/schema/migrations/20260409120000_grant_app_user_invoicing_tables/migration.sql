-- Migration: grant_app_user_invoicing_tables
-- Otorga permisos DML a app_user sobre las tablas de facturación (Fase 3)
-- creadas en 20260330_feat_invoicing_module y 20260402_add_supplier_invoice.
--
-- Causa: ALTER DEFAULT PRIVILEGES sólo aplica a tablas creadas por el mismo
-- role en el futuro. Las tablas de Fase 3 se crearon sin que app_user tuviera
-- grants, produciendo "permission denied for table ..." (PG-42501) en runtime.

-- ─── Facturación (Fase 3) ─────────────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE cais                    TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE tax_rates               TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE invoice_sequences       TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE invoices                TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE invoice_lines           TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE supplier_invoices       TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE supplier_invoice_lines  TO app_user;
