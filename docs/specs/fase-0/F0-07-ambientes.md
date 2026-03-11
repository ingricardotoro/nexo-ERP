# F0-07: Ambientes — Local (Docker), Staging y Production

> **ID:** F0-07
> **Fase:** 0 — Fundación
> **Prioridad:** 🟡 Alta
> **Estimación:** 3–4 horas
> **Dependencias:** F0-02 (Amplify Gen 2), F0-03 (Prisma + PostgreSQL), F0-06 (Repositorio)
> **Bloquea a:** Todas las fases posteriores

---

## 1. Objetivo

Configurar los tres ambientes de trabajo de NexoERP (local, staging, production) y el despliegue automático de Amplify Gen 2. Cada ambiente debe tener su propia base de datos, variables de entorno y configuración aislada.

---

## 2. Mapa de Ambientes

| Ambiente       | Branch Git  | Base de Datos                | URL                           | Propósito            |
| -------------- | ----------- | ---------------------------- | ----------------------------- | -------------------- |
| **Local**      | cualquiera  | Docker PostgreSQL 16         | `localhost:3000`              | Desarrollo diario    |
| **Sandbox**    | `feature/*` | Amplify Sandbox (efímero)    | `sandbox-{id}.amplifyapp.com` | Testing features AWS |
| **Staging**    | `staging`   | RDS `db.t3.micro` staging    | `staging.nexoerp.com`         | QA, demos a clientes |
| **Production** | `main`      | RDS `db.t3.micro` production | `app.nexoerp.com`             | Producción           |

---

## 3. Prerrequisitos

| Requisito          | Detalle                      | Verificación                  |
| ------------------ | ---------------------------- | ----------------------------- |
| F0-02 completado   | Amplify Gen 2 configurado    | `amplify/backend.ts` existe   |
| F0-03 completado   | Prisma + Docker PostgreSQL   | `docker compose up` funciona  |
| F0-06 completado   | Repositorio con CI           | CI pipeline pasa              |
| AWS CLI v2         | Configurado con credenciales | `aws sts get-caller-identity` |
| Docker Desktop     | Instalado y corriendo        | `docker --version`            |
| Dominio (opcional) | Para staging/production      | DNS configurado               |

---

## 4. Pasos de Implementación

### 4.1 Ambiente Local — Docker Compose Completo

El archivo `docker-compose.yml` ya fue creado en F0-03. Aquí lo extendemos con servicios adicionales para desarrollo completo:

```yaml
# docker-compose.yml
services:
  # === PostgreSQL 16 ===
  postgres:
    image: postgres:16-alpine
    container_name: nexoerp-db
    restart: unless-stopped
    ports:
      - '5432:5432'
    environment:
      POSTGRES_DB: nexoerp
      POSTGRES_USER: nexoerp
      POSTGRES_PASSWORD: nexoerp_dev_2026
      TZ: America/Tegucigalpa
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./docker/postgres/init.sql:/docker-entrypoint-initdb.d/init.sql
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U nexoerp -d nexoerp']
      interval: 10s
      timeout: 5s
      retries: 5

  # === pgAdmin 4 ===
  pgadmin:
    image: dpage/pgadmin4:latest
    container_name: nexoerp-pgadmin
    restart: unless-stopped
    ports:
      - '5050:80'
    environment:
      PGADMIN_DEFAULT_EMAIL: admin@nexoerp.com
      PGADMIN_DEFAULT_PASSWORD: admin123
      PGADMIN_LISTEN_PORT: 80
    volumes:
      - pgadmin_data:/var/lib/pgadmin
    depends_on:
      postgres:
        condition: service_healthy

  # === MailHog (SMTP de desarrollo para emails) ===
  mailhog:
    image: mailhog/mailhog:latest
    container_name: nexoerp-mailhog
    restart: unless-stopped
    ports:
      - '1025:1025' # SMTP
      - '8025:8025' # Web UI
    logging:
      driver: 'none'

volumes:
  postgres_data:
    driver: local
  pgadmin_data:
    driver: local
```

### 4.2 Variables de Entorno por Ambiente

**Archivo base `.env.example` (ya creado en F0-01, ampliamos):**

```env
# .env.example — NexoERP Environment Variables
# Copiar a .env.local para desarrollo

# ============ Database ============
DATABASE_URL=postgresql://nexoerp:nexoerp_dev_2026@localhost:5432/nexoerp
DIRECT_URL=postgresql://nexoerp:nexoerp_dev_2026@localhost:5432/nexoerp

# ============ App ============
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_APP_ENV=development
NODE_ENV=development

# ============ AWS ============
AWS_REGION=us-east-1

# ============ Email (local: MailHog) ============
SMTP_HOST=localhost
SMTP_PORT=1025
SES_FROM_EMAIL=no-reply@nexoerp.com

# ============ Storage ============
S3_BUCKET_DOCUMENTS=nexoerp-documents

# ============ Monitoring (opcional) ============
SENTRY_DSN=
NEXT_PUBLIC_SENTRY_DSN=

# ============ Feature Flags ============
NEXT_PUBLIC_ENABLE_DEBUG=true
```

**Crear `.env.local` para desarrollo:**

```powershell
# Copiar y personalizar
Copy-Item .env.example .env.local
```

**Crear `.env.staging` (referencia para Amplify):**

```env
# .env.staging — Variables para Staging (configurar en Amplify Console)
DATABASE_URL=postgresql://nexoerp:${DB_PASSWORD}@${RDS_HOST}:5432/nexoerp_staging
DIRECT_URL=postgresql://nexoerp:${DB_PASSWORD}@${RDS_HOST}:5432/nexoerp_staging
NEXT_PUBLIC_APP_URL=https://staging.nexoerp.com
NEXT_PUBLIC_APP_ENV=staging
NODE_ENV=production
AWS_REGION=us-east-1
SES_FROM_EMAIL=no-reply@nexoerp.com
S3_BUCKET_DOCUMENTS=nexoerp-documents-staging
SENTRY_DSN=
```

**Crear `.env.production` (referencia para Amplify):**

```env
# .env.production — Variables para Production (configurar en Amplify Console)
DATABASE_URL=postgresql://nexoerp:${DB_PASSWORD}@${RDS_HOST}:5432/nexoerp_production
DIRECT_URL=postgresql://nexoerp:${DB_PASSWORD}@${RDS_HOST}:5432/nexoerp_production
NEXT_PUBLIC_APP_URL=https://app.nexoerp.com
NEXT_PUBLIC_APP_ENV=production
NODE_ENV=production
AWS_REGION=us-east-1
SES_FROM_EMAIL=no-reply@nexoerp.com
S3_BUCKET_DOCUMENTS=nexoerp-documents-production
SENTRY_DSN=<configurar en Amplify>
```

### 4.3 Validación de variables de entorno con Zod

```typescript
// src/lib/env.ts
import { z } from 'zod';

const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().url().startsWith('postgresql://'),
  DIRECT_URL: z.string().url().startsWith('postgresql://'),

  // App
  NEXT_PUBLIC_APP_URL: z.string().url(),
  NEXT_PUBLIC_APP_ENV: z.enum(['development', 'staging', 'production']).default('development'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // AWS
  AWS_REGION: z.string().default('us-east-1'),

  // Email
  SES_FROM_EMAIL: z.string().email().optional(),

  // Storage
  S3_BUCKET_DOCUMENTS: z.string().optional(),

  // Monitoring
  SENTRY_DSN: z.string().url().optional().or(z.literal('')),
});

// Validar al importar (fail-fast en server startup)
function validateEnv() {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    console.error('❌ Variables de entorno inválidas:', parsed.error.flatten().fieldErrors);
    throw new Error('Variables de entorno inválidas. Revisar .env.local');
  }

  return parsed.data;
}

export const env = validateEnv();

// Tipo para autocompletado
export type Env = z.infer<typeof envSchema>;
```

```typescript
// src/lib/env-client.ts
import { z } from 'zod';

// Solo variables NEXT_PUBLIC_* disponibles en el cliente
const clientEnvSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url(),
  NEXT_PUBLIC_APP_ENV: z.enum(['development', 'staging', 'production']).default('development'),
  NEXT_PUBLIC_ENABLE_DEBUG: z
    .string()
    .transform((v) => v === 'true')
    .default('false'),
});

export const clientEnv = clientEnvSchema.parse({
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  NEXT_PUBLIC_APP_ENV: process.env.NEXT_PUBLIC_APP_ENV,
  NEXT_PUBLIC_ENABLE_DEBUG: process.env.NEXT_PUBLIC_ENABLE_DEBUG,
});
```

### 4.4 Script de Setup para Desarrollo Local

```json
// Agregar a package.json scripts
{
  "scripts": {
    "dev": "next dev --turbopack",
    "dev:setup": "node scripts/dev-setup.mjs",
    "docker:up": "docker compose up -d",
    "docker:down": "docker compose down",
    "docker:reset": "docker compose down -v && docker compose up -d",
    "docker:logs": "docker compose logs -f"
  }
}
```

```javascript
// scripts/dev-setup.mjs
#!/usr/bin/env node

/**
 * Script de setup para entorno de desarrollo local.
 * Ejecutar: npm run dev:setup
 *
 * Realiza:
 * 1. Verifica Docker en ejecución
 * 2. Levanta contenedores
 * 3. Espera a que PostgreSQL esté listo
 * 4. Ejecuta migraciones Prisma
 * 5. Ejecuta seed
 */

import { execSync } from 'child_process';
import { existsSync, copyFileSync } from 'fs';

const run = (cmd, opts = {}) => {
  console.log(`\n▶ ${cmd}`);
  try {
    execSync(cmd, { stdio: 'inherit', ...opts });
    return true;
  } catch {
    return false;
  }
};

const step = (name) => console.log(`\n${'='.repeat(50)}\n🔧 ${name}\n${'='.repeat(50)}`);

async function main() {
  console.log('\n🚀 NexoERP — Dev Environment Setup\n');

  // 1. Verificar .env.local
  step('1/5 — Verificar .env.local');
  if (!existsSync('.env.local')) {
    console.log('📋 Creando .env.local desde .env.example...');
    copyFileSync('.env.example', '.env.local');
    console.log('✅ .env.local creado. Revisa los valores si es necesario.');
  } else {
    console.log('✅ .env.local ya existe.');
  }

  // 2. Verificar Docker
  step('2/5 — Verificar Docker');
  if (!run('docker info', { stdio: 'pipe' })) {
    console.error('❌ Docker no está corriendo. Inicia Docker Desktop.');
    process.exit(1);
  }
  console.log('✅ Docker está corriendo.');

  // 3. Levantar contenedores
  step('3/5 — Levantar contenedores Docker');
  run('docker compose up -d');

  // 4. Esperar a PostgreSQL
  step('4/5 — Esperar a PostgreSQL');
  let retries = 10;
  while (retries > 0) {
    if (run('docker exec nexoerp-db pg_isready -U nexoerp', { stdio: 'pipe' })) {
      console.log('✅ PostgreSQL listo.');
      break;
    }
    retries--;
    console.log(`⏳ Esperando... (${retries} intentos restantes)`);
    await new Promise((r) => setTimeout(r, 2000));
  }
  if (retries === 0) {
    console.error('❌ PostgreSQL no respondió a tiempo.');
    process.exit(1);
  }

  // 5. Migraciones y seed
  step('5/5 — Migraciones y Seed');
  run('npx prisma migrate deploy');
  run('npx prisma db seed');

  console.log('\n✅ Entorno de desarrollo listo!');
  console.log('\n📋 Servicios:');
  console.log('   App:     http://localhost:3000');
  console.log('   pgAdmin: http://localhost:5050');
  console.log('   MailHog: http://localhost:8025');
  console.log('\n🚀 Ejecuta: npm run dev\n');
}

main().catch(console.error);
```

### 4.5 Amplify Gen 2 — Configuración de Ambientes

Amplify Gen 2 mapea automáticamente ramas de Git a ambientes. Configurar en `amplify/backend.ts`:

```typescript
// amplify/backend.ts (actualizar)
import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource';
import { storage } from './storage/resource';

const backend = defineBackend({
  auth,
  storage,
});

// ===== Configuración por ambiente =====
// Amplify Gen 2 detecta el branch automáticamente:
//   main     → production
//   staging  → staging
//   feature/* → sandbox (efímero, creado con npx ampx sandbox)
```

### 4.6 Amplify Branch Mapping (via Console)

Configurar en **AWS Amplify Console → App Settings → Branch auto-detection**:

1. Ir a [Amplify Console](https://console.aws.amazon.com/amplify)
2. Seleccionar la app NexoERP
3. **Hosting → Branch settings:**

| Branch    | Ambiente   | Auto deploy | Domain                |
| --------- | ---------- | ----------- | --------------------- |
| `main`    | Production | ✅          | `app.nexoerp.com`     |
| `staging` | Staging    | ✅          | `staging.nexoerp.com` |

4. **Environment variables** (Settings → Environment variables):

Para **staging**:

```
DATABASE_URL         = postgresql://nexoerp:XXX@staging-rds.xxx.us-east-1.rds.amazonaws.com:5432/nexoerp_staging
DIRECT_URL           = postgresql://nexoerp:XXX@staging-rds.xxx.us-east-1.rds.amazonaws.com:5432/nexoerp_staging
NEXT_PUBLIC_APP_URL  = https://staging.nexoerp.com
NEXT_PUBLIC_APP_ENV  = staging
SES_FROM_EMAIL       = no-reply@nexoerp.com
S3_BUCKET_DOCUMENTS  = nexoerp-documents-staging
```

Para **production**:

```
DATABASE_URL         = postgresql://nexoerp:XXX@prod-rds.xxx.us-east-1.rds.amazonaws.com:5432/nexoerp_production
DIRECT_URL           = postgresql://nexoerp:XXX@prod-rds.xxx.us-east-1.rds.amazonaws.com:5432/nexoerp_production
NEXT_PUBLIC_APP_URL  = https://app.nexoerp.com
NEXT_PUBLIC_APP_ENV  = production
SES_FROM_EMAIL       = no-reply@nexoerp.com
S3_BUCKET_DOCUMENTS  = nexoerp-documents-production
SENTRY_DSN           = <configurar>
```

> ⚠️ Las contraseñas de RDS se almacenan en AWS Secrets Manager y se referencian desde Amplify Console, **nunca** en código.

### 4.7 Amplify Build Settings

```yaml
# amplify.yml — build settings
version: 1
frontend:
  phases:
    preBuild:
      commands:
        - npm ci
        - npx prisma generate
    build:
      commands:
        - npm run build
  artifacts:
    baseDirectory: .next
    files:
      - '**/*'
  cache:
    paths:
      - node_modules/**/*
      - .next/cache/**/*
```

### 4.8 RDS PostgreSQL (Staging + Production)

> ⚠️ **Nota:** RDS se configura en Fase 0 pero el uso real comienza en Staging/Production. Costos según REQUIREMENTS.md: ~$15-30/mes por instancia `db.t3.micro`.

**Crear RDS via CLI (staging):**

```powershell
# Crear Security Group para RDS
aws ec2 create-security-group `
  --group-name nexoerp-rds-staging-sg `
  --description "Security group for NexoERP RDS Staging" `
  --vpc-id <vpc-id>

# Permitir acceso desde Amplify (Regla de ingreso)
aws ec2 authorize-security-group-ingress `
  --group-id <sg-id> `
  --protocol tcp `
  --port 5432 `
  --cidr 0.0.0.0/0  # En producción: restringir a VPC CIDR

# Crear instancia RDS
aws rds create-db-instance `
  --db-instance-identifier nexoerp-staging `
  --db-instance-class db.t3.micro `
  --engine postgres `
  --engine-version "16.4" `
  --master-username nexoerp `
  --master-user-password "<GENERAR-PASSWORD-SEGURO>" `
  --allocated-storage 20 `
  --storage-type gp3 `
  --vpc-security-group-ids <sg-id> `
  --db-name nexoerp_staging `
  --backup-retention-period 7 `
  --preferred-backup-window "04:00-05:00" `
  --preferred-maintenance-window "sun:06:00-sun:07:00" `
  --storage-encrypted `
  --no-publicly-accessible `
  --region us-east-1

# Guardar password en Secrets Manager
aws secretsmanager create-secret `
  --name nexoerp/staging/db-password `
  --description "NexoERP Staging DB password" `
  --secret-string "<MISMO-PASSWORD>"
```

> **Nota:** La creación de RDS para **production** sigue el mismo proceso, cambiando `staging` por `production` y usando bases de datos separadas.

### 4.9 Actualizar .gitignore para ambientes

```gitignore
# Agregar a .gitignore existente (sección de ambientes)

# === Environments ===
.env.local
.env.staging
.env.production
.env*.local

# === Docker ===
# Los datos de Docker volumes NO deben persistirse en Git
docker/postgres/data/
```

### 4.10 Health Check Endpoint

```typescript
// src/app/api/health/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  const startTime = Date.now();

  try {
    // Check DB connection
    await prisma.$queryRaw`SELECT 1`;
    const dbLatency = Date.now() - startTime;

    return NextResponse.json(
      {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        environment: process.env.NEXT_PUBLIC_APP_ENV || 'unknown',
        version: process.env.npm_package_version || '0.0.0',
        checks: {
          database: { status: 'connected', latency: `${dbLatency}ms` },
        },
      },
      { status: 200 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        environment: process.env.NEXT_PUBLIC_APP_ENV || 'unknown',
        checks: {
          database: {
            status: 'disconnected',
            error: error instanceof Error ? error.message : 'Unknown error',
          },
        },
      },
      { status: 503 },
    );
  }
}
```

### 4.11 Script de verificación de ambiente

```powershell
# scripts/verify-env.ps1 — Script PowerShell para verificar ambiente local

Write-Host "`n🔍 NexoERP — Verificación de Ambiente Local`n" -ForegroundColor Cyan

# 1. Docker
Write-Host "1. Docker..." -NoNewline
try {
    $null = docker info 2>$null
    Write-Host " ✅" -ForegroundColor Green
} catch {
    Write-Host " ❌ Docker no está corriendo" -ForegroundColor Red
}

# 2. PostgreSQL
Write-Host "2. PostgreSQL..." -NoNewline
$pgReady = docker exec nexoerp-db pg_isready -U nexoerp 2>$null
if ($LASTEXITCODE -eq 0) {
    Write-Host " ✅" -ForegroundColor Green
} else {
    Write-Host " ❌ No disponible" -ForegroundColor Red
}

# 3. .env.local
Write-Host "3. .env.local..." -NoNewline
if (Test-Path ".env.local") {
    Write-Host " ✅" -ForegroundColor Green
} else {
    Write-Host " ❌ No existe (copiar de .env.example)" -ForegroundColor Red
}

# 4. node_modules
Write-Host "4. node_modules..." -NoNewline
if (Test-Path "node_modules") {
    Write-Host " ✅" -ForegroundColor Green
} else {
    Write-Host " ❌ Ejecutar 'npm install'" -ForegroundColor Red
}

# 5. Prisma Client
Write-Host "5. Prisma Client..." -NoNewline
if (Test-Path "node_modules/.prisma/client") {
    Write-Host " ✅" -ForegroundColor Green
} else {
    Write-Host " ❌ Ejecutar 'npx prisma generate'" -ForegroundColor Red
}

# 6. Migraciones
Write-Host "6. Migraciones Prisma..." -NoNewline
$status = npx prisma migrate status 2>$null
if ($LASTEXITCODE -eq 0) {
    Write-Host " ✅" -ForegroundColor Green
} else {
    Write-Host " ⚠️  Ejecutar 'npm run db:migrate'" -ForegroundColor Yellow
}

Write-Host "`n📋 Servicios:" -ForegroundColor Cyan
Write-Host "   App:     http://localhost:3000"
Write-Host "   pgAdmin: http://localhost:5050 (admin@nexoerp.com / admin123)"
Write-Host "   MailHog: http://localhost:8025"
Write-Host ""
```

---

## 5. Estructura Resultante

```
├── amplify/
│   └── backend.ts                    # ← actualizado con docs
├── amplify.yml                       # Amplify build settings
├── docker-compose.yml                # ← actualizado con MailHog
├── docker/
│   └── postgres/
│       └── init.sql                  # Extensiones PostgreSQL
├── scripts/
│   ├── dev-setup.mjs                 # Setup automático dev
│   └── verify-env.ps1                # Verificación de ambiente
├── src/
│   ├── app/
│   │   └── api/
│   │       └── health/
│   │           └── route.ts          # Health check endpoint
│   └── lib/
│       ├── env.ts                    # Validación env (server)
│       └── env-client.ts             # Validación env (client)
├── .env.example                      # ← actualizado
├── .env.local                        # Dev local (no en Git)
├── .env.staging                      # Referencia staging (no en Git)
└── .env.production                   # Referencia production (no en Git)
```

---

## 6. Criterios de Aceptación

| #   | Criterio                                                      | Verificación                              |
| --- | ------------------------------------------------------------- | ----------------------------------------- |
| 1   | Docker Compose levanta PG16 + pgAdmin + MailHog               | `docker compose up -d` sin errores        |
| 2   | Health check responde `200` en local                          | `curl localhost:3000/api/health`          |
| 3   | `.env.example` tiene todas las variables documentadas         | Revisión manual                           |
| 4   | Validación Zod falla si falta variable requerida              | Eliminar `DATABASE_URL`, verificar error  |
| 5   | `amplify.yml` configura build correctamente                   | Deploy exitoso en Amplify                 |
| 6   | Amplify mapea `staging` y `main` a ambientes                  | Console → Branch settings verificado      |
| 7   | Variables de entorno configuradas en Amplify Console          | Settings → Env vars verificado            |
| 8   | `.env.local`, `.env.staging`, `.env.production` en .gitignore | `git status` no los muestra               |
| 9   | Script `dev-setup.mjs` completa sin errores                   | `npm run dev:setup`                       |
| 10  | Script `verify-env.ps1` reporta estado correcto               | `powershell scripts/verify-env.ps1`       |
| 11  | MailHog captura emails en `localhost:8025`                    | Enviar test email                         |
| 12  | Cada ambiente tiene BD aislada (no comparten datos)           | Verificar URLs distintas                  |
| 13  | Passwords de RDS en Secrets Manager, no en código             | No hay passwords en archivos .env tracked |

---

## 7. Checklist de Verificación

```
□ docker-compose.yml actualizado con MailHog
□ .env.example completo con todas las variables
□ .env.local creado y funcional
□ .env.staging y .env.production como referencia
□ src/lib/env.ts valida variables con Zod
□ src/lib/env-client.ts para variables públicas
□ scripts/dev-setup.mjs funciona end-to-end
□ scripts/verify-env.ps1 reporta todo ✅
□ src/app/api/health/route.ts responde correctamente
□ amplify.yml configurado
□ Amplify Console: staging branch mapeado
□ Amplify Console: main branch mapeado
□ Amplify Console: env vars configuradas por ambiente
□ .gitignore incluye todos los .env locales
□ RDS staging creado (o documentado para crear después)
□ Secrets Manager con passwords de RDS
□ npm run dev:setup → npm run dev funciona de principio a fin
```

---

## 8. Costos AWS por Ambiente

| Servicio        | Local        | Staging           | Production        |
| --------------- | ------------ | ----------------- | ----------------- |
| Amplify Hosting | $0           | ~$5/mes           | ~$5/mes           |
| RDS db.t3.micro | $0 (Docker)  | ~$15-30/mes       | ~$15-30/mes       |
| Cognito         | $0 (sandbox) | Gratis (<50k MAU) | Gratis (<50k MAU) |
| S3              | $0 (sandbox) | ~$1/mes           | ~$1/mes           |
| **Total**       | **$0**       | **~$21-36/mes**   | **~$21-36/mes**   |

> Budget alert de $50/mes total configurado en F0-02.

---

## 9. Notas Técnicas

- **Amplify Gen 2 auto-deploy:** Cada push a `staging` o `main` dispara un build automático. No se necesita configurar CI de deploy separado — Amplify reemplaza al job de deploy.
- **Sandbox efímero:** `npx ampx sandbox` crea un ambiente temporal con Cognito + S3 propios. Se elimina con `npx ampx sandbox delete`.
- **RDS en Fase 0:** No es obligatorio crear RDS inmediatamente. El desarrollo local usa Docker. RDS se necesita cuando staging o production se activen.
- **MailHog como sustituto local de SES:** En desarrollo, MailHog captura todos los emails en `localhost:8025`. En staging/production se usa Amazon SES.
- **Health check:** Sirve para monitoreo de uptime y como verificación rápida de conectividad BD. Se puede usar con AWS ALB health checks o servicios externos.
