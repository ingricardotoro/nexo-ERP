---
name: Decisiones de schema Prisma y modelos existentes
description: Modelos Prisma definidos, ADRs de base de datos, gaps pendientes para Fase 2+
type: project
---

## Modelos existentes (Fase 0-1)

### Company (prisma/schema/core.prisma)

Tabla: companies (SIN RLS — tabla de plataforma)
Campos clave: id (UUID), legalName, tradeName, rtn (Citext UNIQUE), maxUsers (Int default 5), isActive, baseCurrency (HNL)
Relaciones: users User[]

### User (prisma/schema/core.prisma)

Tabla: users (CON RLS)
Campos clave: id (= Cognito sub), email (Citext UNIQUE), cognitoSub (String UNIQUE), companyId (UUID FK), role (SystemRole enum), isActive, lastLoginAt
Índices: [companyId, email], [companyId, isActive], [cognitoSub]
ADR-003: id del User = Cognito sub (asignado externamente, no @default)

## Enums existentes (base.prisma)

- SystemRole: ADMINISTRADOR, GERENTE, CONTADOR, VENDEDOR, AUDITOR
  (Nota: el README menciona SALESPERSON como default en schema, pero el nombre del enum
  en docs dice VENDEDOR — verificar en base.prisma antes de usar)

## Migraciones aplicadas

1. 20260311033815_init_core_company_user — Crea companies y users
2. 20260311033827_add_rls_policies — Políticas RLS en tabla users

## ADRs de base de datos

- DAR-DBA-003: Prisma Client Extension para multi-tenant (no SET LOCAL RLS porque
  el connection pooling de Prisma hace que SET LOCAL no persista entre queries)
  → Solución: extensión ORM como capa primaria, RLS como defensa secundaria

## Modelos pendientes para Fase 2

### contacts.prisma (a crear)
- Contact: id, companyId, type (CUSTOMER|VENDOR|BOTH), legalName, tradeName, rtn, email, phone, isActive
- ContactAddress: id, companyId, contactId, type, street, city, department, country
- ContactPerson: id, companyId, contactId, name, position, phone, email
- PaymentTerms: id, companyId, name, days, description

### accounting.prisma (a crear)
- Account: id, companyId, code, name, type (ASSET|LIABILITY|EQUITY|INCOME|EXPENSE|COST), nature (DEBIT|CREDIT), parentId (self-relation árbol), currencyId, isReconcilable, isActive
- FiscalYear: id, companyId, name, startDate, endDate, state (OPEN|CLOSED)
- FiscalPeriod: id, companyId, fiscalYearId, name, startDate, endDate, state
- Journal: id, companyId, name, type (SALES|PURCHASES|BANK|GENERAL|ADJUSTMENTS), defaultAccountId
- JournalEntry: id, companyId, journalId, fiscalPeriodId, date, reference, state (DRAFT|POSTED|CANCELLED), totalDebit, totalCredit
- JournalEntryLine: id, companyId, journalEntryId, accountId, description, debit, credit, currencyId, currencyAmount
- Currency: id, code (HNL|USD), name, symbol, isBase
- ExchangeRate: id, companyId, currencyId, date, rate
- BankStatement, BankStatementLine, Reconciliation, ReconciliationLine

## Reglas invariantes de schema

1. TODA tabla de negocio lleva company_id (UUID, NOT NULL, FK a companies)
2. company_id es SIEMPRE el primer campo en índices compuestos
3. RLS se activa en TODAS las tablas de negocio
4. Citext para emails y RTN (case-insensitive search)
5. Soft delete via isActive: Boolean (nunca DELETE físico en datos de negocio)
6. Timestamps: createdAt, updatedAt obligatorios en todas las tablas
