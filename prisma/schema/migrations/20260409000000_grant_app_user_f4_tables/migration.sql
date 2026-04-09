-- Migration: grant_app_user_f4_tables
-- Otorga permisos DML a app_user sobre las tablas creadas en Fase 4
-- (inventario, compras, ventas) que se crearon después del GRANT inicial.
--
-- Causa: ALTER DEFAULT PRIVILEGES sólo aplica a tablas creadas por el mismo
-- role en el futuro. Las tablas F4 se crearon sin que app_user tuviera grants,
-- lo que produce "permission denied for table ..." (PG-42501) en runtime.

-- ─── Inventario ────────────────────────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE product_categories  TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE units_of_measure     TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE products             TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE warehouses           TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE locations            TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE lots                 TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE stock_quants         TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE stock_moves          TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE stock_move_lines     TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE reorder_rules        TO app_user;

-- ─── Compras ───────────────────────────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE purchase_orders      TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE purchase_order_lines TO app_user;

-- ─── Ventas ────────────────────────────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE sales_orders         TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE sales_order_lines    TO app_user;

-- ─── Sequences ─────────────────────────────────────────────────────────────────
-- Necesario para que app_user pueda usar nextval() en columnas con DEFAULT gen_random_uuid()
-- o secuencias propias si las hay.
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO app_user;
