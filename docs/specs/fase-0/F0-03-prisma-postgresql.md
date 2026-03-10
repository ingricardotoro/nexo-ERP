# F0-03: Prisma ORM 6 + PostgreSQL 16 + Docker

> **ID:** F0-03
> **Fase:** 0 — Fundación
> **Prioridad:** 🔴 Crítica
> **Estimación:** 3–4 horas
> **Dependencias:** F0-01 (Setup proyecto)
> **Bloquea a:** F0-07 (Ambientes)

---

## 1. Objetivo

Configurar Prisma ORM 6 con multi-file schema modular, PostgreSQL 16 local via Docker Compose, y el cliente Prisma singleton con soporte para multi-tenant (preparación para Client Extensions de Fase 1). Establecer la base de datos local funcional para desarrollo.

---

## 2. Prerrequisitos

| Requisito | Detalle | Verificación |
|-----------|---------|-------------|
| F0-01 completado | Proyecto Next.js 15 funcional | `npm run dev` funciona |
| Docker Desktop | Instalado y ejecutándose | `docker --version` |
| Docker Compose | v2+ (incluido con Docker Desktop) | `docker compose version` |
| Puerto 5432 | Disponible en localhost | `Test-NetConnection localhost -Port 5432` (debe fallar) |
| Puerto 5050 | Disponible para pgAdmin (opcional) | `Test-NetConnection localhost -Port 5050` |

---

## 3. Pasos de Implementación

### 3.1 Crear `docker-compose.yml`

```yaml
# docker-compose.yml
# NexoERP — Servicios locales de desarrollo

services:
  # PostgreSQL 16 — Base de datos principal
  postgres:
    image: postgres:16-alpine
    container_name: nexoerp-postgres
    restart: unless-stopped
    ports:
      - "5432:5432"
    environment:
      POSTGRES_USER: nexoerp
      POSTGRES_PASSWORD: nexoerp_dev_2026
      POSTGRES_DB: nexoerp
      # Zona horaria de Honduras
      TZ: America/Tegucigalpa
    volumes:
      - nexoerp_pgdata:/var/lib/postgresql/data
      # Script de inicialización (habilitar extensiones)
      - ./docker/postgres/init.sql:/docker-entrypoint-initdb.d/01-init.sql
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U nexoerp -d nexoerp"]
      interval: 10s
      timeout: 5s
      retries: 5

  # pgAdmin 4 — GUI para administrar PostgreSQL (opcional)
  pgadmin:
    image: dpage/pgadmin4:latest
    container_name: nexoerp-pgadmin
    restart: unless-stopped
    ports:
      - "5050:80"
    environment:
      PGADMIN_DEFAULT_EMAIL: admin@nexoerp.com
      PGADMIN_DEFAULT_PASSWORD: admin123
    volumes:
      - nexoerp_pgadmin:/var/lib/pgadmin
    depends_on:
      postgres:
        condition: service_healthy

volumes:
  nexoerp_pgdata:
    name: nexoerp_pgdata
  nexoerp_pgadmin:
    name: nexoerp_pgadmin
```

### 3.2 Crear script de inicialización de PostgreSQL

```powershell
New-Item -ItemType Directory -Path "docker/postgres" -Force
```

```sql
-- docker/postgres/init.sql
-- Script de inicialización para PostgreSQL 16
-- Se ejecuta automáticamente al crear el contenedor por primera vez

-- Habilitar extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";    -- Generación de UUIDs
CREATE EXTENSION IF NOT EXISTS "pgcrypto";     -- Funciones criptográficas
CREATE EXTENSION IF NOT EXISTS "citext";       -- Text case-insensitive

-- Configurar timezone por defecto
ALTER DATABASE nexoerp SET timezone TO 'America/Tegucigalpa';

-- Mensaje de confirmación
DO $$
BEGIN
  RAISE NOTICE 'NexoERP database initialized successfully';
  RAISE NOTICE 'Extensions: uuid-ossp, pgcrypto, citext';
  RAISE NOTICE 'Timezone: America/Tegucigalpa';
END
$$;
```

### 3.3 Levantar PostgreSQL local

```powershell
# Levantar servicios
docker compose up -d

# Verificar que estén running
docker compose ps

# Ver logs de PostgreSQL
docker compose logs -f postgres

# Verificar conectividad
docker compose exec postgres pg_isready -U nexoerp -d nexoerp
```

### 3.4 Instalar Prisma ORM 6

```powershell
# Prisma CLI (dev dependency)
npm install --save-dev prisma@6

# Prisma Client (production dependency)
npm install @prisma/client@6
```

### 3.5 Inicializar Prisma con multi-file schema

```powershell
# Crear directorio para schemas modulares
New-Item -ItemType Directory -Path "prisma/schema" -Force
New-Item -ItemType Directory -Path "prisma/migrations" -Force
New-Item -ItemType Directory -Path "prisma/seed" -Force
```

### 3.6 Crear `prisma/schema/base.prisma`

```prisma
// prisma/schema/base.prisma
// Configuración base: datasource, generator y enums compartidos

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
  // Multi-file schema (Prisma 6)
  // Todos los archivos .prisma en este directorio se combinan
}

generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["prismaSchemaFolder"]
  // output por defecto: node_modules/.prisma/client
}

// === Enums globales ===

/// Roles predeterminados del sistema (RBAC)
enum SystemRole {
  ADMIN       // Administrador — Acceso total
  MANAGER     // Gerente — CRUD operativo
  ACCOUNTANT  // Contador — Contabilidad y facturación
  SALESPERSON // Vendedor — Ventas y CRM
  AUDITOR     // Auditor — Solo lectura + auditoría
}

/// Acciones de auditoría
enum AuditAction {
  CREATE
  UPDATE
  DELETE
}

/// Estados genéricos de documentos
enum DocumentStatus {
  DRAFT      // Borrador
  PUBLISHED  // Publicado/Activo
  CANCELLED  // Cancelado
}

/// Tipos de contacto
enum ContactType {
  NATURAL   // Persona natural
  JURIDICAL // Persona jurídica
}

/// Naturaleza de cuenta contable
enum AccountNature {
  DEBIT  // Deudora
  CREDIT // Acreedora
}

/// Tipos de cuenta contable (clasificación NIIF)
enum AccountType {
  ASSET    // Activo
  LIABILITY // Pasivo
  EQUITY   // Patrimonio/Capital
  INCOME   // Ingreso
  COST     // Costo
  EXPENSE  // Gasto
}

/// Estados de período fiscal
enum FiscalPeriodStatus {
  OPEN   // Abierto — permite asientos
  CLOSED // Cerrado — no permite asientos
}

/// Estados de factura
enum InvoiceStatus {
  DRAFT     // Borrador
  PUBLISHED // Publicada (con número fiscal)
  PAID      // Pagada
  CANCELLED // Cancelada
}
```

### 3.7 Crear `prisma/schema/core.prisma`

```prisma
// prisma/schema/core.prisma
// Módulo Core: Company, User (stubs mínimos para Fase 0)
// Se expandirá en Fase 1 con Role, Permission, Module, Menu, AuditLog

/// Empresa/Tenant — Entidad central de multi-tenancy
/// Todas las tablas de negocio referencian a Company via company_id
model Company {
  id        String   @id @default(uuid()) @db.Uuid
  
  // Datos de la empresa
  legalName     String  @map("legal_name")       // Razón social
  tradeName     String? @map("trade_name")       // Nombre comercial
  rtn           String  @unique                  // Registro Tributario Nacional
  email         String?
  phone         String?
  website       String?
  address       String?
  city          String?
  department    String?                          // Departamento (Honduras)
  
  // Configuración
  baseCurrency  String  @default("HNL") @map("base_currency")
  logoUrl       String? @map("logo_url")
  
  // Límites del tenant
  maxUsers      Int     @default(5) @map("max_users")  // RF-CORE-13
  
  // Estado
  isActive      Boolean @default(true) @map("is_active")
  
  // Timestamps
  createdAt     DateTime @default(now()) @map("created_at")
  updatedAt     DateTime @updatedAt @map("updated_at")
  
  // Relaciones (se expanden en Fase 1)
  users         User[]
  
  @@map("companies")
}

/// Usuario del sistema — vinculado a Cognito para autenticación
model User {
  id        String   @id @default(uuid()) @db.Uuid
  
  // Datos del usuario
  email     String   @unique
  fullName  String   @map("full_name")
  
  // Cognito
  cognitoSub String  @unique @map("cognito_sub")  // Cognito User Pool sub
  
  // Empresa actual (multi-tenant)
  companyId String   @map("company_id") @db.Uuid
  company   Company  @relation(fields: [companyId], references: [id], onDelete: Cascade)
  
  // Estado
  isActive  Boolean  @default(true) @map("is_active")
  
  // Timestamps
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")
  lastLoginAt DateTime? @map("last_login_at")
  
  // Índices — company_id SIEMPRE como primer campo en compuestos
  @@index([companyId, email])
  @@index([companyId, isActive])
  @@index([cognitoSub])
  
  @@map("users")
}
```

### 3.8 Crear Prisma Client singleton

```typescript
// src/lib/db/prisma.ts
import { PrismaClient } from '@prisma/client';

/**
 * Prisma Client singleton para NexoERP.
 *
 * En desarrollo, evita crear múltiples instancias de PrismaClient
 * cuando Next.js hace Fast Refresh (HMR).
 *
 * En Fase 1 se agregarán Client Extensions para:
 * - Filtro automático por company_id (multi-tenant)
 * - Auditoría automática (AuditLog)
 *
 * @see prisma/schema/ para los modelos
 */

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? ['query', 'error', 'warn']
        : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export default prisma;
```

### 3.9 Configurar scripts de Prisma en `package.json`

Agregar a `package.json`:

```json
{
  "scripts": {
    "db:migrate": "prisma migrate dev",
    "db:migrate:deploy": "prisma migrate deploy",
    "db:push": "prisma db push",
    "db:seed": "prisma db seed",
    "db:studio": "prisma studio",
    "db:generate": "prisma generate",
    "db:reset": "prisma migrate reset",
    "db:status": "prisma migrate status"
  },
  "prisma": {
    "seed": "npx tsx prisma/seed/index.ts"
  }
}
```

### 3.10 Crear seed básico

```typescript
// prisma/seed/index.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Seed básico para Fase 0.
 * Se expandirá en Fase 1 y 2 con:
 * - Roles y permisos predeterminados
 * - Plan de cuentas NIIF Honduras (~200 cuentas)
 * - Monedas (HNL, USD)
 * - Impuestos (ISV 15%, 18%, Exento)
 * - Condiciones de pago
 * - Diarios contables
 * - Tipos de documento fiscal
 */

async function main() {
  console.log('🌱 Iniciando seed de NexoERP...');

  // Empresa demo para desarrollo
  const demoCompany = await prisma.company.upsert({
    where: { rtn: '0801-1990-00001' },
    update: {},
    create: {
      legalName: 'Empresa Demo S.A. de C.V.',
      tradeName: 'Demo NexoERP',
      rtn: '0801-1990-00001',
      email: 'demo@nexoerp.com',
      phone: '+504 2222-3333',
      address: 'Col. Kennedy, Blvd. Morazán',
      city: 'Tegucigalpa',
      department: 'Francisco Morazán',
      baseCurrency: 'HNL',
      maxUsers: 10,
    },
  });

  console.log(`✅ Empresa demo creada: ${demoCompany.legalName} (${demoCompany.id})`);

  // Segunda empresa para testing de multi-tenant isolation
  const testCompany = await prisma.company.upsert({
    where: { rtn: '0501-2000-00002' },
    update: {},
    create: {
      legalName: 'Empresa Test Aislamiento Ltda.',
      tradeName: 'Test Isolation',
      rtn: '0501-2000-00002',
      email: 'test@nexoerp.com',
      phone: '+504 3333-4444',
      address: 'Bo. El Centro, 3ra Calle',
      city: 'San Pedro Sula',
      department: 'Cortés',
      baseCurrency: 'HNL',
      maxUsers: 5,
    },
  });

  console.log(`✅ Empresa test creada: ${testCompany.legalName} (${testCompany.id})`);

  console.log('🌱 Seed completado exitosamente.');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('❌ Error en seed:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
```

Instalar tsx para ejecutar TypeScript directamente:

```powershell
npm install --save-dev tsx
```

### 3.11 Ejecutar primera migración

```powershell
# Generar y aplicar la primera migración
npx prisma migrate dev --name init_core_company_user

# Verificar el estado
npx prisma migrate status
```

**Migración esperada crea:**
- Tabla `companies`
- Tabla `users`
- Índices definidos
- Enums del sistema

### 3.12 Crear migración SQL para RLS

Después de la migración de Prisma, crear una migración manual para RLS:

```powershell
# Crear migración vacía para RLS
npx prisma migrate dev --name add_rls_policies --create-only
```

Editar el archivo SQL generado en `prisma/migrations/[timestamp]_add_rls_policies/migration.sql`:

```sql
-- Habilitar RLS en tablas de negocio
-- Las tablas de plataforma (companies) NO llevan RLS

-- === Users ===
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_select ON users
  FOR SELECT USING (company_id = current_setting('app.current_company_id')::uuid);

CREATE POLICY tenant_isolation_insert ON users
  FOR INSERT WITH CHECK (company_id = current_setting('app.current_company_id')::uuid);

CREATE POLICY tenant_isolation_update ON users
  FOR UPDATE USING (company_id = current_setting('app.current_company_id')::uuid);

CREATE POLICY tenant_isolation_delete ON users
  FOR DELETE USING (company_id = current_setting('app.current_company_id')::uuid);

-- Nota: las políticas para tablas adicionales se agregarán 
-- en las migraciones de cada módulo (Fase 1, 2, 3...)
```

Aplicar la migración:

```powershell
npx prisma migrate dev
```

### 3.13 Ejecutar seed

```powershell
npx prisma db seed
```

### 3.14 Verificar con Prisma Studio

```powershell
npx prisma studio
```

Abrir `http://localhost:5555` y verificar:
- Tabla `companies` con 2 registros (Demo + Test)
- Tabla `users` vacía (se crearán en Fase 1)

### 3.15 Verificar RLS localmente

```powershell
# Conectar al PostgreSQL local y verificar RLS
docker compose exec postgres psql -U nexoerp -d nexoerp -c "
  SELECT tablename, policyname, cmd, qual 
  FROM pg_policies 
  WHERE schemaname = 'public';
"

# Verificar que RLS está habilitado
docker compose exec postgres psql -U nexoerp -d nexoerp -c "
  SELECT relname, relrowsecurity 
  FROM pg_class 
  WHERE relname IN ('users', 'companies');
"
# Esperado: users → true, companies → false
```

---

## 4. Estructura Resultante

```
prisma/
├── schema/
│   ├── base.prisma             # Datasource, generator, enums
│   └── core.prisma             # Company, User
├── migrations/
│   ├── [timestamp]_init_core_company_user/
│   │   └── migration.sql
│   ├── [timestamp]_add_rls_policies/
│   │   └── migration.sql
│   └── migration_lock.toml
└── seed/
    └── index.ts                # Seed básico

docker/
└── postgres/
    └── init.sql                # Extensiones y configuración

src/lib/db/
└── prisma.ts                   # Singleton Prisma Client

docker-compose.yml              # PostgreSQL 16 + pgAdmin
```

---

## 5. Criterios de Aceptación

| # | Criterio | Verificación |
|---|----------|-------------|
| 1 | `docker compose up -d` levanta PostgreSQL 16 sin errores | `docker compose ps` → healthy |
| 2 | PostgreSQL tiene extensiones uuid-ossp, pgcrypto, citext | `SELECT * FROM pg_extension;` |
| 3 | Prisma 6.x instalado | `npx prisma --version` → 6.x |
| 4 | Multi-file schema con `base.prisma` y `core.prisma` | Archivos en `prisma/schema/` |
| 5 | `prisma migrate dev` ejecuta sin errores | Exit code 0 |
| 6 | Tablas `companies` y `users` creadas | Prisma Studio o `\dt` en psql |
| 7 | RLS habilitado en tabla `users` | `relrowsecurity = true` |
| 8 | Policies de RLS creadas para `users` | `pg_policies` tiene 4 registros |
| 9 | RLS NO habilitado en `companies` (tabla de plataforma) | `relrowsecurity = false` |
| 10 | Índices compuestos tienen `company_id` como primer campo | `\di+` en psql |
| 11 | Seed crea 2 empresas (demo + test isolation) | Prisma Studio / SELECT |
| 12 | Prisma Client singleton en `src/lib/db/prisma.ts` | Archivo existe, importable |
| 13 | pgAdmin accesible en `localhost:5050` | Verificar en navegador |
| 14 | `prisma generate` regenera el cliente sin errores | Exit code 0 |
| 15 | Scripts `db:*` configurados en package.json | Verificar scripts |

---

## 6. Checklist de Verificación

```
□ Docker Desktop ejecutándose
□ docker-compose.yml creado con postgres + pgadmin
□ docker/postgres/init.sql con extensiones
□ docker compose up -d exitoso
□ PostgreSQL responde en localhost:5432
□ Prisma 6 instalado (CLI + Client)
□ prisma/schema/base.prisma con datasource, generator, enums
□ prisma/schema/core.prisma con Company, User
□ Todos los company_id son UUID, NOT NULL, FK
□ Índices compuestos con company_id primero
□ prisma migrate dev ejecutado exitosamente
□ RLS habilitado en users (no en companies)
□ 4 policies RLS en tabla users
□ Seed ejecutado con 2 empresas
□ Prisma Studio muestra datos correctos
□ Prisma Client singleton creado
□ Scripts npm configurados (db:migrate, db:seed, etc.)
□ tsx instalado para ejecutar seed en TypeScript
□ .env.local tiene DATABASE_URL correcto
□ pgAdmin accesible (opcional pero recomendado)
```

---

## 7. Notas Técnicas

- **Prisma 6 multi-file schema** requiere `previewFeatures = ["prismaSchemaFolder"]` en el generator. Todos los archivos `.prisma` dentro de `prisma/schema/` se combinan automáticamente.
- **`directUrl`** en el datasource es necesario para que `prisma migrate` conecte directamente a RDS sin pasar por RDS Proxy (en producción). En local ambos apuntan al mismo PostgreSQL.
- **RLS y el owner de tablas:** En local, el usuario `nexoerp` es owner de las tablas. Las policies de RLS aplican solo a non-owner roles. Para testing correcto de RLS, crear un rol de aplicación diferente al owner, o usar `FORCE ROW LEVEL SECURITY`. Esto se configurará en detalle en F1-04.
- **`migrate dev` en Git Bash:** No funciona en terminal non-interactive. Usar PowerShell o `db push` como alternativa.
- **pgAdmin credentials:** Solo para desarrollo local. Email: `admin@nexoerp.com`, Password: `admin123`.
- **RTN de ejemplo:** `0801-1990-00001` no es un RTN real. Se usa formato mimético para testing.
