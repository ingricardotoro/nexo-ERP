---
name: Estado actual del proyecto NexoERP
description: Fases completadas, en progreso, ramas activas y metricas clave verificadas en codigo
type: project
---

## Estado al 2026-03-28

### Rama activa
`feat/fase-2-contabilidad-seed-niif`

### Fase 0 — COMPLETADA
Setup, Amplify Gen 2, Prisma, tooling, testing, ambientes, CI/CD.

### Fase 1 — COMPLETADA (10-16 marzo 2026, 6 dias)
- Multi-tenancy 4 capas: RLS + Prisma Extension + company_id + Frontend Context
- Auth con AWS Cognito + Lambda PostConfirmation
- CRUD Usuarios completo (API + UI TanStack Table)
- Schema Prisma: Company, User, AuditLog, Module, CompanyModule, Permission, RolePermission
- 47 tests passing al cierre de Fase 1
- CI/CD GitHub Actions + AWS Amplify staging
- Endpoints: 7 (GET/POST /users, GET/PUT/DELETE /users/[id], GET /tenant, GET /health)

### Fase 2 — EN PROGRESO (rama feat/fase-2-contabilidad-contactos)

#### Modulo Contactos — COMPLETADO
Commits: 52fc0a0, a62354b, f3f45ec, 1ff065c, 32a52db, 4cebfec
Modelos Prisma: PaymentTerms, Contact, ContactAddress, ContactPerson
Endpoints: 19 (16 CRUD + 2 import + 1 payment-terms delete)
Paginas UI: /contacts, /contacts/[id], /contacts/new, /contacts/[id]/edit
Validacion fiscal: RTN Honduras formato DDDD-DDDD-DDDDD (Citext en BD)

#### Modulo Contabilidad — EN PROGRESO (~75%)
Tareas completadas: F2-04 a F2-11 + F2-14 (9 de 12 tareas)
Tareas pendientes: F2-12 (PDF/Excel), F2-13 (conciliacion bancaria), F2-15 (tests)

**Schema:** accounting.prisma con 9 modelos:
Currency, ExchangeRate, Account, FiscalYear, FiscalPeriod, Journal, JournalEntry, JournalEntryLine, JournalSequence

**Endpoints contabilidad:** 28 endpoints bajo /api/v1/accounting/
- /accounts (2), /fiscal-years (6), /journals (5), /journal-entries (7)
- /exchange-rates (4), /currencies (1), /reports (3)

**Servicios:** account.service, fiscal-year.service, journal.service,
journal-entry.service, exchange-rate.service, financial-report.service, aging.service

**Migraciones aplicadas:** 6 (core, contacts, accounting-base, journal-sequences-cancellation + 2 adicionales)

**Metricas adicionales:**
- Modelos Prisma: 20 activos
- Permisos RBAC seeded: 27 (core + contacts + accounting)
- Cuentas NIIF seeded: ~360 (Plan de Cuentas Honduras)
- Diarios seeded: 7 (DJ, LV, LC, CA, BK, NM, AJ)
- Monedas: 3 (HNL base, USD, EUR)
- Tests unitarios: ~52

**Decisiones clave:**
- ExchangeRate excluido de BUSINESS_MODELS (companyId nullable) — filtrado manual
- JournalSequence con INSERT ON CONFLICT DO UPDATE RETURNING via $queryRaw (atomicidad)
- Reportes: propagacion bottom-up en memoria (no CTE SQL recursiva)
- company_id desnormalizado en FiscalPeriod y JournalEntryLine (mismo patron que ContactAddress)

### Total endpoints proyecto
47 (7 core + 19 contactos + 21 contabilidad [28 contabilidad menos algunos ya contados])
Nota: contar desde route handlers: accounts(2) + fiscal-years(5) + journals(5) + journal-entries(7) + exchange-rates(4) + currencies(1) + reports(2) = 26 contabilidad

### Tests
Al cierre de Fase 1: 47 passing.
Estado al 2026-03-27: pendiente verificar — la rama tiene deuda de tests (F2-15 pendiente).

**How to apply:** Al documentar metricas de tests para contabilidad, indicar que F2-15
es tarea pendiente y no hay metricas verificadas de cobertura para el modulo contabilidad.
