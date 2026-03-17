# NexoERP

[![CI Pipeline](https://github.com/ingricardotoro/nexo-ERP/actions/workflows/ci.yml/badge.svg)](https://github.com/ingricardotoro/nexo-ERP/actions/workflows/ci.yml)
[![Tests](https://img.shields.io/badge/tests-47%20passing-brightgreen)](https://github.com/ingricardotoro/nexo-ERP/actions)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/license-private-red)]()

Sistema ERP multi-tenant modular para PYMEs hondureñas con cumplimiento fiscal SAR y contabilidad NIIF.

**Versión actual:** 0.1.0-alpha (Fase 1 — Core System) 🎉

## 🚀 Estado del Proyecto

| Fase       | Módulos                                             | Estado         | Tests           |
| ---------- | --------------------------------------------------- | -------------- | --------------- |
| **Fase 0** | Foundation (Next.js, AWS, Prisma, CI/CD, Ambientes) | ✅ Completada  | 6 smoke tests   |
| **Fase 1** | Core System (Multi-tenant, RBAC, Users CRUD)        | ✅ Completada  | 47 tests (100%) |
| **Fase 2** | Contabilidad + Contactos                            | 🔜 Planificada | —               |
| **Fase 3** | Facturación Honduras (CAI, ISV, DET)                | 🔜 Planificada | —               |
| **Fase 4** | Compras + Ventas/CRM + Inventarios                  | 🔜 Planificada | —               |

### 🎯 Fase 1 Completada (16 marzo 2026)

- ✅ **Arquitectura Multi-Tenant** con 4 capas de aislamiento (RLS + Prisma Extension + Middleware + Context)
- ✅ **Sistema RBAC** con 5 roles (ADMINISTRADOR, GERENTE, CONTADOR, VENDEDOR, AUDITOR)
- ✅ **Módulo Users CRUD** completo (API REST + Service Layer + UI React + Validaciones Zod)
- ✅ **47 tests pasando** (6 smoke + 8 multi-tenant integration + 3 component + 30 unit)
- ✅ **Guías de deployment staging** (AWS RDS + Amplify + ~$1.35/mes con Free Tier)
- ✅ **CI/CD híbrido** GitHub Actions + Amplify (<4 min por PR)

## 📋 Stack Tecnológico

### Frontend

- **Next.js 15** (App Router) + **React 19** + **TypeScript 5** (strict mode)
- **Tailwind CSS 4** + **shadcn/ui** (Radix UI primitives)
- **TanStack Table v8** + **TanStack Query v5** + **Zustand 5**
- **React Hook Form 7** + **Zod 3** + **date-fns** + **nuqs**

### Backend

- **Next.js API Routes** (REST API-first `/api/v1/*`)
- **Prisma ORM 6** (multi-file schema + Client Extensions)
- **PostgreSQL 16** + **Row-Level Security (RLS)**

### Infraestructura AWS

- **Amplify Gen 2** (Hosting + CI/CD)
- **Cognito** (Autenticación + custom attributes: `company_id`, `role`)
- **RDS PostgreSQL** (staging: db.t4g.micro)
- **S3** (documentos, backups)
- **Lambda** (PostConfirmation, PDF generation)

### Tooling & Quality

- **ESLint 9** + **Prettier 3** + **Husky 9** + **commitlint**
- **Vitest** (unit/integration) + **Playwright** (E2E)
- **GitHub Actions** (Lint, TypeCheck, Test, Build en <4 min)
- **Changesets** (versionado semántico + changelog automático)

## 🛠️ Desarrollo Local

### Prerequisitos

- **Node.js 20+** (LTS recomendado)
- **Docker Desktop** (para PostgreSQL, pgAdmin, MailHog)
- **Git** (Conventional Commits obligatorio)

### Quick Start

```bash
# 1. Clonar repositorio
git clone https://github.com/ingricardotoro/nexo-ERP.git
cd nexo-ERP

# 2. Instalar dependencias
npm install

# 3. Copiar variables de entorno
cp .env.example .env.local
# Editar .env.local con tus credenciales AWS (ver .env.example)

# 4. Setup completo automatizado (Docker + Prisma + Seed)
npm run dev:setup
# ✅ Inicia Docker Compose (PostgreSQL, pgAdmin, MailHog)
# ✅ Espera a que PostgreSQL esté ready
# ✅ Ejecuta prisma migrate dev (aplica migraciones)
# ✅ Ejecuta prisma db seed (2 empresas demo)

# 5. Verificar que todo está OK (9 checks)
npm run dev:verify

# 6. Iniciar servidor de desarrollo
npm run dev
# 🚀 http://localhost:3000
```

### Servicios Disponibles

| Servicio               | URL                   | Credenciales                     |
| ---------------------- | --------------------- | -------------------------------- |
| **Next.js Dev Server** | http://localhost:3000 | —                                |
| **PostgreSQL 16**      | localhost:5433        | `nexoerp` / `nexoerp123`         |
| **pgAdmin 4**          | http://localhost:5050 | `admin@nexoerp.com` / `admin123` |
| **MailHog (SMTP dev)** | http://localhost:8025 | —                                |
| **Prisma Studio**      | http://localhost:5555 | (ejecutar `npm run db:studio`)   |

### Scripts Disponibles

```bash
# Desarrollo
npm run dev              # Next.js dev server (Turbopack)
npm run dev:setup        # Setup completo automatizado
npm run dev:verify       # Validar ambiente (9 checks)

# Base de datos
npm run db:studio        # Prisma Studio UI
npm run db:migrate       # Crear/aplicar migración
npm run db:push          # Push schema sin migración
npm run db:seed          # Ejecutar seeds
npm run db:reset         # Reset completo (elimina datos)

# Docker
npm run docker:up        # Iniciar contenedores
npm run docker:down      # Detener contenedores
npm run docker:reset     # Reset completo (elimina volúmenes)
npm run docker:logs      # Ver logs de servicios

# Quality
npm run lint             # ESLint check
npm run lint:fix         # ESLint auto-fix
npm run format           # Prettier format
npm run format:check     # Prettier check
npm run typecheck        # TypeScript check

# Testing
npm run test             # Vitest (run once)
npm run test:watch       # Vitest (watch mode)
npm run test:coverage    # Cobertura con c8
npm run test:ui          # Vitest UI
npm run test:e2e         # Playwright E2E
npm run test:e2e:ui      # Playwright UI mode

# Build & Deploy
npm run build            # Next.js production build
npm run start            # Next.js production server

# Versionado
npm run changeset        # Crear changeset (nueva versión)
npm run version          # Bump version + update CHANGELOG
npm run release          # Publish (para futuros paquetes)
```

## 📁 Estructura del Proyecto

```
nexoerp/
├── amplify/                    # AWS Amplify Gen 2 (Cognito, Lambda, S3)
│   ├── auth/resource.ts        # Cognito User Pool config
│   ├── functions/              # Lambda handlers
│   │   └── post-confirmation/  # Cognito → Prisma sync
│   └── storage/resource.ts     # S3 buckets config
├── prisma/
│   ├── schema/                 # Multi-file schema modular
│   │   ├── base.prisma         # Datasource + generator
│   │   └── core.prisma         # Company + User (Fase 1)
│   │       # contacts.prisma, accounting.prisma... (Fase 2+)
│   ├── migrations/             # Migraciones declarativas
│   └── seed/index.ts           # Seeds de desarrollo
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── (auth)/             # Rutas de autenticación
│   │   ├── (dashboard)/        # Dashboard + módulos ERP
│   │   │   └── users/          # Módulo Users (Fase 1) ✅
│   │   └── api/v1/             # REST API endpoints
│   │       └── core/users/     # CRUD Users API ✅
│   ├── components/
│   │   ├── ui/                 # shadcn/ui components
│   │   ├── layout/             # Layout components (Sidebar, Header)
│   │   └── users/              # Componentes módulo Users ✅
│   ├── lib/
│   │   ├── db/
│   │   │   ├── prisma.ts       # Singleton Prisma Client
│   │   │   └── tenant-extension.ts  # Multi-tenant filtering ✅
│   │   ├── services/           # Service layer (lógica de negocio)
│   │   │   └── core/user.service.ts ✅
│   │   ├── validations/        # Zod schemas compartidos
│   │   │   └── user.schema.ts  ✅
│   │   ├── amplify/            # AWS Amplify helpers
│   │   └── utils/              # Utilidades generales
│   ├── types/                  # TypeScript types globales
│   └── __tests__/              # Tests (Vitest + Playwright)
├── docs/
│   ├── REQUIREMENTS.md         # Requerimientos funcionales/no funcionales
│   ├── ARCHITECTURE.md         # Arquitectura del sistema + ADRs
│   ├── adr/                    # Architecture Decision Records
│   │   ├── DAR-DBA-003-prisma-client-extension.md
│   │   ├── DAR-INFRA-001-hybrid-cicd.md
│   │   └── DAR-INFRA-002-nextjs-16-update.md
│   ├── infra/                  # Guías de infraestructura
│   │   ├── STAGING-DEPLOY-GUIDE.md  # 60-90 min deploy staging
│   │   └── RDS-SETUP-STAGING.md     # Setup RDS PostgreSQL
│   └── specs/                  # Especificaciones por fase
│       ├── fase-0/             # Foundation (8 specs) ✅
│       └── fase-1/             # Core System (summary) ✅
├── scripts/                    # Scripts de automatización
│   ├── dev-setup.mjs           # Setup desarrollo (Node.js)
│   └── verify-env.ps1          # Validación ambiente (PowerShell)
├── docker-compose.yml          # PostgreSQL + pgAdmin + MailHog
├── .github/workflows/ci.yml    # GitHub Actions CI pipeline
├── CHANGELOG.md                # Historial de cambios
└── README.md                   # Este archivo
```

## 🧪 Testing

### Ejecución de Tests

```bash
# Tests unitarios/integración (Vitest)
npm run test                    # Run once
npm run test:watch              # Watch mode
npm run test:coverage           # Con cobertura

# Tests E2E (Playwright)
npm run test:e2e                # Headless
npm run test:e2e:ui             # UI mode (debug)
```

### Cobertura Actual (47 tests - 100% pasando)

| Tipo                         | Cantidad | Propósito                                          |
| ---------------------------- | -------- | -------------------------------------------------- |
| **Smoke**                    | 6        | Compilación TS, ESLint, Prettier, rutas básicas    |
| **Multi-Tenant Integration** | 8        | Aislamiento entre empresas (Company A ≠ Company B) |
| **Component**                | 3        | UI components (Badge, Button, Card)                |
| **Unit (Prisma Extension)**  | 30       | Lógica crítica de filtrado multi-tenant            |

**Total:** 47 tests | **Estado:** ✅ 100% pasando | **CI Time:** ~2 min

## 🏗️ Arquitectura Multi-Tenant

NexoERP implementa **Shared Schema + `company_id` + Row-Level Security** con **4 capas de aislamiento**:

```
┌─────────────────────────────────────────────────────────┐
│  Capa 4 — FRONTEND                                       │
│  React Context + Zustand: company_id en todas requests   │
└───────────────────────┬─────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│  Capa 3 — API MIDDLEWARE                                 │
│  Extrae company_id del JWT Cognito (custom attribute)    │
└───────────────────────┬─────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│  Capa 2 — PRISMA CLIENT EXTENSION                        │
│  createTenantPrisma(prisma, companyId)                   │
│  Auto-inyecta WHERE company_id en TODAS las queries      │
└───────────────────────┬─────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│  Capa 1 — POSTGRESQL RLS (Row-Level Security)           │
│  Políticas RLS en todas las tablas (fallback seguridad)  │
└─────────────────────────────────────────────────────────┘
```

**Ver:** [ARCHITECTURE.md](docs/ARCHITECTURE.md#arquitectura-multi-tenant) para detalles completos.

## 📚 Documentación

### Principal

- **[REQUIREMENTS.md](docs/REQUIREMENTS.md)** — Requerimientos funcionales y no funcionales (v0.3.0)
- **[ARCHITECTURE.md](docs/ARCHITECTURE.md)** — Arquitectura del sistema + ADRs
- **[CHANGELOG.md](CHANGELOG.md)** — Historial de cambios (Keep a Changelog)

### ADRs (Architecture Decision Records)

- [DAR-DBA-003](docs/adr/DAR-DBA-003-prisma-client-extension.md) — Prisma Client Extension para multi-tenant
- [DAR-INFRA-001](docs/adr/DAR-INFRA-001-hybrid-cicd.md) — CI/CD híbrido GitHub Actions + Amplify
- [DAR-INFRA-002](docs/adr/DAR-INFRA-002-nextjs-16-update.md) — Actualización Next.js 16

### Guías de Infraestructura

- [STAGING-DEPLOY-GUIDE.md](docs/infra/STAGING-DEPLOY-GUIDE.md) — Guía completa deploy staging (60-90 min)
- [RDS-SETUP-STAGING.md](docs/infra/RDS-SETUP-STAGING.md) — Setup RDS PostgreSQL staging
- [AMPLIFY-HOSTING-SETUP.md](docs/infra/AMPLIFY-HOSTING-SETUP.md) — GitHub + Amplify CI/CD
- [CHECKLIST-STAGING-VALIDATION.md](docs/infra/CHECKLIST-STAGING-VALIDATION.md) — 9 fases validación post-deploy
- [QUICK-START.md](docs/infra/QUICK-START.md) — Guía rápida para desarrolladores

### Especificaciones por Fase

- **[Fase 0](docs/specs/fase-0/)** — Foundation (8 specs: Setup, Amplify, Prisma, Tooling, Testing, CI/CD, Ambientes, MCPs) ✅
- **[Fase 1](docs/specs/fase-1/)** — Core System (F1-SUMMARY.md) ✅
- **Fase 2** — Contabilidad + Contactos (🔜 planificada)
- **Fase 3** — Facturación Honduras (🔜 planificada)
- **Fase 4** — Compras + Ventas/CRM + Inventarios (🔜 planificada)

## 🤝 Contribución

Este proyecto sigue **Conventional Commits** estrictamente:

```bash
# Formato
<type>(scope): <description>

# Ejemplos
feat(users): add CRUD endpoints for user management
fix(auth): resolve JWT token refresh issue
docs(readme): update installation instructions
refactor(core): extract tenant filtering to extension
test(multi-tenant): add isolation tests for Company A/B

# Scopes válidos
core, auth, contacts, accounting, invoicing, purchasing, sales, inventory, ui, infra, docs
```

**Ver:** [.github/PULL_REQUEST_TEMPLATE.md](.github/PULL_REQUEST_TEMPLATE.md) para template de PRs.

## 📊 Presupuestos

### Desarrollo Local

- **Costo:** $0 (Docker local + Amplify Sandbox gratis)

### Staging AWS (con Free Tier activo — primer año)

- **RDS db.t4g.micro + 20GB gp3:** $0 (Free Tier: 750h/mes)
- **Amplify Hosting:** $0 (Free Tier: 1000 min build/mes)
- **S3 + Cognito + Lambda:** $0.35/mes
- **Data Transfer + SES:** $1/mes
- **Total:** ~$1.35/mes

### Staging AWS (sin Free Tier)

- **RDS db.t4g.micro + 20GB gp3:** $13.17/mes
- **Amplify Hosting:** $0.05/mes (builds mínimos)
- **Other services:** $1.60/mes
- **Total:** ~$14.82/mes

**Ver:** [COSTOS-ESTIMADOS-STAGING.md](docs/infra/COSTOS-ESTIMADOS-STAGING.md) para desglose completo.

## 🔐 Seguridad

- **Multi-tenant:** 4 capas de aislamiento con defense-in-depth
- **Autenticación:** AWS Cognito con MFA obligatorio para roles críticos
- **Autorización:** RBAC con 5 roles y permisos granulares (`module.resource.action`)
- **Base de datos:** Row-Level Security (RLS) en PostgreSQL
- **Secrets:** AWS Secrets Manager con rotación automática
- **CDN:** CloudFront + WAF + Shield (DDoS protection)

## 📞 Soporte

Para preguntas, issues o contribuciones:

- **GitHub Issues:** https://github.com/ingricardotoro/nexo-ERP/issues
- **Email:** marvinsamuel@nexoerp.com

## 📄 Licencia

Privado — Todos los derechos reservados © 2026 NexoERP
