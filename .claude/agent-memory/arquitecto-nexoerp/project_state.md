---
name: Estado del proyecto NexoERP por fase
description: Qué fases están completadas, qué está implementado y qué sigue según el roadmap
type: project
---

## Estado a 2026-03-31

**Versión actual:** 0.1.0-alpha
**Rama activa:** feat/fase-3-facturacion-ui
**Why:** Confirmado por inspección directa del codebase el 2026-03-31.
**How to apply:** Usar como punto de partida para cerrar Fase 3 y planear los items pendientes.

---

### Fase 0 — Foundation (COMPLETADA, v0.0.0, 11 marzo 2026)

- Next.js 15 + React 19 + TypeScript 5 strict
- AWS Amplify Gen 2 + Cognito (User Pool us-east-1_adYn3n5fz, custom attrs: custom:company_id, custom:role)
- PostgreSQL 16 local via Docker (puerto 5433), Prisma 6.19.2 multi-file schema
- prisma/schema/base.prisma (datasource, generator, enums) + core.prisma (Company, User)
- 2 migraciones: 20260311033815_init_core_company_user + 20260311033827_add_rls_policies
- CI/CD: GitHub Actions + Amplify Hosting (staging branch)
- Tooling: ESLint 9, Prettier 3, Husky 9, commitlint, Changesets
- 6 smoke tests pasando

### Fase 1 — Core System (COMPLETADA, v0.1.0-alpha, 16 marzo 2026)

- Multi-tenant con 4 capas: RLS (DB) + Prisma Extension (ORM) + Middleware JWT (API) + Context (Frontend)
- Middleware en src/middleware.ts: extrae JWT Cognito, inyecta x-company-id/x-user-id/x-user-role en headers
- Prisma Client Extension: createTenantPrisma() en src/lib/db/tenant-extension.ts
  - BUSINESS_MODELS = ['User'] — se expande al agregar módulos
- RBAC: 5 roles (ADMINISTRADOR, GERENTE, CONTADOR, VENDEDOR, AUDITOR) en schema Prisma enum SystemRole
- API Routes implementadas:
  - GET/POST /api/v1/core/users
  - GET/PUT/DELETE /api/v1/core/users/[id]
  - GET /api/v1/core/tenant
  - GET /api/health
- Service Layer: src/lib/services/core/user.service.ts
- Validaciones Zod: src/lib/validations/user.schema.ts
- UI: src/app/(dashboard)/dashboard/users/page.tsx + UserEditModal.tsx
- shadcn/ui components: Button, Badge, Card, Input, Label, Separator, Alert, Avatar, Dialog, DropdownMenu, Form, Select, Skeleton, Sonner, Switch, Table
- 47 tests: 6 smoke + 8 multi-tenant integration + 3 component + 30 unit (100% passing)
- Staging AWS validado: RDS db.t4g.micro, Amplify hosting, 25/25 checks passing

### Fase 2 — Contactos y Contabilidad (~88% COMPLETADA, rama feat/fase-2-contabilidad-contactos)

Módulo Contactos — COMPLETADO.
Módulo Contabilidad — 12/15 entregables completos:

Entregables COMPLETADOS (F2-01 a F2-11 + F2-14):
- F2-01: accounting.prisma — Currency, ExchangeRate, Account, FiscalYear, FiscalPeriod, Journal, JournalEntry, JournalEntryLine
- Migraciones hasta 20260327171502_add_journal_sequences_and_cancellation (9 total)
- Services: account.service.ts, fiscal-year.service.ts, journal.service.ts, journal-entry.service.ts, financial-report.service.ts, aging-report.service.ts, exchange-rate.service.ts
- APIs: /accounting/accounts, /currencies, /exchange-rates, /fiscal-years, /journals, /journal-entries, /reports/(balance-sheet|income-statement|cxc-aging|cxp-aging)
- Seed: accounting permissions (13 permisos en seed/index.ts), plan de cuentas NIIF ~360 cuentas, 7 diarios
- AuditLog implementado en journal-entry.service.ts (POSTED y CANCELLED)
- createTenantPrisma usado en todos los services contables
- F2-14 Aging CxC/CxP (aging-report.service.ts — nota: depende de Fase 3 Invoicing para datos reales)

PENDIENTES (3/15):
- F2-12: Exportación PDF/Excel (Lambda + S3) — NO implementado
- F2-13: Conciliación Bancaria (OFX/CSV import, auto-match) — NO implementado, BankStatement/Reconciliation NO en schema
- F2-15: Tests de integración del módulo contable — solo 2 test files de accounting (unit level)

Gaps CRÍTICOS confirmados el 2026-03-28:
1. RBAC NO aplicado en ningún endpoint contable (confirmado: ningún route usa auth.role ni RolePermission)
2. src/lib/permissions/ NO EXISTE — no hay helper de verificación de permisos
3. Endpoint /reports/balance-sheet y otros de reportes tampoco verifican RBAC
4. AuditLog parcial: solo en journal-entry, no en accounts/journals/fiscal-years/exchange-rates
5. F2-13 requiere migración nueva (BankStatement + BankStatementLine + Reconciliation + ReconciliationLine)

Dependencias en REQUIREMENTS.md:
- contacts depende de core
- accounting depende de core + contacts

### Fase 3 — Facturación Honduras (~46% COMPLETADA, rama feat/fase-3-facturacion-ui)

COMPLETADOS (F3-01 a F3-06):
- F3-01: invoicing.prisma — CAI, TaxRate, InvoiceSequence, Invoice, InvoiceLine (EmissionPoint y TaxGroup AUSENTES del schema, simplificados en CAI)
- F3-02: ISV configurado — TaxRate CRUD (ISV15, ISV18, EXENTO) con UI en /invoicing/tax-rates
- F3-03: CAI CRUD completo — cai.service.ts, UI en /invoicing/cais, validaciones activo/vencido/rango
- F3-04: Facturas de venta — createInvoice, updateInvoice, deleteDraftInvoice en invoice.service.ts; API REST en /api/v1/invoicing/invoices; UI: lista, nueva, detalle en /dashboard/invoicing/invoices
- F3-05: Numeración SAR automática — sar-numbering.service.ts; formato PPP-PPP-TT-NNNNNNNN; atomic UPSERT en invoice_sequences; validación rango y vencimiento CAI
- F3-06: Asientos automáticos al publicar — publishInvoice genera journal entry SALES: Débito CxC (1103) / Crédito Ventas (4101) / Crédito ISV Payable (2102); cancelInvoice genera reversión; todo en $transaction con set_config RLS

API Routes invoicing completas:
  - GET/POST /api/v1/invoicing/invoices
  - GET/PATCH/DELETE /api/v1/invoicing/invoices/[id]
  - POST /api/v1/invoicing/invoices/[id]/publish
  - POST /api/v1/invoicing/invoices/[id]/cancel
  - CRUD /api/v1/invoicing/cais y /api/v1/invoicing/tax-rates

Bugs corregidos (2026-03-31):
  - FORCE RLS fix en tenant-extension.ts (findUnique no acepta AND)
  - set_config en basePrisma.$transaction en invoice.service.ts y cancel
  - Response key fix en GET /api/v1/invoicing/invoices (data vs invoices)
  - ZodResolver type mismatch en invoice form

Tests creados:
  - src/__tests__/components/invoicing/ — 4 archivos (unit: format-currency, invoice-status-badge, invoice-type-badge, invoices-table)
  - tests/e2e/invoicing.spec.ts — 30+ tests Playwright (lista + form nueva factura + validaciones + accesibilidad)

PENDIENTES (F3-07 a F3-13):
- F3-07: Facturas de compra (proveedor) — NO implementado. Requiere: tipo COMPRA en InvoiceType o modelo separado; asiento: Débito Gasto + Débito ISV crédito fiscal / Crédito CxP
- F3-08: Notas de Crédito/Débito — schema NOTA_CREDITO y NOTA_DEBITO existen en InvoiceType pero NO hay servicio ni UI específica. originalInvoiceId existe en Invoice. Falta: UI de creación vinculada, lógica de ajuste de saldos diferenciada
- F3-09: PDF Lambda — NO implementado. Requiere: @sparticuz/chromium + Puppeteer en Lambda, Handlebars template SAR-compliant (CAI, rango, RTN, ISV detalle), SQS queue, pre-signed S3 URL
- F3-10: Libro de Ventas mensual — NO implementado. Requiere: servicio de reportes, columnas: fecha, tipo doc, número fiscal, RTN cliente, gravado 15%, gravado 18%, exento, ISV
- F3-11: Export DET (CSV) — NO implementado. Formato compatible con DET del SAR Honduras
- F3-12: Retenciones — NO implementado (prioridad media según RF-INV-16)
- F3-13: Tests E2E flujo completo — parcialmente cubierto (Playwright existe para lista/form, pero NO para publish/cancel/PDF end-to-end)

Estado de las alertas CAI (RF-INV-05): NO implementado (< 30 días vence, < 10% rango). 
Estado de pago PAID de facturas: NO hay servicio markAsPaid — depende de Conciliación CxC (F2-13).

### Fase 4 — Compras + Ventas/CRM + Inventarios (PENDIENTE, post-MVP)

- purchasing.prisma, sales.prisma, inventory.prisma

---

## Gaps de Fase 1 — CERRADOS (2026-03-24)

Estado: Implementados y migrados.
Orden de implementación acordado: Gap 1 (AuditLog) → Gap 2 (Module/CompanyModule) → Gap 3 (Permission/RolePermission)

1. **Gap 1 — AuditLog model** (core.prisma, NO lleva RLS, NO va en BUSINESS_MODELS)
   - Tabla: audit_logs. Campos: id UUID, companyId UUID, userId String (FK User, Restrict), action AuditAction enum,
     entity String, entityId String, oldValues Json?, newValues Json?, ipAddress String?, userAgent String?, createdAt DateTime
   - Índices: [companyId, entity, createdAt], [companyId, userId], [companyId, entityId]
   - Sin updatedAt (inmutable). Sin soft delete. Sin tenant-extension filtering (append-only global).
   - Relaciones: User (1:N via auditLogs), Company (1:N via auditLogs)
   - Company necesita añadir: auditLogs AuditLog[]
   - AuditLog requiere añadir relación a Company: company Company @relation(fields:[companyId], references:[id], onDelete: Restrict)

2. **Gap 2 — Module + CompanyModule** (core.prisma, solo CompanyModule lleva RLS/tenant-extension)
   - Module (tabla de plataforma, SIN RLS, SIN company_id): id String (slug: 'core','contacts','accounting'…),
     name String, description String?, icon String?, color String?, dependencies String[] (slugs),
     isCore Boolean @default(false), sortOrder Int, isActive Boolean
   - CompanyModule (tabla de negocio, CON RLS): id UUID, companyId UUID, moduleId String (FK Module),
     isActive Boolean @default(true), activatedAt DateTime, deactivatedAt DateTime?,
     Índice ÚNICO: [companyId, moduleId]. Índice: [companyId, isActive]
   - BUSINESS_MODELS += 'CompanyModule'
   - dashboard-sidebar.tsx: reemplazar array navigation[] estático por fetch a GET /api/v1/core/modules/active

3. **Gap 3 — Permission + RolePermission** (core.prisma, SIN RLS, son tablas de plataforma)
   - Permission (tabla de plataforma): id String (= "module.resource.action", PK),
     moduleId String (FK Module), resource String, action String, description String?
   - RolePermission (tabla de plataforma): id UUID, role SystemRole, permissionId String (FK Permission),
     Índice ÚNICO: [role, permissionId]. Índice: [role]
   - Mantener campo role SystemRole en User (enum existente — no breaking change)
   - BUSINESS_MODELS: NO agregar Permission ni RolePermission (son tablas de config de plataforma)

### Riesgos de migración identificados
- Gap 1: Migración aditiva pura. Sin riesgo.
- Gap 2: Module es tabla nueva. CompanyModule requiere seed de datos (módulos pre-existentes por empresa).
  Riesgo: si el sidebar se migra a datos dinámicos antes de sembrar CompanyModule, quedará vacío.
  Mitigación: seed obligatorio en la misma migración. Mantener fallback estático hasta que seed corra en staging.
- Gap 3: Permission/RolePermission son tablas nuevas. No toca User.role enum → cero breaking changes.
  Riesgo: RBAC granular en middleware requiere lógica nueva. Los 68 tests existentes deben mantenerse verdes.

### Otros gaps menores
- Lambda PostConfirmation (Cognito → Prisma sync) aún en CHANGELOG como "planificado"
- RF-CORE-08 (usuario en múltiples empresas) no implementado aún
