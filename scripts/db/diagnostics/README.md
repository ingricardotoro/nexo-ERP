# Scripts de Diagnóstico de Base de Datos

Scripts SQL manuales para debugging y diagnóstico de comportamiento de PostgreSQL RLS y Prisma.

## ⚠️ Propósito

Estos scripts se ejecutan **manualmente** en desarrollo local para:

- Diagnosticar comportamiento de Row Level Security (RLS)
- Entender cómo Prisma interactúa con SET LOCAL y transacciones
- Reproducir issues de aislamiento multi-tenant
- Validar políticas RLS antes de commit

**NO se ejecutan en CI/CD** ni forman parte de migraciones.

## Scripts Disponibles

### `test-rls-manual.sql`

Test básico de RLS con INSERT + SELECT en transacción.

- Valida que `SET LOCAL app.current_company_id` funciona correctamente
- Verifica aislamiento cambiando company_id en misma transacción
- Siempre hace ROLLBACK (no altera datos)

**Cómo ejecutar:**

```bash
# Desde psql o pgAdmin
psql -U nexoerp -d nexoerp -f scripts/db/diagnostics/test-rls-manual.sql
```

### `test-rls-prisma-flow.sql`

Replica el flujo de transacciones de Prisma para diagnosticar discrepancias.

- Escenario 1: SET LOCAL + SELECT inmediato
- Escenario 2: SET LOCAL + verification + SELECT (como withRLSContext)
- Escenario 3: Prepared statements (como Prisma podría usar)

**Cómo ejecutar:**

```bash
psql -U nexoerp -d nexoerp -f scripts/db/diagnostics/test-rls-prisma-flow.sql
```

## Cuándo Usar

- Después de modificar políticas RLS en migraciones
- Al investigar bugs de aislamiento multi-tenant
- Para entender comportamiento de SET LOCAL en transacciones
- Durante troubleshooting de Prisma + RLS integration

## Arquitectura de Referencia

Ver documentación completa en:

- `docs/ARCHITECTURE.md` - Sección "Multi-Tenant Isolation Strategy"
- `docs/adr/DAR-DBA-003-prisma-client-extension.md` - Decisión sobre Prisma Extension

## Contexto Histórico

Estos scripts se crearon durante F0-03 (Prisma + PostgreSQL + RLS) para diagnosticar por qué los tests de integración fallaban inicialmente. La solución final fue usar **Prisma Client Extension** para tenant filtering en application layer, manteniendo RLS como fallback (defense-in-depth).

**Refs:** F0-03, DAR-DBA-003
