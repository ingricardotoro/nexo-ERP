---
name: Patrones de schema Prisma multi-tenant confirmados
description: Convenciones de Prisma 6 multi-file confirmadas leyendo base.prisma, core.prisma y contacts.prisma
type: project
---

## Estructura de archivos

- `prisma/schema/base.prisma` — datasource, generator, enums globales
- `prisma/schema/core.prisma` — Company, User, AuditLog, Module, CompanyModule, Permission, RolePermission
- `prisma/schema/contacts.prisma` — PaymentTerms, Contact, ContactAddress, ContactPerson
- Módulos nuevos: un archivo por módulo (e.g., `accounting.prisma`, `invoicing.prisma`)

## Convenciones de campos confirmadas

- `id String @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid` — PK estándar
- `companyId String @map("company_id") @db.Uuid` — siempre NOT NULL en tablas de negocio
- `company Company @relation(fields: [companyId], references: [id], onDelete: Restrict)` — onDelete Restrict en tablas de negocio
- `createdAt DateTime @default(now()) @map("created_at")`
- `updatedAt DateTime @updatedAt @map("updated_at")`
- snake_case en `@map()` para nombres de columna SQL
- `@db.Citext` para campos case-insensitive (email, rtn, códigos)
- `Decimal` para montos (nunca Float)

## Enums ya definidos en base.prisma (no redefinir)

- `AccountNature` (DEBIT, CREDIT)
- `AccountType` (ASSET, LIABILITY, EQUITY, INCOME, COST, EXPENSE)
- `FiscalPeriodStatus` (OPEN, CLOSED)
- `DocumentStatus`, `ContactType`, `AddressType`, `SystemRole`, `AuditAction`

**Nota crítica:** Los enums `AccountNature`, `AccountType` y `FiscalPeriodStatus` ya existen en base.prisma.
El módulo de contabilidad debe reutilizarlos — NO redefinirlos en accounting.prisma.

## Regla de índices (DAR-005 — inquebrantable)

`company_id` siempre es el PRIMER campo en todos los índices compuestos de tablas de negocio.

## Tablas de plataforma (sin company_id, sin RLS)

`companies`, `modules`, `permissions`, `role_permissions`

## Cascade

- Tablas hijo desnormalizadas (con company_id propio): `onDelete: Cascade` en FK al padre de negocio, `onDelete: Restrict` en FK a company
- Ejemplo confirmado: ContactAddress.contact -> Cascade, ContactAddress.company -> Restrict
