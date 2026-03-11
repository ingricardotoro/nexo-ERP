# NexoERP — Documento de Requerimientos del Sistema

> **Versión:** 0.3.0
> **Fecha:** 2026-03-09
> **Autor:** Equipo NexoERP
> **Estado:** Borrador
> **País objetivo:** Honduras 🇭🇳

---

## Tabla de Contenidos

1. [Visión General](#1-visión-general)
2. [Objetivos del Proyecto](#2-objetivos-del-proyecto)
3. [Alcance](#3-alcance)
4. [Arquitectura del Sistema](#4-arquitectura-del-sistema)
5. [Stack Tecnológico](#5-stack-tecnológico)
6. [Servicios AWS](#6-servicios-aws)
7. [Requerimientos Funcionales](#7-requerimientos-funcionales)
8. [Requerimientos No Funcionales](#8-requerimientos-no-funcionales)
9. [Seguridad de Infraestructura AWS](#9-seguridad-de-infraestructura-aws)
10. [Requerimientos Fiscales Honduras](#10-requerimientos-fiscales-honduras)
11. [Modelo de Multi-tenencia](#11-modelo-de-multi-tenencia)
12. [Sistema de Módulos](#12-sistema-de-módulos)
13. [Módulos del Sistema](#13-módulos-del-sistema)
14. [Funcionalidades Transversales](#14-funcionalidades-transversales)
15. [Ambientes de Despliegue](#15-ambientes-de-despliegue)
16. [Herramientas de Desarrollo](#16-herramientas-de-desarrollo)
17. [Fases de Implementación](#17-fases-de-implementación)
18. [Criterios de Aceptación](#18-criterios-de-aceptación)
19. [Glosario](#19-glosario)

---

## 1. Visión General

**NexoERP** es un sistema de Planificación de Recursos Empresariales (ERP) modular, basado en web, diseñado específicamente para pequeñas y medianas empresas (PYMEs) en Honduras. El sistema se presenta como una alternativa moderna a Odoo, manteniendo su filosofía de modularidad y facilidad de uso, pero desarrollado desde cero con tecnologías actuales.

El sistema soportará dos modos de operación:

- **Cloud (Multi-tenencia):** Múltiples empresas en una sola instancia de base de datos, segregadas por identificador de compañía.
- **On-Premise:** Instalación en el servidor local de la empresa, con una base de datos por instancia.

---

## 2. Objetivos del Proyecto

| ID     | Objetivo                                                                                   | Prioridad |
| ------ | ------------------------------------------------------------------------------------------ | --------- |
| OBJ-01 | Proveer un ERP modular y escalable para PYMEs hondureñas                                   | Alta      |
| OBJ-02 | Cumplir con los requisitos fiscales del SAR de Honduras (CAI, ISV, DET)                    | Alta      |
| OBJ-03 | Soportar despliegue dual: Cloud (multi-tenant) y On-Premise                                | Alta      |
| OBJ-04 | Ofrecer una experiencia de usuario moderna tipo dashboard (estilo Notion/Odoo 17)          | Alta      |
| OBJ-05 | Permitir activación/desactivación de módulos por empresa cliente                           | Alta      |
| OBJ-06 | Implementar contabilidad completa bajo NIIF para PYMEs                                     | Alta      |
| OBJ-07 | Soportar multimoneda (HNL + USD) con tasas de cambio configurables                         | Media     |
| OBJ-08 | Garantizar trazabilidad y auditoría completa de todas las operaciones                      | Alta      |
| OBJ-09 | Exportación de reportes en PDF y Excel en todos los módulos                                | Alta      |
| OBJ-10 | Mantener estándares profesionales de desarrollo, testing y documentación                   | Alta      |
| OBJ-11 | Diseñar el backend con arquitectura API-first para soportar futura aplicación móvil nativa | Alta      |

---

## 3. Alcance

### 3.1 Dentro del Alcance (MVP)

- Módulo Core (empresas, usuarios, roles, permisos, menús, módulos)
- Módulo de Contactos (clientes, proveedores, directorio unificado)
- Módulo de Contabilidad (plan de cuentas NIIF, asientos, períodos fiscales, reportes financieros)
- Módulo de Facturación (facturas de venta/compra, notas de crédito/débito, CAI, ISV, libro de ventas/compras)
- Multimoneda (HNL + USD)
- Auditoría transversal
- Exportación PDF/Excel
- Integración con facturación electrónica SAR

### 3.2 Fase Posterior (Post-MVP)

- Módulo de Compras (solicitudes de cotización, órdenes de compra, recepción)
- Módulo de Ventas y CRM (pipeline, presupuestos, pedidos, cobranzas)
- Módulo de Inventarios (almacenes, movimientos, valoración, trazabilidad)
- Módulo de Recursos Humanos (futuro)
- Módulo de Punto de Venta (futuro)
- Aplicación móvil nativa (futuro) — el backend se diseñará API-first desde el MVP para garantizar compatibilidad

### 3.3 Fuera del Alcance

- Integración con sistemas bancarios (transferencias automáticas)
- Comercio electrónico (e-commerce)
- Manufactura / MRP
- Nómina y planillas del IHSS/RAP

---

## 4. Arquitectura del Sistema

### 4.1 Diagrama de Arquitectura de Alto Nivel

```
                        ┌──────────────────────────────┐
                        │      AWS Amplify Gen 2       │
                        │  (Hosting + CI/CD + Auth)     │
                        └──────────┬───────────────────┘
                                   │
           ┌───────────────────────┼───────────────────────┐
           │                       │                       │
    ┌──────▼──────┐   ┌───────────▼──────────┐  ┌────────▼────────┐
    │   Cognito    │   │  Next.js 15 (SSR)    │  │    S3 Storage   │
    │  User Pools  │   │  App Router + API    │  │  (PDFs, logos)  │
    │  + Groups    │   │  Routes + Prisma     │  └─────────────────┘
    └──────────────┘   └───────────┬──────────┘
                                   │
                       ┌───────────▼──────────┐
                       │  RDS PostgreSQL 16    │
                       │  + RDS Proxy          │
                       │  + Row Level Security │
                       └──────────────────────┘
                                   │
        ┌──────────────┬───────────┼──────────────┐
        │              │           │              │
   ┌────▼────┐  ┌──────▼──┐  ┌────▼────┐  ┌─────▼────┐
   │   SQS   │  │  Lambda  │  │   SES   │  │EventBridge│
   │ (colas) │  │ (PDF,bg) │  │ (email) │  │(scheduler)│
   └─────────┘  └─────────┘  └─────────┘  └──────────┘
```

### 4.2 Patrón Arquitectónico

- **Frontend Web:** SPA con SSR (Server-Side Rendering) via Next.js App Router
- **Frontend Móvil (futuro):** Aplicación nativa (React Native u otra tecnología) consumiendo la misma API REST
- **Backend:** API Route Handlers (Next.js) como capa de servicio — diseñados como **API REST bien definida** (API-first) para ser consumida tanto por el frontend web como por futuras aplicaciones móviles
- **Base de Datos:** PostgreSQL relacional con Row-Level Security
- **Multi-tenencia:** Shared schema con columna `company_id` en todas las tablas de negocio + RLS
- **Background Processing:** Arquitectura event-driven con SQS + Lambda
- **Autenticación:** JWT via AWS Cognito (tokens en HTTP-only cookies para SSR web; Bearer tokens para clientes móviles)

### 4.3 Principios Arquitectónicos

1. **Modularidad:** Cada módulo de negocio es independiente y activable por empresa.
2. **Separación de responsabilidades:** UI → API Routes → Business Logic → Data Layer.
3. **Defense in depth (Multi-tenancy):** RLS en PostgreSQL + filtro en Prisma Extension + validación en API.
4. **Event-driven:** Operaciones complejas (PDF, email, cálculos) son asíncronas via colas.
5. **Convention over configuration:** Patrones consistentes que reducen decisiones repetitivas.
6. **Auditabilidad:** Todo registro tiene trazabilidad de quién lo creó, modificó o eliminó.
7. **API-first:** Todos los endpoints de backend se diseñan como API REST estándar (JSON, códigos HTTP semánticos, versionado), documentados con OpenAPI/Swagger, de forma que sean consumibles por cualquier cliente (web, móvil, integraciones de terceros). La lógica de negocio nunca se acopla al framework de frontend.

---

## 5. Stack Tecnológico

### 5.1 Frontend

| Tecnología           | Versión | Propósito                                     |
| -------------------- | ------- | --------------------------------------------- |
| Next.js (App Router) | 15.x    | Framework principal, SSR, routing             |
| React                | 19.x    | Librería de UI                                |
| TypeScript           | 5.x     | Tipado estático                               |
| Tailwind CSS         | 4.x     | Utility-first CSS                             |
| shadcn/ui + Radix UI | latest  | Componentes accesibles                        |
| TanStack Table       | 8.x     | Tablas con sorting, filtering, pagination     |
| TanStack Query       | 5.x     | Server state management, cache                |
| Zustand              | 5.x     | State management global (ligero)              |
| React Hook Form      | 7.x     | Gestión de formularios                        |
| Zod                  | 3.x     | Validación de schemas (compartida front/back) |
| Recharts             | latest  | Gráficos y charts                             |
| dnd-kit              | latest  | Drag and drop (vistas Kanban)                 |
| cmdk                 | latest  | Command palette (⌘K)                          |
| date-fns             | latest  | Manipulación de fechas                        |
| nuqs                 | latest  | State en URL query params                     |

### 5.2 Backend

| Tecnología                      | Versión | Propósito                     |
| ------------------------------- | ------- | ----------------------------- |
| Next.js API Routes              | 15.x    | Capa de API (Route Handlers)  |
| Prisma ORM                      | 6.x     | ORM con Client Extensions     |
| Prisma (multi-file schema)      | 6.x     | Schemas modulares por dominio |
| Zod                             | 3.x     | Validación de inputs en API   |
| @sparticuz/chromium + Puppeteer | latest  | Generación de PDF en Lambda   |
| exceljs                         | 4.x     | Generación de archivos Excel  |
| Handlebars                      | latest  | Templates HTML para PDFs      |

### 5.3 Infraestructura

| Tecnología                | Propósito                                      |
| ------------------------- | ---------------------------------------------- |
| AWS Amplify Gen 2         | Hosting, CI/CD, Auth (Cognito), Storage (S3)   |
| AWS RDS PostgreSQL        | Base de datos relacional                       |
| AWS RDS Proxy             | Connection pooling para Lambda/serverless      |
| AWS Lambda                | Background jobs, PDF generation, email         |
| AWS SQS                   | Colas de mensajes para procesamiento asíncrono |
| AWS SES                   | Email transaccional                            |
| AWS EventBridge Scheduler | Tareas programadas (alertas, cierres)          |
| AWS Secrets Manager       | Gestión de credenciales                        |
| AWS CloudFront            | CDN (incluido automáticamente con Amplify)     |
| AWS CloudWatch            | Logs, métricas, alarmas                        |

### 5.4 Herramientas de Desarrollo

| Herramienta     | Propósito                          |
| --------------- | ---------------------------------- |
| ESLint          | Linting de código                  |
| Prettier        | Formateo de código                 |
| Vitest          | Unit tests e integration tests     |
| Playwright      | Tests end-to-end                   |
| Husky           | Git hooks (pre-commit, commit-msg) |
| commitlint      | Validación de Conventional Commits |
| @changesets/cli | Gestión de changelogs y versiones  |
| Docker Compose  | PostgreSQL local para desarrollo   |
| GitHub Actions  | CI/CD complementario               |

---

## 6. Servicios AWS

### 6.1 Servicios por Fase

| Fase | Servicio AWS                 | Propósito                      | Costo estimado/mes |
| ---- | ---------------------------- | ------------------------------ | ------------------ |
| 0    | Amplify Gen 2 Hosting        | CI/CD + SSR hosting            | ~$5–15             |
| 0    | Cognito User Pools           | Autenticación (50K MAU gratis) | $0                 |
| 0    | RDS PostgreSQL (db.t3.micro) | Base de datos principal        | ~$15–25            |
| 0    | S3                           | Almacenamiento de archivos     | ~$1–5              |
| 0    | Secrets Manager              | Credenciales seguras           | ~$2                |
| 1    | CloudFront                   | CDN (incluido con Amplify)     | $0                 |
| 3    | Lambda                       | PDF, background jobs           | ~$0–5              |
| 3    | SQS                          | Colas de trabajo               | ~$0–1              |
| 3    | SES                          | Envío de emails                | ~$1                |
| 3    | RDS Proxy                    | Connection pooling             | ~$15               |
| 4    | EventBridge Scheduler        | Tareas programadas             | ~$1                |
| —    | **Total estimado MVP**       |                                | **~$40–70/mes**    |

### 6.2 Configuración de Región

- **Región primaria:** `us-east-1` (Virginia) — más cercana a Honduras, menor latencia
- **CDN:** CloudFront distribuye estáticos globalmente

---

## 7. Requerimientos Funcionales

### 7.1 RF-CORE: Módulo Core

| ID         | Requerimiento                                                                                                   | Prioridad | Criterio de Aceptación                                                                                                                                                                                                                                 |
| ---------- | --------------------------------------------------------------------------------------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| RF-CORE-01 | El sistema debe permitir el registro e inicio de sesión de usuarios con email y contraseña                      | Alta      | Usuario puede registrarse, confirmar email y acceder al dashboard                                                                                                                                                                                      |
| RF-CORE-02 | El sistema debe soportar recuperación de contraseña                                                             | Alta      | Usuario recibe email con enlace/código para restablecer contraseña                                                                                                                                                                                     |
| RF-CORE-03 | El sistema debe gestionar múltiples empresas (CRUD)                                                             | Alta      | Un usuario admin puede crear empresas con datos fiscales, logo, moneda base                                                                                                                                                                            |
| RF-CORE-04 | Cada empresa debe tener: nombre legal, nombre comercial, RTN, dirección, teléfono, email, logo, moneda base     | Alta      | Todos los campos se almacenan y muestran correctamente                                                                                                                                                                                                 |
| RF-CORE-05 | El sistema debe implementar RBAC (Role-Based Access Control) con roles personalizables                          | Alta      | Se pueden crear roles con combinaciones de permisos                                                                                                                                                                                                    |
| RF-CORE-06 | Los permisos deben ser granulares por módulo y acción: crear, leer, editar, eliminar                            | Alta      | Un usuario con rol "Vendedor" solo ve módulos de venta y no puede eliminar facturas                                                                                                                                                                    |
| RF-CORE-07 | Los menús de navegación deben ser dinámicos basados en los permisos del usuario y módulos activos de la empresa | Alta      | Usuario solo ve en sidebar los módulos a los que tiene acceso                                                                                                                                                                                          |
| RF-CORE-08 | Un usuario puede pertenecer a múltiples empresas con roles diferentes en cada una                               | Media     | Al iniciar sesión, el usuario selecciona empresa; sus permisos cambian según la empresa                                                                                                                                                                |
| RF-CORE-09 | Los módulos de negocio deben poder activarse/desactivarse por empresa                                           | Alta      | El administrador puede activar "Inventarios" para Empresa A y no para Empresa B                                                                                                                                                                        |
| RF-CORE-10 | El sistema debe proveer roles predeterminados: Administrador, Gerente, Vendedor, Contador, Auditor              | Alta      | Al crear empresa, se generan los 5 roles base con permisos predefinidos                                                                                                                                                                                |
| RF-CORE-11 | El dashboard principal debe mostrar KPIs relevantes según el rol del usuario                                    | Media     | Admin ve métricas globales; vendedor ve sus ventas; contador ve métricas financieras                                                                                                                                                                   |
| RF-CORE-12 | El sistema debe soportar búsqueda global (Command Palette ⌘K) para navegar rápidamente                          | Media     | El usuario puede buscar contactos, facturas, cuentas contables desde cualquier pantalla                                                                                                                                                                |
| RF-CORE-13 | El sistema debe permitir configurar un límite máximo de usuarios por tenant (empresa)                           | Alta      | El super-administrador o el plan de suscripción define el límite; al intentar crear un usuario que exceda el límite, el sistema lo impide con mensaje descriptivo; el administrador de la empresa puede ver cuántos usuarios tiene y cuál es su límite |

### 7.2 RF-CONTACTS: Módulo de Contactos

| ID         | Requerimiento                                                                                                             | Prioridad | Criterio de Aceptación                                                                 |
| ---------- | ------------------------------------------------------------------------------------------------------------------------- | --------- | -------------------------------------------------------------------------------------- |
| RF-CONT-01 | El sistema debe mantener un directorio unificado de contactos (clientes, proveedores, o ambos)                            | Alta      | Un contacto puede marcarse como cliente, proveedor, o ambos                            |
| RF-CONT-02 | Cada contacto debe almacenar: nombre/razón social, RTN, tipo (persona natural/jurídica), email, teléfonos, sitio web      | Alta      | Todos los campos se gestionan correctamente                                            |
| RF-CONT-03 | Un contacto puede tener múltiples direcciones (facturación, envío, sucursal)                                              | Alta      | Se pueden agregar N direcciones con tipo, calle, ciudad, departamento, país            |
| RF-CONT-04 | Un contacto puede tener múltiples personas de contacto asociadas (nombre, cargo, teléfono, email)                         | Media     | Sub-contactos vinculados al contacto principal                                         |
| RF-CONT-05 | El sistema debe permitir asignar condiciones de pago a cada contacto (Contado, Neto 15, Neto 30, Neto 60, personalizable) | Alta      | Las condiciones de pago se aplican automáticamente al crear facturas para ese contacto |
| RF-CONT-06 | El sistema debe permitir definir límite de crédito por contacto                                                           | Media     | Al superar el límite, el sistema muestra advertencia al crear nueva factura            |
| RF-CONT-07 | El directorio debe ser filtrable por tipo (cliente/proveedor), estado (activo/inactivo), y búsqueda de texto              | Alta      | Los filtros funcionan en tiempo real sobre la lista                                    |
| RF-CONT-08 | El sistema debe permitir importación masiva de contactos desde archivo Excel                                              | Media     | Se sube un archivo .xlsx con formato predefinido y se crean los contactos              |

### 7.3 RF-ACCT: Módulo de Contabilidad

| ID         | Requerimiento                                                                                                                                                                                                 | Prioridad | Criterio de Aceptación                                                                                                                                                    |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| RF-ACCT-01 | El sistema debe proveer un plan de cuentas jerárquico configurable, pre-cargado con plantilla NIIF para PYMEs Honduras                                                                                        | Alta      | Al crear empresa, se genera el plan de cuentas base (~200 cuentas)                                                                                                        |
| RF-ACCT-02 | Cada cuenta contable debe tener: código, nombre, tipo (activo/pasivo/capital/ingreso/costo/gasto), naturaleza (deudora/acreedora), moneda, y si es reconciliable                                              | Alta      | Todas las propiedades se gestionan y validan correctamente                                                                                                                |
| RF-ACCT-03 | El plan de cuentas debe visualizarse en estructura de árbol expandible/colapsable                                                                                                                             | Alta      | Se puede navegar la jerarquía visualmente                                                                                                                                 |
| RF-ACCT-04 | El sistema debe gestionar años fiscales (enero–diciembre para Honduras) con apertura y cierre                                                                                                                 | Alta      | Se puede crear año fiscal 2026, abrir/cerrar períodos mensuales                                                                                                           |
| RF-ACCT-05 | El sistema debe permitir crear asientos contables manuales con partida doble                                                                                                                                  | Alta      | Un asiento con N líneas donde la suma de débitos = suma de créditos                                                                                                       |
| RF-ACCT-06 | Los asientos deben tener estados: borrador, publicado, cancelado                                                                                                                                              | Alta      | Solo asientos publicados afectan los saldos                                                                                                                               |
| RF-ACCT-07 | El sistema debe generar asientos contables automáticamente al publicar facturas de venta y compra                                                                                                             | Alta      | Al publicar factura de venta, se genera asiento: Débito CxC / Crédito Ingreso + Crédito ISV por pagar                                                                     |
| RF-ACCT-08 | El sistema debe impedir asientos en períodos cerrados                                                                                                                                                         | Alta      | Al intentar publicar en período cerrado, el sistema rechaza con mensaje claro                                                                                             |
| RF-ACCT-09 | El sistema debe soportar múltiples diarios contables: Ventas, Compras, Banco, General, Ajustes                                                                                                                | Alta      | Los asientos se clasifican por diario                                                                                                                                     |
| RF-ACCT-10 | El sistema debe generar Balance General (Estado de Situación Financiera)                                                                                                                                      | Alta      | Reporte muestra activos, pasivos, patrimonio a una fecha dada                                                                                                             |
| RF-ACCT-11 | El sistema debe generar Estado de Resultados                                                                                                                                                                  | Alta      | Reporte muestra ingresos, costos, gastos y utilidad para un rango de fechas                                                                                               |
| RF-ACCT-12 | El sistema debe generar Balance de Comprobación                                                                                                                                                               | Alta      | Reporte con todas las cuentas: saldo anterior, movimientos del período, saldo final                                                                                       |
| RF-ACCT-13 | El sistema debe generar Libro Mayor por cuenta                                                                                                                                                                | Alta      | Detalle de movimientos de una cuenta en un rango de fechas                                                                                                                |
| RF-ACCT-14 | El sistema debe generar Libro Diario                                                                                                                                                                          | Alta      | Lista cronológica de todos los asientos en un rango de fechas                                                                                                             |
| RF-ACCT-15 | Todos los reportes contables deben exportarse a PDF y Excel                                                                                                                                                   | Alta      | Botones "Exportar PDF" y "Exportar Excel" funcionales en cada reporte                                                                                                     |
| RF-ACCT-16 | El sistema debe soportar multimoneda: registrar operaciones en moneda original y moneda base (HNL)                                                                                                            | Alta      | Una factura en USD genera asientos con monto USD y equivalente HNL                                                                                                        |
| RF-ACCT-17 | El sistema debe gestionar tasas de cambio con fecha (HNL/USD)                                                                                                                                                 | Alta      | Se pueden registrar tasas diarias; el sistema usa la tasa vigente a la fecha de operación                                                                                 |
| RF-ACCT-18 | El sistema debe calcular y registrar diferencial cambiario                                                                                                                                                    | Media     | Al cierre, las cuentas en moneda extranjera se revalúan y se genera asiento de ajuste                                                                                     |
| RF-ACCT-19 | El sistema debe permitir conciliación bancaria: importar estados de cuenta bancarios (CSV/Excel/OFX), cruzar automáticamente movimientos bancarios con asientos contables, y resolver diferencias manualmente | Alta      | El usuario importa estado de cuenta, el sistema sugiere coincidencias, el usuario confirma o ajusta; se genera reporte de partidas conciliadas y pendientes               |
| RF-ACCT-20 | El sistema debe permitir conciliación de cuentas por cobrar: cruzar facturas de venta pendientes con pagos recibidos, identificar facturas vencidas y saldos a favor de clientes                              | Alta      | El usuario selecciona un cliente, visualiza facturas pendientes vs pagos aplicados, puede conciliar manual o automáticamente; se genera reporte de antigüedad de saldos   |
| RF-ACCT-21 | El sistema debe permitir conciliación de cuentas por pagar: cruzar facturas de proveedores pendientes con pagos realizados, identificar facturas vencidas y anticipos a proveedores                           | Alta      | El usuario selecciona un proveedor, visualiza facturas pendientes vs pagos aplicados, puede conciliar manual o automáticamente; se genera reporte de antigüedad de saldos |

### 7.4 RF-INV: Módulo de Facturación

| ID        | Requerimiento                                                                                                                                                       | Prioridad | Criterio de Aceptación                                                                              |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | --------------------------------------------------------------------------------------------------- |
| RF-INV-01 | El sistema debe permitir crear facturas de venta con líneas de detalle (producto/servicio, cantidad, precio, impuesto, descuento)                                   | Alta      | Factura con N líneas, cálculo automático de subtotal, impuestos, total                              |
| RF-INV-02 | El sistema debe soportar los tipos de documento fiscal hondureño: Factura, Crédito Fiscal, Nota de Crédito, Nota de Débito, Factura de Exportación                  | Alta      | Cada tipo tiene su propio correlativo y reglas                                                      |
| RF-INV-03 | El sistema debe gestionar CAIs (Código de Autorización de Impresión): código, rango inicio, rango fin, fecha vencimiento, punto de emisión                          | Alta      | El admin puede registrar CAIs, el sistema los asigna automáticamente a facturas                     |
| RF-INV-04 | El número fiscal debe generarse automáticamente siguiendo el formato SAR: `PPP-PPP-TT-NNNNNNNN`                                                                     | Alta      | Al publicar factura, se asigna el siguiente correlativo del CAI activo                              |
| RF-INV-05 | El sistema debe alertar cuando un CAI está próximo a vencer (< 30 días) o su rango se está agotando (< 10% restante)                                                | Alta      | Notificación visible en dashboard y al crear factura                                                |
| RF-INV-06 | Las facturas deben tener estados: borrador, publicada, pagada, cancelada                                                                                            | Alta      | Transiciones de estado controladas con validación                                                   |
| RF-INV-07 | Al publicar una factura de venta, debe generarse automáticamente el asiento contable correspondiente                                                                | Alta      | Asiento se crea y publica vinculado a la factura                                                    |
| RF-INV-08 | El sistema debe permitir registrar facturas de proveedor (compras) con cálculo del ISV como crédito fiscal                                                          | Alta      | Factura de compra genera asiento: Débito Gasto/Inventario + Débito ISV crédito fiscal / Crédito CxP |
| RF-INV-09 | Las notas de crédito deben vincularse a una factura original y ajustar saldos en contabilidad                                                                       | Alta      | Nota de crédito reversa parcial o totalmente una factura                                            |
| RF-INV-10 | Las notas de débito deben poder generarse para cargos adicionales                                                                                                   | Media     | Nota de débito se vincula a factura y genera asiento de cargo adicional                             |
| RF-INV-11 | El sistema debe calcular ISV al 15% (general) y 18% (productos selectivos) configurables                                                                            | Alta      | Impuestos se calculan correctamente según configuración de la línea                                 |
| RF-INV-12 | La factura impresa (PDF) debe incluir todos los campos requeridos por el SAR: CAI, rango autorizado, fecha límite de emisión, RTN emisor y receptor, detalle de ISV | Alta      | El PDF generado cumple con requisitos legales del SAR                                               |
| RF-INV-13 | El sistema debe generar Libro de Ventas mensual                                                                                                                     | Alta      | Reporte lista todas las facturas emitidas con desglose de base gravada, exenta e ISV                |
| RF-INV-14 | El sistema debe generar Libro de Compras mensual                                                                                                                    | Alta      | Reporte lista todas las facturas de proveedor registradas                                           |
| RF-INV-15 | Los libros de ventas/compras deben exportarse en formato compatible con DET del SAR                                                                                 | Alta      | Exportación CSV/Excel con columnas requeridas para transcripción al DET                             |
| RF-INV-16 | El sistema debe manejar retenciones en la fuente aplicadas a proveedores                                                                                            | Media     | Se puede registrar retención y generar constancia                                                   |
| RF-INV-17 | Las facturas de exportación deben manejar ISV exento                                                                                                                | Media     | Tipo de documento exportación con ISV 0%                                                            |
| RF-INV-18 | Cada factura debe permitir adjuntar archivos (PDFs, imágenes)                                                                                                       | Baja      | Archivos se suben a S3 y se vinculan al registro                                                    |

### 7.5 RF-PUR: Módulo de Compras (Post-MVP)

| ID        | Requerimiento                                                              | Prioridad | Criterio de Aceptación                                                |
| --------- | -------------------------------------------------------------------------- | --------- | --------------------------------------------------------------------- |
| RF-PUR-01 | El sistema debe permitir crear solicitudes de cotización a proveedores     | Media     | Se genera documento con productos solicitados y se envía al proveedor |
| RF-PUR-02 | Las solicitudes de cotización deben poder convertirse en órdenes de compra | Media     | Con un clic se genera la OC desde la solicitud aprobada               |
| RF-PUR-03 | Las órdenes de compra deben tener flujo de aprobación configurable         | Media     | Montos > X requieren aprobación del gerente                           |
| RF-PUR-04 | El sistema debe gestionar listas de precios por proveedor                  | Media     | Se pueden registrar precios preferenciales por proveedor/producto     |
| RF-PUR-05 | La recepción de productos debe validar contra la orden de compra           | Media     | Se compara cantidad recibida vs ordenada                              |
| RF-PUR-06 | Las facturas de proveedor deben vincularse a la orden de compra            | Media     | Se puede crear factura de proveedor directamente desde la OC          |

### 7.6 RF-SALES: Módulo de Ventas y CRM (Post-MVP)

| ID          | Requerimiento                                                                                                | Prioridad | Criterio de Aceptación                                        |
| ----------- | ------------------------------------------------------------------------------------------------------------ | --------- | ------------------------------------------------------------- |
| RF-SALES-01 | El sistema debe proveer un pipeline de oportunidades con fases personalizables                               | Media     | Vista Kanban con drag & drop entre fases                      |
| RF-SALES-02 | Las oportunidades deben tener: contacto, monto estimado, probabilidad, fecha estimada de cierre, responsable | Media     | Campos gestionables con vista de resumen                      |
| RF-SALES-03 | El sistema debe permitir generar presupuestos desde oportunidades                                            | Media     | Presupuesto se genera pre-llenado con datos de la oportunidad |
| RF-SALES-04 | Los presupuestos aprobados deben convertirse en pedidos de venta                                             | Media     | Conversión con un clic, manteniendo trazabilidad              |
| RF-SALES-05 | Los pedidos de venta deben poder facturarse                                                                  | Media     | Generación de factura desde el pedido de venta                |
| RF-SALES-06 | El sistema debe generar informe de cobranzas con aging (0-30, 31-60, 61-90, 90+ días)                        | Media     | Reporte muestra facturas pendientes agrupadas por antigüedad  |

### 7.7 RF-STOCK: Módulo de Inventarios (Post-MVP)

| ID          | Requerimiento                                                                                         | Prioridad | Criterio de Aceptación                                                             |
| ----------- | ----------------------------------------------------------------------------------------------------- | --------- | ---------------------------------------------------------------------------------- |
| RF-STOCK-01 | El sistema debe gestionar múltiples almacenes con ubicaciones jerárquicas                             | Media     | Se pueden crear almacenes con zonas/estantes/ubicaciones                           |
| RF-STOCK-02 | El sistema debe registrar movimientos de stock: entradas, salidas, transferencias internas            | Media     | Cada movimiento actualiza el stock de las ubicaciones involucradas                 |
| RF-STOCK-03 | El sistema debe calcular stock disponible en tiempo real por producto/almacén/ubicación               | Media     | La consulta de stock refleja todos los movimientos confirmados                     |
| RF-STOCK-04 | El sistema debe soportar reglas de reabastecimiento: stock mínimo, punto de reorden, cantidad a pedir | Media     | Al llegar al punto de reorden, se sugiere/genera orden de compra                   |
| RF-STOCK-05 | El sistema debe soportar valoración de inventario por FIFO o Promedio Ponderado (configurable)        | Media     | El costo unitario y valor total del inventario se calcula según método configurado |
| RF-STOCK-06 | El sistema debe soportar inventarios cíclicos (conteo parcial programado)                             | Baja      | Se puede crear conteo, comparar vs teórico, registrar ajuste                       |
| RF-STOCK-07 | El sistema debe soportar trazabilidad por lotes (opcional por empresa)                                | Baja      | Productos con seguimiento por lote registran lote en cada movimiento               |
| RF-STOCK-08 | Los movimientos de stock deben vincularse con compras (entrada) y ventas (salida)                     | Media     | Al confirmar recepción de compra se genera movimiento de entrada                   |

---

## 8. Requerimientos No Funcionales

| ID     | Requerimiento                                                                                                      | Métrica                                             | Prioridad |
| ------ | ------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------- | --------- |
| RNF-01 | **Performance:** Las páginas del dashboard deben cargar en menos de 2 segundos                                     | Time to Interactive < 2s                            | Alta      |
| RNF-02 | **Performance:** Las consultas de API deben responder en menos de 500ms para operaciones CRUD                      | P95 latency < 500ms                                 | Alta      |
| RNF-03 | **Disponibilidad:** El sistema Cloud debe tener uptime de 99.5%                                                    | SLA 99.5% uptime mensual                            | Alta      |
| RNF-04 | **Seguridad:** Todas las comunicaciones deben ser vía HTTPS/TLS                                                    | Certificado SSL en todos los endpoints              | Alta      |
| RNF-05 | **Seguridad:** Las contraseñas deben cumplir política de complejidad mínima (8 chars, mayúscula, número, especial) | Validación en Cognito                               | Alta      |
| RNF-06 | **Seguridad:** Los tokens JWT deben expirar en máximo 1 hora con refresh tokens de 30 días                         | Configuración Cognito                               | Alta      |
| RNF-07 | **Seguridad:** Multi-tenant isolation debe ser verificable con tests automatizados                                 | Test E2E que verifica aislamiento                   | Alta      |
| RNF-08 | **Escalabilidad:** El sistema debe soportar al menos 100 empresas concurrentes en modo Cloud                       | Load testing con 100 tenants                        | Media     |
| RNF-09 | **Accesibilidad:** Todas las interfaces deben cumplir WCAG 2.1 nivel AA                                            | Lighthouse Accessibility > 95                       | Media     |
| RNF-10 | **Compatibilidad:** El sistema debe funcionar en Chrome, Firefox, Safari y Edge (últimas 2 versiones)              | Tests cross-browser                                 | Alta      |
| RNF-11 | **Responsive:** El sistema debe ser usable en tablets (1024px+) y funcional en móviles (375px+)                    | Diseño responsive verificado                        | Media     |
| RNF-12 | **Backup:** La base de datos debe tener respaldo automático diario con retención de 7 días                         | RDS automated backups                               | Alta      |
| RNF-13 | **Internacionalización:** El código debe estar preparado para i18n aunque la primera versión sea solo en español   | Strings externalizados, no hardcoded en componentes | Baja      |
| RNF-14 | **Código:** Cobertura mínima de tests unitarios del 80% en lógica de negocio                                       | Vitest coverage report                              | Alta      |
| RNF-15 | **Código:** Cero errores de ESLint en código mergeado a main                                                       | CI pipeline enforced                                | Alta      |

---

## 9. Seguridad de Infraestructura AWS

La seguridad es un pilar fundamental para un ERP que maneja datos fiscales, financieros y comerciales sensibles. NexoERP implementa un modelo de **Defense in Depth** (defensa en profundidad) con múltiples capas de protección a nivel de red, aplicación y datos.

### 9.1 Modelo de Seguridad por Capas

```
Internet → CloudFront + WAF → Amplify (SSR) → VPC → Security Groups → RDS/Lambda
   │            │                                        │
   │       AWS Shield                              Network ACLs
   │       (DDoS L3/L4)                            (Subnet level)
   │
   └─── Rate Limiting + Bot Control + Geo-Restriction
```

### 9.2 AWS WAF (Web Application Firewall)

| ID        | Requerimiento                                                                                                                                    | Prioridad | Criterio de Aceptación                                                |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | --------- | --------------------------------------------------------------------- |
| RS-WAF-01 | AWS WAF debe configurarse en la distribución de CloudFront para filtrar tráfico malicioso                                                        | Alta      | WAF activo con reglas managed habilitadas                             |
| RS-WAF-02 | Se deben activar las reglas managed de AWS: `AWSManagedRulesCommonRuleSet`, `AWSManagedRulesSQLiRuleSet`, `AWSManagedRulesKnownBadInputsRuleSet` | Alta      | Reglas activas y probadas contra payloads de prueba                   |
| RS-WAF-03 | Se debe configurar rate limiting por IP: máximo 2,000 requests por cada 5 minutos                                                                | Alta      | IPs que excedan el límite son bloqueadas temporalmente                |
| RS-WAF-04 | Se debe implementar geo-blocking: permitir acceso solo desde Honduras (HN), Estados Unidos (US), y países configurables por el administrador     | Media     | Requests desde países no autorizados son bloqueadas con respuesta 403 |
| RS-WAF-05 | Se debe activar protección contra bots maliciosos (AWS WAF Bot Control)                                                                          | Media     | Bots conocidos como scrapers y crawlers maliciosos son bloqueados     |
| RS-WAF-06 | Los logs de WAF deben enviarse a CloudWatch para análisis y alertas                                                                              | Alta      | Dashboard de WAF con métricas de requests bloqueados/permitidos       |

**Reglas personalizadas para NexoERP:**

- Bloquear requests con `Content-Length` excesivo (> 10MB) excepto en rutas de upload.
- Rate limit estricto en endpoints de autenticación: máximo 20 intentos/minuto por IP.
- Bloquear user-agents vacíos o sospechosos en rutas de API.

### 9.3 AWS Shield (Protección DDoS)

| ID           | Requerimiento                                                                 | Prioridad | Criterio de Aceptación                                  |
| ------------ | ----------------------------------------------------------------------------- | --------- | ------------------------------------------------------- |
| RS-SHIELD-01 | AWS Shield Standard debe estar activo en CloudFront y Route 53                | Alta      | Protección DDoS L3/L4 automática (incluido sin costo)   |
| RS-SHIELD-02 | Se debe monitorear las métricas de Shield en CloudWatch para detectar ataques | Alta      | Alarma configurada para eventos DDoS detectados         |
| RS-SHIELD-03 | Evaluar Shield Advanced cuando el sistema tenga > 50 empresas activas         | Baja      | Revisión documentada en ADR cuando se alcance el umbral |

### 9.4 VPC y Network ACLs (NACLs)

| ID        | Requerimiento                                                                                                             | Prioridad | Criterio de Aceptación                                                |
| --------- | ------------------------------------------------------------------------------------------------------------------------- | --------- | --------------------------------------------------------------------- |
| RS-VPC-01 | Toda la infraestructura de datos debe residir dentro de una VPC dedicada                                                  | Alta      | VPC creada con CIDR `10.0.0.0/16`                                     |
| RS-VPC-02 | La VPC debe tener subredes públicas y privadas distribuidas en al menos 2 AZs                                             | Alta      | Mínimo 4 subredes: 2 públicas + 2 privadas en us-east-1a y us-east-1b |
| RS-VPC-03 | RDS debe ubicarse exclusivamente en subredes privadas sin acceso directo desde Internet                                   | Alta      | RDS no tiene IP pública; solo accesible desde subredes de aplicación  |
| RS-VPC-04 | Las NACLs de subredes privadas deben denegar todo tráfico excepto el explícitamente permitido                             | Alta      | Regla por defecto: DENY ALL; whitelist de puertos específicos         |
| RS-VPC-05 | Las NACLs de la subred de base de datos solo deben permitir tráfico entrante en puerto 5432 desde la subred de aplicación | Alta      | Test de conectividad: solo Lambda/Amplify pueden alcanzar RDS         |

**Topología de red:**

```
VPC (10.0.0.0/16)
├── Subred Pública A (10.0.1.0/24) — us-east-1a
│   └── NAT Gateway
├── Subred Pública B (10.0.2.0/24) — us-east-1b
│   └── NAT Gateway (redundante)
├── Subred Privada App A (10.0.10.0/24) — us-east-1a
│   └── Lambda functions, RDS Proxy
├── Subred Privada App B (10.0.11.0/24) — us-east-1b
│   └── Lambda functions, RDS Proxy
├── Subred Privada DB A (10.0.20.0/24) — us-east-1a
│   └── RDS Primary
└── Subred Privada DB B (10.0.21.0/24) — us-east-1b
    └── RDS Standby (Multi-AZ)
```

**Reglas de NACLs:**

| Subred      | Dirección | Puerto                | Origen/Destino                                  | Acción                   |
| ----------- | --------- | --------------------- | ----------------------------------------------- | ------------------------ |
| Pública     | Inbound   | 443 (HTTPS)           | 0.0.0.0/0                                       | ALLOW                    |
| Pública     | Inbound   | 80 (HTTP)             | 0.0.0.0/0                                       | ALLOW (redirect a HTTPS) |
| Pública     | Outbound  | Todo                  | 0.0.0.0/0                                       | ALLOW                    |
| Privada App | Inbound   | 5432                  | Subred Pública                                  | DENY                     |
| Privada App | Inbound   | 443                   | Servicios AWS (VPC Endpoints)                   | ALLOW                    |
| Privada App | Outbound  | 5432                  | Subred DB                                       | ALLOW                    |
| Privada App | Outbound  | 443                   | 0.0.0.0/0 (via NAT)                             | ALLOW                    |
| Privada DB  | Inbound   | 5432                  | Subred Privada App (10.0.10.0/24, 10.0.11.0/24) | ALLOW                    |
| Privada DB  | Inbound   | Todo                  | 0.0.0.0/0                                       | DENY                     |
| Privada DB  | Outbound  | Efímeros (1024-65535) | Subred Privada App                              | ALLOW                    |

### 9.5 Security Groups (Firewall a Nivel de Instancia)

| ID       | Requerimiento                                                                            | Prioridad | Criterio de Aceptación                                |
| -------- | ---------------------------------------------------------------------------------------- | --------- | ----------------------------------------------------- |
| RS-SG-01 | Cada tipo de recurso debe tener su propio Security Group con reglas mínimas              | Alta      | SGs separados para Lambda, RDS, RDS Proxy             |
| RS-SG-02 | El SG de RDS solo debe permitir tráfico entrante en puerto 5432 desde el SG de RDS Proxy | Alta      | Conexión directa desde Internet a RDS falla           |
| RS-SG-03 | El SG de RDS Proxy solo debe permitir tráfico entrante desde el SG de Lambda/Amplify     | Alta      | Solo funciones autorizadas acceden al proxy           |
| RS-SG-04 | Ningún Security Group debe tener reglas con `0.0.0.0/0` en inbound                       | Alta      | Auditoría de SGs verifica ausencia de reglas abiertas |

**Matriz de Security Groups:**

| Security Group      | Inbound                                           | Outbound                                                        |
| ------------------- | ------------------------------------------------- | --------------------------------------------------------------- |
| `sg-amplify-lambda` | N/A (serverless, no inbound directo)              | HTTPS (443) a servicios AWS; PostgreSQL (5432) a `sg-rds-proxy` |
| `sg-rds-proxy`      | PostgreSQL (5432) desde `sg-amplify-lambda`       | PostgreSQL (5432) a `sg-rds`                                    |
| `sg-rds`            | PostgreSQL (5432) desde `sg-rds-proxy` únicamente | Efímeros a `sg-rds-proxy` (respuestas)                          |

### 9.6 Encriptación de Datos

| ID        | Requerimiento                                                                                                                   | Prioridad | Criterio de Aceptación                                                         |
| --------- | ------------------------------------------------------------------------------------------------------------------------------- | --------- | ------------------------------------------------------------------------------ |
| RS-ENC-01 | RDS debe tener encriptación at-rest habilitada (AES-256 via KMS)                                                                | Alta      | Encryption activado al crear instancia (no puede cambiarse después)            |
| RS-ENC-02 | Todas las conexiones a RDS deben usar SSL/TLS                                                                                   | Alta      | Connection string incluye `sslmode=require`; conexiones sin SSL son rechazadas |
| RS-ENC-03 | S3 debe tener Server-Side Encryption habilitada por defecto (SSE-S3 o SSE-KMS)                                                  | Alta      | Todos los objetos en S3 están encriptados                                      |
| RS-ENC-04 | S3 debe tener Block Public Access activado en las 4 opciones                                                                    | Alta      | Ningún objeto del bucket puede hacerse público accidentalmente                 |
| RS-ENC-05 | CloudFront debe enforcer TLS 1.2+ con política de seguridad moderna                                                             | Alta      | Conexiones TLS 1.0/1.1 son rechazadas                                          |
| RS-ENC-06 | Los backups de RDS deben estar encriptados                                                                                      | Alta      | Backups automáticos heredan encriptación de la instancia                       |
| RS-ENC-07 | Las credenciales de base de datos y API keys deben almacenarse en Secrets Manager, nunca en variables de entorno en texto plano | Alta      | Ningún secret en código fuente ni en .env en producción                        |

### 9.7 Seguridad de Autenticación (Cognito)

| ID         | Requerimiento                                                                                | Prioridad | Criterio de Aceptación                                                      |
| ---------- | -------------------------------------------------------------------------------------------- | --------- | --------------------------------------------------------------------------- |
| RS-AUTH-01 | Activar Cognito Advanced Security Features para detección de credenciales comprometidas      | Alta      | Login con credenciales filtradas en breaches públicos genera alerta/bloqueo |
| RS-AUTH-02 | Configurar protección contra brute force: máximo 5 intentos fallidos, lockout de 15 minutos  | Alta      | Después de 5 intentos fallidos, la cuenta se bloquea temporalmente          |
| RS-AUTH-03 | MFA (TOTP) debe ser opcional para todos los usuarios y obligatorio para rol Administrador    | Alta      | Admin no puede acceder sin segundo factor; otros usuarios pueden activarlo  |
| RS-AUTH-04 | Device tracking debe estar activado para detectar sesiones desde dispositivos no reconocidos | Media     | Login desde dispositivo nuevo genera notificación al usuario                |
| RS-AUTH-05 | Tokens de acceso expiran en 1 hora; refresh tokens en 30 días                                | Alta      | Configuración verificada en Cognito User Pool                               |
| RS-AUTH-06 | Los tokens JWT deben almacenarse en cookies HTTP-only, Secure, SameSite=Strict               | Alta      | Tokens no accesibles via JavaScript del cliente                             |

### 9.8 Seguridad a Nivel de Aplicación

| ID        | Requerimiento                                                                                  | Prioridad | Criterio de Aceptación                                                             |
| --------- | ---------------------------------------------------------------------------------------------- | --------- | ---------------------------------------------------------------------------------- |
| RS-APP-01 | Implementar headers de seguridad HTTP en `next.config.ts`                                      | Alta      | Headers verificados con securityheaders.com (calificación A+)                      |
| RS-APP-02 | Configurar Content Security Policy (CSP) restrictiva                                           | Alta      | Solo fuentes autorizadas pueden ejecutar scripts                                   |
| RS-APP-03 | Configurar CORS con whitelist de dominios permitidos                                           | Alta      | Solo `app.nexoerp.com` y `staging.nexoerp.com` en whitelist                        |
| RS-APP-04 | Validación de inputs con Zod en todos los API route handlers sin excepción                     | Alta      | Ningún endpoint acepta datos sin validar                                           |
| RS-APP-05 | Implementar rate limiting a nivel de aplicación en endpoints críticos de API                   | Alta      | Endpoints de login, creación de facturas, y exportación tienen límites por usuario |
| RS-APP-06 | Sanitización de outputs para prevenir XSS (React auto-escaping + no `dangerouslySetInnerHTML`) | Alta      | Audit de código verifica ausencia de XSS vectors                                   |
| RS-APP-07 | Protección CSRF via SameSite cookies + token validation en mutaciones                          | Alta      | Requests cross-origin a endpoints de mutación son rechazados                       |

**Headers de seguridad requeridos:**

```
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://*.s3.amazonaws.com; connect-src 'self' https://*.amazonaws.com; font-src 'self'; frame-ancestors 'none'
```

### 9.9 Monitoreo y Respuesta a Incidentes

| ID        | Requerimiento                                                                                                           | Prioridad | Criterio de Aceptación                                                             |
| --------- | ----------------------------------------------------------------------------------------------------------------------- | --------- | ---------------------------------------------------------------------------------- |
| RS-MON-01 | CloudTrail debe estar activo para registrar todas las llamadas API a servicios AWS                                      | Alta      | Trail activo con logs en S3; retención mínima de 90 días                           |
| RS-MON-02 | CloudWatch Alarms debe configurarse para: errores 5xx > 10/min, latencia P95 > 2s, intentos de login fallidos > 50/hora | Alta      | Alarmas notifican al equipo via SNS (email o Slack)                                |
| RS-MON-03 | AWS GuardDuty debe estar activo para detección de amenazas (acceso anómalo, crypto mining, reconocimiento)              | Alta      | GuardDuty habilitado; findings de severidad HIGH generan alarma inmediata          |
| RS-MON-04 | Los logs de aplicación (errores, accesos, operaciones críticas) deben centralizarse en CloudWatch Logs                  | Alta      | Todos los API routes logean request metadata (sin datos sensibles)                 |
| RS-MON-05 | Se debe implementar un plan de respuesta a incidentes documentado                                                       | Media     | Documento con pasos de respuesta para: brecha de datos, DDoS, acceso no autorizado |
| RS-MON-06 | AWS Config debe verificar compliance de configuración (S3 público, RDS sin encryption, SGs abiertos)                    | Media     | Config rules activas con remediación automática o alertas                          |

### 9.10 Costos de Seguridad por Fase

| Fase | Servicio                          | Costo/mes       | Incluido                           |
| ---- | --------------------------------- | --------------- | ---------------------------------- |
| 0    | VPC + NACLs + Security Groups     | $0              | Arquitectura de red base           |
| 0    | Shield Standard (DDoS L3/L4)      | $0              | Automático en CloudFront           |
| 0    | RDS Encryption at-rest/in-transit | $0              | Habilitado sin costo adicional     |
| 0    | S3 Block Public Access + SSE      | $0              | Configuración por defecto          |
| 0    | CloudTrail (1 trail)              | $0              | Primer trail gratuito              |
| 0    | Secrets Manager                   | ~$2             | Par de secrets (DB + API keys)     |
| 1    | AWS WAF (en CloudFront)           | ~$6–10          | WebACL + reglas managed + requests |
| 1    | Cognito Advanced Security         | ~$3–5           | Adaptive auth, credentials check   |
| 1    | CloudWatch Alarms (10 alarmas)    | ~$2             | Alarmas de seguridad y performance |
| 1    | GuardDuty                         | ~$5             | Threat detection continuo          |
| 2    | AWS Config (10 rules)             | ~$2             | Compliance checks                  |
| —    | **Total seguridad**               | **~$20–25/mes** |                                    |

**Costo total actualizado con seguridad:**

| Categoría                                                  | Costo/mes       |
| ---------------------------------------------------------- | --------------- |
| Infraestructura base (Amplify, RDS, S3, SES, Lambda, etc.) | ~$40–70         |
| Seguridad (WAF, GuardDuty, Cognito Advanced, etc.)         | ~$20–25         |
| **Total estimado MVP**                                     | **~$60–95/mes** |

---

## 10. Requerimientos Fiscales Honduras

### 10.1 Impuestos

| Impuesto                    | Tasa     | Aplicación                                                    | Requerimiento en Sistema                                                   |
| --------------------------- | -------- | ------------------------------------------------------------- | -------------------------------------------------------------------------- |
| ISV (Impuesto Sobre Ventas) | 15%      | Ventas y compras generales                                    | Cálculo automático en facturas, registro como IVA por pagar/crédito fiscal |
| ISV Selectivo               | 18%      | Alcohol, tabaco, productos selectivos                         | Tasa configurable por producto/categoría                                   |
| ISV Exento                  | 0%       | Productos de canasta básica, exportaciones, servicios exentos | Marca de exención en producto                                              |
| ISR Empresas                | 25%      | Renta neta gravable anual                                     | Reporte de apoyo para declaración (no calculado automáticamente en MVP)    |
| Retención en la fuente      | Variable | Pagos a proveedores de servicios                              | Registro de retención y generación de constancia                           |
| Contribución Social         | 5%       | Sobre exceso de L 1,000,000 renta neta                        | Informativo en reportes                                                    |

### 10.2 CAI (Código de Autorización de Impresión)

El sistema debe gestionar:

- **Registro de CAI:** Código alfanumérico, rango numérico autorizado (inicio-fin), fecha de vencimiento, punto de emisión, tipo de documento asociado.
- **Formato de numeración:** `PPP-PPP-TT-NNNNNNNN`
  - `PPP-PPP`: Punto de emisión / establecimiento
  - `TT`: Tipo de documento (01=Factura, 02=Crédito Fiscal, etc.)
  - `NNNNNNNN`: Correlativo secuencial (8 dígitos)
- **Validaciones automáticas:**
  - No permitir emitir facturas si no hay CAI activo para el tipo de documento.
  - Alertar cuando el CAI esté a 30 días de vencer.
  - Alertar cuando quede menos del 10% del rango numérico.
  - No permitir emitir si el rango se agotó.
- **Múltiples CAIs por punto de emisión:** Transición automática al siguiente CAI cuando el actual se agota.

### 10.3 Documentos Fiscales

| Tipo                    | Código | Uso                                 | Requiere CAI |
| ----------------------- | ------ | ----------------------------------- | ------------ |
| Factura de Venta        | 01     | Venta a consumidor final            | Sí           |
| Crédito Fiscal          | 02     | Venta entre contribuyentes ISV      | Sí           |
| Nota de Crédito         | 03     | Devoluciones, descuentos post-venta | Sí           |
| Nota de Débito          | 04     | Cargos adicionales                  | Sí           |
| Recibo por Honorarios   | 05     | Pagos de servicios profesionales    | Sí           |
| Constancia de Retención | 06     | Comprobante de retención            | No           |
| Factura de Exportación  | 07     | Ventas al exterior (ISV exento)     | Sí           |
| Comprobante de Compras  | 08     | Compras a pequeños contribuyentes   | Sí           |

### 10.4 Reportes para el SAR/DET

| Reporte                 | Frecuencia | Formato salida  | Contenido                                                                                                       |
| ----------------------- | ---------- | --------------- | --------------------------------------------------------------------------------------------------------------- |
| Libro de Ventas         | Mensual    | PDF, Excel, CSV | Todas las facturas emitidas: fecha, tipo doc, número fiscal, RTN cliente, gravado 15%, gravado 18%, exento, ISV |
| Libro de Compras        | Mensual    | PDF, Excel, CSV | Todas las facturas de compra: fecha, tipo doc, número fiscal, RTN proveedor, gravado 15%, ISV crédito fiscal    |
| Declaración ISV (apoyo) | Mensual    | Excel           | Resumen de ventas/compras gravadas, ISV cobrado, ISV pagado, ISV por pagar                                      |
| Retenciones aplicadas   | Mensual    | PDF, Excel      | Detalle de retenciones realizadas a proveedores                                                                 |

### 10.5 Plan de Cuentas Honduras (Plantilla NIIF para PYMEs)

```
1       ACTIVOS
  11      Activos Corrientes
    1101    Efectivo y Equivalentes
    1102    Cuentas por Cobrar Comerciales
    1103    Inventarios
    1104    Impuestos por Cobrar (ISV Crédito Fiscal)
    1105    Anticipos y Pagos por Adelantado
  12      Activos No Corrientes
    1201    Propiedad, Planta y Equipo
    1202    Depreciación Acumulada (-)
    1203    Activos Intangibles
2       PASIVOS
  21      Pasivos Corrientes
    2101    Cuentas por Pagar Comerciales
    2102    Impuestos por Pagar (ISV, ISR, Retenciones)
    2103    Sueldos y Beneficios por Pagar
    2104    Préstamos a Corto Plazo
  22      Pasivos No Corrientes
    2201    Préstamos a Largo Plazo
    2202    Provisiones
3       PATRIMONIO
  31      Capital Social
  32      Reserva Legal
  33      Utilidades Retenidas
  34      Utilidad (Pérdida) del Ejercicio
4       INGRESOS
  41      Ingresos por Ventas
  42      Otros Ingresos
  43      Ingresos Financieros
5       COSTOS
  51      Costo de Ventas
6       GASTOS
  61      Gastos de Administración
  62      Gastos de Ventas
  63      Gastos Financieros
  64      Otros Gastos
```

> La plantilla completa (~200 cuentas) se incluirá en el seed de la base de datos.

---

## 11. Modelo de Multi-tenencia

### 11.1 Estrategia: Shared Schema + company_id + RLS

Todas las tablas de negocio incluyen una columna `company_id` (UUID, NOT NULL, FK a `companies`). PostgreSQL Row-Level Security (RLS) se activa en todas las tablas de negocio para impedir acceso cruzado entre empresas.

### 11.2 Capas de Aislamiento (Defense in Depth)

| Capa              | Mecanismo                | Descripción                                                                              |
| ----------------- | ------------------------ | ---------------------------------------------------------------------------------------- |
| 1 - Base de datos | PostgreSQL RLS           | Policies que filtran por `company_id` usando `current_setting('app.current_company_id')` |
| 2 - ORM           | Prisma Client Extension  | Inyecta `where: { company_id }` automáticamente en todas las queries                     |
| 3 - API           | Middleware de validación | Extrae `company_id` del JWT y lo establece como contexto de sesión                       |
| 4 - Frontend      | Context de empresa       | Todas las requests incluyen el company context; datos solo del tenant visible            |

### 11.3 Modo On-Premise

En modo local, el sistema se despliega con una instancia de base de datos dedicada. La columna `company_id` y RLS siguen activos (para consistencia del código), pero solo existe un tenant.

### 11.4 Índices Multi-tenant

Todas las tablas de negocio deben incluir `company_id` como primer campo en los índices compuestos para optimizar las queries filtradas por tenant.

### 11.5 Límites y Cuotas por Tenant

Cada empresa (tenant) tendrá límites configurables que controlan el uso del sistema:

| Límite                 | Descripción                                              | Configurable por                  |
| ---------------------- | -------------------------------------------------------- | --------------------------------- |
| **Máximo de usuarios** | Número máximo de usuarios activos permitidos por empresa | Super-admin / plan de suscripción |

**Reglas de implementación:**

- La tabla `companies` incluirá una columna `max_users` (INTEGER, NOT NULL, DEFAULT configurable).
- Al crear o reactivar un usuario, el sistema debe verificar que `COUNT(active_users) < max_users` para esa empresa.
- Si el límite se alcanza, la API retorna error `403` con mensaje: _"Se ha alcanzado el límite máximo de usuarios para esta empresa ({n}/{max}). Contacte al administrador para ampliar el límite."_
- El dashboard del administrador de empresa debe mostrar un indicador de uso: _"Usuarios: {n} de {max}"_.
- El super-administrador (plataforma Cloud) puede modificar el límite de cualquier empresa.
- En modo On-Premise, el límite se configura según la licencia adquirida.
- Los usuarios **desactivados** no cuentan contra el límite.

> **Nota:** En futuras versiones, se podrán agregar límites adicionales por tenant (almacenamiento, módulos activos, transacciones/mes, etc.) según el modelo de suscripción.

---

## 12. Sistema de Módulos

### 12.1 Módulos Disponibles

| Slug         | Nombre                | Dependencias               | Fase |
| ------------ | --------------------- | -------------------------- | ---- |
| `core`       | Core (siempre activo) | —                          | 0-1  |
| `contacts`   | Contactos             | core                       | 2    |
| `accounting` | Contabilidad          | core, contacts             | 2    |
| `invoicing`  | Facturación           | core, contacts, accounting | 3    |
| `purchasing` | Compras               | core, contacts, invoicing  | 4    |
| `sales`      | Ventas y CRM          | core, contacts, invoicing  | 4    |
| `inventory`  | Inventarios           | core, contacts             | 4    |

### 12.2 Activación de Módulos

- El módulo `core` siempre está activo y no puede desactivarse.
- Al activar un módulo, se activan automáticamente sus dependencias.
- Al desactivar un módulo, se verifica que ningún otro módulo activo dependa de él.
- La activación/desactivación es instantánea (no requiere migración de datos); los datos persisten desactivados.

---

## 13. Módulos del Sistema

> Los requerimientos funcionales detallados de cada módulo se encuentran en la [Sección 7](#7-requerimientos-funcionales).

### 13.1 Resumen de Módulos

| Módulo       | Entities principales                                                                                                                                                     | Vistas principales                                                                                                  |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| Core         | Company, User, Role, Permission, Module, Menu, AuditLog                                                                                                                  | Dashboard, Settings, Users, Roles                                                                                   |
| Contactos    | Contact, ContactAddress, ContactPerson, PaymentTerms                                                                                                                     | Lista+Detalle, Import                                                                                               |
| Contabilidad | Account, FiscalYear, FiscalPeriod, Journal, JournalEntry, JournalEntryLine, Currency, ExchangeRate, BankStatement, BankStatementLine, Reconciliation, ReconciliationLine | Plan de cuentas (árbol), Asientos (lista+form), Conciliación bancaria, Conciliación CxC, Conciliación CxP, Reportes |
| Facturación  | Invoice, InvoiceLine, CAI, EmissionPoint, TaxRate, TaxGroup                                                                                                              | Facturas (lista+form), Notas Cr/Db, CAI mgmt, Libros de V/C                                                         |
| Compras      | PurchaseOrder, PurchaseOrderLine, PriceList, Reception                                                                                                                   | Solicitudes, Órdenes, Recepciones                                                                                   |
| Ventas/CRM   | Opportunity, Pipeline, PipelineStage, Quotation, SaleOrder                                                                                                               | Pipeline (Kanban), Presupuestos, Pedidos, Cobranzas                                                                 |
| Inventarios  | Product, ProductCategory, Warehouse, Location, StockMove, StockQuant, Lot, ReorderRule                                                                                   | Productos, Almacenes, Movimientos, Valoración                                                                       |

---

## 14. Funcionalidades Transversales

### 14.1 Auditoría

| Campo            | Tipo     | Descripción                                |
| ---------------- | -------- | ------------------------------------------ |
| `id`             | UUID     | Identificador único                        |
| `entity_type`    | String   | Nombre del modelo (Invoice, Contact, etc.) |
| `entity_id`      | UUID     | ID del registro afectado                   |
| `action`         | Enum     | CREATE, UPDATE, DELETE                     |
| `old_values`     | JSONB    | Valores anteriores (null para CREATE)      |
| `new_values`     | JSONB    | Valores nuevos (null para DELETE)          |
| `changed_fields` | String[] | Lista de campos modificados                |
| `user_id`        | UUID     | Usuario que realizó la acción              |
| `company_id`     | UUID     | Empresa del contexto                       |
| `ip_address`     | String   | IP del request                             |
| `user_agent`     | String   | Navegador/cliente                          |
| `created_at`     | DateTime | Timestamp de la acción                     |

- Se implementa via Prisma Client Extension (automático, sin código manual en cada operación).
- Widget `<AuditTrail>` disponible en la vista de detalle de cualquier registro.
- Los logs de auditoría son inmutables (no se pueden editar ni eliminar).

### 14.2 Exportación de Reportes

| Formato | Tecnología                                | Uso                                                   |
| ------- | ----------------------------------------- | ----------------------------------------------------- |
| PDF     | Lambda + Puppeteer + Handlebars templates | Facturas, reportes contables, listas                  |
| Excel   | exceljs                                   | Reportes contables, libros de V/C, listas exportables |
| CSV     | Generación directa                        | Formato DET/SAR                                       |

**Flujo asíncrono para reportes pesados:**

1. Usuario solicita exportación → API Route encola mensaje en SQS
2. Lambda consumer procesa: consulta datos, genera archivo, sube a S3
3. Notificación al usuario (via polling o WebSocket) con URL de descarga
4. URL pre-signed de S3 con expiración de 24 horas

### 14.3 Permisos Granulares

Estructura del sistema de permisos:

```
Permission = Module + Resource + Action + Scope

Ejemplo:
- invoicing.invoice.create (all)     → Puede crear facturas para cualquier registro
- invoicing.invoice.read (own)       → Solo puede ver facturas que creó
- accounting.journal_entry.delete    → Puede eliminar asientos
- core.user.manage                   → Puede gestionar usuarios
```

**Roles predeterminados y sus permisos:**

| Rol           | Permisos resumidos                                                           |
| ------------- | ---------------------------------------------------------------------------- |
| Administrador | Acceso total a todos los módulos y configuraciones                           |
| Gerente       | CRUD en todos los módulos operativos, sin acceso a configuración del sistema |
| Contador      | CRUD en contabilidad y facturación, lectura en otros módulos                 |
| Vendedor      | CRUD en ventas y CRM, lectura de contactos e inventario, crear facturas      |
| Auditor       | Solo lectura en todos los módulos + acceso a logs de auditoría               |

---

## 15. Ambientes de Despliegue

### 15.1 Ambientes

| Ambiente   | Branch Git | Base de Datos             | URL                           | Propósito            |
| ---------- | ---------- | ------------------------- | ----------------------------- | -------------------- |
| Local      | cualquiera | Docker PostgreSQL 16      | `localhost:3000`              | Desarrollo diario    |
| Sandbox    | feature/\* | Amplify Sandbox (efímero) | `sandbox-{id}.amplifyapp.com` | Testing features AWS |
| Staging    | `staging`  | RDS staging instance      | `staging.nexoerp.com`         | QA, demos a clientes |
| Production | `main`     | RDS production instance   | `app.nexoerp.com`             | Producción           |

### 15.2 Flujo Git / CI-CD

```
feature/NEXO-xxx  →  PR  →  staging (auto-deploy, QA)  →  merge to main  →  production (auto-deploy)
```

- **Branch protection:** `main` y `staging` requieren PR con CI passing.
- **CI Pipeline (GitHub Actions + Amplify Build):**
  1. Lint (ESLint)
  2. Type check (TypeScript)
  3. Unit + Integration tests (Vitest)
  4. Build (Next.js)
  5. E2E tests (Playwright) — solo en staging
  6. Deploy (automático via Amplify)

### 15.3 Variables de Entorno por Ambiente

```env
# .env.example
DATABASE_URL=postgresql://user:pass@host:5432/nexoerp
DIRECT_URL=postgresql://user:pass@host:5432/nexoerp
NEXT_PUBLIC_APP_URL=http://localhost:3000
AWS_REGION=us-east-1
SES_FROM_EMAIL=no-reply@nexoerp.com
S3_BUCKET_DOCUMENTS=nexoerp-documents
SENTRY_DSN=
```

---

## 16. Herramientas de Desarrollo

### 16.1 MCP Servers

| MCP Server          | Propósito                                                        | Fase |
| ------------------- | ---------------------------------------------------------------- | ---- |
| GitHub MCP          | Gestión de repo, PRs, issues, code review                        | 0    |
| Context7            | Documentación actualizada de Next.js 15, Prisma 6, Amplify Gen 2 | 0    |
| Notion MCP          | Gestión de tareas, sprints, documentación de proyecto            | 0    |
| PostgreSQL MCP      | Inspección de schema, queries de debug, verificar RLS            | 1    |
| Figma MCP           | Extraer design tokens y specs de componentes                     | 2    |
| Sequential Thinking | Razonamiento estructurado para decisiones de arquitectura        | 0    |

### 16.2 Sub-Agentes IA

| Agente              | Rol                                                      | Cuándo invocar                            |
| ------------------- | -------------------------------------------------------- | ----------------------------------------- |
| Architect Agent     | Revisa decisiones de arquitectura, schema DB, patrones   | Antes de cada fase, al añadir módulo      |
| QA/Testing Agent    | Genera tests, revisa cobertura, valida edge cases        | Después de implementar cada feature       |
| UX/UI Review Agent  | Revisa consistencia de UI, accesibilidad, responsive     | Al completar cada pantalla                |
| DevOps/Deploy Agent | Revisa configuración de ambientes, CI/CD, seguridad      | Al configurar ambientes, antes de release |
| Planning Agent      | Descompone features en tareas, estima esfuerzo, prioriza | Al inicio de cada sprint                  |
| Data/Schema Agent   | Revisa modelos Prisma, migraciones, índices, integridad  | Al crear/modificar modelos                |

### 16.3 Changelog y Versionado

- **Formato:** [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) + [Semantic Versioning](https://semver.org/)
- **Herramienta:** `@changesets/cli`
- **Commits:** Conventional Commits (enforced via `commitlint` + `husky`)
- **Formato de commit:** `type(scope): description`
- **Types:** `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `chore`, `ci`
- **Scopes:** `core`, `auth`, `contacts`, `accounting`, `invoicing`, `purchasing`, `sales`, `inventory`, `ui`, `infra`
- **Ejemplo:** `feat(invoicing): add CAI range validation and expiration alerts`

### 16.4 Diseño de Interfaces

**Herramientas:**

- **v0.dev** (Vercel): Generación de componentes React/Tailwind desde prompts
- **Figma**: Mockups profesionales y design system

**Component Library:** shadcn/ui + Radix UI + Tailwind CSS

**Complementos UI:**

- TanStack Table (tablas avanzadas)
- Recharts (gráficos)
- dnd-kit (drag & drop para Kanban)
- cmdk (command palette ⌘K)

### 16.5 Prompts Recomendados para v0.dev

**Dashboard Principal:**

> "Create a modern ERP dashboard layout with: 1) A collapsible sidebar with icon+text navigation grouped by modules (Core, Accounting, Invoicing, Inventory, Sales, Purchases) with active state highlighting, 2) A top bar with global search (Command+K), company selector dropdown, notification bell, and user avatar menu, 3) Main content area showing: 4 KPI cards (revenue, pending invoices, overdue payments, active customers) with trend arrows and sparkline charts, a revenue vs expenses bar chart for the last 12 months, recent invoices table with status badges (draft=gray, published=blue, paid=green, overdue=red), and a quick actions panel. Use shadcn/ui components, Tailwind CSS, neutral palette with indigo-600 accent. Dark mode support. Responsive layout."

**Facturación Honduras:**

> "Design an invoice creation form for Honduras fiscal requirements: 1) Header section with auto-generated fiscal number (format: 000-001-01-00000001), CAI code display, date picker, due date, customer search combobox with recent suggestions, 2) Line items table with inline editing: product search, description, quantity (number input), unit price (currency formatted HNL), discount %, tax selector (ISV 15%, ISV 18%, Exempt), line total auto-calculated, add/remove row buttons, 3) Totals panel: subtotal, discount total, ISV 15% amount, ISV 18% amount, total in letters (Spanish), 4) Footer: payment terms selector, internal notes textarea, 5) Action bar: Save Draft, Preview PDF, Publish & Send buttons. Use shadcn/ui, clean professional design."

**Plan de Cuentas:**

> "Create an interactive chart of accounts tree view: hierarchical expandable list showing account code (bold monospace), account name, type badge (Asset/green, Liability/red, Equity/purple, Income/blue, Expense/orange), balance column right-aligned with currency format, search/filter bar at top, add account button, edit inline on click, drag and drop to reorganize hierarchy. Use shadcn/ui Tree component pattern with Tailwind CSS."

**Directorio de Contactos:**

> "Design a contacts directory page with: 1) Left panel: search bar + filter chips (All, Customers, Suppliers), scrollable contact list cards showing avatar/initials, name, company, tags. 2) Right panel: selected contact detail view with tabs (General, Addresses, Invoices, Payments, Activity). General tab shows: editable form fields for name, RTN (tax ID), type, email, phone, website, payment terms, credit limit, assigned salesperson. Address tab shows multiple addresses with map preview. Activity tab shows timeline of interactions. Use a master-detail layout with shadcn/ui."

### 16.6 Prompts Recomendados para Figma

> "Design a complete design system for NexoERP, a modern ERP application. Include: color palette (primary indigo, semantic colors for success/warning/error/info), typography scale (Inter font, 6 sizes), spacing scale (4px base), component library (buttons: primary/secondary/ghost/destructive in 3 sizes, inputs with labels and validation states, select/combobox, date picker, data table with sorting/filtering/pagination, stat cards, status badges, sidebar navigation with collapsible groups, modal dialogs, toast notifications, breadcrumbs, tabs). Dark mode variants for all components. 8px grid. Accessible contrast ratios (WCAG AA)."

---

## 17. Fases de Implementación

### Fase 0: Fundación (Semana 1–2)

| ID    | Tarea               | Descripción                                              |
| ----- | ------------------- | -------------------------------------------------------- |
| F0-01 | Setup proyecto      | Inicializar Next.js 15 + TypeScript + Tailwind CSS 4     |
| F0-02 | Amplify Gen 2       | Configurar auth (Cognito), storage (S3), hosting         |
| F0-03 | Prisma + PostgreSQL | Multi-file schema + Docker PostgreSQL local              |
| F0-04 | Tooling             | ESLint, Prettier, Husky, commitlint, Changesets          |
| F0-05 | Testing             | Configurar Vitest + Playwright                           |
| F0-06 | Repositorio         | GitHub con branch protection y PR templates              |
| F0-07 | Ambientes           | Configurar local (Docker), staging, production           |
| F0-08 | Documentación       | ARCHITECTURE.md con ADRs (Architecture Decision Records) |
| F0-09 | MCPs                | Configurar GitHub, Context7, Notion                      |

### Fase 1: Core System (Semana 3–6)

| ID    | Tarea         | Descripción                                             |
| ----- | ------------- | ------------------------------------------------------- |
| F1-01 | Autenticación | Login, register, forgot password via Cognito            |
| F1-02 | Middleware    | Auth check + tenant resolution en Next.js               |
| F1-03 | Schema Core   | Company, User, Role, Permission, Module, Menu, AuditLog |
| F1-04 | Multi-tenancy | RLS en PostgreSQL + Prisma Client Extension             |
| F1-05 | Empresas      | CRUD de empresas (datos fiscales, logo, moneda)         |
| F1-06 | Usuarios      | CRUD de usuarios con asignación de roles por empresa    |
| F1-07 | Permisos      | Sistema de permisos granulares + menú dinámico          |
| F1-08 | Módulos       | Sistema de módulos activables por empresa               |
| F1-09 | Auditoría     | Prisma Extension de auditoría automática                |
| F1-10 | Layout        | Sidebar, topbar, command palette, breadcrumbs           |
| F1-11 | Tests         | Unit + integration para auth, RBAC, multi-tenancy       |

### Fase 2: Contabilidad + Contactos (Semana 7–12)

| ID    | Tarea                 | Descripción                                                                                                                      |
| ----- | --------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| F2-01 | Schema Contactos      | Contact, ContactAddress, PaymentTerms                                                                                            |
| F2-02 | UI Contactos          | CRUD con vista lista + detalle                                                                                                   |
| F2-03 | Import Contactos      | Importación masiva desde Excel                                                                                                   |
| F2-04 | Schema Contabilidad   | Account, FiscalYear, FiscalPeriod, Journal, JournalEntry, JournalEntryLine, Currency, ExchangeRate                               |
| F2-05 | Seed Honduras         | Plan de cuentas ~200 cuentas NIIF                                                                                                |
| F2-06 | UI Plan Cuentas       | Vista árbol jerárquico                                                                                                           |
| F2-07 | Años Fiscales         | CRUD de años fiscales y períodos                                                                                                 |
| F2-08 | Asientos              | CRUD con validación partida doble                                                                                                |
| F2-09 | Multimoneda           | Currencies, exchange rates, conversión automática                                                                                |
| F2-10 | Reportes              | Balance General, Estado de Resultados, Balance de Comprobación, Libro Mayor, Libro Diario                                        |
| F2-11 | Exportación           | PDF + Excel de todos los reportes                                                                                                |
| F2-12 | Conciliación Bancaria | Importación de estados de cuenta, matching automático/manual con asientos de banco, reporte de partidas conciliadas y pendientes |
| F2-13 | Conciliación CxC      | Cruce de facturas de venta con pagos recibidos, reporte de antigüedad de saldos por cliente                                      |
| F2-14 | Conciliación CxP      | Cruce de facturas de proveedor con pagos realizados, reporte de antigüedad de saldos por proveedor                               |
| F2-15 | Tests                 | Testing de cada componente contable y conciliaciones                                                                             |

### Fase 3: Facturación Honduras (Semana 13–18)

| ID    | Tarea              | Descripción                                        |
| ----- | ------------------ | -------------------------------------------------- |
| F3-01 | Schema Facturación | Invoice, InvoiceLine, CAI, EmissionPoint, TaxRate  |
| F3-02 | Impuestos          | Configuración de ISV 15%, 18%, exento              |
| F3-03 | CAI                | Gestión CRUD + validaciones de rango y vencimiento |
| F3-04 | Facturas Venta     | Creación con líneas, impuestos, cálculos           |
| F3-05 | Numeración         | Fiscal automática formato SAR                      |
| F3-06 | Asientos Auto      | Generación automática al publicar factura          |
| F3-07 | Facturas Compra    | Facturas de proveedor con ISV crédito fiscal       |
| F3-08 | Notas Cr/Db        | Notas de crédito y débito vinculadas               |
| F3-09 | PDF Lambda         | Generación de PDF conforme SAR                     |
| F3-10 | Libros V/C         | Libro de Ventas y Libro de Compras mensual         |
| F3-11 | Export DET         | CSV compatible con DET del SAR                     |
| F3-12 | Retenciones        | Retenciones en la fuente                           |
| F3-13 | Tests E2E          | Flujo completo de facturación                      |

### Fase 4: Compras + Ventas/CRM + Inventarios (Semana 19–30)

| ID    | Tarea             | Descripción                                   |
| ----- | ----------------- | --------------------------------------------- |
| F4-01 | Compras           | Solicitudes, órdenes, recepciones             |
| F4-02 | Ventas/CRM        | Pipeline, presupuestos, pedidos               |
| F4-03 | Cobranzas         | Informe de cobranzas con aging                |
| F4-04 | Inventarios       | Productos, almacenes, movimientos, valoración |
| F4-05 | Reabastecimiento  | Reglas de reabastecimiento                    |
| F4-06 | Integración C→I→A | Compras ↔ Inventario ↔ Contabilidad           |
| F4-07 | Integración V→I→A | Ventas ↔ Inventario ↔ Contabilidad            |
| F4-08 | Tests Cross       | E2E de flujos completos cross-module          |

---

## 18. Criterios de Aceptación

### 18.1 Definición de "Done" (DoD)

Un feature se considera completo cuando:

- [ ] El código cumple las reglas de ESLint sin errores
- [ ] TypeScript compila sin errores (strict mode)
- [ ] Tests unitarios pasan con cobertura ≥ 80% de la lógica de negocio
- [ ] Tests de integración pasan para los API routes
- [ ] La funcionalidad es visualmente consistente con el design system
- [ ] El componente es responsive (1024px+ tablet, 375px+ mobile)
- [ ] La accesibilidad cumple WCAG AA (verificado con Lighthouse)
- [ ] Multi-tenant isolation verificado (no se filtran datos entre empresas)
- [ ] Auditoría funcional (las operaciones generan logs)
- [ ] El changeset file describe el cambio
- [ ] Commit messages siguen Conventional Commits
- [ ] PR aprobado y CI pipeline verde

### 18.2 Criterios de Aceptación del MVP

- [ ] Un usuario puede registrarse, crear una empresa, configurar sus datos fiscales
- [ ] Se puede gestionar un directorio de contactos con clientes y proveedores
- [ ] Se puede configurar y visualizar el plan de cuentas NIIF Honduras
- [ ] Se pueden crear y publicar asientos contables con partida doble
- [ ] Se pueden generar los 5 reportes contables básicos en PDF y Excel
- [ ] Se puede registrar un CAI y crear facturas de venta con numeración SAR
- [ ] La factura genera automáticamente su asiento contable
- [ ] El PDF de la factura cumple con los requisitos del SAR
- [ ] Se puede generar el libro de ventas mensual en formato compatible con DET
- [ ] El sistema multimoneda convierte correctamente HNL ↔ USD
- [ ] Dos empresas distintas no pueden ver datos entre sí (multi-tenant verified)
- [ ] Los roles y permisos restringen acceso correctamente

---

## 19. Glosario

| Término           | Definición                                                                                 |
| ----------------- | ------------------------------------------------------------------------------------------ |
| **SAR**           | Servicio de Administración de Rentas — Autoridad tributaria de Honduras                    |
| **DET**           | Declaración Electrónica de Tributos — Software del SAR para declaraciones                  |
| **ISV**           | Impuesto Sobre Ventas — Equivalente al IVA en Honduras (15% / 18%)                         |
| **ISR**           | Impuesto Sobre la Renta — Impuesto a las ganancias (25% para empresas)                     |
| **CAI**           | Código de Autorización de Impresión — Código del SAR que autoriza emisión de facturas      |
| **RTN**           | Registro Tributario Nacional — Número de identificación fiscal de Honduras                 |
| **NIIF**          | Normas Internacionales de Información Financiera                                           |
| **PYMEs**         | Pequeñas y Medianas Empresas                                                               |
| **RLS**           | Row-Level Security — Seguridad a nivel de fila en PostgreSQL                               |
| **RBAC**          | Role-Based Access Control — Control de acceso basado en roles                              |
| **Multi-tenancy** | Arquitectura donde múltiples clientes comparten una instancia del sistema                  |
| **HNL**           | Lempira — Moneda oficial de Honduras (código ISO 4217)                                     |
| **FIFO**          | First In, First Out — Método de valoración de inventario                                   |
| **Partida doble** | Principio contable: todo débito tiene un crédito igual                                     |
| **SPA**           | Single Page Application — Aplicación de página única                                       |
| **SSR**           | Server-Side Rendering — Renderizado en el servidor                                         |
| **ORM**           | Object-Relational Mapping — Mapeo objeto-relacional                                        |
| **CDN**           | Content Delivery Network — Red de distribución de contenido                                |
| **CI/CD**         | Continuous Integration / Continuous Deployment                                             |
| **ADR**           | Architecture Decision Record — Registro de decisiones de arquitectura                      |
| **CRUD**          | Create, Read, Update, Delete — Operaciones básicas de datos                                |
| **WAF**           | Web Application Firewall — Firewall de aplicación web                                      |
| **DDoS**          | Distributed Denial of Service — Ataque de denegación de servicio distribuido               |
| **NACL**          | Network Access Control List — Lista de control de acceso a nivel de subred                 |
| **SG**            | Security Group — Firewall virtual a nivel de instancia en AWS                              |
| **VPC**           | Virtual Private Cloud — Red virtual privada en AWS                                         |
| **AZ**            | Availability Zone — Zona de disponibilidad (datacenter independiente dentro de una región) |
| **KMS**           | Key Management Service — Servicio de gestión de claves de encriptación de AWS              |
| **MFA**           | Multi-Factor Authentication — Autenticación de múltiples factores                          |
| **TOTP**          | Time-based One-Time Password — Contraseña de un solo uso basada en tiempo                  |
| **CSP**           | Content Security Policy — Política de seguridad de contenido HTTP                          |
| **HSTS**          | HTTP Strict Transport Security — Fuerza conexiones HTTPS                                   |
| **CORS**          | Cross-Origin Resource Sharing — Control de acceso entre orígenes                           |
| **CSRF**          | Cross-Site Request Forgery — Falsificación de peticiones entre sitios                      |
| **XSS**           | Cross-Site Scripting — Inyección de scripts maliciosos                                     |

---

## Historial de Cambios del Documento

| Versión | Fecha      | Descripción                                                                                                                                                                                                                                           |
| ------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0.1.0   | 2026-03-01 | Versión inicial del documento de requerimientos                                                                                                                                                                                                       |
| 0.2.0   | 2026-03-02 | Agregada Sección 9: Seguridad de Infraestructura AWS (WAF, Shield, VPC, NACLs, Security Groups, encriptación, monitoreo). Renumeración de secciones 9-18 → 10-19. Nuevos términos de seguridad en glosario.                                           |
| 0.3.0   | 2026-03-09 | Arquitectura API-first para futura app móvil (OBJ-11, principio 7, actualización de patrón 4.2). Conciliación bancaria, CxC y CxP (RF-ACCT-19/20/21, nuevas entidades, tareas F2-12/13/14). Límite de usuarios por tenant (RF-CORE-13, sección 11.5). |

---

> **Nota:** Este documento es un artefacto vivo. Se actualizará conforme avance el desarrollo y se definan nuevos requerimientos o se modifiquen los existentes. Cada cambio debe reflejarse en el historial de cambios del documento.
