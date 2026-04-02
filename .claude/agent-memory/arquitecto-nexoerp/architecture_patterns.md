---
name: Patrones arquitectónicos confirmados en NexoERP
description: Convenciones de código, estructura de carpetas y patrones validados en el codebase real
type: project
---

## Estructura de rutas API confirmada

- Versionado: /api/v1/[modulo]/[recurso]/route.ts
- Ejemplo: /api/v1/core/users/route.ts, /api/v1/core/users/[id]/route.ts
- Módulo core: /api/v1/core/
- Módulo contacts (próximo): /api/v1/contacts/
- Módulo accounting (próximo): /api/v1/accounting/

## Patrón de autenticación en API routes

- El middleware inyecta headers: x-company-id, x-user-id, x-user-role, x-user-email, x-user-fullname
- Los routes leen estos headers via getAuthContextFromHeaders(request) en src/lib/auth/request-auth.ts
- Matcher del middleware: ['/api/v1/:path*', '/dashboard/:path*']

## Patrón de Service Layer

- src/lib/services/[modulo]/[recurso].service.ts
- Ejemplo: src/lib/services/core/user.service.ts
- La lógica de negocio vive en services, NUNCA en API route handlers
- Los route handlers solo: validan con Zod → llaman service → retornan JSON

## Patrón de validaciones Zod

- src/lib/validations/[recurso].schema.ts compartido front/back
- Ejemplo: src/lib/validations/user.schema.ts

## Estructura del dashboard

- Grupo de rutas: src/app/(dashboard)/
- Ruta actual: src/app/(dashboard)/dashboard/page.tsx
- Users: src/app/(dashboard)/dashboard/users/page.tsx
- Layout compartido: src/app/(dashboard)/layout.tsx
- Sidebar: src/components/layout/dashboard-sidebar.tsx

## Prisma multi-file schema

- prisma/schema/base.prisma: datasource, generator, enums globales (SystemRole)
- prisma/schema/core.prisma: Company, User
- Próximos archivos: contacts.prisma, accounting.prisma, invoicing.prisma, etc.
- Puerto Docker PostgreSQL: 5433 (no 5432, para evitar conflicto con WSL)

## Tenant Extension

- src/lib/db/tenant-extension.ts
- BUSINESS_MODELS array: agregar cada nuevo modelo con company_id aquí
- createTenantPrisma(prisma, companyId): uso obligatorio en todos los service layers
- createAdminPrisma(prisma): solo para seeds y fixtures de tests

## Convenciones de naming

- Archivos: kebab-case (user-form.tsx, user.service.ts, user.schema.ts)
- Modelos Prisma: PascalCase (User, Company, Contact)
- Tablas DB: snake_case plural (users, companies, contacts)
- Campos DB: snake_case (company_id, created_at, is_active)
- Props TypeScript: camelCase (companyId, createdAt, isActive)
- company_id SIEMPRE primer campo en índices compuestos

## Commits Convention

- Scopes válidos: core, auth, contacts, accounting, invoicing, purchasing, sales, inventory, ui, infra, docs
- Formato: feat(scope): descripción en español
