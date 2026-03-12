# NexoERP — Arquitectura del Sistema

**Versión:** 1.0 (Fase 0 — Foundation)  
**Fecha:** 11 marzo 2026  
**Estado:** 🚧 En construcción (Fase 0-1 completadas)

---

## 📋 Tabla de Contenidos

1. [Visión General](#visión-general)
2. [Stack Tecnológico](#stack-tecnológico)
3. [Arquitectura Multi-Tenant](#arquitectura-multi-tenant)
4. [Infraestructura AWS](#infraestructura-aws)
5. [Arquitectura de Datos](#arquitectura-de-datos)
6. [Seguridad](#seguridad)
7. [CI/CD Pipeline](#cicd-pipeline)
8. [Cumplimiento Fiscal Honduras](#cumplimiento-fiscal-honduras)
9. [Sistema de Módulos](#sistema-de-módulos)
10. [Decisiones Arquitectónicas (ADRs)](#decisiones-arquitectónicas-adrs)
11. [Roadmap](#roadmap)

---

## Visión General

**NexoERP** es un sistema de Planificación de Recursos Empresariales (ERP) modular, basado en web, diseñado específicamente para **pequeñas y medianas empresas (PYMEs) en Honduras**.

### Características Clave

- 🏢 **Multi-tenant:** Arquitectura shared schema con aislamiento garantizado por 4 capas de seguridad
- 🇭🇳 **Cumplimiento fiscal Honduras:** CAI, ISV, DET, numeración SAR, libros contables NIIF
- 🔐 **RBAC granular:** 5 roles predefinidos con permisos por módulo/recurso/acción
- 📱 **API-first:** Backend REST desacoplado del frontend para futura app móvil nativa
- ☁️ **Cloud + On-Premise:** Dual deployment (AWS Amplify Gen 2 + Docker self-hosted)
- 🧩 **Modular:** 7 módulos activables con gestión de dependencias

### Objetivos de Diseño

1. **Simplicidad:** Preferir soluciones simples sobre sofisticadas
2. **Seguridad:** Defense-in-depth, zero-trust entre tenants
3. **Auditabilidad:** Toda operación debe ser trazable
4. **Escalabilidad:** Horizontal (más tenants) y vertical (más features)
5. **Mantenibilidad:** Clean code, TypeScript strict, tests >80% coverage
6. **Costo-efectivo:** Presupuesto ~$50/mes/empresa en Cloud

---

## Stack Tecnológico

### Frontend

| Tecnología | Versión | Propósito |
|------------|---------|-----------|
| **Next.js** | 16.1.6 | Framework React con SSR, App Router, API Routes |
| **React** | 19.x | UI library con Server/Client Components |
| **TypeScript** | 5.x | Type safety (strict mode) |
| **Tailwind CSS** | 4.x | Utility-first styling |
| **shadcn/ui** | Latest | Component library (Radix UI primitives) |
| **TanStack Table** | 8.x | Tablas avanzadas (sorting, filtering, pagination) |
| **TanStack Query** | 5.x | Server state management y caché |
| **Zustand** | 5.x | Client state management ligero |
| **React Hook Form** | 7.x | Form management |
| **Zod** | 3.x | Schema validation (compartido front/back) |
| **Recharts** | Latest | Gráficos y KPIs |
| **dnd-kit** | Latest | Drag & drop (Kanban boards) |
| **cmdk** | Latest | Command palette (⌘K) |
| **date-fns** | Latest | Manipulación de fechas |
| **nuqs** | Latest | State en URL query params |

### Backend

| Tecnología | Versión | Propósito |
|------------|---------|-----------|
| **Next.js API Routes** | 16.1.6 | REST API handlers (versionado `/api/v1/`) |
| **Prisma ORM** | 6.19.2+ | Database access layer con type safety |
| **Zod** | 3.x | Input validation en endpoints |
| **Puppeteer** | Latest | PDF generation (invoices, reports) |
| **@sparticuz/chromium** | Latest | Headless Chrome para Lambda |
| **exceljs** | 4.x | Excel import/export |
| **Handlebars** | Latest | HTML templates para PDFs |

### Base de Datos

| Tecnología | Versión | Propósito |
|------------|---------|-----------|
| **PostgreSQL** | 16 | RDBMS principal |
| **Prisma Schema** | Multi-file | Schema modular por dominio |
| **Row-Level Security (RLS)** | Native | Aislamiento multi-tenant en DB |

### Infraestructura AWS

| Servicio | Configuración | Propósito |
|----------|--------------|-----------|
| **Amplify Gen 2** | Hosting + CI/CD | Deploy frontend, backend provisioning |
| **Cognito User Pools** | MFA + Advanced Security | Autenticación, JWT tokens |
| **RDS PostgreSQL** | db.t3.micro (20GB) | Base de datos producción |
| **RDS Proxy** | Connection pooling | Serverless connection management |
| **Lambda** | Node.js 20 | PDF generation, background jobs |
| **SQS** | Standard queue | Async task processing |
| **SES** | Transactional email | Notificaciones, facturas por email |
| **EventBridge Scheduler** | Cron expressions | Tareas programadas (cierres, alertas) |
| **S3** | Standard + Glacier | Almacenamiento documentos, backups |
| **Secrets Manager** | Auto-rotation | Credenciales BD, API keys |
| **CloudFront** | WAF + Shield | CDN, firewall, DDoS protection |
| **CloudWatch** | Logs + Metrics | Monitoreo aplicación |
| **CloudTrail** | Audit logs | Auditoría infraestructura |
| **GuardDuty** | Threat detection | Seguridad proactiva |

**Región:** `us-east-1`  
**Presupuesto:** ~$50/mes (Cloud multi-tenant)

### Tooling & Quality

| Herramienta | Propósito |
|-------------|-----------|
| **ESLint** | Linting (estándar Next.js + custom rules) |
| **Prettier** | Code formatting (enforce consistency) |
| **Husky** | Git hooks (pre-commit, commit-msg) |
| **commitlint** | Conventional Commits enforcement |
| **Changesets** | Versioning + changelog automation |
| **Vitest** | Unit & integration testing |
| **Playwright** | E2E testing |
| **GitHub Actions** | CI pipeline (lint, typecheck, test, build) |

---

## Arquitectura Multi-Tenant

NexoERP implementa **Shared Schema + `company_id` + Row-Level Security (RLS)** con **4 capas de aislamiento** (defense-in-depth):

### Diagrama de Capas

```
┌─────────────────────────────────────────────────────────────────┐
│  Capa 4 — FRONTEND                                              │
│  Context React con company_id en todas las requests             │
│  Zustand store: { user, company, permissions }                  │
└────────────────────────────┬────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│  Capa 3 — API MIDDLEWARE                                         │
│  - Extrae company_id del JWT de Cognito (custom:company_id)     │
│  - Inyecta companyId en context de request                      │
│  - Valida RBAC: module.resource.action                          │
└────────────────────────────┬────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│  Capa 2 — ORM (Prisma Client Extension)                         │
│  - createTenantPrisma(prisma, companyId)                        │
│  - Auto-inyecta where: { company_id: companyId }                │
│  - Middleware en TODAS las operaciones (findMany, create, etc.) │
│  - Ver: DAR-DBA-003 (Prisma Client Extension)                   │
└────────────────────────────┬────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│  Capa 1 — DATABASE (PostgreSQL RLS)                             │
│  - Políticas RLS activadas en TODAS las tablas de negocio       │
│  - Filtro: WHERE company_id = current_setting('app.current_..') │
│  - Fallback de seguridad (defense-in-depth)                     │
│  - Ver: DAR-DBA-003 (limitación con Prisma connection pooling)  │
└─────────────────────────────────────────────────────────────────┘
```

### Reglas Inquebrantables

1. ✅ **TODA tabla de negocio** lleva `company_id` (UUID, NOT NULL, FK a `companies`)
2. ✅ **`company_id` SIEMPRE es el primer campo** en índices compuestos
3. ✅ **RLS activado** en todas las tablas sin excepciones
4. ✅ **Prisma Client Extension** inyecta filtro automáticamente
5. ✅ **Tests E2E** validan aislamiento entre tenants (Company A ≠ Company B)

### Limitaciones de Diseño

**PostgreSQL RLS + Prisma connection pooling NO son compatibles** (DAR-DBA-003):
- `SET LOCAL app.current_company_id` no persiste entre queries del ORM
- **Solución:** Application-layer filtering via Prisma Client Extension
- **RLS se mantiene como fallback** (defense-in-depth)

---

## Infraestructura AWS

### Arquitectura de Deployment

```
GitHub Repository
       ↓
  [Feature Branch]
       ↓
   Open Pull Request
       ↓
┌──────────────────────────┐
│  GitHub Actions (CI)     │  ← 2-3 min, GRATIS
│  ├─ Lint & Format        │
│  ├─ TypeScript check     │
│  ├─ Vitest tests         │
│  └─ Build verification   │
└──────────┬───────────────┘
           ↓ (Pass)
      Code Review
           ↓ (Approve)
   Merge to main/staging
           ↓
┌──────────────────────────┐
│  AWS Amplify Gen 2       │  ← 5-10 min, ~$0.05-0.10
│  ├─ Build Next.js        │
│  ├─ Deploy CloudFront    │
│  └─ Provision backend    │
│      - Cognito           │
│      - Lambda            │
│      - S3                │
└──────────┬───────────────┘
           ↓
   CloudFront CDN (HTTPS)
           ↓
      End Users
```

**Ver:** [DAR-INFRA-001: Hybrid CI/CD](./adr/DAR-INFRA-001-hybrid-cicd.md)

### Ambientes

| Ambiente | Branch | Base de Datos | URL |
|----------|--------|---------------|-----|
| **Local** | cualquiera | Docker PostgreSQL 16 (puerto 5433) | `http://localhost:3000` |
| **Sandbox** | feature/* | Amplify Sandbox (efímero) | `sandbox-{id}.amplifyapp.com` |
| **Staging** | staging | RDS staging instance | `staging.nexoerp.com` |
| **Production** | main | RDS production instance | `app.nexoerp.com` |

### Cognito User Pool

- **Region:** us-east-1
- **User Pool ID:** `us-east-1_adYn3n5fz`
- **MFA:** Obligatorio (TOTP)
- **Advanced Security Features:** Activado (adaptive auth, compromised credentials)
- **Custom Attributes:**
  - `custom:company_id` (String, UUID, mutable)
  - `custom:role` (String, enum: ADMINISTRADOR | GERENTE | CONTADOR | VENDEDOR | AUDITOR)

**Lambda Triggers:**
- PostConfirmation: Sincroniza user de Cognito → Prisma (Fase 1, pendiente)

### S3 Bucket Structure

```
s3://amplify-nexoerp-marvin-sa-nexoerpdocumentsbucketb8-bimtcqkqm8s3/
├── documents/
│   ├── {company_id}/
│   │   ├── invoices/       # Facturas PDF
│   │   ├── receipts/       # Recibos PDF
│   │   └── reports/        # Reportes contables
│   └── shared/             # Plantillas, logos sistema
├── uploads/
│   └── {company_id}/
│       ├── bank-statements/  # Excel de bancos
│       └── contacts/         # Importación contactos
└── backups/                  # Backups automáticos (Glacier)
```

**Ver:** [F0-02: Amplify Gen 2 Configuration](./specs/fase-0/F0-02-amplify-gen2.md)

---

## Arquitectura de Datos

### Prisma Multi-File Schema

NexoERP usa **multi-file schema modular** (Prisma 6+) organizado por dominio:

```
prisma/
├── schema/
│   ├── base.prisma          # Datasource, client, generator
│   ├── core.prisma          # Company, User, Role, Permission, Module, Menu, AuditLog
│   ├── contacts.prisma      # Contact, ContactAddress, ContactPerson, PaymentTerms
│   ├── accounting.prisma    # Account, Journal, JournalEntry, Currency, BankReconciliation
│   ├── invoicing.prisma     # Invoice, InvoiceLine, CAI, EmissionPoint, TaxRate
│   ├── purchasing.prisma    # (Fase 4)
│   ├── sales.prisma         # (Fase 4)
│   └── inventory.prisma     # (Fase 4)
└── migrations/              # Migraciones Prisma (declarativas)
```

### Diagrama de Entidades Core

```
┌─────────────────────────────────────────────────────────────────┐
│                            CORE                                  │
└─────────────────────────────────────────────────────────────────┘

        Company (tenant root)
           │  (1:N)
           ├──────────────────> User
           │                      │ (M:1)
           │                      └────> Role
           │                              │ (M:N)
           │                              └────> Permission (module.resource.action)
           │  (1:N)
           ├──────────────────> Module (activable)
           │  (1:N)
           ├──────────────────> Menu (navigation)
           │  (1:N)
           └──────────────────> AuditLog (inmutable)

┌─────────────────────────────────────────────────────────────────┐
│                          CONTACTOS                               │
└─────────────────────────────────────────────────────────────────┘

        Contact (dual: cliente/proveedor)
           │  (1:N)
           ├──────────────────> ContactAddress (facturación, entrega)
           │  (1:N)
           ├──────────────────> ContactPerson (nombres de contacto)
           └──────────────────> Invoice, PurchaseOrder (relaciones a otros módulos)

┌─────────────────────────────────────────────────────────────────┐
│                         CONTABILIDAD                             │
└─────────────────────────────────────────────────────────────────┘

        Account (jerárquico NIIF, ~200 cuentas)
           │  (tree structure)
           ├─ parent_id (self-referencing)
           └─ account_type: ASSET | LIABILITY | EQUITY | INCOME | EXPENSE

        Journal (Libro: ventas, compras, general)
           │  (1:N)
           └──────────────────> JournalEntry (asiento contable)
                                   │  (1:N)
                                   └──────────────────> JournalEntryLine (partidas)
                                                          constraint: SUM(debit) = SUM(credit)

        Currency (HNL, USD, EUR)
           │  (1:N)
           └──────────────────> ExchangeRate (histórico diario)

        BankReconciliation (conciliaciones bancarias)
           │  (1:N)
           └──────────────────> ReconciliationLine (matching con journal entries)

┌─────────────────────────────────────────────────────────────────┐
│                        FACTURACIÓN                               │
└─────────────────────────────────────────────────────────────────┘

        CAI (Código de Autorización de Impresión SAR)
           │  (1:N)
           └──────────────────> Invoice (fiscalmente válidas)
                                   │  (1:N)
                                   │──────────────────> InvoiceLine (detalle)
                                   │  (1:1)
                                   └──────────────────> JournalEntry (asiento automático)

        EmissionPoint (punto de emisión: 001, 002, etc.)
        TaxRate (ISV: 15%, 18%, exento)
        TaxGroup (combinaciones de impuestos)
```

**Nota:** Inventarios, Compras y Ventas se agregarán en Fase 4.

### Convenciones de Modelado

1. **Nombres en inglés** (modelos, campos): `Invoice`, `created_at`
2. **PascalCase para modelos:** `JournalEntry`, `ContactPerson`
3. **snake_case para campos:** `company_id`, `created_at`, `is_active`
4. **`company_id` obligatorio** en TODAS las tablas de negocio (excepto `companies`)
5. **Soft deletes:** `deleted_at` (nullable, indexed)
6. **Timestamps:** `created_at`, `updated_at` (auto-managed)
7. **Audit fields:** `created_by_id`, `updated_by_id` (FK a `users`)

---

## Seguridad

### Autenticación

- **Amazon Cognito User Pools** (JWT tokens)
- **MFA obligatorio** para roles ADMINISTRADOR y CONTADOR
- **Advanced Security Features:** Adaptive authentication, compromised credential checks
- **Token refresh automático** (frontend maneja silently)
- **Session management:** HTTP-only cookies (web) + Bearer tokens (futura app móvil)

### Autorización (RBAC)

**5 roles predefinidos:**

| Rol | Permisos Resumidos |
|-----|-------------------|
| **ADMINISTRADOR** | Acceso total a todos los módulos y configuración del sistema |
| **GERENTE** | CRUD en todos los módulos operativos, sin acceso a config sistema |
| **CONTADOR** | CRUD en contabilidad y facturación, lectura en otros módulos |
| **VENDEDOR** | CRUD en ventas y CRM, lectura contactos/inventario, crear facturas |
| **AUDITOR** | Solo lectura en todos los módulos + acceso completo a logs auditoría |

**Sistema de permisos:** `module.resource.action`

```typescript
// Ejemplos:
'invoicing.invoice.create'      // Crear facturas
'accounting.journal_entry.delete' // Eliminar asientos contables
'core.user.manage'              // Gestionar usuarios (solo ADMIN)
'contacts.contact.read'         // Leer contactos
```

**Implementación:**
- Middleware en API Routes: `src/lib/permissions/rbac-middleware.ts`
- Frontend guards: `src/lib/permissions/use-permissions.ts`
- Database level: RLS policies como fallback

### Validación de Inputs

- **Zod schemas compartidos** entre frontend y backend (`src/lib/validators/`)
- **TODOS los API Route Handlers** validan inputs con Zod (sin excepción)
- **Sanitización automática** de strings (trim, escape HTML)
- **Rate limiting** en endpoints sensibles (login, register, invoice creation)

### Protección de Datos

| Tipo de Dato | Protección |
|--------------|-----------|
| **Passwords** | Hashed con Cognito (bcrypt equivalente) |
| **JWT tokens** | Signed por Cognito, verificados server-side |
| **Datos fiscales** | Encriptados at-rest (RDS encryption), in-transit (TLS 1.3) |
| **PII** | Masked en logs, nunca en console.log() |
| **API keys** | Secrets Manager con auto-rotation |

### Headers de Seguridad HTTP

```typescript
// next.config.ts
{
  headers: {
    'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
    'X-Frame-Options': 'DENY',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'Content-Security-Policy': "default-src 'self'; ..."
  }
}
```

### WAF Rules (CloudFront)

- SQL injection protection
- XSS protection
- Rate limiting (100 req/5min por IP)
- Geographic blocking (opcional, configurado por tenant)
- Bot detection (AWS Managed Rules)

---

## CI/CD Pipeline

**Arquitectura híbrida: GitHub Actions (quality gates) + AWS Amplify (deploy)**

### GitHub Actions (Pre-Merge)

```yaml
# .github/workflows/ci.yml

jobs:
  lint:        # ESLint + Prettier (~1 min)
  typecheck:   # TypeScript strict (~1 min)
  test:        # Vitest + PostgreSQL container (~3 min)
  build:       # Next.js build verification (~2 min)
```

**Total por PR:** ~6-8 minutos  
**Bloquea merge** si algún job falla  
**Costo:** GRATIS (2000 min/mes = ~250 PRs/mes)

### AWS Amplify (Post-Merge)

```yaml
# amplify.yml

phases:
  preBuild:
    - npm ci
    - npx ampx generate outputs
  build:
    - npm run db:generate
    - npm run build
```

**Deploy a:** CloudFront + S3  
**Provisiona:** Cognito + Lambda + S3  
**Rollback automático** si deployment falla  
**Costo:** ~$0.05-0.10 por build

**Ver:** [DAR-INFRA-001: Hybrid CI/CD](./adr/DAR-INFRA-001-hybrid-cicd.md)

### Branch Protection Rules

**Ramas protegidas:** `main`, `staging`

- ✅ Require 1 approval
- ✅ Dismiss stale reviews on new commits
- ✅ Require status checks: `lint`, `typecheck`, `test`, `build`
- ✅ Require linear history (no merge commits)
- ✅ Enforce for admins
- ❌ No force pushes

---

## Cumplimiento Fiscal Honduras

NexoERP implementa los requisitos del **SAR (Servicio de Administración de Rentas)** de Honduras:

### CAI (Código de Autorización de Impresión)

```typescript
// Model: CAI
{
  code: string              // "ABC123-DEF456-GHI789" (formato oficial SAR)
  emission_point_id: string // FK a EmissionPoint
  document_type: string     // "FACTURA" | "RECIBO" | "NOTA_CREDITO" | "NOTA_DEBITO"
  authorized_from: Date     // Inicio de vigencia
  authorized_to: Date       // Fin de vigencia
  range_start: number       // Número inicial autorizado
  range_end: number         // Número final autorizado
  current_number: number    // Contador (incrementa con cada factura)
  is_active: boolean        // Auto-desactivar al llegar a range_end o vencer
}
```

**Validaciones automáticas:**
- ✅ CAI activo (dentro de rango de fechas)
- ✅ Número dentro de rango autorizado
- ✅ No reutilizar números (constraint UNIQUE en invoice_number + emission_point)
- ✅ Alertas 30 días antes de vencer o 90% del rango consumido

### Numeración SAR

**Formato oficial:** `PPP-PPP-TT-NNNNNNNN`

- **PPP-PPP:** Punto de emisión (ej. `001-001`, `002-001`)
- **TT:** Tipo de documento (ej. `01` = Factura, `02` = Recibo)
- **NNNNNNNN:** Número consecutivo (8 dígitos, padding con ceros)

**Ejemplo:** `001-001-01-00000042` (Factura #42 del punto de emisión 001-001)

### ISV (Impuesto Sobre Ventas)

| Tasa | Porcentaje | Aplicación |
|------|-----------|-----------|
| **Tasa 15%** | 15% | Venta de bienes (estándar) |
| **Tasa 18%** | 18% | Servicios profesionales y técnicos |
| **Exento** | 0% | Productos de la canasta básica, exportaciones |

**Cálculo en factura:**

```typescript
// InvoiceLine
{
  quantity: 10
  unit_price: 100.00
  subtotal: 1000.00              // quantity × unit_price
  tax_rate_id: "ISV_15"          // FK a TaxRate (15%)
  tax_amount: 150.00             // subtotal × 0.15
  total: 1150.00                 // subtotal + tax_amount
}

// Invoice
{
  subtotal: 1000.00              // SUM(lines.subtotal)
  total_tax: 150.00              // SUM(lines.tax_amount)
  total: 1150.00                 // subtotal + total_tax
}
```

### DET (Declaración Electrónica Tributaria)

**Libros contables exportables:**
- Libro de Ventas (facturas emitidas)
- Libro de Compras (facturas recibidas)
- Libro Diario (journal entries)
- Libro Mayor (balances por cuenta)

**Formato de exportación:** Excel (exceljs) con columnas según spec SAR

---

## Sistema de Módulos

NexoERP implementa **7 módulos activables** con gestión de dependencias:

| Slug | Nombre | Dependencias | Fase | Estado |
|------|--------|-------------|------|--------|
| `core` | Core | — | 0-1 | ✅ Completado |
| `contacts` | Contactos | core | 2 | ⏳ Planeado |
| `accounting` | Contabilidad | core, contacts | 2 | ⏳ Planeado |
| `invoicing` | Facturación | core, contacts, accounting | 3 | ⏳ Planeado |
| `purchasing` | Compras | core, contacts, invoicing | 4 | ⏳ Planeado |
| `sales` | Ventas y CRM | core, contacts, invoicing | 4 | ⏳ Planeado |
| `inventory` | Inventarios | core, contacts | 4 | ⏳ Planeado |

### Reglas de Activación

1. **`core` siempre activo** (no desactivable)
2. **Dependencias se activan automáticamente:** Activar `invoicing` → activa `accounting` + `contacts` + `core`
3. **Validación al desactivar:** No se puede desactivar un módulo si otro activo depende de él
4. **Datos persisten desactivados:** Desactivar un módulo NO borra datos, solo oculta menús/features
5. **UI dinámica:** Menús y navegación se generan según módulos activos

### Implementation Pattern

```typescript
// Model: Module
{
  slug: string              // "invoicing" (UNIQUE)
  name: string              // "Facturación"
  description: string
  dependencies: string[]    // ["core", "contacts", "accounting"]
  is_system: boolean        // true para "core" (no desactivable)
}

// Model: CompanyModule (junction table)
{
  company_id: string        // FK a Company
  module_slug: string       // FK a Module
  is_active: boolean        // Estado de activación
  activated_at: Date
  activated_by_id: string   // FK a User (auditoría)
}
```

**(Pendiente implementación en Fase 1)**

---

## Decisiones Arquitectónicas (ADRs)

Todas las decisiones arquitectónicas significativas se documentan como **Architecture Decision Records (ADRs)** en `docs/adr/`.

### ADRs Completados

| ID | Título | Estado | Fecha | Descripción |
|----|--------|--------|-------|-------------|
| [DAR-DBA-003](./adr/DAR-DBA-003-prisma-client-extension.md) | Prisma Client Extension para Multi-Tenant | ✅ Implementado | 2026-03-11 | Application-layer filtering debido a incompatibilidad RLS + Prisma connection pooling |
| [DAR-INFRA-001](./adr/DAR-INFRA-001-hybrid-cicd.md) | Arquitectura Híbrida CI/CD | ✅ Implementado | 2026-03-11 | GitHub Actions (quality gates) + AWS Amplify (deploy) |
| [DAR-INFRA-002](./adr/DAR-INFRA-002-nextjs-16-update.md) | Actualización Next.js 15 → 16 | ✅ Implementado | 2026-03-11 | Resolución vulnerabilidad MEDIUM + TypeScript 5.x compatibility |

### ADRs Investigados (No Implementados)

| ID | Título | Estado | Razón de Rechazo |
|----|--------|--------|-----------------|
| DAR-DBA-001 | PostgreSQL RLS como Única Capa | ❌ Rechazado | Incompatible con Prisma connection pooling |
| DAR-DBA-002 | Dual-Role Pattern en Schema | 🔬 Investigado | Requiere Prisma views (experimental), complejidad > beneficio |

### Template ADR

Para crear nuevos ADRs, seguir la estructura:

```markdown
# DAR-{SCOPE}-{NUMBER}: {Título}

**Estado:** 🔬 Propuesto | ✅ Implementado | ❌ Rechazado  
**Fecha:** YYYY-MM-DD  
**Contexto:** {Fase/Módulo}  
**Relacionado con:** {Otros ADRs}

## Contexto
[Problema que se intenta resolver]

## Decisión
[Opción seleccionada y justificación]

## Consecuencias
[Positivas y negativas]

## Alternativas Consideradas
[Opciones descartadas con razones]
```

---

## Roadmap

### ✅ Fase 0: Foundation (COMPLETADA — 11 marzo 2026)

- [x] F0-01: Next.js 16 + React 19 + Tailwind CSS 4 + shadcn/ui
- [x] F0-02: AWS Amplify Gen 2 (Cognito + S3)
- [x] F0-03: Prisma 6 + PostgreSQL 16 + Docker Compose
- [x] F0-04: Tooling (ESLint, Prettier, Husky, Changesets)
- [x] F0-05: Testing (Vitest + Playwright)
- [x] F0-06: GitHub Actions CI/CD (hybrid pipeline)
- [ ] F0-07: Ambientes staging/production (RDS + RDS Proxy)
- [x] F0-08: ARCHITECTURE.md + ADRs (este documento)
- [ ] F0-09: MCPs configuration

**Entregables:**
- Repositorio GitHub configurado con CI/CD
- Infraestructura AWS desplegada (sandbox funcionando)
- Multi-tenant isolation testeado (8/8 tests pasando)
- Documentación arquitectónica completa

---

### ⏳ Fase 1: Core Module (En desarrollo)

**Objetivo:** Sistema base con multi-tenant, RBAC, y gestión de usuarios

#### Entidades
- [x] `Company` (tenant root) — Schema creado ✅
- [x] `User` — Schema creado ✅
- [ ] `Role` (5 roles predefinidos)
- [ ] `Permission` (granular: module.resource.action)
- [ ] `Module` (activación dinámica)
- [ ] `Menu` (navegación por rol)
- [ ] `AuditLog` (inmutable, append-only)

#### Features
- [ ] Lambda PostConfirmation (Cognito → Prisma sync)
- [ ] API middleware para extraer `company_id` del JWT
- [ ] RBAC middleware en API Routes
- [ ] Dashboard multi-tenant con KPIs básicos
- [ ] Gestión de usuarios (CRUD, roles, permisos)
- [ ] Gestión de empresas (settings, max_users, activación)
- [ ] Sistema de módulos activables (UI + lógica)
- [ ] Auditoría de cambios (quién, qué, cuándo)

#### Criterios de Éxito
- [ ] Usuario puede registrarse (Cognito) y auto-provision su empresa
- [ ] ADMINISTRADOR puede invitar usuarios a su tenant
- [ ] Roles funcionan correctamente (permisos restrictivos)
- [ ] Logs de auditoría capturan todas las operaciones
- [ ] Tests E2E validan flujos completos (Playwright)

---

### ⏳ Fase 2: Contactos + Contabilidad

**Objetivo:** Base para facturación (requiere contactos + plan de cuentas)

#### Módulo Contactos
- [ ] Contact (dual: cliente/proveedor)
- [ ] ContactAddress (facturación, entrega)
- [ ] ContactPerson (nombres de contacto)
- [ ] PaymentTerms (crédito 30/60/90 días)
- [ ] Importación masiva Excel

#### Módulo Contabilidad
- [ ] Account (plan de cuentas NIIF jerárquico, ~200 cuentas seed)
- [ ] FiscalYear + FiscalPeriod (cierres mensuales/anuales)
- [ ] Journal (libro diario, ventas, compras)
- [ ] JournalEntry + JournalEntryLine (asientos contables)
- [ ] Currency + ExchangeRate (HNL, USD)
- [ ] BankStatement + BankStatementLine (conciliación bancaria)
- [ ] Reportes: Balance General, Estado de Resultados, Libro Mayor

#### Criterios de Éxito
- [ ] Plan de cuentas NIIF cargado con seed
- [ ] Asientos contables cumplen partida doble (debit = credit)
- [ ] Conciliación bancaria funcional (matching automático)
- [ ] Reportes contables exportables a Excel/PDF

---

### ⏳ Fase 3: Facturación Honduras

**Objetivo:** Emisión de facturas fiscalmente válidas con CAI del SAR

#### Features
- [ ] CAI (gestión de rangos autorizados SAR)
- [ ] EmissionPoint (puntos de emisión: 001, 002, etc.)
- [ ] TaxRate + TaxGroup (ISV 15%, 18%, exento)
- [ ] Invoice + InvoiceLine (facturas con cálculo automático ISV)
- [ ] Numeración SAR (`PPP-PPP-TT-NNNNNNNN`)
- [ ] Asientos contables automáticos (invoice → journal entry)
- [ ] PDF de facturas (Puppeteer + template HTML)
- [ ] Email de facturas (SES)
- [ ] Libro de Ventas (exportable para DET)

#### Criterios de Éxito
- [ ] Factura con CAI válido genera PDF fiscalmente correcto
- [ ] Numeración SAR nunca se repite (constraint DB)
- [ ] Asiento contable automático cumple partida doble
- [ ] Libro de Ventas exportable a Excel (formato SAR)
- [ ] Alertas de vencimiento CAI (30 días antes)

---

### ⏳ Fase 4: Compras + Ventas + Inventarios

**Objetivo:** ERP completo con módulos avanzados

#### Módulo Compras
- [ ] PurchaseOrder (órdenes de compra)
- [ ] PurchaseInvoice (facturas de proveedores)
- [ ] Libro de Compras (DET)

#### Módulo Ventas y CRM
- [ ] Lead (prospectos)
- [ ] Opportunity (oportunidades de venta)
- [ ] SalesPipeline (Kanban board con dnd-kit)
- [ ] Quotation (cotizaciones)

#### Módulo Inventarios
- [ ] Product (productos y servicios)
- [ ] Warehouse + Location (bodegas y ubicaciones)
- [ ] StockMove (movimientos de inventario)
- [ ] StockQuant (existencias actuales)
- [ ] Lot (lotes y números de serie)
- [ ] ReorderRule (reabastecimiento automático)

---

## Apéndices

### A. Convenciones de Código

- **Conventional Commits:** `feat(scope):`, `fix(scope):`, `refactor(scope):`
- **Scopes válidos:** core, auth, contacts, accounting, invoicing, purchasing, sales, inventory, ui, infra
- **Idioma:** Español (documentación, commits, UI), inglés (código, nombres de variables)
- **TypeScript strict mode:** Obligatorio
- **ESLint/Prettier:** Auto-format en pre-commit hook

### B. Testing Strategy

| Tipo | Framework | Coverage Target | Cuando Ejecuta |
|------|-----------|-----------------|---------------|
| **Unit** | Vitest | >80% | Cada commit (local) + PR (CI) |
| **Integration** | Vitest | >70% | PR (CI) |
| **E2E** | Playwright | Critical flows | Push a main (CI) |
| **Multi-tenant** | Vitest | 100% aislamiento | PR (CI) |

### C. Recursos Externos

- **Documentación oficial:** [docs/REQUIREMENTS.md](./REQUIREMENTS.md)
- **Especificaciones por fase:** [docs/specs/fase-0/](./specs/fase-0/)
- **GitHub Actions guide:** [docs/GITHUB-ACTIONS.md](./GITHUB-ACTIONS.md)
- **Troubleshooting Amplify:** En repositorio memoria (`/memories/repo/`)

---

**Última actualización:** 11 marzo 2026  
**Mantenido por:** Arquitecto de Software (Marvin)  
**Revisión:** Cada fin de fase (Fase 0 → Documento actual)
