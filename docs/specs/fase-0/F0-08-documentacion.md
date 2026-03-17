# F0-08: Documentación — ARCHITECTURE.md + ADRs

> **ID:** F0-08
> **Fase:** 0 — Fundación
> **Prioridad:** 🟡 Alta
> **Estimación:** 2–3 horas
> **Dependencias:** F0-01 (Setup proyecto)
> **Bloquea a:** Ninguno (pero referenciado por todas las fases posteriores)

---

## 1. Objetivo

Crear el documento de arquitectura principal (`ARCHITECTURE.md`) y establecer el sistema de Architecture Decision Records (ADRs) para documentar todas las decisiones técnicas significativas. Estos documentos sirven como referencia para nuevos desarrolladores, auditorías, y como contexto para agentes IA.

---

## 2. Prerrequisitos

| Requisito        | Detalle                                     | Verificación                  |
| ---------------- | ------------------------------------------- | ----------------------------- |
| F0-01 completado | Proyecto base existe                        | Directorio `docs/` existe     |
| REQUIREMENTS.md  | Documento con la arquitectura de referencia | `docs/REQUIREMENTS.md` existe |

---

## 3. Pasos de Implementación

### 3.1 Crear estructura de documentación

```powershell
# Crear directorios
New-Item -ItemType Directory -Path "docs/architecture" -Force
New-Item -ItemType Directory -Path "docs/adrs" -Force
New-Item -ItemType Directory -Path "docs/guides" -Force
```

### 3.2 Crear ARCHITECTURE.md

```markdown
<!-- docs/ARCHITECTURE.md -->

# NexoERP — Arquitectura del Sistema

> **Versión:** 0.1.0
> **Última actualización:** 2025-06
> **Estado:** Fase 0 — Fundación

---

## Tabla de Contenidos

1. [Visión General](#1-visión-general)
2. [Principios de Arquitectura](#2-principios-de-arquitectura)
3. [Diagrama de Alto Nivel](#3-diagrama-de-alto-nivel)
4. [Stack Tecnológico](#4-stack-tecnológico)
5. [Estructura del Proyecto](#5-estructura-del-proyecto)
6. [Patrones de Diseño](#6-patrones-de-diseño)
7. [Multi-tenancy](#7-multi-tenancy)
8. [Seguridad](#8-seguridad)
9. [Flujo de Datos](#9-flujo-de-datos)
10. [Infraestructura AWS](#10-infraestructura-aws)
11. [ADRs Relacionados](#11-adrs-relacionados)

---

## 1. Visión General

NexoERP es un sistema ERP modular diseñado para PYMEs hondureñas. Combina contabilidad NIIF, facturación fiscal SAR, gestión de contactos, inventarios, compras y ventas/CRM en una plataforma multi-tenant con soporte cloud y on-premise.

**Características principales:**

- Multi-tenant con aislamiento a nivel de fila (RLS)
- Cumplimiento fiscal Honduras (SAR, DET, CAI, ISV)
- Contabilidad NIIF con plan de cuentas hondureño
- Módulos activables por empresa
- API-first (REST via Next.js Route Handlers)
- Diseño responsive-first

---

## 2. Principios de Arquitectura

| Principio                         | Descripción                                                                                        |
| --------------------------------- | -------------------------------------------------------------------------------------------------- |
| **API-First**                     | Toda operación pasa por Route Handlers REST. No hay acceso directo a BD desde componentes cliente. |
| **Defense in Depth**              | Seguridad en múltiples capas: WAF → middleware → API → RLS → encriptación.                         |
| **Multi-tenant by Design**        | Cada tabla incluye `company_id`. RLS garantiza aislamiento.                                        |
| **Progressive Enhancement**       | Funcionalidad básica sin JavaScript. UI mejorada con hidratación.                                  |
| **Fail-Fast**                     | Validación con Zod en entrada (API) y en variables de entorno (startup).                           |
| **Convention over Configuration** | Estructura de carpetas predecible, naming consistente.                                             |
| **Event-Driven (Future)**         | El sistema prepara soporte para eventos en operaciones críticas (facturas, asientos).              |

---

## 3. Diagrama de Alto Nivel
```

┌─────────────────────────────────────────────────────────┐
│ CloudFront + WAF │
│ (CDN + Protección DDoS) │
└──────────────────────────┬──────────────────────────────┘
│
┌──────────────────────────▼──────────────────────────────┐
│ AWS Amplify Gen 2 │
│ (Next.js 15 App Router SSR) │
│ │
│ ┌──────────────┐ ┌──────────────┐ ┌───────────────┐ │
│ │ Frontend │ │ API Routes │ │ Server │ │
│ │ React 19 │ │ /api/_ │ │ Components │ │
│ │ + shadcn/ui │ │ REST + Zod │ │ + RSC │ │
│ └──────────────┘ └──────┬───────┘ └───────────────┘ │
│ │ │
│ ┌────────────────────────▼──────────────────────────┐ │
│ │ Prisma 6 ORM │ │
│ │ Client Extensions: tenant filter + audit │ │
│ │ Multi-file schema: prisma/schema/_.prisma │ │
│ └────────────────────────┬──────────────────────────┘ │
└───────────────────────────┼──────────────────────────────┘
│
┌───────────────────────────▼──────────────────────────────┐
│ PostgreSQL 16 │
│ (Local: Docker / AWS: RDS) │
│ │
│ • Row Level Security (RLS) por company_id │
│ • Extensiones: uuid-ossp, pgcrypto, citext │
│ • Cifrado en reposo (AES-256 en RDS) │
└──────────────────────────────────────────────────────────┘

           ┌──────────┐    ┌──────────┐    ┌───────────┐
           │ Cognito  │    │    S3    │    │    SES    │
           │  (Auth)  │    │(Storage) │    │  (Email)  │
           └──────────┘    └──────────┘    └───────────┘

```

---

## 4. Stack Tecnológico

### Frontend

| Tecnología | Versión | Propósito |
|-----------|---------|-----------|
| Next.js | 15 (App Router) | Framework fullstack SSR/SSG |
| React | 19 | UI library |
| TypeScript | 5 | Type safety |
| Tailwind CSS | 4 | Utility-first CSS |
| shadcn/ui | Latest | Component library (New York style) |
| Radix UI | Latest | Accessible primitives |
| Zustand | 5 | Client state management |
| TanStack Query | 5 | Server state + caching |
| React Hook Form | 7 | Form handling |
| Zod | 3 | Schema validation |
| nuqs | Latest | URL state management |
| date-fns | Latest | Date manipulation |
| Recharts | Latest | Charts and graphs |

### Backend

| Tecnología | Versión | Propósito |
|-----------|---------|-----------|
| Next.js API Routes | 15 | REST API (Route Handlers) |
| Prisma | 6 | ORM + migrations + multi-file schema |
| PostgreSQL | 16 | Primary database |
| Zod | 3 | Request/response validation |
| bcrypt / pgcrypto | — | Password/data hashing |

### Infraestructura AWS

| Servicio | Propósito | Fase |
|----------|----------|------|
| Amplify Gen 2 | Hosting + CI/CD | 0 |
| Cognito | Autenticación + MFA | 0 |
| S3 | Almacenamiento de archivos | 0 |
| RDS PostgreSQL | Base de datos managed | 0 (staging/prod) |
| CloudFront | CDN | 0 |
| WAF | Firewall de aplicación | 0 |
| Shield | Protección DDoS (Standard) | 0 |
| SES | Envío de emails transaccionales | 1 |
| Secrets Manager | Almacenamiento de secretos | 0 |

### Dev Tools

| Herramienta | Propósito |
|------------|-----------|
| ESLint (flat config) | Linting |
| Prettier | Formatting |
| Husky + lint-staged | Git hooks |
| commitlint | Conventional commits |
| Changesets | Changelog + versioning |
| Vitest | Unit + integration tests |
| Playwright | E2E tests |
| Docker Compose | PostgreSQL + pgAdmin local |
| GitHub Actions | CI pipeline |

---

## 5. Estructura del Proyecto

```

nexoerp/
├── amplify/ # AWS Amplify Gen 2 backend
│ ├── auth/resource.ts # Cognito config
│ ├── storage/resource.ts # S3 config
│ ├── backend.ts # Entry point
│ └── tsconfig.json
├── docker/ # Docker configs
│ └── postgres/init.sql # DB extensions
├── docs/ # Documentation
│ ├── ARCHITECTURE.md # This file
│ ├── REQUIREMENTS.md # Requirements doc
│ ├── adrs/ # Architecture Decision Records
│ ├── guides/ # Developer guides
│ └── specs/ # Phase specs
├── prisma/
│ ├── schema/ # Multi-file Prisma schema
│ │ ├── base.prisma # Datasource, generator, enums
│ │ ├── core.prisma # Company, User
│ │ ├── contacts.prisma # (Fase 2)
│ │ ├── accounting.prisma # (Fase 2)
│ │ ├── invoicing.prisma # (Fase 3)
│ │ └── inventory.prisma # (Fase 4)
│ ├── migrations/ # Migration history
│ └── seed/index.ts # Seed data
├── public/ # Static files
├── scripts/ # Dev scripts
├── src/
│ ├── app/ # Next.js App Router
│ │ ├── (auth)/ # Auth routes (login, register)
│ │ ├── (dashboard)/ # Protected routes
│ │ │ ├── layout.tsx # Sidebar + topbar
│ │ │ ├── page.tsx # Dashboard home
│ │ │ ├── contacts/ # (Fase 2)
│ │ │ ├── accounting/ # (Fase 2)
│ │ │ ├── invoicing/ # (Fase 3)
│ │ │ ├── inventory/ # (Fase 4)
│ │ │ └── settings/ # Company + user settings
│ │ ├── api/ # REST API Route Handlers
│ │ │ ├── health/route.ts
│ │ │ ├── v1/ # API v1 namespace
│ │ │ │ ├── auth/
│ │ │ │ ├── companies/
│ │ │ │ ├── users/
│ │ │ │ └── ...
│ │ │ └── webhooks/ # External webhooks
│ │ ├── layout.tsx # Root layout
│ │ └── page.tsx # Landing
│ ├── components/
│ │ ├── ui/ # shadcn/ui components
│ │ ├── forms/ # Reusable form components
│ │ ├── layout/ # Sidebar, Topbar, etc.
│ │ └── shared/ # Shared components
│ ├── hooks/ # Custom React hooks
│ ├── lib/ # Core utilities
│ │ ├── amplify/ # AWS Amplify config
│ │ ├── db/prisma.ts # Prisma singleton
│ │ ├── env.ts # Env validation (server)
│ │ ├── env-client.ts # Env validation (client)
│ │ ├── utils.ts # CN helper + utilities
│ │ └── validators/ # Zod schemas
│ ├── constants/ # App constants
│ ├── types/ # TypeScript types
│ ├── styles/ # Global styles
│ └── **tests**/ # Test setup + helpers
├── e2e/ # Playwright E2E tests
├── .github/ # GitHub Actions + templates
├── .vscode/ # VS Code config
├── docker-compose.yml
├── amplify.yml
├── next.config.ts
├── tailwind.config.ts (if needed)
├── tsconfig.json
├── vitest.config.ts
├── playwright.config.ts
└── package.json

```

**Convenciones de naming:**

- Archivos: `kebab-case.ts` (excepto componentes React: `PascalCase.tsx`)
- Carpetas: `kebab-case/`
- Variables/funciones: `camelCase`
- Types/Interfaces: `PascalCase`
- Constants: `UPPER_SNAKE_CASE`
- DB columns: `snake_case`
- API endpoints: `/api/v1/kebab-case`

---

## 6. Patrones de Diseño

### 6.1 API-First Pattern

```

Client Component
→ fetch('/api/v1/invoices', { method: 'POST', body })
→ Route Handler (src/app/api/v1/invoices/route.ts)
→ Zod validation
→ Auth check (middleware)
→ Tenant resolution (company_id from session)
→ Prisma query (with RLS)
→ Return JSON response

```

### 6.2 Server Component Data Fetching

```

Server Component (src/app/(dashboard)/invoices/page.tsx)
→ Direct Prisma query (server-only)
→ RLS filters automatically by company_id
→ Render HTML (no client JS needed)

```

### 6.3 Form Pattern

```

Client Component (form)
→ React Hook Form + Zod resolver
→ onSubmit → fetch('/api/v1/...')
→ TanStack Query mutation
→ Optimistic UI update
→ Sonner toast notification

```

### 6.4 Audit Pattern

```

Any Prisma write (create, update, delete)
→ Prisma Client Extension intercepts
→ Extracts: who (user_id), what (table, action, changes), when (timestamp)
→ Writes to audit_logs table
→ Original operation proceeds

```

---

## 7. Multi-tenancy

### 7.1 Modelo de Aislamiento (4 capas)

```

Capa 1: Middleware Next.js
→ Extrae company_id de token/sesión
→ Rechaza si no autenticado

Capa 2: Prisma Client Extension
→ Agrega WHERE company_id = ? automáticamente
→ A todas las queries (findMany, findFirst, etc.)

Capa 3: Row Level Security (PostgreSQL)
→ Políticas RLS como última línea de defensa
→ SET app.current_company_id = 'xxx' por transacción

Capa 4: Índices compuestos
→ Todos los índices inician con company_id
→ Performance: partition pruning por tenant

```

### 7.2 Regla Critical

> **Toda tabla que contenga datos de empresa DEBE incluir `company_id` como primer campo de cualquier índice compuesto.**

---

## 8. Seguridad

### 8.1 Capas de Seguridad

| Capa | Tecnología | Protección |
|------|-----------|-----------|
| Edge | CloudFront + WAF + Shield | DDoS, IP blocking, rate limiting |
| Transport | TLS 1.3 | Encriptación en tránsito |
| Application | Next.js middleware + headers | CSRF, XSS, CSP, HSTS |
| Auth | Cognito + MFA TOTP | Autenticación + 2FA |
| Authorization | RBAC (5 roles) | Permisos granulares |
| Data | Prisma Extension + RLS | Aislamiento por tenant |
| Storage | AES-256 (RDS + S3) | Encriptación en reposo |

### 8.2 Security Headers (configurados en next.config.ts)

- `Strict-Transport-Security`
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`
- `Content-Security-Policy: default-src 'self'; ...`

### 8.3 Roles RBAC

| Rol | Nivel | Acceso |
|-----|-------|--------|
| `administrador` | Full | Toda la empresa, config, usuarios |
| `gerente` | Alto | Reportes, aprobaciones, supervisión |
| `contador` | Medio | Contabilidad, facturación, reportes |
| `vendedor` | Limitado | Facturas de venta, contactos clientes |
| `auditor` | Lectura | Solo lectura, auditoría, reportes |

---

## 9. Flujo de Datos

### 9.1 Flujo de Factura (ejemplo representativo)

```

1. Usuario crea factura (Form → POST /api/v1/invoices)
2. Validación Zod del body
3. Auth middleware verifica token + permisos
4. Route Handler:
   a. Verifica CAI activo y rango disponible
   b. Genera número fiscal SAR
   c. Calcula ISV (15%, 18%, exento por línea)
   d. Crea Invoice + InvoiceLines en transacción
   e. Genera asiento contable automático
   f. Genera PDF conforme SAR (Lambda)
   g. Registra en audit_log
5. Respuesta: Invoice creada con número fiscal
6. UI actualiza via TanStack Query invalidation

```

### 9.2 Flujo de Autenticación

```

1. Login form → Cognito authenticateUser
2. Cognito valida credenciales + MFA (si habilitado)
3. Retorna tokens (id, access, refresh)
4. Next.js middleware:
   a. Extrae access_token de cookie
   b. Verifica token con Cognito
   c. Extrae user_id → busca User en BD
   d. Resuelve company_id del usuario
   e. Establece session context (user + company + role)
5. Requests subsecuentes incluyen company_id

```

---

## 10. Infraestructura AWS

### 10.1 Ambientes

| Ambiente | Branch | URL | BD |
|----------|--------|-----|-----|
| Local | any | localhost:3000 | Docker PG16 |
| Sandbox | feature/* | sandbox-{id}.amplifyapp.com | Amplify sandbox |
| Staging | staging | staging.nexoerp.com | RDS staging |
| Production | main | app.nexoerp.com | RDS production |

### 10.2 Estimación de Costos

| Servicio | Mensual |
|----------|---------|
| Amplify Hosting (2 ambientes) | ~$10 |
| RDS db.t3.micro (2 instancias) | ~$30-60 |
| Cognito (< 50k MAU) | $0 |
| S3 (< 5GB) | ~$1 |
| CloudFront | ~$1 |
| SES (< 1k emails) | ~$1 |
| WAF (basic rules) | ~$5 |
| **Total estimado** | **~$48-78/mes** |

> Budget alert configurado en $50/mes (90% threshold).

---

## 11. ADRs Relacionados

| ADR | Título | Estado |
|-----|--------|--------|
| [ADR-001](adrs/001-next15-app-router.md) | Next.js 15 App Router como framework fullstack | Aceptado |
| [ADR-002](adrs/002-multi-tenant-rls.md) | Multi-tenancy con RLS en PostgreSQL | Aceptado |
| [ADR-003](adrs/003-api-first-rest.md) | API-first con REST (Route Handlers) | Aceptado |
| [ADR-004](adrs/004-prisma6-multi-schema.md) | Prisma 6 con multi-file schema | Aceptado |
| [ADR-005](adrs/005-amplify-gen2-hosting.md) | AWS Amplify Gen 2 para hosting y CI/CD | Aceptado |

---

## Historial de Cambios

| Fecha | Versión | Cambio |
|-------|---------|--------|
| 2025-06 | 0.1.0 | Documento inicial — Fase 0 Fundación |
```

### 3.3 Crear ADR-001: Next.js 15 App Router

```markdown
<!-- docs/adrs/001-next15-app-router.md -->

# ADR-001: Next.js 15 App Router como Framework Fullstack

- **Estado:** Aceptado
- **Fecha:** 2025-06
- **Autor:** Equipo NexoERP

## Contexto

NexoERP necesita un framework web que soporte:

- Server-Side Rendering (SSR) para SEO y performance inicial
- API Routes para construir endpoints REST
- TypeScript nativo
- Ecosistema maduro con componentes enterprise (tablas, formularios, reportes)
- Despliegue en AWS Amplify Gen 2

## Decisión

Usar **Next.js 15 con App Router** como framework fullstack.

## Alternativas Consideradas

| Alternativa                  | Pros                                                | Contras                                            |
| ---------------------------- | --------------------------------------------------- | -------------------------------------------------- |
| **Next.js 15 App Router** ✅ | RSC, streaming, layouts, API routes, Amplify nativo | Curva de aprendizaje RSC, ecosistema en transición |
| Remix                        | Loaders/Actions elegantes, progressive enhancement  | Soporte Amplify limitado, ecosistema más pequeño   |
| Nuxt 3 (Vue)                 | Buen DX, Nitro server                               | Ecosistema menor para ERP enterprise, Vue vs React |
| SvelteKit                    | Performance excelente, DX simple                    | Ecosistema limitado para componentes enterprise    |
| Express + React SPA          | Control total del backend                           | Duplicar funcionalidad que Next.js ya provee       |

## Consecuencias

### Positivas

- Framework unificado (frontend + backend) reduce complejidad operacional
- RSC (React Server Components) permite queries directos a BD sin API intermedio para lectura
- App Router con layouts anidados alinea con la estructura modular de NexoERP
- Compatibilidad nativa con AWS Amplify Gen 2
- Ecosistema rico: shadcn/ui, TanStack, Zustand, etc.
- Turbopack para desarrollo rápido

### Negativas

- Complejidad del modelo de rendering (client vs server components)
- Cambios frecuentes en Next.js requieren actualizaciones periódicas
- App Router aún en maduración para algunos patrones enterprise

### Mitigación

- Documentar claramente cuándo usar Server vs Client components
- Mantener una capa de abstracción sobre las APIs de Next.js para facilitar migración futura
- Seguir convenciones estrictas (todos los fetches de mutación via API Routes)

## Referencias

- [Next.js 15 Release Notes](https://nextjs.org/blog/next-15)
- [REQUIREMENTS.md §4](../REQUIREMENTS.md)
```

### 3.4 Crear ADR-002: Multi-tenancy con RLS

```markdown
<!-- docs/adrs/002-multi-tenant-rls.md -->

# ADR-002: Multi-tenancy con Row Level Security (RLS)

- **Estado:** Aceptado
- **Fecha:** 2025-06
- **Autor:** Equipo NexoERP

## Contexto

NexoERP es un sistema multi-tenant donde múltiples empresas comparten la misma instancia de aplicación y base de datos. Se necesita garantizar aislamiento total de datos entre empresas, incluyendo protección contra errores de programación que pudieran filtrar datos.

## Decisión

Implementar **4 capas de aislamiento multi-tenant**, con **Row Level Security (RLS) de PostgreSQL** como capa de defensa en profundidad.

### Las 4 capas:

1. **Middleware Next.js** — Resolución de tenant desde token JWT
2. **Prisma Client Extension** — Filtro automático `WHERE company_id = ?`
3. **RLS PostgreSQL** — Políticas a nivel de motor de BD
4. **Índices compuestos** — `company_id` como primer campo siempre

## Alternativas Consideradas

| Alternativa                   | Pros                                     | Contras                                        |
| ----------------------------- | ---------------------------------------- | ---------------------------------------------- |
| **RLS (database per row)** ✅ | Costo bajo, schema unificado, RLS nativo | Complejidad de RLS policies                    |
| Schema per tenant             | Aislamiento fuerte                       | Complejidad de migraciones, costo alto         |
| Database per tenant           | Aislamiento total                        | Costo prohibitivo para PYMEs, gestión compleja |
| Solo filtro en aplicación     | Simple de implementar                    | Un bug filtra datos de otro tenant             |

## Consecuencias

### Positivas

- Costo operacional mínimo (una BD, un schema)
- RLS como "safety net" previene filtraciones incluso con bugs en la app
- Migraciones se aplican una vez para todos los tenants
- Prisma Client Extension automatiza el filtro (DX excelente)
- Escalable: funciona para cientos de empresas

### Negativas

- RLS requiere `SET app.current_company_id` por transacción
- Índices compuestos con `company_id` agregan overhead de espacio
- Testing requiere simular múltiples tenants
- Queries ad-hoc (debugging) requieren establecer el contexto RLS

### Mitigación

- Prisma Extension maneja `SET` automáticamente
- Tests multi-tenant con fixtures predefinidos (TENANT_A, TENANT_B)
- Script de debug para establecer contexto RLS en pgAdmin/psql

## Regla de Oro

> **Toda tabla con datos de empresa DEBE incluir `company_id` como campo y como primer campo de índices compuestos.**

## Referencias

- [PostgreSQL RLS Documentation](https://www.postgresql.org/docs/16/ddl-rowsecurity.html)
- [REQUIREMENTS.md §11](../REQUIREMENTS.md)
```

### 3.5 Crear ADR-003: API-first REST

```markdown
<!-- docs/adrs/003-api-first-rest.md -->

# ADR-003: API-first con REST (Next.js Route Handlers)

- **Estado:** Aceptado
- **Fecha:** 2025-06
- **Autor:** Equipo NexoERP

## Contexto

NexoERP necesita una estrategia de API para:

- Operaciones de escritura (crear facturas, asientos, contactos)
- Futuras integraciones con sistemas externos
- Aplicación móvil futura
- Separación clara de responsabilidades (UI vs lógica de negocio)

## Decisión

Usar **API-first con REST** implementado mediante **Next.js Route Handlers** (`src/app/api/`). Las lecturas simples pueden usar Server Components con queries directos a Prisma, pero todas las mutaciones pasan por API Routes.

## Alternativas Consideradas

| Alternativa                | Pros                               | Contras                                                    |
| -------------------------- | ---------------------------------- | ---------------------------------------------------------- |
| **REST Route Handlers** ✅ | Simple, estándar, fácil de cachear | Puede resultar en muchos endpoints                         |
| GraphQL (AppSync)          | Flexible, un endpoint              | Overhead para CRUD simple, complejidad                     |
| tRPC                       | Type-safety end-to-end             | Acoplado a TypeScript, no apto para integraciones externas |
| Server Actions only        | Simple, sin API visible            | No apto para integraciones, difícil de testear             |

## Estructura de API
```

src/app/api/
├── health/route.ts # GET /api/health
└── v1/
├── auth/
│ ├── login/route.ts # POST /api/v1/auth/login
│ └── register/route.ts # POST /api/v1/auth/register
├── companies/
│ └── route.ts # GET, POST /api/v1/companies
├── users/
│ ├── route.ts # GET, POST /api/v1/users
│ └── [id]/route.ts # GET, PUT, DELETE /api/v1/users/:id
├── contacts/route.ts # (Fase 2)
├── accounts/route.ts # (Fase 2)
├── invoices/route.ts # (Fase 3)
└── ...

```

## Convenciones

- **Versionado:** `/api/v1/...` para permitir evolución sin breaking changes
- **Validación:** Zod schemas en cada endpoint (request body, query params)
- **Respuestas:** JSON estandarizado `{ data, error, meta }`
- **Errores:** HTTP status codes estándar + error codes propios
- **Auth:** Middleware verifica token en todas las rutas `/api/v1/*`

## Consecuencias

### Positivas
- API documentable y testeable independientemente del frontend
- Facilita futuras integraciones (mobile, third-party)
- Separación clara: Server Components para lectura, API Routes para escritura
- Cacheable con mecanismos HTTP estándar

### Negativas
- Más código que Server Actions para operaciones internas simples
- Requiere mantener validación en `frontend` (form) + `backend` (API) alineadas (mitigado con Zod schemas compartidos)

### Mitigación
- Zod schemas compartidos entre frontend y backend (`src/lib/validators/`)
- Generador de API client con tipos (futuro)

## Referencias
- [Next.js Route Handlers](https://nextjs.org/docs/app/building-your-application/routing/route-handlers)
- [REQUIREMENTS.md §4](../REQUIREMENTS.md)
```

### 3.6 Crear ADR-004: Prisma 6 Multi-file Schema

```markdown
<!-- docs/adrs/004-prisma6-multi-schema.md -->

# ADR-004: Prisma 6 con Multi-file Schema

- **Estado:** Aceptado
- **Fecha:** 2025-06
- **Autor:** Equipo NexoERP

## Contexto

NexoERP tiene un modelo de datos extenso con ~30+ tablas distribuidas en 7 módulos. Un único archivo `schema.prisma` sería difícil de mantener y navegar. Prisma 6 introduce soporte nativo para multi-file schemas.

## Decisión

Usar **Prisma 6** con la feature `prismaSchemaFolder` para organizar el schema en múltiples archivos por dominio.

## Estructura
```

prisma/schema/
├── base.prisma # datasource, generator, enums comunes
├── core.prisma # Company, User, Role, Permission, Module, Menu, AuditLog
├── contacts.prisma # Contact, ContactAddress, PaymentTerms
├── accounting.prisma # Account, FiscalYear, Period, Journal, Entry, Currency, ExchangeRate
├── invoicing.prisma # Invoice, InvoiceLine, CAI, EmissionPoint, TaxRate
├── purchasing.prisma # PurchaseOrder, PurchaseOrderLine, Supplier
├── sales.prisma # SalesOrder, Quotation, Pipeline, Opportunity
└── inventory.prisma # Product, Warehouse, StockMovement, Category

````

## Alternativas Consideradas

| Alternativa | Pros | Contras |
|------------|------|---------|
| **Prisma 6 multi-file** ✅ | Organizado, nativo, un `prisma generate` | Feature relativamente nueva |
| Single schema.prisma | Simple, bien documentado | Archivo enorme, difícil de navegar |
| Multiple databases | Aislamiento por módulo | Complejidad de joins cross-DB |
| Raw SQL migrations | Control total | Pierde type-safety de Prisma |

## Configuración

```prisma
// prisma/schema/base.prisma
generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["prismaSchemaFolder"]
}

datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}
````

## Consecuencias

### Positivas

- Cada módulo tiene su archivo de schema, fácil de localizar y modificar
- Prisma Client generado incluye todos los modelos con relaciones cross-file
- Migraciones unificadas (un historial)
- Alinea con la arquitectura modular de NexoERP

### Negativas

- `prismaSchemaFolder` aún es preview feature
- Orden de archivos importa (base.prisma debe tener datasource)
- Algunos editores pueden no auto-completar relaciones cross-file

### Mitigación

- Prisma 6 estabilizará la feature pronto
- Documentar orden y convenciones
- Usar Prisma VS Code extension para autocompletado

## Referencias

- [Prisma Multi-file Schema](https://www.prisma.io/docs/orm/prisma-schema/overview/location#multi-file-prisma-schema)
- [REQUIREMENTS.md §5](../REQUIREMENTS.md)

````

### 3.7 Crear ADR-005: Amplify Gen 2

```markdown
<!-- docs/adrs/005-amplify-gen2-hosting.md -->
# ADR-005: AWS Amplify Gen 2 para Hosting y CI/CD

- **Estado:** Aceptado
- **Fecha:** 2025-06
- **Autor:** Equipo NexoERP

## Contexto

NexoERP necesita una plataforma de hosting que:
- Soporte Next.js 15 SSR (no solo SSG)
- Integre CI/CD automático desde Git
- Ofrezca servicios de autenticación (Cognito) y storage (S3) integrados
- Mantenga costos bajos para PYMEs ($50/mes target)
- Permita ambientes múltiples (staging, production)

## Decisión

Usar **AWS Amplify Gen 2** como plataforma de hosting, CI/CD, y backend services (Cognito + S3).

## Alternativas Consideradas

| Alternativa | Pros | Contras |
|------------|------|---------|
| **Amplify Gen 2** ✅ | Next.js SSR nativo, Cognito/S3 integrado, auto-deploy | Lock-in AWS, Gen 2 aún madurando |
| Vercel | Mejor DX para Next.js, Edge Functions | Costoso para producción, sin Cognito nativo |
| AWS ECS/Fargate | Control total | Complejidad operacional alta, más caro |
| AWS Lambda + API Gateway | Serverless puro | Complejidad, cold starts, no SSR nativo |
| Railway / Render | Simple, barato | Sin servicios AWS integrados |
| Self-hosted (EC2) | Control total | Requiere admin de servers, costoso en tiempo |

## Consecuencias

### Positivas
- Deploy automático en push a `staging` / `main`
- Cognito User Pools integrado (Auth sin servidor propio)
- S3 para almacenamiento de documentos con access rules
- CloudFront CDN incluido
- Amplify sandbox para desarrollo con servicios reales
- Costo predecible (~$5-10/mes hosting, Cognito gratis <50k usuarios)

### Negativas
- Dependencia de AWS (vendor lock-in)
- Amplify Gen 2 es más nuevo (menos documentación que Gen 1)
- Build times pueden ser lentos (~3-5 min)
- Debugging de deploys puede ser opaco

### Mitigación
- Prisma abstrae la BD (migrable a cualquier PostgreSQL)
- Código de la app no depende de Amplify excepto en `amplify/` y `src/lib/amplify/`
- Documentar proceso de migración a Vercel/ECS como contingencia
- Usar GitHub Actions como CI principal (no depender solo de Amplify build)

## References
- [AWS Amplify Gen 2 Docs](https://docs.amplify.aws/gen2/)
- [REQUIREMENTS.md §5, §6](../REQUIREMENTS.md)
````

### 3.8 Crear ADR Template

```markdown
<!-- docs/adrs/000-template.md -->

# ADR-XXX: [Título de la Decisión]

- **Estado:** Propuesto | Aceptado | Rechazado | Deprecated | Superseded
- **Fecha:** YYYY-MM
- **Autor:** [Nombre]
- **Supersede:** [ADR-NNN] (si aplica)

## Contexto

[¿Cuál es el problema o necesidad que motiva esta decisión?]

## Decisión

[¿Qué se decidió hacer?]

## Alternativas Consideradas

| Alternativa           | Pros | Contras |
| --------------------- | ---- | ------- |
| **Opción elegida** ✅ | ...  | ...     |
| Opción B              | ...  | ...     |
| Opción C              | ...  | ...     |

## Consecuencias

### Positivas

- ...

### Negativas

- ...

### Mitigación

- ...

## Referencias

- [Link 1]
- [Link 2]
```

### 3.9 Crear guía de contribución

````markdown
<!-- docs/guides/CONTRIBUTING.md -->

# Guía de Contribución — NexoERP

## Git Workflow

1. **Crear branch** desde `staging`:
   ```bash
   git checkout staging && git pull
   git checkout -b feature/NEXO-xxx-descripcion
   ```
````

2. **Commits** con Conventional Commits:

   ```
   feat(invoicing): add CAI validation rules
   fix(accounting): correct ISV calculation for exempt items
   docs(core): update ARCHITECTURE.md with new patterns
   ```

3. **Push y PR** → `staging`:

   ```bash
   git push -u origin feature/NEXO-xxx-descripcion
   gh pr create --base staging
   ```

4. **CI debe pasar** antes del merge.

5. **Staging → main** via PR con CI + E2E passing.

## Scopes válidos para commits

`core`, `auth`, `contacts`, `accounting`, `invoicing`, `purchasing`, `sales`, `inventory`, `ui`, `db`, `infra`, `api`, `deps`, `config`

## Reglas Multi-tenant

- ✅ Toda tabla con datos de empresa incluye `company_id`
- ✅ Índices compuestos: `company_id` como primer campo
- ✅ RLS policies creadas para cada tabla nueva
- ✅ Tests de aislamiento para operaciones cross-tenant

## Reglas de API

- ✅ Endpoints en `src/app/api/v1/[domain]/route.ts`
- ✅ Validación Zod en request body y query params
- ✅ Respuesta estandarizada: `{ data, error, meta }`
- ✅ Auth middleware verifica token en todas las rutas

## Testing

- ✅ Unit tests para lógica de negocio (≥ 80% coverage)
- ✅ Integration tests para API endpoints
- ✅ E2E tests para flujos críticos
- ✅ Tests multi-tenant (verificar aislamiento)

## Checklist antes de PR

- [ ] `npm run lint` pasa sin errores
- [ ] `npm run typecheck` pasa
- [ ] `npx vitest run` pasa
- [ ] Tests agregados para cambios nuevos
- [ ] PR template completado
- [ ] Multi-tenant checklist verificado (si aplica)

```

---

## 4. Estructura Resultante

```

docs/
├── ARCHITECTURE.md # Documento principal de arquitectura
├── REQUIREMENTS.md # Requisitos (ya existente)
├── adrs/
│ ├── 000-template.md # Template para nuevos ADRs
│ ├── 001-next15-app-router.md # Next.js 15 + App Router
│ ├── 002-multi-tenant-rls.md # Multi-tenancy con RLS
│ ├── 003-api-first-rest.md # API-first REST
│ ├── 004-prisma6-multi-schema.md # Prisma 6 multi-file schema
│ └── 005-amplify-gen2-hosting.md # AWS Amplify Gen 2
├── guides/
│ └── CONTRIBUTING.md # Guía de contribución
└── specs/
└── fase-0/ # Specs de Fase 0

```

---

## 5. Criterios de Aceptación

| # | Criterio | Verificación |
|---|----------|-------------|
| 1 | `ARCHITECTURE.md` creado con todas las secciones | Revisión manual |
| 2 | 5 ADRs iniciales creados | `ls docs/adrs/` muestra 6 archivos (inc. template) |
| 3 | ADR template existe para futuros ADRs | `docs/adrs/000-template.md` existe |
| 4 | `CONTRIBUTING.md` creado con workflow y reglas | Revisión manual |
| 5 | `ARCHITECTURE.md` referencia a los ADRs con links relativos | Links funcionan |
| 6 | Diagramas en formato ASCII (renderizan en GitHub) | Vista preview en GitHub |
| 7 | Convenciones de naming documentadas | Sección 5 en ARCHITECTURE.md |
| 8 | Stack tecnológico completo con versiones | Sección 4 en ARCHITECTURE.md |
| 9 | Patrones de diseño documentados con ejemplos | Sección 6 en ARCHITECTURE.md |
| 10 | Cada ADR incluye alternativas consideradas y consecuencias | Revisión |

---

## 6. Checklist de Verificación

```

□ docs/ARCHITECTURE.md creado
□ docs/adrs/000-template.md creado
□ docs/adrs/001-next15-app-router.md creado
□ docs/adrs/002-multi-tenant-rls.md creado
□ docs/adrs/003-api-first-rest.md creado
□ docs/adrs/004-prisma6-multi-schema.md creado
□ docs/adrs/005-amplify-gen2-hosting.md creado
□ docs/guides/CONTRIBUTING.md creado
□ Links entre ARCHITECTURE.md y ADRs funcionan
□ Todos los documentos renderizan correctamente en GitHub
□ No hay placeholders pendientes de llenar

```

---

## 7. Notas Técnicas

- **ADRs son inmutables:** Una vez aceptados, no se editan. Si la decisión cambia, se crea un nuevo ADR que "supersede" al anterior.
- **ARCHITECTURE.md es vivo:** Se actualiza con cada fase. Al final de cada fase, actualizar sección de estructura del proyecto y diagrama.
- **Formato ASCII:** Los diagramas usan ASCII art para máxima compatibilidad (renderizan en cualquier viewer de Markdown).
- **Convención de ADRs:** Secuencia numérica `XXX-titulo-kebab-case.md`. No se eliminan ADRs, solo se marcan como Deprecated/Superseded.
```
