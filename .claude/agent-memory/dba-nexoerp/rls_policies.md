---
name: Configuracion RLS y patron de migraciones
description: Estructura RLS confirmada de migraciones existentes — patron a seguir para tablas nuevas
type: project
---

## Variable de sesion

`current_setting('app.current_company_id', TRUE)::uuid`
- El segundo argumento `TRUE` hace que retorne NULL en lugar de lanzar error si no está configurada.
- El middleware API ejecuta `SET app.current_company_id = 'uuid'` al inicio de cada request.

## Configuracion RLS confirmada

```sql
ALTER TABLE {tabla} ENABLE ROW LEVEL SECURITY;
ALTER TABLE {tabla} FORCE ROW LEVEL SECURITY;
-- FORCE aplica incluso al owner (nexoerp) — activado desde migración disable_force_rls
-- Nota: la migración se llama "disable_force_rls" pero en realidad REACTIVA FORCE RLS
```

## Template de 4 policies por tabla

```sql
CREATE POLICY "tenant_isolation_select" ON {tabla}
  FOR SELECT
  USING (company_id = current_setting('app.current_company_id', TRUE)::uuid);

CREATE POLICY "tenant_isolation_insert" ON {tabla}
  FOR INSERT
  WITH CHECK (company_id = current_setting('app.current_company_id', TRUE)::uuid);

CREATE POLICY "tenant_isolation_update" ON {tabla}
  FOR UPDATE
  USING (company_id = current_setting('app.current_company_id', TRUE)::uuid);

CREATE POLICY "tenant_isolation_delete" ON {tabla}
  FOR DELETE
  USING (company_id = current_setting('app.current_company_id', TRUE)::uuid);
```

## Policy especial para tablas con company_id nullable (ExchangeRate)

```sql
CREATE POLICY "tenant_isolation_select" ON exchange_rates
  FOR SELECT
  USING (company_id IS NULL OR company_id = current_setting('app.current_company_id', TRUE)::uuid);
```

## Tablas SIN RLS (plataforma)

`companies`, `modules`, `permissions`, `role_permissions`, `currencies` (catálogo global)

## Tablas de negocio con RLS aplicado hasta F2-03

`users`, `audit_logs` (RLS aplicado con FORCE), `company_modules`,
`payment_terms`, `contacts`, `contact_addresses`, `contact_persons`

## Patron de RLS en migraciones separadas

Las políticas RLS van en la MISMA migración que crea las tablas (no en una migración separada).
Excepcion: la migración inicial de users tuvo el RLS en migración separada por razones de bootstrap.
Para F2-04 en adelante: RLS va inline en la misma migración.
