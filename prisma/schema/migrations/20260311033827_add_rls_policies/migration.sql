-- =========================================================
-- Migración: add_rls_policies
-- Row Level Security (RLS) para tablas de negocio
--
-- Estrategia (DAR-DBA):
--   - Tablas de PLATAFORMA (companies): NO llevan RLS
--   - Tablas de NEGOCIO (users, y futuras): SÍ llevan RLS
--   - Variable de sesión: app.current_company_id via current_setting()
--   - 4 tipos de política por tabla: SELECT, INSERT, UPDATE, DELETE
--   - FORCE ROW LEVEL SECURITY: aplica también al owner (nexoerp)
-- =========================================================

-- === users ===
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE users FORCE ROW LEVEL SECURITY;

-- SELECT: solo registros de la company actual
CREATE POLICY "tenant_isolation_select" ON users
  FOR SELECT
  USING (company_id = current_setting('app.current_company_id', TRUE)::uuid);

-- INSERT: solo en la company actual
CREATE POLICY "tenant_isolation_insert" ON users
  FOR INSERT
  WITH CHECK (company_id = current_setting('app.current_company_id', TRUE)::uuid);

-- UPDATE: solo registros de la company actual
CREATE POLICY "tenant_isolation_update" ON users
  FOR UPDATE
  USING (company_id = current_setting('app.current_company_id', TRUE)::uuid);

-- DELETE: solo registros de la company actual
-- Nota: soft-delete (is_active=false) es el método preferido (DAR-006)
-- Esta policy protege de DELETEs accidentales cross-tenant
CREATE POLICY "tenant_isolation_delete" ON users
  FOR DELETE
  USING (company_id = current_setting('app.current_company_id', TRUE)::uuid);

-- =========================================================
-- Las políticas de RLS para tablas futuras (contacts, invoices,
-- journal_entries, etc.) se agregarán en las migraciones de
-- cada módulo (Fase 1, 2, 3...) siguiendo este mismo patrón.
-- =========================================================
