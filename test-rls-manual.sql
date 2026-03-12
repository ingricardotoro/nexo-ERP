-- Test RLS manual with INSERT + SELECT
BEGIN;
-- Crear usuario para empresa 1
SET LOCAL app.current_company_id TO '00000000-0000-0000-0000-000000000001';
INSERT INTO users (id, company_id, cognito_sub, email, full_name, role, is_active, created_at, updated_at)
VALUES ('test-manual-1', '00000000-0000-0000-0000-000000000001', 'test1', 'test1@test.com', 'Test 1', 'ADMIN', true, NOW(), NOW());

-- Verificar que se ve con su propio company_id
SELECT count(*) as "Con company_id correcto (debe ser 1)" FROM users WHERE id='test-manual-1';

-- Cambiar a company_id diferente EN LA MISMA TRANSACCIÓN
SET LOCAL app.current_company_id TO '00000000-0000-0000-0000-000000000002';
SELECT count(*) as "Con company_id diferente (debe ser 0)" FROM users WHERE id='test-manual-1';

ROLLBACK;
