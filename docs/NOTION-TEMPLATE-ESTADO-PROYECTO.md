# NexoERP — Estado del Proyecto (Marzo 2026)

> **Copia este documento completo y pegalo en Notion (Create page > Paste Markdown)**
> **Fecha de actualizacion:** 27 de marzo de 2026
> **Preparado por:** Claude Code (Doc Engineer)
> **Rama activa:** `feat/fase-2-contabilidad-contactos`
> **Ultimo commit:** `feat(accounting): add financial reports (balance sheet + income statement) (f2-11)`

---

## Resumen Ejecutivo

**NexoERP** es un ERP multi-tenant en la nube para PYMEs hondurenas con cumplimiento fiscal SAR y contabilidad NIIF. Actualmente en **Fase 2 de 5**, con la Fase 1 completada exitosamente, el Modulo de Contactos completado y el Modulo de Contabilidad en progreso acelerado (F2-04 a F2-11 completados).

### Metricas Generales del Proyecto

| Metrica               | Valor                                                                                                                                                                                                                                                                                             |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Fases completadas** | 1 de 5 (Fase 0 + Fase 1)                                                                                                                                                                                                                                                                          |
| **Fase en progreso**  | Fase 2 — Contabilidad + Contactos                                                                                                                                                                                                                                                                 |
| **Endpoints REST**    | 47 endpoints (7 core + 17 contactos + 2 import + 21 contabilidad)                                                                                                                                                                                                                                 |
| **Modelos Prisma**    | 19 modelos (Company, User, AuditLog, Module, CompanyModule, Permission, RolePermission, PaymentTerms, Contact, ContactAddress, ContactPerson, Currency, ExchangeRate, Account, FiscalYear, FiscalPeriod, Journal, JournalEntry, JournalEntryLine, JournalSequence — mas enums AccountType/Nature) |
| **Migraciones**       | 4 (core, contacts, accounting-base, journal-sequences-cancellation)                                                                                                                                                                                                                               |
| **Ambiente staging**  | AWS Amplify (activo)                                                                                                                                                                                                                                                                              |
| **Presupuesto AWS**   | ~$1.35/mes con Free Tier activo                                                                                                                                                                                                                                                                   |
| **Repositorio**       | GitHub — rama principal: `main`                                                                                                                                                                                                                                                                   |

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

---

## Fase 2 — Contabilidad + Contactos (EN PROGRESO)

> **Rama activa:** `feat/fase-2-contabilidad-contactos`
> **Inicio:** ~17 marzo 2026
> **Estimacion:** ~6 semanas total

### Progreso General Fase 2

| Modulo       | Completado | Total tareas | Estado      |
| ------------ | ---------- | ------------ | ----------- |
| Contactos    | 3          | 3            | Completo    |
| Contabilidad | 8          | 12           | En progreso |

---

### Modulo Contactos — COMPLETADO

| ID        | Tarea                                       | Estado     |
| --------- | ------------------------------------------- | ---------- |
| **F2-01** | Schema Contactos (4 modelos Prisma)         | Completado |
| **F2-02** | UI Contactos (lista + detalle + CRUD forms) | Completado |
| **F2-03** | Import Contactos (Excel masivo)             | Completado |

Ver detalle completo de Contactos en la version anterior de este documento (25 marzo 2026). Los 3 entregables estan en produccion en staging.

---

### Modulo Contabilidad — EN PROGRESO

| ID        | Tarea                                  | Estado     | Descripcion resumida                                                                               |
| --------- | -------------------------------------- | ---------- | -------------------------------------------------------------------------------------------------- |
| **F2-04** | Schema Contabilidad (8 modelos Prisma) | Completado | Currency, ExchangeRate, Account, FiscalYear, FiscalPeriod, Journal, JournalEntry, JournalEntryLine |
| **F2-05** | Seed Plan de Cuentas NIIF Honduras     | Completado | ~200 cuentas NIIF para PYMEs, seed por empresa                                                     |
| **F2-06** | UI Plan de Cuentas                     | Completado | Arbol jerarquico con TanStack Table tree mode                                                      |
| **F2-07** | Anos Fiscales + Periodos (CRUD)        | Completado | Apertura/cierre de anos fiscales, 12 periodos mensuales                                            |
| **F2-08** | Diarios Contables (CRUD)               | Completado | 7 diarios seeded (DJ, LV, LC, CA, BK, NM, AJ), CRUD + UI                                           |
| **F2-09** | Asientos Contables (partida doble)     | Completado | Ciclo DRAFT -> POSTED -> CANCELLED, numeracion atomica                                             |
| **F2-10** | Tipos de Cambio + Multimoneda          | Completado | HNL + USD, tasas globales y por empresa, lookup con fallback                                       |
| **F2-11** | Reportes Financieros                   | Completado | Balance General + Estado de Resultados, propagacion bottom-up                                      |
| **F2-12** | Exportacion PDF + Excel                | Pendiente  | Lambda PDF, S3 almacenamiento, export Excel                                                        |
| **F2-13** | Conciliacion Bancaria                  | Pendiente  | Match transacciones banco vs asientos                                                              |
| **F2-14** | CxC / CxP Aging                        | Pendiente  | Estado de cuenta clientes y proveedores, aging por vencimiento                                     |
| **F2-15** | Tests Modulo Contabilidad              | Pendiente  | Tests unitarios e integracion modulo contabilidad                                                  |

---

### F2-08: Diarios Contables — COMPLETADO

**7 diarios seeded por empresa (en `prisma/seed/`):**

| Codigo | Nombre            | Tipo       |
| ------ | ----------------- | ---------- |
| DJ     | Diario General    | GENERAL    |
| LV     | Libro de Ventas   | SALES      |
| LC     | Libro de Compras  | PURCHASES  |
| CA     | Diario de Caja    | CASH       |
| BK     | Diario de Bancos  | BANK       |
| NM     | Diario de Nomina  | PAYROLL    |
| AJ     | Diario de Ajustes | ADJUSTMENT |

**Endpoints REST implementados:**

| Metodo   | Ruta                               | Descripcion                       | Permisos        |
| -------- | ---------------------------------- | --------------------------------- | --------------- |
| `GET`    | `/api/v1/accounting/journals`      | Lista diarios del tenant          | Todos los roles |
| `POST`   | `/api/v1/accounting/journals`      | Crear diario                      | Admin, Gerente  |
| `GET`    | `/api/v1/accounting/journals/[id]` | Detalle de diario                 | Todos los roles |
| `PUT`    | `/api/v1/accounting/journals/[id]` | Actualizar diario                 | Admin, Gerente  |
| `DELETE` | `/api/v1/accounting/journals/[id]` | Eliminar diario (si sin asientos) | Admin           |

**UI:** Pagina de lista con CRUD, sidebar de contabilidad con acceso directo.

---

### F2-09: Asientos Contables — COMPLETADO

**Ciclo de vida del asiento:**

```
DRAFT  -->  POSTED  -->  CANCELLED
  |                           ^
  +------ (cancelacion) ------+
```

- `DRAFT`: borrador editable, no afecta saldos contables
- `POSTED`: contabilizado, inmutable, afecta saldos; requiere partida doble (totalDebit = totalCredit)
- `CANCELLED`: anulado mediante contraasiento automatico; el asiento original queda con estado CANCELLED

**Modelos Prisma nuevos:**

- `JournalEntry` — cabecera del asiento con campos `entryNumber`, `status`, `postedBy`, `cancelledById`
- `JournalSequence` — contador atomico por `(companyId, journalId)`, clave primaria compuesta

**Migracion:** `20260327171502_add_journal_sequences_and_cancellation`

**Numeracion atomica (`$queryRaw`):**

El servicio usa `INSERT ... ON CONFLICT DO UPDATE ... RETURNING` para garantizar que dos asientos concurrentes del mismo diario nunca obtengan el mismo `entryNumber`, incluso en entorno serverless con multiples instancias Lambda.

**7 metodos del service (`journal-entry.service.ts`):**

| Metodo        | Descripcion                                                             |
| ------------- | ----------------------------------------------------------------------- |
| `listEntries` | Lista paginada con filtros por diario, periodo, estado, fecha           |
| `getEntry`    | Detalle con lineas y datos relacionados                                 |
| `createEntry` | Crea asiento en DRAFT con lineas; asigna entryNumber atomicamente       |
| `updateEntry` | Actualiza asiento en DRAFT (no permite editar POSTED)                   |
| `deleteEntry` | Elimina asiento en DRAFT (no permite eliminar POSTED)                   |
| `postEntry`   | Publica asiento: valida partida doble, calcula totales, cambia a POSTED |
| `cancelEntry` | Anula asiento POSTED: genera contraasiento espejo, marca CANCELLED      |

**Endpoints REST implementados:**

| Metodo   | Ruta                                             | Descripcion                            | Permisos                 |
| -------- | ------------------------------------------------ | -------------------------------------- | ------------------------ |
| `GET`    | `/api/v1/accounting/journal-entries`             | Lista asientos (paginada, con filtros) | Todos los roles          |
| `POST`   | `/api/v1/accounting/journal-entries`             | Crear asiento en DRAFT                 | Admin, Gerente, Contador |
| `GET`    | `/api/v1/accounting/journal-entries/[id]`        | Detalle con lineas                     | Todos los roles          |
| `PUT`    | `/api/v1/accounting/journal-entries/[id]`        | Actualizar asiento DRAFT               | Admin, Gerente, Contador |
| `DELETE` | `/api/v1/accounting/journal-entries/[id]`        | Eliminar asiento DRAFT                 | Admin, Gerente, Contador |
| `POST`   | `/api/v1/accounting/journal-entries/[id]/post`   | Publicar asiento (DRAFT -> POSTED)     | Admin, Gerente, Contador |
| `POST`   | `/api/v1/accounting/journal-entries/[id]/cancel` | Anular asiento (POSTED -> CANCELLED)   | Admin, Gerente           |

**UI:** Formulario de partida doble con balance en tiempo real (debit != credit muestra alerta), pagina de listado con acciones de publicar/anular inline.

**Deuda tecnica resuelta (pre-F2-09):**

- Capa 2 multi-tenancy: todos los servicios contables ahora usan `createTenantPrisma` correctamente
- 13 permisos RBAC de contabilidad agregados al seed (`accounting.*`)
- `handle-error.ts` extendido con entidades contables (Account, Journal, JournalEntry, FiscalYear, FiscalPeriod)
- Handlers API corregidos: parseo de body con Zod directamente en route handlers (no en service)

---

### F2-10: Tipos de Cambio — COMPLETADO

**Modelo de datos (`ExchangeRate`):**

- `companyId` es **nullable**: `NULL` = tasa global de plataforma; UUID = tasa especifica de empresa
- El modelo fue removido de `BUSINESS_MODELS` (lista de modelos con `companyId` obligatorio) porque la extension Prisma no puede filtrar automaticamente un campo nullable
- El servicio filtra manualmente: `WHERE companyId = :id OR companyId IS NULL`
- RLS cubre ambos casos con politica: `company_id IS NULL OR company_id = current_setting('app.current_company_id')`

**4 metodos del service (`exchange-rate.service.ts`):**

| Metodo       | Descripcion                                                                                   |
| ------------ | --------------------------------------------------------------------------------------------- |
| `listRates`  | Lista tasas propias de empresa + tasas globales (companyId IS NULL), paginado                 |
| `upsertRate` | Crea o actualiza tasa por (currencyCode, date, companyId); empresa puede sobreescribir global |
| `deleteRate` | Elimina tasa; solo Admin puede eliminar tasas globales                                        |
| `lookupRate` | Busca tasa para fecha: empresa primero, fallback a global; error si no existe                 |

**Endpoints REST implementados:**

| Metodo   | Ruta                                       | Descripcion                                         | Permisos                 |
| -------- | ------------------------------------------ | --------------------------------------------------- | ------------------------ |
| `GET`    | `/api/v1/accounting/exchange-rates`        | Lista tasas (propias + globales)                    | Todos los roles          |
| `POST`   | `/api/v1/accounting/exchange-rates`        | Crear o actualizar tasa (upsert por moneda+fecha)   | Admin, Gerente, Contador |
| `DELETE` | `/api/v1/accounting/exchange-rates/[id]`   | Eliminar tasa                                       | Admin, Gerente           |
| `GET`    | `/api/v1/accounting/exchange-rates/lookup` | Buscar tasa para fecha especifica (con fallback)    | Todos los roles          |
| `GET`    | `/api/v1/accounting/currencies`            | Catalogo de monedas activas (global, sin companyId) | Todos los roles          |

**Mejora en formulario de asientos:** El `journal-entry-form` incluye un selector de moneda que hace `auto-fetch` de la tasa via el endpoint `lookup`, evitando que el usuario ingrese la tasa manualmente.

**UI:** Pagina con tabla dividida en dos secciones (Global / Empresa), formulario `ExchangeRateForm` con selector de moneda y fecha.

---

### F2-11: Reportes Financieros — COMPLETADO

**2 reportes implementados (`financial-report.service.ts`):**

#### Balance General (`getBalanceSheet`)

- Solo considera asientos con `status = POSTED`
- Corte a una fecha especifica (`asOfDate`): suma movimientos desde el inicio hasta esa fecha
- Secciones: ASSET (Activos), LIABILITY (Pasivos), EQUITY (Patrimonio)
- Propagacion bottom-up: los saldos de cuentas hoja se acumulan automaticamente en cuentas padre
- Campo `isBalanced`: verifica que `totalAssets ≈ totalLiabilitiesAndEquity` (tolerancia 0.01 HNL)

#### Estado de Resultados (`getIncomeStatement`)

- Solo considera asientos con `status = POSTED`
- Rango de fechas (`dateFrom`, `dateTo`)
- Secciones: INCOME (Ingresos), COST (Costo de Ventas), EXPENSE (Gastos)
- Calcula: Utilidad Bruta = Ingresos - Costos; Utilidad Neta = Utilidad Bruta - Gastos
- Indicador visual de Utilidad o Perdida en la UI

**Endpoints REST implementados:**

| Metodo | Ruta                                          | Descripcion                              | Permisos        |
| ------ | --------------------------------------------- | ---------------------------------------- | --------------- |
| `GET`  | `/api/v1/accounting/reports/balance-sheet`    | Balance General al corte de fecha        | Todos los roles |
| `GET`  | `/api/v1/accounting/reports/income-statement` | Estado de Resultados por rango de fechas | Todos los roles |

**Query params:**

- `balance-sheet`: `?asOfDate=YYYY-MM-DD`
- `income-statement`: `?dateFrom=YYYY-MM-DD&dateTo=YYYY-MM-DD`

**UI:** Pagina con Tabs (Balance General / Estado de Resultados), arbol de cuentas con sangria por nivel de jerarquia, badge indicador de Utilidad (verde) o Perdida (rojo).

---

## Resumen de Endpoints REST — Contabilidad (F2-04 a F2-11)

| Metodo   | Ruta                                                      | Modulo            |
| -------- | --------------------------------------------------------- | ----------------- |
| `GET`    | `/api/v1/accounting/accounts`                             | Plan de Cuentas   |
| `POST`   | `/api/v1/accounting/accounts`                             | Plan de Cuentas   |
| `GET`    | `/api/v1/accounting/fiscal-years`                         | Anos Fiscales     |
| `POST`   | `/api/v1/accounting/fiscal-years`                         | Anos Fiscales     |
| `GET`    | `/api/v1/accounting/fiscal-years/[id]`                    | Anos Fiscales     |
| `PUT`    | `/api/v1/accounting/fiscal-years/[id]`                    | Anos Fiscales     |
| `POST`   | `/api/v1/accounting/fiscal-years/[id]/activate`           | Anos Fiscales     |
| `POST`   | `/api/v1/accounting/fiscal-years/[id]/close`              | Anos Fiscales     |
| `GET`    | `/api/v1/accounting/fiscal-years/[id]/periods/[periodId]` | Periodos Fiscales |
| `GET`    | `/api/v1/accounting/journals`                             | Diarios           |
| `POST`   | `/api/v1/accounting/journals`                             | Diarios           |
| `GET`    | `/api/v1/accounting/journals/[id]`                        | Diarios           |
| `PUT`    | `/api/v1/accounting/journals/[id]`                        | Diarios           |
| `DELETE` | `/api/v1/accounting/journals/[id]`                        | Diarios           |
| `GET`    | `/api/v1/accounting/journal-entries`                      | Asientos          |
| `POST`   | `/api/v1/accounting/journal-entries`                      | Asientos          |
| `GET`    | `/api/v1/accounting/journal-entries/[id]`                 | Asientos          |
| `PUT`    | `/api/v1/accounting/journal-entries/[id]`                 | Asientos          |
| `DELETE` | `/api/v1/accounting/journal-entries/[id]`                 | Asientos          |
| `POST`   | `/api/v1/accounting/journal-entries/[id]/post`            | Asientos          |
| `POST`   | `/api/v1/accounting/journal-entries/[id]/cancel`          | Asientos          |
| `GET`    | `/api/v1/accounting/exchange-rates`                       | Tipos de Cambio   |
| `POST`   | `/api/v1/accounting/exchange-rates`                       | Tipos de Cambio   |
| `DELETE` | `/api/v1/accounting/exchange-rates/[id]`                  | Tipos de Cambio   |
| `GET`    | `/api/v1/accounting/exchange-rates/lookup`                | Tipos de Cambio   |
| `GET`    | `/api/v1/accounting/currencies`                           | Monedas           |
| `GET`    | `/api/v1/accounting/reports/balance-sheet`                | Reportes          |
| `GET`    | `/api/v1/accounting/reports/income-statement`             | Reportes          |

**Total endpoints contabilidad:** 28

---

## Decisiones Arquitectonicas Clave (Fase 2)

### DAR-ACCT-001: ExchangeRate fuera de BUSINESS_MODELS

**Decision:** El modelo `ExchangeRate` tiene `companyId` nullable (`NULL` = tasa global de plataforma) y fue excluido de la lista `BUSINESS_MODELS` que usa la extension Prisma para el filtrado automatico multi-tenant.

**Por que:** La extension Prisma solo puede inyectar `WHERE companyId = :id` en modelos donde el campo es obligatorio. Con `companyId` nullable, el filtro automatico ocultaria las tasas globales a todas las empresas, rompiendo el comportamiento de fallback deseado.

**Consecuencia:** El servicio `exchange-rate.service.ts` filtra manualmente con `OR: [{ companyId }, { companyId: null }]`. La politica RLS usa `company_id IS NULL OR company_id = current_setting(...)` para cubrir ambos casos en la capa de base de datos.

**Patron reutilizable:** Cualquier catalogo global de plataforma (monedas, departamentos de Honduras, tasas SAR) debe seguir este mismo patron: `companyId` nullable, excluido de BUSINESS_MODELS, filtrado manual en service.

---

### DAR-ACCT-002: Numeracion Atomica de Asientos via $queryRaw

**Decision:** El numero de asiento (`entryNumber`) se asigna mediante `INSERT INTO journal_sequences ... ON CONFLICT DO UPDATE ... RETURNING` ejecutado via `prisma.$queryRaw` dentro de la misma transaccion de creacion del asiento.

**Por que:** En un entorno serverless (Next.js en Amplify + posibles Lambdas), multiples instancias concurrentes pueden intentar crear asientos en el mismo diario simultaneamente. Un simple `SELECT max(entryNumber) + 1` tiene race condition entre el SELECT y el INSERT. La instruccion SQL con `ON CONFLICT DO UPDATE` es atomica a nivel de fila en PostgreSQL y garantiza secuencialidad sin locks de tabla.

**Consecuencia:** `JournalSequence` es una tabla de contadores con clave primaria `(companyId, journalId)`. Es la unica tabla del schema que usa `$queryRaw` (todos los demas usos son via API Prisma). Los numeros de asiento son consecutivos y nunca se repiten dentro del mismo diario de una empresa.

---

### DAR-ACCT-003: Propagacion Bottom-Up en Reportes Financieros

**Decision:** Los reportes Balance General y Estado de Resultados calculan los saldos de cuentas padre acumulando bottom-up los saldos de sus cuentas hija en memoria, no mediante una query SQL recursiva (CTE).

**Por que:** El plan de cuentas NIIF de una PYME hondurena tiene entre 3 y 5 niveles de jerarquia. Hacer una CTE recursiva con JOIN a `journal_entry_lines` por cada nivel seria costosa y dificil de mantener. En cambio, la query trae todas las cuentas activas con sus saldos de lineas de asiento en una sola consulta, y la logica de propagacion se ejecuta en JavaScript con un pase bottom-up sobre el arbol.

**Consecuencia:** El servicio carga en memoria todas las cuentas del plan de cuentas de la empresa + sus saldos. Para PYMEs con 150-300 cuentas esto es trivial (~50KB). Si en el futuro se necesitan empresas con miles de cuentas, se puede migrar a CTE SQL sin cambiar la interfaz del servicio.

---

### DAR-ACCT-004: company_id Desnormalizado en Tablas Hijas

**Decision:** Las tablas hijas `FiscalPeriod`, `JournalEntryLine`, `ContactAddress` y `ContactPerson` tienen `company_id` desnormalizado (redundante con el de su tabla padre).

**Por que:** Las politicas RLS de PostgreSQL operan sobre la fila actual. Sin `company_id` en la fila, RLS tendria que hacer un JOIN a la tabla padre para verificar la empresa, lo que rompe el modelo de seguridad declarativo y agrega costo a cada SELECT.

**Consecuencia:** Al crear registros hijos, el servicio debe propagar el `companyId` del padre explicitamente. Este patron esta consolidado y documentado en todos los servicios contables y de contactos.

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

### Schema Prisma — Modulo Contabilidad

```
prisma/schema/accounting.prisma
  |
  +-- Currency              (global, sin companyId, catalogo plataforma)
  +-- ExchangeRate          (companyId NULLABLE — global o por empresa)
  +-- Account               (companyId obligatorio — plan de cuentas NIIF)
  |     +-- Account (self)  (jerarquia recursiva padre/hijos)
  |
  +-- FiscalYear            (companyId obligatorio — ano fiscal)
  |     +-- FiscalPeriod    (companyId desnormalizado — mes contable)
  |           +-- JournalEntry
  |
  +-- Journal               (companyId obligatorio — libro de diario)
  |     +-- JournalSequence (PK compuesta: companyId + journalId)
  |     +-- JournalEntry    (companyId obligatorio — asiento cabecera)
  |           +-- JournalEntryLine (companyId desnormalizado — linea debito/credito)
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

**Permisos RBAC de contabilidad agregados (13 permisos en seed):**

- `accounting.accounts.read` / `create` / `update` / `delete`
- `accounting.journals.read` / `create` / `update` / `delete`
- `accounting.journal-entries.read` / `create` / `update` / `post` / `cancel`

---

## Proximos Pasos

### Inmediato — F2-12: Exportacion PDF y Excel

- Lambda para generacion de PDF del Balance General y Estado de Resultados
- Descarga directa de Excel (.xlsx) via servicio en memory (sin Lambda)
- S3 para almacenamiento temporal de PDFs generados
- Endpoints: `GET /api/v1/accounting/reports/balance-sheet/export?format=pdf|xlsx`

### Corto plazo — F2-13: Conciliacion Bancaria

- Match de movimientos bancarios importados (CSV/OFX) vs asientos contables POSTED
- Estado: pendiente, conciliado, en disputa
- Endpoints: `/api/v1/accounting/bank-reconciliation`
- UI: tabla de dos columnas (banco vs contabilidad) con lineas de match

### Mediano plazo — F2-14: CxC / CxP Aging

- Estado de cuenta de clientes (Cuentas por Cobrar): facturas pendientes + pagos aplicados
- Estado de cuenta de proveedores (Cuentas por Pagar): facturas recibidas + pagos realizados
- Aging report: vencimiento por rangos (0-30, 31-60, 61-90, 90+ dias)
- Endpoints: `/api/v1/accounting/aging/receivables` y `/api/v1/accounting/aging/payables`

### Cierre de Fase 2 — F2-15: Tests Modulo Contabilidad

- Tests unitarios: servicios de asientos, reportes, tipos de cambio
- Tests de integracion: ciclo completo DRAFT -> POSTED -> CANCELLED
- Tests de aislamiento tenant: asientos de Empresa A no visibles para Empresa B
- Meta: mantener 100% de tests pasando al cerrar la rama

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
_Fecha: 27 de marzo de 2026 | Proyecto: NexoERP | Version en progreso: 0.2.x_
