-- Test: Replicar el flujo de Prisma $transaction con SET LOCAL
-- Objetivo: Entender por qué las queries dentro de Prisma NO respetan SET LOCAL

-- Escenario 1: Transaction con SET LOCAL + immediate SELECT (como test manual que SÍ funcionó)
BEGIN;
SET LOCAL app.current_company_id TO '00000000-0000-0000-0000-000000000001';
SELECT 'Escenario 1: SET LOCAL + SELECT inmediato' AS test;
SELECT count(*) AS count_escenario_1 FROM users;
ROLLBACK;

-- Escenario 2: Transaction con SET LOCAL + verification + SELECT (como hace withRLSContext)
BEGIN;
SET LOCAL app.current_company_id TO '00000000-0000-0000-0000-000000000001';
SELECT 'Escenario 2: SET LOCAL + verification + SELECT' AS test;
SELECT current_setting('app.current_company_id', true) AS verification;
SELECT count(*) AS count_escenario_2 FROM users;
ROLLBACK;

-- Escenario 3: Transaction con SET LOCAL que usa prepared statements (como Prisma podría hacer)
BEGIN;
SET LOCAL app.current_company_id TO '00000000-0000-0000-0000-000000000001';
SELECT 'Escenario 3: SET LOCAL + prepared statement style' AS test;
PREPARE query_test AS SELECT count(*) FROM users;
EXECUTE query_test;
DEALLOCATE query_test;
ROLLBACK;

-- Escenario 4: Sin transaction, SET SESSION (persistente, peligroso en pooling)
SET SESSION app.current_company_id TO '00000000-0000-0000-0000-000000000001';
SELECT 'Escenario 4: SET SESSION (sin transaction)' AS test;
SELECT count(*) AS count_escenario_4 FROM users;
-- Limpiar
RESET app.current_company_id;

-- Escenario 5: Verificar que app_user realmente tiene RLS habilitado
SELECT 'Escenario 5: Verificar RLS status' AS test;
SELECT schemaname, tablename, rowsecurity FROM pg_tables WHERE tablename='users';

-- Escenario 6: Verificar policies aplicadas a app_user
SELECT 'Escenario 6: Policies para app_user' AS test;
SELECT tablename, policyname, roles FROM pg_policies WHERE tablename='users' AND 'app_user' = ANY(roles);
