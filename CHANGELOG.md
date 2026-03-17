# Changelog

Todos los cambios notables de este proyecto serán documentados en este archivo.

El formato se basa en [Keep a Changelog](https://keepachangelog.com/es/1.0.0/),
y este proyecto adhiere a [Semantic Versioning](https://semver.org/lang/es/).

---

## [Unreleased]

### Planificado

- Lambda PostConfirmation para sincronización Cognito → Prisma
- API middleware para extracción de `company_id` del JWT
- Módulo Contactos (Fase 2)
- Módulo Contabilidad (Fase 2)

---

## [0.1.0-alpha] - 2026-03-16

### 🎉 Hito: Fase 1 — Core System Completado

Primera versión funcional del sistema core con arquitectura multi-tenant completa, sistema RBAC, módulo de usuarios CRUD, testing comprehensivo (47 tests pasando) y guías de deployment a staging AWS.

### Agregado

#### Core System

- **Arquitectura Multi-Tenant** con 4 capas de aislamiento (PostgreSQL RLS, Prisma Extension, API Middleware, Frontend Context)
- **Sistema RBAC** con 5 roles predefinidos: ADMINISTRADOR, GERENTE, CONTADOR, VENDEDOR, AUDITOR
- **Prisma Client Extension** para filtrado automático por `company_id` en todas las queries ([tenant-extension.ts](src/lib/db/tenant-extension.ts))
- **Políticas Row-Level Security (RLS)** en tabla `users` con PostgreSQL
- **Modelos Prisma Core:** `Company` y `User` con campos de auditoría completos
- **Seed de datos:** 2 empresas demo para testing de aislamiento multi-tenant

#### Módulo Users (CRUD Completo)

- **API Routes REST (API-first):**
  - `GET /api/v1/core/users` - Listar usuarios con paginación, filtros y ordenamiento
  - `GET /api/v1/core/users/[id]` - Obtener detalle de usuario
  - `POST /api/v1/core/users` - Crear usuario (valida límite `max_users`)
  - `PUT /api/v1/core/users/[id]` - Actualizar usuario
  - `DELETE /api/v1/core/users/[id]` - Soft delete de usuario
- **Service Layer** ([user.service.ts](src/lib/services/core/user.service.ts)) con lógica de negocio separada de API routes
- **Validaciones Zod** compartidas frontend/backend ([user.schema.ts](src/lib/validations/user.schema.ts))
- **UI Components React:**
  - Página principal con TanStack Table v8 (sorting, paginación, acciones)
  - Formulario de usuario con React Hook Form + validación Zod
  - Dashboard layout con sidebar de 7 módulos
- **Reglas de negocio:**
  - Validación de límite `max_users` por empresa antes de crear usuarios
  - Unicidad de email por empresa (tenant-scoped)
  - Soft delete con campo `isActive` (no eliminación física)

#### Testing (47 tests passing - 100% exitosos)

- **6 smoke tests:** Compilación TypeScript, configuración Prettier/ESLint, rutas principales
- **8 integration tests multi-tenant:** Aislamiento completo entre empresas (Company A ≠ Company B)
- **3 component tests:** Badge, Button, Card (React Testing Library)
- **30 unit tests:** Prisma Client Extension con cobertura prioritaria P0 (lógica crítica de filtrado)

#### Infraestructura AWS Staging

- **Guía completa de deployment** ([STAGING-DEPLOY-GUIDE.md](docs/infra/STAGING-DEPLOY-GUIDE.md)) - 820 líneas, 60-90 min de deploy
- **RDS PostgreSQL staging:** db.t4g.micro con 20GB gp3 ($13.17/mes)
- **Amplify Hosting:** Branch `staging` con CI/CD automático desde GitHub
- **Presupuesto optimizado:** $1.35/mes con Free Tier activo, $22.82/mes sin Free Tier
- **Scripts PowerShell:** `configure-amplify-staging.ps1` para automatización de setup

#### Documentación

- **ADR (Architecture Decision Record):**
  - [DAR-DBA-003](docs/adr/DAR-DBA-003-prisma-client-extension.md) - Uso de Prisma Client Extension para multi-tenant filtering
  - [DAR-INFRA-001](docs/adr/DAR-INFRA-001-hybrid-cicd.md) - CI/CD híbrido GitHub Actions + Amplify
  - [DAR-INFRA-002](docs/adr/DAR-INFRA-002-nextjs-16-update.md) - Actualización a Next.js 16
- **Guías de infraestructura:**
  - [RDS-SETUP-STAGING.md](docs/infra/RDS-SETUP-STAGING.md) - Configuración detallada de RDS PostgreSQL
  - [AMPLIFY-HOSTING-SETUP.md](docs/infra/AMPLIFY-HOSTING-SETUP.md) - Integración GitHub + Amplify CI/CD
  - [CHECKLIST-STAGING-VALIDATION.md](docs/infra/CHECKLIST-STAGING-VALIDATION.md) - 9 fases de validación post-deploy
  - [COSTOS-ESTIMADOS-STAGING.md](docs/infra/COSTOS-ESTIMADOS-STAGING.md) - Desglose detallado de costos AWS
  - [QUICK-START.md](docs/infra/QUICK-START.md) - Guía rápida para desarrolladores
- **Fase 1 Summary** ([F1-SUMMARY.md](docs/specs/fase-1/F1-SUMMARY.md)) - Documento ejecutivo con diagramas Mermaid
- **JSDoc/TSDoc completo** en archivos core del sistema

### Cambiado

- Actualizado **ARCHITECTURE.md** con:
  - Sección completa de Prisma Client Extensions con ejemplos de código
  - Diagrama Mermaid del flujo multi-tenant (4 capas de aislamiento)
  - Estrategia de testing con niveles implementados (smoke, integration, component, unit)
  - Referencias cruzadas a ADRs existentes
- Actualizado **README.md** con:
  - Badge de tests pasando (47/47 ✅)
  - Estado de Fase 1 como completada
  - Instrucciones de quick start actualizadas
  - Scripts disponibles documentados
  - Estructura de carpetas actualizada

### Infraestructura

- **PostgreSQL 16** con Row-Level Security activada en tabla `users`
- **Prisma 6.19.2+** con multi-file schema modular (`prisma/schema/base.prisma`, `core.prisma`)
- **Migraciones aplicadas:**
  - `20260311033815_init_core_company_user` - Tablas `companies` y `users`
  - `20260311033827_add_rls_policies` - Políticas RLS en tabla `users`
- **Docker Compose** con 3 servicios:
  - PostgreSQL 16 (puerto 5433 para evitar conflicto con WSL)
  - pgAdmin 4 (http://localhost:5050)
  - MailHog SMTP dev server (http://localhost:8025)

### Seguridad

- **Defense-in-depth multi-tenant:** 4 capas de aislamiento de datos entre empresas
- **Row-Level Security (RLS)** en PostgreSQL como fallback de seguridad
- **Prisma Client Extension** como capa primaria de filtrado por `company_id`
- **Validaciones Zod** consistentes en frontend y backend
- **Soft deletes** en lugar de eliminación física (auditoría completa)

### Testing

- **Cobertura:** 47 tests pasando (6 smoke + 8 multi-tenant + 3 component + 30 unit)
- **CI Pipeline:** GitHub Actions ejecuta tests en cada PR (<4 minutos)
- **Aislamiento validado:** Tests garantizan que Company A no puede ver datos de Company B
- **Docker PostgreSQL:** Tests usan contenedor PostgreSQL 16 (CI + local)

### Documentación

- **10 documentos** creados/actualizados en `docs/`:
  - 3 ADRs (decisiones arquitectónicas formales)
  - 6 guías de infraestructura (staging, deployment, validación)
  - 1 summary ejecutivo de Fase 1
- **JSDoc/TSDoc** agregado en archivos core:
  - `src/lib/db/tenant-extension.ts`
  - `src/lib/services/core/user.service.ts`
  - `src/lib/validations/user.schema.ts`

---

## [0.0.0] - 2026-03-11

### 🎉 Hito: Fase 0 — Foundation Completado

Infraestructura base del proyecto establecida con Next.js 15, Amplify Gen 2, Prisma ORM, PostgreSQL, testing framework completo, CI/CD híbrido y ambientes de desarrollo configurados.

### Agregado

#### Proyecto Base (F0-01)

- **Next.js 15** con App Router y React 19
- **TypeScript 5** con modo strict
- **Tailwind CSS 4** con configuración personalizada
- **shadcn/ui** con componentes base: Button, Badge, Card, Input, Label, Separator
- Configuración de ESLint, Prettier, Husky, commitlint

#### Infraestructura AWS (F0-02)

- **AWS Amplify Gen 2** deployed en sandbox
- **Cognito User Pool** (us-east-1_adYn3n5fz) con MFA y Advanced Security
- **Custom attributes Cognito:**
  - `custom:company_id` (UUID, String, mutable)
  - `custom:role` (String, enum de 5 roles)
- **S3 Bucket** para documentos (amplify-nexoerp-marvin-sa-nexoerpdocumentsbucketb8-bimtcqkqm8s3)
- **Lambda PostConfirmation** (estructura preparada para Fase 1)

#### Base de Datos (F0-03)

- **PostgreSQL 16** local via Docker Compose (puerto 5433)
- **Prisma ORM 6.19.2** con multi-file schema modular
- **Schema inicial:**
  - `prisma/schema/base.prisma` - Datasource, generator, enums
  - `prisma/schema/core.prisma` - Modelos `Company` y `User`
- **2 migraciones aplicadas** (init + RLS policies)
- **Seed con 2 empresas demo** para desarrollo

#### Tooling (F0-04)

- **ESLint 9** con flat config (eslint.config.mjs)
- **Prettier 3** con formateo consistente
- **Husky 9** con pre-commit hooks (lint-staged)
- **commitlint** para Conventional Commits
- **Changesets** para versionado semántico

#### Testing (F0-05)

- **Vitest** para unit/integration tests
- **Playwright** para E2E tests
- **Testing Library** (React + User Event)
- **6 smoke tests** pasando (compilación, formatos, configuración)

#### CI/CD (F0-06)

- **GitHub Actions workflow** (`.github/workflows/ci.yml`):
  - Lint & Format (1m47s)
  - TypeScript check (1m50s)
  - Tests con PostgreSQL container (2m7s)
  - Build verification (2m13s)
- **CODEOWNERS** con auto-asignación por módulo
- **PR Template** estandarizado
- **Branch protection rules** definidas (pendiente activación manual)
- **Presupuesto CI:** 2000 min/mes gratis = ~250 PRs/mes

#### Ambientes (F0-07)

- **Docker Compose** con 3 servicios (PostgreSQL, pgAdmin, MailHog)
- **Scripts de automatización:**
  - `npm run dev:setup` - Setup completo (Node.js)
  - `npm run dev:verify` - Validación de 9 componentes (PowerShell)
  - `npm run docker:*` - Gestión de contenedores
- **Health check endpoint** (`/api/health`)
- **Validación de ambiente** con Zod (15+ variables server + 5 client)
- **Template `.env.example`** con 26+ variables documentadas

#### MCPs Configuration (F0-09)

- **GitHub MCP** para gestión de repo/issues/PRs
- **Context7 MCP** para documentación de Next.js 15, Prisma 6, Amplify Gen 2
- **Sequential Thinking MCP** para decisiones arquitectónicas
- **Documentación completa:**
  - `docs/guides/MCP-SETUP.md` - Guía de instalación
  - `docs/guides/MCP-USAGE.md` - Patrones de uso
- **Configuración en `.vscode/mcp.json`** (3 servidores activos)

### Documentación

- **ARCHITECTURE.md** estructurado con visión general del sistema
- **REQUIREMENTS.md** v0.3.0 con requerimientos funcionales/no funcionales completos
- **8 specs de Fase 0** (`docs/specs/fase-0/F0-*.md`)
- **3 ADRs** (Prisma Extension, CI/CD Híbrido, Next.js 16)
- **Guías de infraestructura** staging (6 documentos)

### Infraestructura

- **Region AWS:** us-east-1
- **Account ID:** 155326049791
- **Docker PostgreSQL:** Puerto 5433 (evita conflicto con WSL PostgreSQL en 5432)
- **pgAdmin:** http://localhost:5050 (admin@nexoerp.com / admin123)
- **MailHog:** http://localhost:8025
- **Prisma Studio:** http://localhost:5555

### Notas

- ⚠️ **Puerto 5433 para PostgreSQL:** WSL tiene PostgreSQL en puerto 5432
- ⚠️ **Next.js auto-port detection:** Si 3000 ocupado, usa 3003 automáticamente
- ⚠️ **PowerShell encoding:** Scripts usan ASCII (emojis UTF-8 causan errores de parseo)

---

[Unreleased]: https://github.com/ingricardotoro/nexo-ERP/compare/v0.1.0-alpha...HEAD
[0.1.0-alpha]: https://github.com/ingricardotoro/nexo-ERP/compare/v0.0.0...v0.1.0-alpha
[0.0.0]: https://github.com/ingricardotoro/nexo-ERP/releases/tag/v0.0.0
