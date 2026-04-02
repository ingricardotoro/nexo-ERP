---
name: Rutas clave del proyecto NexoERP
description: Archivos y directorios importantes verificados en el repositorio
type: reference
---

## Documentacion
- `docs/REQUIREMENTS.md` — Documento maestro de requerimientos (v0.3.0)
- `docs/ARCHITECTURE.md` — ADRs y decisiones arquitectonicas
- `docs/FASE-1-CORE-SYSTEM-SUMMARY.md` — Resumen completo Fase 1
- `docs/NOTION-TEMPLATE-FASE-1.md` — Template Notion Fase 1 (ya creado)
- `docs/specs/fase-0/` — Specs detalladas Fase 0
- `docs/specs/fase-1/F1-SUMMARY.md` — Summary Fase 1
- `docs/adr/` — Architecture Decision Records individuales
- `docs/infra/` — Guias de infraestructura AWS

## Schema Prisma
- `prisma/schema/base.prisma` — Datasource, generator, enums
- `prisma/schema/core.prisma` — Company, User, AuditLog, Module, etc.
- `prisma/schema/contacts.prisma` — PaymentTerms, Contact, ContactAddress, ContactPerson
- `prisma/schema/accounting.prisma` — Currency, ExchangeRate, Account, FiscalYear, FiscalPeriod, Journal, JournalEntry, JournalEntryLine, JournalSequence

## Servicios Contabilidad
- `src/lib/services/accounting/account.service.ts`
- `src/lib/services/accounting/fiscal-year.service.ts`
- `src/lib/services/accounting/journal.service.ts`
- `src/lib/services/accounting/journal-entry.service.ts`
- `src/lib/services/accounting/exchange-rate.service.ts`
- `src/lib/services/accounting/financial-report.service.ts`

## API Route Handlers (verificados)
- `src/app/api/health/route.ts`
- `src/app/api/v1/contacts/route.ts` — GET lista, POST crear
- `src/app/api/v1/contacts/[id]/route.ts` — GET, PUT, DELETE contacto
- `src/app/api/v1/contacts/[id]/addresses/route.ts` — GET, POST
- `src/app/api/v1/contacts/[id]/addresses/[addressId]/route.ts` — PUT, DELETE
- `src/app/api/v1/contacts/[id]/persons/route.ts` — GET, POST
- `src/app/api/v1/contacts/[id]/persons/[personId]/route.ts` — PUT, DELETE
- `src/app/api/v1/contacts/payment-terms/route.ts` — GET, POST
- `src/app/api/v1/contacts/payment-terms/[id]/route.ts` — PUT, DELETE
- `src/app/api/v1/core/users/route.ts` — GET, POST
- `src/app/api/v1/core/users/[id]/route.ts` — GET, PUT, DELETE
- `src/app/api/v1/core/tenant/route.ts` — GET tenant context

## Paginas UI Contactos
- `src/app/(dashboard)/contacts/page.tsx` — Lista de contactos
- `src/app/(dashboard)/contacts/[id]/page.tsx` — Detalle (3 tabs)
- `src/app/(dashboard)/contacts/new/page.tsx` — Crear contacto
- `src/app/(dashboard)/contacts/[id]/edit/page.tsx` — Editar contacto

## Templates Notion creados
- `docs/NOTION-TEMPLATE-FASE-1.md` — Estado Fase 1 (creado ~16 marzo 2026)
- `docs/NOTION-TEMPLATE-ESTADO-PROYECTO.md` — Estado general Fase 1+2 (creado 2026-03-24)
