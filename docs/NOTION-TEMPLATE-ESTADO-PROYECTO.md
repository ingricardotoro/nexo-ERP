# NexoERP — Estado del Proyecto (Marzo 2026)

> **Copia este documento completo y pegalo en Notion (Create page > Paste Markdown)**
> **Fecha de actualizacion:** 24 de marzo de 2026
> **Preparado por:** Claude Code (Doc Engineer)
> **Rama activa:** `feat/fase-2-contabilidad-contactos`
> **Ultimo commit:** `32a52db feat(contacts): add contacts module ui with list, detail and crud forms`

---

## Resumen Ejecutivo

**NexoERP** es un ERP multi-tenant en la nube para PYMEs hondurenas con cumplimiento
fiscal SAR y contabilidad NIIF. Actualmente en **Fase 2 de 5**, con la Fase 1 completada
exitosamente y el Modulo de Contactos de la Fase 2 ya implementado.

### Metricas Generales del Proyecto

| Metrica               | Valor                                                                                                                                         |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| **Fases completadas** | 1 de 5 (Fase 0 + Fase 1)                                                                                                                      |
| **Fase en progreso**  | Fase 2 — Contabilidad + Contactos                                                                                                             |
| **Tests (CI)**        | 68 passing                                                                                                                                    |
| **Endpoints REST**    | 17 endpoints (12 core + 5 health)                                                                                                             |
| **Modelos Prisma**    | 11 modelos (Company, User, AuditLog, Module, CompanyModule, Permission, RolePermission, PaymentTerms, Contact, ContactAddress, ContactPerson) |
| **Ambiente staging**  | AWS Amplify (activo)                                                                                                                          |
| **Presupuesto AWS**   | ~$1.35/mes con Free Tier activo                                                                                                               |
| **Repositorio**       | GitHub — rama principal: `main`                                                                                                               |

---

## Estado de Fases

| Fase       | Nombre                         | Estado      | Periodo               | Duracion              |
| ---------- | ------------------------------ | ----------- | --------------------- | --------------------- |
| **Fase 0** | Fundamentos                    | Completada  | Marzo 2026            | ~3 dias               |
| **Fase 1** | Core System                    | Completada  | 10-16 marzo 2026      | 6 dias                |
| **Fase 2** | Contabilidad + Contactos       | En progreso | Marzo 2026 — presente | ~6 semanas estimadas  |
| **Fase 3** | Facturacion Honduras           | Pendiente   | —                     | ~8 semanas estimadas  |
| **Fase 4** | Compras + Ventas + Inventarios | Pendiente   | —                     | ~12 semanas estimadas |

---

## Fase 1 — Core System (COMPLETADA)

> **Periodo:** 10 al 16 de marzo de 2026 (6 dias)
> **Branch:** `feat/fase-1-core-system` -> `staging` -> `main`

### Resultados Clave de Fase 1

| Metrica           | Objetivo | Resultado    | Estado     |
| ----------------- | -------- | ------------ | ---------- |
| Tests pasando     | 90%+     | 100% (47/47) | Completado |
| TypeScript errors | 0        | 0            | Completado |
| ESLint warnings   | <5       | 0            | Completado |
| CI tiempo         | <5 min   | ~3.8 min     | Completado |
| Cobertura core    | 80%+     | ~87%         | Completado |
| ADRs documentados | 2+       | 3            | Completado |

### Entregables de Fase 1

#### Arquitectura Multi-Tenant (4 capas de aislamiento)

| Capa       | Implementacion     | Descripcion                                                |
| ---------- | ------------------ | ---------------------------------------------------------- |
| **Capa 1** | PostgreSQL RLS     | `SET app.current_company_id` + politicas RLS por tabla     |
| **Capa 2** | Prisma Extension   | Filtro automatico `companyId` en todas las queries         |
| **Capa 3** | Middleware Next.js | Validacion JWT + extraccion `company_id` del token Cognito |
| **Capa 4** | Frontend Context   | `TenantContext` en React — datos de empresa en UI          |

#### Schema Prisma Fase 1

- `Company` — Empresa multi-tenant con RTN Honduras, logo S3, limites SaaS
- `User` — Usuario vinculado a Cognito (cognitoSub) + company_id
- `AuditLog` — Trazabilidad de cambios (quien, que, cuando, antes/despues)
- `Module` — Catalogo de modulos del sistema (core, accounting, invoicing, etc.)
- `CompanyModule` — Activacion de modulos por empresa (subscription model)
- `Permission` — Permisos granulares por modulo + accion
- `RolePermission` — Matriz de permisos por rol RBAC

#### Endpoints REST Implementados (Fase 1)

| Metodo   | Ruta                      | Descripcion                                 |
| -------- | ------------------------- | ------------------------------------------- |
| `GET`    | `/api/health`             | Health check del sistema                    |
| `GET`    | `/api/v1/core/users`      | Lista de usuarios (paginada, tenant-scoped) |
| `POST`   | `/api/v1/core/users`      | Crear usuario                               |
| `GET`    | `/api/v1/core/users/[id]` | Detalle de usuario                          |
| `PUT`    | `/api/v1/core/users/[id]` | Actualizar usuario                          |
| `DELETE` | `/api/v1/core/users/[id]` | Desactivar usuario (soft delete)            |
| `GET`    | `/api/v1/core/tenant`     | Contexto del tenant activo                  |

#### UI Implementada (Fase 1)

- Dashboard principal con navegacion modular por sidebar
- Pagina de lista de usuarios con TanStack Table (filtros, paginacion, sorting)
- Modal de creacion/edicion de usuarios con React Hook Form + Zod
- Pagina de perfil de usuario individual
- Componentes: TenantContext, AuthGuard, LoadingSpinner, DataTable, UserForm

#### Infraestructura (Fase 1)

- AWS Amplify Gen 2 — hosting y CI/CD
- Amazon Cognito — autenticacion JWT (HTTP-only cookies web, Bearer tokens movil)
- Lambda PostConfirmation — sincronizacion Cognito -> PostgreSQL
- Amazon RDS PostgreSQL 16 + RDS Proxy (staging)
- GitHub Actions — CI con Jest + TypeScript + ESLint
- Costo staging: ~$1.35/mes con Free Tier activo

---

## Fase 2 — Contabilidad + Contactos (EN PROGRESO)

> **Rama activa:** `feat/fase-2-contabilidad-contactos`
> **Inicio:** ~17 marzo 2026
> **Estimacion:** ~6 semanas total

### Progreso General Fase 2

| Modulo       | Progreso       | Estado      |
| ------------ | -------------- | ----------- |
| Contactos    | 2 de 3 tareas  | En progreso |
| Contabilidad | 0 de 12 tareas | Pendiente   |

---

### Modulo Contactos

| ID        | Tarea                                       | Estado     | Commit    |
| --------- | ------------------------------------------- | ---------- | --------- |
| **F2-01** | Schema Contactos (4 modelos Prisma)         | Completado | `52fc0a0` |
| **F2-02** | UI Contactos (lista + detalle + CRUD forms) | Completado | `32a52db` |
| **F2-03** | Import Contactos (Excel masivo)             | Pendiente  | —         |

#### F2-01: Schema Contactos — COMPLETADO

**Modelos implementados en `prisma/schema/contacts.prisma`:**

**`PaymentTerms`** — Terminos de pago configurables por empresa

- Campos: `name`, `description`, `daysUntilDue`, `isDefault`, `isActive`
- Seeds iniciales: Contado (0 dias), Neto 15, Neto 30, Neto 60, Personalizado
- Restriccion: `UNIQUE(companyId, name)` — no hay duplicados por empresa
- Multi-tenant: `companyId` + RLS directo

**`Contact`** — Cliente y/o proveedor (dual role)

- Tipo: `NATURAL` (persona fisica) o `JURIDICA` (empresa)
- Roles independientes: `isCustomer` (true/false) + `isSupplier` (true/false)
- RTN Honduras: campo `Citext` nullable — `UNIQUE(companyId, rtn)` con soporte multi-NULL
- Campos: `legalName`, `tradeName`, `email`, `phone`, `website`, `notes`
- FK opcional: `paymentTermsId` para credito por defecto
- Multi-tenant: `companyId` con 6 indices optimizados

**`ContactAddress`** — Direcciones multiples por contacto

- Tipos: `BILLING` (facturacion), `SHIPPING` (entrega), `OFFICE`, `OTHER`
- `company_id` desnormalizado para RLS sin JOIN al padre
- Campos Honduras-centric: `addressLine1/2`, `city`, `department`, `country` (default HN), `postalCode`
- Soporte `isDefault` por tipo de direccion

**`ContactPerson`** — Personas de contacto multiples

- `company_id` desnormalizado para RLS sin JOIN al padre
- Campos: `fullName`, `jobTitle`, `email`, `phone`, `isPrimary`, `isActive`

**Validacion RTN Honduras:**

- Formato: `DDDD-DDDD-DDDDD` (14 digitos con guiones)
- Implementado en schema Zod con regex: `/^\d{4}-\d{4}-\d{5}$/`
- Almacenado como `Citext` (case-insensitive) en PostgreSQL
- Nullable: contactos extranjeros sin RTN hondureno

#### F2-02: UI Contactos — COMPLETADO

**4 paginas implementadas:**

| Pagina              | Ruta                  | Descripcion                                                     |
| ------------------- | --------------------- | --------------------------------------------------------------- |
| Lista de contactos  | `/contacts`           | TanStack Table con filtros por tipo/rol, busqueda, paginacion   |
| Detalle de contacto | `/contacts/[id]`      | 3 tabs: Info General, Direcciones, Personas de Contacto         |
| Crear contacto      | `/contacts/new`       | Formulario con React Hook Form + Zod, seleccion de tipo y roles |
| Editar contacto     | `/contacts/[id]/edit` | Mismo formulario pre-poblado con datos existentes               |

**Endpoints REST implementados (16 endpoints en 9 route handlers):**

| Metodo   | Ruta                                          | Descripcion                     | Permisos                           |
| -------- | --------------------------------------------- | ------------------------------- | ---------------------------------- |
| `GET`    | `/api/v1/contacts`                            | Lista paginada de contactos     | Todos los roles                    |
| `POST`   | `/api/v1/contacts`                            | Crear contacto                  | Admin, Gerente, Contador, Vendedor |
| `GET`    | `/api/v1/contacts/[id]`                       | Detalle de contacto             | Todos los roles                    |
| `PUT`    | `/api/v1/contacts/[id]`                       | Actualizar contacto             | Admin, Gerente, Contador, Vendedor |
| `DELETE` | `/api/v1/contacts/[id]`                       | Eliminar contacto (soft delete) | Admin, Gerente                     |
| `GET`    | `/api/v1/contacts/[id]/addresses`             | Lista de direcciones            | Todos los roles                    |
| `POST`   | `/api/v1/contacts/[id]/addresses`             | Agregar direccion               | Admin, Gerente, Contador, Vendedor |
| `PUT`    | `/api/v1/contacts/[id]/addresses/[addressId]` | Actualizar direccion            | Admin, Gerente, Contador, Vendedor |
| `DELETE` | `/api/v1/contacts/[id]/addresses/[addressId]` | Eliminar direccion              | Admin, Gerente                     |
| `GET`    | `/api/v1/contacts/[id]/persons`               | Lista de personas de contacto   | Todos los roles                    |
| `POST`   | `/api/v1/contacts/[id]/persons`               | Agregar persona                 | Admin, Gerente, Contador, Vendedor |
| `PUT`    | `/api/v1/contacts/[id]/persons/[personId]`    | Actualizar persona              | Admin, Gerente, Contador, Vendedor |
| `DELETE` | `/api/v1/contacts/[id]/persons/[personId]`    | Eliminar persona                | Admin, Gerente                     |
| `GET`    | `/api/v1/contacts/payment-terms`              | Lista de terminos de pago       | Todos los roles                    |
| `POST`   | `/api/v1/contacts/payment-terms`              | Crear termino de pago           | Admin, Gerente, Contador           |
| `PUT`    | `/api/v1/contacts/payment-terms/[id]`         | Actualizar termino de pago      | Admin, Gerente, Contador           |

**Aislamiento multi-tenant:**

- Todos los endpoints verifican `company_id` del JWT Cognito
- Prisma Extension filtra automaticamente por tenant en todas las queries
- RLS PostgreSQL como segunda capa de defensa
- `ContactAddress` y `ContactPerson` tienen `company_id` desnormalizado para RLS directo sin JOIN

#### F2-03: Import Contactos (Excel) — PENDIENTE

- Subida de archivo Excel (.xlsx) con validacion de columnas
- Procesamiento asincrono via SQS + Lambda
- Reporte de importacion (exitosos, errores, duplicados)
- Validacion RTN por fila
- Estimacion: ~3-4 dias de desarrollo

---

### Modulo Contabilidad — PENDIENTE

| ID        | Tarea                           | Estado    | Descripcion                                                                                        |
| --------- | ------------------------------- | --------- | -------------------------------------------------------------------------------------------------- |
| **F2-04** | Schema Contabilidad             | Pendiente | Account, FiscalYear, FiscalPeriod, Journal, JournalEntry, JournalEntryLine, Currency, ExchangeRate |
| **F2-05** | Seed Honduras ~200 cuentas NIIF | Pendiente | Plan de cuentas NIIF para PYMEs estandar Honduras                                                  |
| **F2-06** | UI Plan de Cuentas              | Pendiente | Arbol jerarquico de cuentas (TanStack Table tree mode)                                             |
| **F2-07** | Anos Fiscales (CRUD)            | Pendiente | Apertura y cierre de periodos fiscales                                                             |
| **F2-08** | Asientos contables              | Pendiente | Partida doble, validacion cuadre debito=credito                                                    |
| **F2-09** | Multimoneda                     | Pendiente | HNL + USD + tasas de cambio diarias BCH                                                            |
| **F2-10** | Reportes financieros            | Pendiente | Balance General, Estado de Resultados, Flujo de Efectivo                                           |
| **F2-11** | Exportacion PDF + Excel         | Pendiente | Lambda para generacion PDF, S3 para almacenamiento                                                 |
| **F2-12** | Conciliacion Bancaria           | Pendiente | Match de transacciones banco vs asientos contables                                                 |
| **F2-13** | Conciliacion CxC                | Pendiente | Estado de cuenta de clientes, aplicacion de pagos                                                  |
| **F2-14** | Conciliacion CxP                | Pendiente | Estado de cuenta de proveedores, aplicacion de pagos                                               |
| **F2-15** | Tests Fase 2                    | Pendiente | Tests unitarios e integracion del modulo contabilidad                                              |

---

## Arquitectura Tecnica

### Stack Tecnologico

| Capa                | Tecnologia                          | Version   |
| ------------------- | ----------------------------------- | --------- |
| Frontend Framework  | Next.js App Router                  | 15.x      |
| UI Library          | React                               | 19.x      |
| Lenguaje            | TypeScript                          | 5+        |
| UI Components       | shadcn/ui + Tailwind CSS + Radix UI | 4.x       |
| Estado global       | Zustand                             | 5.x       |
| Data fetching       | TanStack Query                      | v5        |
| Tablas              | TanStack Table                      | v8        |
| Formularios         | React Hook Form + Zod               | 7.x / 3.x |
| ORM                 | Prisma (multi-file schema)          | 6.x       |
| Auth                | Amazon Cognito (JWT)                | —         |
| Base de datos       | Amazon RDS PostgreSQL + RDS Proxy   | 16        |
| Hosting             | AWS Amplify Gen 2                   | —         |
| CI/CD               | GitHub Actions + Amplify Build      | —         |
| Procesamiento async | AWS SQS + Lambda                    | —         |
| Email               | AWS SES                             | —         |
| Eventos             | AWS EventBridge                     | —         |
| Storage             | AWS S3 + CloudFront                 | —         |
| Seguridad           | AWS WAF + Shield                    | —         |

### Estructura del Repositorio

```
amplify/            # IaC Amplify Gen 2 (auth, functions, storage)
prisma/
  schema/           # Multi-file schema modular
    base.prisma     # Datasource, generator, enums globales
    core.prisma     # Company, User, AuditLog, Module, etc.
    contacts.prisma # PaymentTerms, Contact, ContactAddress, ContactPerson
  migrations/       # Migraciones declarativas
src/
  app/
    (dashboard)/    # Rutas del dashboard (layout autenticado)
      contacts/     # NUEVO: Modulo Contactos UI
    api/v1/         # REST endpoints API-first
      contacts/     # NUEVO: 9 route handlers de contactos
      core/         # Users, Tenant
  lib/              # auth, db, validators, permissions, utils
  components/ui/    # shadcn/ui components
  types/            # TypeScript types globales
docs/               # Documentacion del proyecto
```

---

## Roles RBAC

| Rol               | Descripcion                      | Permisos principales                                                |
| ----------------- | -------------------------------- | ------------------------------------------------------------------- |
| **Administrador** | Control total del sistema        | CRUD en todos los modulos, configuracion empresa, usuarios, modulos |
| **Gerente**       | Supervision y aprobaciones       | Lectura total, edicion operativa, reportes, aprobaciones            |
| **Contador**      | Operaciones contables y fiscales | CRUD contabilidad, facturacion, compras, reportes financieros       |
| **Vendedor**      | Gestion comercial                | CRUD contactos, cotizaciones, pedidos, facturas de venta            |
| **Auditor**       | Solo lectura para trazabilidad   | Lectura total + logs de auditoria (sin modificaciones)              |

---

## Proximos Pasos

### Inmediato (esta semana)

1. **F2-03** — Import masivo de contactos desde Excel
2. **F2-04** — Disenar y crear schema de contabilidad en Prisma

### Corto plazo (proximas 2 semanas)

3. **F2-05** — Seed del plan de cuentas NIIF Honduras (~200 cuentas)
4. **F2-06** — UI del plan de cuentas con arbol jerarquico
5. **F2-07** — CRUD de anos y periodos fiscales

### Mediano plazo (proximas 4-6 semanas)

6. **F2-08 a F2-15** — Asientos contables, multimoneda, reportes, exportaciones, conciliaciones, tests

---

## Referencias

| Documento               | Ubicacion                                |
| ----------------------- | ---------------------------------------- |
| Requerimientos maestros | `docs/REQUIREMENTS.md`                   |
| Arquitectura y ADRs     | `docs/ARCHITECTURE.md`                   |
| Resumen Fase 1          | `docs/FASE-1-CORE-SYSTEM-SUMMARY.md`     |
| Specs Fase 0            | `docs/specs/fase-0/`                     |
| Guia de staging         | `docs/infra/STAGING-DEPLOY-GUIDE.md`     |
| Costos estimados        | `docs/infra/COSTOS-ESTIMADOS-STAGING.md` |
| Template Notion Fase 1  | `docs/NOTION-TEMPLATE-FASE-1.md`         |

---

_Documento generado automaticamente por Claude Code (Doc Engineer)_
_Fecha: 24 de marzo de 2026 | Proyecto: NexoERP | Version en progreso: 0.2.x_
