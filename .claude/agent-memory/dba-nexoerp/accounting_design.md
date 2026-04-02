---
name: Decisiones de diseño del módulo de Contabilidad (F2-04)
description: Decisiones arquitecturales clave tomadas al diseñar accounting.prisma
type: project
---

## Enums reutilizados de base.prisma (no redefinir en accounting.prisma)

- `AccountNature` (DEBIT | CREDIT) — naturaleza del saldo normal
- `AccountType` (ASSET | LIABILITY | EQUITY | INCOME | COST | EXPENSE) — clasificación NIIF
- `FiscalPeriodStatus` (OPEN | CLOSED) — estados de período
- NOTA: El requerimiento pedía tipo REVENUE pero el enum ya definido usa INCOME. Decisión: usar INCOME para consistencia. CONTRA no existe en el enum; se agrega como valor nuevo si se necesita.

## Enums nuevos a definir en accounting.prisma

- `FiscalYearStatus` (OPEN | CLOSED | LOCKED) — FiscalYear necesita LOCKED adicional vs FiscalPeriodStatus
- `JournalType` (GENERAL | SALES | PURCHASES | CASH | BANK | PAYROLL | ADJUSTMENT)
- `JournalEntryStatus` (DRAFT | POSTED | CANCELLED)

## Currency — tabla de plataforma (sin company_id, sin RLS)

- PK: `code String @id` (ej: "HNL", "USD")
- No es multi-tenant: catálogo global compartido entre todos los tenants
- `isBase Boolean` — HNL es true, el resto false

## ExchangeRate — company_id nullable

- `companyId String? @db.Uuid` — null = tasa BCH global, not null = override por empresa
- RLS especial: `company_id IS NULL OR company_id = current_setting(...)`
- PK compuesta: `@@id([currencyCode, date, companyId])` — pero companyId nullable complica esto
- Decisión: usar UUID como PK + `@@unique([currencyCode, date])` para tasas globales, separar override por empresa con `@@unique([currencyCode, date, companyId])` donde companyId nullable usa NULLS NOT DISTINCT

## FiscalYear vs FiscalPeriod

- FiscalYear: `@@unique([companyId, year])` — un año por empresa
- FiscalPeriod: `@@unique([fiscalYearId, periodNumber])` — pero fiscalYearId ya está scoped a companyId
- FiscalPeriod lleva `companyId` desnormalizado para que RLS funcione sin JOIN

## JournalEntry — campo entryNumber

- Correlativo por journal + año fiscal (no global por empresa)
- NO se puede auto-incrementar con `@default(autoincrement())` porque es por combinación de journal+año
- Estrategia: sequence gestionada en application layer (service), no constraint de DB
- Almacenar como Int, validar unicidad con `@@unique([companyId, journalId, entryNumber])`

## JournalEntryLine — restriccion debit XOR credit

- No se implementa como CHECK constraint de DB (Prisma no lo genera nativamente)
- Se valida en service layer antes de persistir
- Ambos campos tienen `@default(0)` para facilitar la inserción
- Los campos `currencyDebit` y `currencyCredit` almacenan el monto en moneda original del asiento

## totalDebit y totalCredit en JournalEntry

- Se almacenan desnormalizados para evitar SUM() en cada listado
- Se recalculan y validan en el service layer al publicar (POSTED)
- Constraint de partida doble: totalDebit = totalCredit — validado en service, no en DB

## Relaciones de Account (self-relation)

- `parentId String? @db.Uuid` — nullable para cuentas raíz
- `parent Account? @relation("AccountHierarchy", fields: [parentId], references: [id])`
- `children Account[] @relation("AccountHierarchy")`
- FK onDelete: Restrict — no eliminar cuenta padre si tiene hijos

## Campos allowDirectEntry vs isParent

- `isParent` refleja si la cuenta tiene hijos (puede calcularse)
- `allowDirectEntry` es la restricción de negocio (false en cuentas de mayor)
- Decisión: mantener ambos como flags explícitos para simplicidad de queries

## FiscalYear — relaciones Company

- Company necesita agregar `fiscalYears FiscalYear[]` y demás relaciones de contabilidad
- Esto requiere editar core.prisma para agregar las relaciones inversas en Company
