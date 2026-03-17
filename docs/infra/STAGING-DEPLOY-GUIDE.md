# NexoERP — Guía de Deploy Staging (Ejecución Paso a Paso)

**Objetivo:** Desplegar la infraestructura AWS completa para el ambiente de staging, desde RDS hasta Amplify Hosting funcionando.

**Tiempo estimado total:** 60-90 minutos  
**Presupuesto:** ~$1.35/mes (con Free Tier AWS activo)

---

## 📋 Tabla de Contenidos

1. [Pre-requisitos y Validación Inicial](#1-pre-requisitos-y-validación-inicial)
2. [Creación de RDS PostgreSQL 16](#2-creación-de-rds-postgresql-16-staging)
3. [Configuración de Secrets Manager](#3-configuración-de-secrets-manager)
4. [Deploy de Lambda PostConfirmation](#4-deploy-de-lambda-postconfirmation)
5. [Aplicar Migraciones Prisma](#5-aplicar-migraciones-prisma-en-rds)
6. [Seed Data (Opcional)](#6-deploy-de-seed-data-opcional)
7. [Configuración de Amplify Hosting](#7-configuración-de-amplify-hosting)
8. [Primer Deploy y Validación](#8-primer-deploy-y-validación)
9. [Monitoreo CloudWatch](#9-monitoreo-y-cloudwatch)
10. [Rollback Plan](#10-rollback-plan)

---

## 1. Pre-requisitos y Validación Inicial

### 1.1 Verificar AWS CLI configurado

```powershell
# Verificar configuración AWS CLI
aws configure list

# Output esperado:
#       Name                    Value             Type    Location
#       ----                    -----             ----    --------
#    profile                <not set>             None    None
# access_key     ****************XXXX shared-credentials-file
# secret_key     ****************XXXX shared-credentials-file
#     region               us-east-1      config-file    ~/.aws/config
```

✅ **Checkpoint:** Región debe ser `us-east-1`  
⚠️ **Troubleshooting:** Si aparece "Unable to locate credentials", ejecutar `aws configure` y proporcionar Access Key ID y Secret Access Key.

---

### 1.2 Verificar Account ID

```powershell
# Obtener Account ID actual
$ACCOUNT_ID = aws sts get-caller-identity --query Account --output text
Write-Host "Account ID: $ACCOUNT_ID" -ForegroundColor Green

# Verificar que coincide con el esperado
if ($ACCOUNT_ID -ne "155326049791") {
    Write-Host "⚠️  ADVERTENCIA: Account ID diferente al esperado (155326049791)" -ForegroundColor Yellow
}
```

---

### 1.3 Validar Amplify Gen 2 Sandbox Local

```powershell
# Verificar que el sandbox está corriendo (opcional — para desarrollo local)
npx ampx sandbox --help

# Output esperado: Muestra comandos disponibles (sandbox, generate, configure, etc.)
```

⚠️ **IMPORTANTE:** NO uses `npx ampx sandbox` conectado a RDS staging. El sandbox debe usar bases de datos temporales o Docker local.

---

### 1.4 Verificar Migraciones Prisma Pendientes

```powershell
# Listar estado de migraciones
npx prisma migrate status

# Output esperado (desarrollo local):
# The following migrations have not yet been applied:
# 20260311033815_init_core_company_user
# 20260311033827_add_rls_policies
# 20260311183128_fix_ondelete_restrict_company_user
# 20260311183955_disable_force_rls_allow_owner_bypass
```

✅ **Checkpoint:** Deberías tener 4 migraciones pendientes (si es primer deploy a staging).

---

### 1.5 Verificar Branch Strategy

```powershell
# Verificar rama actual
git branch --show-current

# Output esperado: feat/fase-1-core-system (o staging si ya mergeaste)

# Verificar que staging está actualizado con main
git fetch origin
git log --oneline origin/main..origin/staging
```

---

## 2. Creación de RDS PostgreSQL 16 (Staging)

**⏱️ Tiempo estimado:** 15-20 minutos (creación + espera a "available")

### 2.1 Obtener Default VPC y Subnets

```powershell
# Obtener Default VPC ID
$VPC_ID = aws ec2 describe-vpcs `
    --filters "Name=is-default,Values=true" `
    --query "Vpcs[0].VpcId" `
    --output text

Write-Host "VPC ID: $VPC_ID" -ForegroundColor Cyan

# Obtener Subnets de Default VPC (mínimo 2 en diferentes AZs)
$SUBNETS = aws ec2 describe-subnets `
    --filters "Name=vpc-id,Values=$VPC_ID" `
    --query "Subnets[*].SubnetId" `
    --output text

$SUBNET_ARRAY = $SUBNETS -split '\s+'
Write-Host "Subnets encontradas: $($SUBNET_ARRAY.Count)" -ForegroundColor Cyan
$SUBNET_ARRAY | ForEach-Object { Write-Host "  - $_" -ForegroundColor Gray }
```

✅ **Checkpoint:** Debes tener mínimo 2 subnets en diferentes Availability Zones.

---

### 2.2 Crear DB Subnet Group

```powershell
# Crear DB Subnet Group (requerido por RDS)
aws rds create-db-subnet-group `
    --db-subnet-group-name nexoerp-staging-subnet-group `
    --db-subnet-group-description "Subnet group for NexoERP Staging RDS" `
    --subnet-ids $SUBNET_ARRAY[0] $SUBNET_ARRAY[1] `
    --tags "Key=Project,Value=NexoERP" "Key=Environment,Value=staging"

# Output esperado: JSON con DBSubnetGroup creado
```

✅ **Checkpoint:** Subnet Group creado exitosamente.

---

### 2.3 Crear Security Group para RDS

```powershell
# Crear Security Group
$SG_ID = aws ec2 create-security-group `
    --group-name nexoerp-staging-rds-sg `
    --description "Security group for NexoERP Staging RDS PostgreSQL" `
    --vpc-id $VPC_ID `
    --tag-specifications 'ResourceType=security-group,Tags=[{Key=Name,Value=nexoerp-staging-rds-sg},{Key=Project,Value=NexoERP}]' `
    --query "GroupId" `
    --output text

Write-Host "Security Group ID: $SG_ID" -ForegroundColor Green

# Permitir PostgreSQL desde anywhere (temporalmente — Amplify usa IPs públicas)
aws ec2 authorize-security-group-ingress `
    --group-id $SG_ID `
    --protocol tcp `
    --port 5432 `
    --cidr 0.0.0.0/0 `
    --group-rule-description "PostgreSQL from Amplify Hosting"
```

⚠️ **Nota de Seguridad:** `0.0.0.0/0` es aceptable en staging porque:

1. RDS estará en subnet privada dentro de la VPC
2. Requiere credenciales válidas (usuario/password en Secrets Manager)
3. Conexión via TLS/SSL obligatoria (`sslmode=require`)
4. En producción se refinará con VPC Peering o PrivateLink

---

### 2.4 Crear Secret para Master Password

```powershell
# Generar contraseña fuerte (32 caracteres aleatorios)
$MASTER_PASSWORD = -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 32 | ForEach-Object {[char]$_})

Write-Host "Contraseña generada (guárdala en un lugar seguro):" -ForegroundColor Yellow
Write-Host $MASTER_PASSWORD -ForegroundColor Red

# Crear secret en AWS Secrets Manager
aws secretsmanager create-secret `
    --name nexoerp/staging/rds/master `
    --description "Master password for NexoERP Staging RDS" `
    --secret-string "{`"username`":`"nexoerp_admin`",`"password`":`"$MASTER_PASSWORD`"}" `
    --tags "Key=Project,Value=NexoERP" "Key=Environment,Value=staging"

# Obtener ARN del secret (guardar para referencia)
$MASTER_SECRET_ARN = aws secretsmanager describe-secret `
    --secret-id nexoerp/staging/rds/master `
    --query ARN `
    --output text

Write-Host "Master Secret ARN: $MASTER_SECRET_ARN" -ForegroundColor Cyan
```

---

### 2.5 Crear RDS Instance (db.t3.micro — Free Tier)

```powershell
# Crear instancia RDS PostgreSQL 16
Write-Host "🚀 Creando RDS instance (esto tomará 10-15 minutos)..." -ForegroundColor Yellow

aws rds create-db-instance `
    --db-instance-identifier nexoerp-staging `
    --db-instance-class db.t3.micro `
    --engine postgres `
    --engine-version 16.4 `
    --master-username nexoerp_admin `
    --master-user-password "$MASTER_PASSWORD" `
    --allocated-storage 20 `
    --storage-type gp3 `
    --iops 3000 `
    --db-subnet-group-name nexoerp-staging-subnet-group `
    --vpc-security-group-ids $SG_ID `
    --db-name nexoerp `
    --backup-retention-period 7 `
    --preferred-backup-window "03:00-04:00" `
    --preferred-maintenance-window "sun:04:00-sun:05:00" `
    --enable-cloudwatch-logs-exports postgresql upgrade `
    --storage-encrypted `
    --publicly-accessible `
    --no-multi-az `
    --tags "Key=Project,Value=NexoERP" "Key=Environment,Value=staging"

# Output: JSON con DBInstance creado (estado: "creating")
```

**Parámetros clave:**

- `--db-instance-class db.t3.micro`: Free Tier elegible (750h/mes gratis)
- `--allocated-storage 20`: 20 GB gp3 (incluido en Free Tier)
- `--no-multi-az`: Single-AZ suficiente para staging (Multi-AZ cuesta 2x)
- `--publicly-accessible`: Permite conexión desde Amplify (protegido por SG)
- `--storage-encrypted`: Encriptación en reposo (requerido por RS-ENC-03)

---

### 2.6 Esperar a que RDS esté disponible

```powershell
Write-Host "⏳ Esperando a que RDS esté disponible (10-15 minutos)..." -ForegroundColor Yellow

# Esperar hasta que el status sea "available"
aws rds wait db-instance-available --db-instance-identifier nexoerp-staging

Write-Host "✅ RDS instance disponible" -ForegroundColor Green

# Obtener endpoint (guardar para DATABASE_URL y DIRECT_URL)
$RDS_ENDPOINT = aws rds describe-db-instances `
    --db-instance-identifier nexoerp-staging `
    --query "DBInstances[0].Endpoint.Address" `
    --output text

Write-Host "RDS Endpoint: $RDS_ENDPOINT" -ForegroundColor Cyan
Write-Host "⚠️  Guardar endpoint — lo necesitarás para connection strings" -ForegroundColor Yellow
```

✅ **Checkpoint:** RDS endpoint debe terminar en `.us-east-1.rds.amazonaws.com`

**Costo estimado:** $0.00/mes (primeros 12 meses con Free Tier), luego ~$15.92/mes.

---

### 2.7 Configurar PostgreSQL (Extensiones + Roles)

```powershell
# Conectar a RDS via psql (asegúrate de tener PostgreSQL client instalado)
# Opción 1: winget install PostgreSQL.PostgreSQL
# Opción 2: Usar pgAdmin Query Tool
# Opción 3: AWS RDS Query Editor (Console): https://console.aws.amazon.com/rds/home?region=us-east-1#query-editor

# Configurar variable de entorno para password (evita warning)
$env:PGPASSWORD = $MASTER_PASSWORD

# Conectar a RDS
psql -h $RDS_ENDPOINT -U nexoerp_admin -d nexoerp -p 5432 -c "\conninfo"

# Output esperado: "You are connected to database "nexoerp" as user "nexoerp_admin"..."
```

**Ejecutar el siguiente SQL en RDS (copiar/pegar en psql o pgAdmin):**

```sql
-- ===================================================
-- Script: Configure PostgreSQL Extensions + Roles
-- Ejecutar en: RDS nexoerp-staging database
-- ===================================================

-- 1. Crear extensiones requeridas por Prisma
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "citext";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- 2. Crear rol de aplicación (nexoerp_app — usado por Prisma en runtime)
CREATE ROLE nexoerp_app WITH LOGIN PASSWORD 'APP_PASSWORD_AQUI';

-- 3. Otorgar permisos de conexión
GRANT CONNECT ON DATABASE nexoerp TO nexoerp_app;

-- 4. Otorgar permisos en schema public
GRANT USAGE ON SCHEMA public TO nexoerp_app;

-- 5. Permisos para crear tablas (Prisma migrations)
GRANT CREATE ON SCHEMA public TO nexoerp_app;

-- 6. Permisos CRUD en tablas existentes (se expande con cada migración)
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO nexoerp_app;

-- 7. Permisos en sequences (para auto-increment IDs si se usan)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO nexoerp_app;

-- 8. Otorgar permisos futuros (para tablas creadas luego de este script)
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO nexoerp_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO nexoerp_app;

-- 9. Verificar roles
\du

-- Output esperado:
--                                   List of roles
--  Role name   |                         Attributes
-- -------------+------------------------------------------------------------
--  nexoerp_admin | Create role, Create DB, Replication +
--              | Password valid until infinity
--  nexoerp_app | Password valid until infinity
--  rds_superuser | Cannot login

-- 10. Verificar extensiones
\dx

-- Output esperado: uuid-ossp, pgcrypto, citext, pg_trgm, plpgsql
```

**Generar contraseña para `nexoerp_app`:**

```powershell
# En otra ventana PowerShell (mientras psql está abierto):
$APP_PASSWORD = -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 32 | ForEach-Object {[char]$_})
Write-Host "Contraseña App Role: $APP_PASSWORD" -ForegroundColor Red
```

Reemplazar `APP_PASSWORD_AQUI` en el script SQL con la contraseña generada.

---

### 2.8 Crear Secret para App Credentials

```powershell
# Crear secret para nexoerp_app (usado por Prisma en runtime)
aws secretsmanager create-secret `
    --name nexoerp/staging/rds/app `
    --description "App credentials for NexoERP Staging RDS" `
    --secret-string "{`"username`":`"nexoerp_app`",`"password`":`"$APP_PASSWORD`",`"engine`":`"postgres`",`"host`":`"$RDS_ENDPOINT`",`"port`":5432,`"dbname`":`"nexoerp`"}" `
    --tags "Key=Project,Value=NexoERP" "Key=Environment,Value=staging"

# Obtener ARN
$APP_SECRET_ARN = aws secretsmanager describe-secret `
    --secret-id nexoerp/staging/rds/app `
    --query ARN `
    --output text

Write-Host "App Secret ARN: $APP_SECRET_ARN" -ForegroundColor Cyan
```

✅ **Checkpoint RDS completo:**

- [x] RDS instance `nexoerp-staging` disponible
- [x] Security Group configurado
- [x] Extensiones PostgreSQL instaladas
- [x] Roles `nexoerp_admin` y `nexoerp_app` creados
- [x] Secrets Manager con credenciales

---

## 3. Configuración de Secrets Manager

**✅ COMPLETADO en sección anterior** — Ya creamos:

- `nexoerp/staging/rds/master` — Credenciales de administrador
- `nexoerp/staging/rds/app` — Credenciales de aplicación

### 3.1 Construir Connection Strings

```powershell
# Obtener credenciales de Secrets Manager
$appSecretJson = aws secretsmanager get-secret-value `
    --secret-id nexoerp/staging/rds/app `
    --query SecretString `
    --output text

$adminSecretJson = aws secretsmanager get-secret-value `
    --secret-id nexoerp/staging/rds/master `
    --query SecretString `
    --output text

$appSecret = $appSecretJson | ConvertFrom-Json
$adminSecret = $adminSecretJson | ConvertFrom-Json

# Construir DATABASE_URL (para runtime — usa nexoerp_app)
$DATABASE_URL = "postgresql://$($appSecret.username):$($appSecret.password)@$RDS_ENDPOINT:5432/nexoerp?schema=public&sslmode=require&connection_limit=10"

# Construir DIRECT_URL (para migraciones — usa nexoerp_admin)
$DIRECT_URL = "postgresql://$($adminSecret.username):$($adminSecret.password)@$RDS_ENDPOINT:5432/nexoerp?schema=public&sslmode=require"

# Mostrar (con passwords ofuscados)
Write-Host "DATABASE_URL: postgresql://$($appSecret.username):****@$RDS_ENDPOINT:5432/nexoerp" -ForegroundColor Gray
Write-Host "DIRECT_URL: postgresql://$($adminSecret.username):****@$RDS_ENDPOINT:5432/nexoerp" -ForegroundColor Gray

# Guardar en variables de entorno temporales (para uso posterior)
$env:DATABASE_URL = $DATABASE_URL
$env:DIRECT_URL = $DIRECT_URL
```

⚠️ **IMPORTANTE:** Estas connection strings se configurarán en Amplify Console en la sección 7.

---

## 4. Deploy de Lambda PostConfirmation

**⏱️ Tiempo estimado:** 10 minutos

El código de la Lambda ya está implementado en:

- `amplify/functions/post-confirmation/handler.ts` — Lógica de sincronización
- `amplify/functions/post-confirmation/resource.ts` — Definición CDK

### 4.1 Actualizar Backend de Amplify (Integrar Lambda)

**DECISIÓN:** Como estamos usando Amplify Gen 2 con IaC en TypeScript, la Lambda se desplegará automáticamente cuando conectemos GitHub a Amplify Hosting.

**POR AHORA:** Validar que el código de la Lambda esté correcto.

```powershell
# Verificar que el handler existe
Get-Content amplify/functions/post-confirmation/handler.ts | Select-Object -First 30

# Output esperado: Código TypeScript con import de Prisma Client
```

### 4.2 Configurar Trigger en Cognito (Post-Deploy de Amplify)

⚠️ **Este paso se ejecutará DESPUÉS de desplegar Amplify en la sección 7.**

La Lambda se conectará automáticamente a Cognito como Post-Confirmation trigger cuando Amplify Gen 2 haga el deploy.

**Validación pendiente (sección 8):**

1. Crear un usuario de prueba en Cognito
2. Confirmar email
3. Verificar que apareció en tabla `users` de RDS

---

## 5. Aplicar Migraciones Prisma en RDS

**⏱️ Tiempo estimado:** 5 minutos

### 5.1 Configurar .env local para apuntar a RDS Staging

```powershell
# Crear archivo .env.staging (NO commitear — ya está en .gitignore)
@"
DATABASE_URL=$DATABASE_URL
DIRECT_URL=$DIRECT_URL
"@ | Out-File -FilePath .env.staging -Encoding UTF8

Write-Host "✅ Archivo .env.staging creado" -ForegroundColor Green
```

---

### 5.2 Aplicar Migraciones

```powershell
# Aplicar migraciones a RDS staging
npx prisma migrate deploy

# Output esperado:
# Prisma Migrate resolves the following migrations:
# migrations/
#   └─ 20260311033815_init_core_company_user/
#   └─ 20260311033827_add_rls_policies/
#   └─ 20260311183128_fix_ondelete_restrict_company_user/
#   └─ 20260311183955_disable_force_rls_allow_owner_bypass/
#
# The following migrations have been applied:
# migrations/
#   └─ 20260311033815_init_core_company_user
#   └─ 20260311033827_add_rls_policies
#   └─ 20260311183128_fix_ondelete_restrict_company_user
#   └─ 20260311183955_disable_force_rls_allow_owner_bypass
#
# All migrations have been successfully applied.
```

---

### 5.3 Verificar Migraciones Aplicadas

```powershell
# Verificar estado
npx prisma migrate status

# Output esperado:
# Database schema is up to date!
```

---

### 5.4 Verificar Tablas Creadas en RDS

```powershell
# Conectar a RDS y listar tablas
psql -h $RDS_ENDPOINT -U nexoerp_admin -d nexoerp -p 5432 -c "\dt"

# Output esperado:
#              List of relations
#  Schema |        Name         | Type  |     Owner
# --------+---------------------+-------+---------------
#  public | companies           | table | nexoerp_admin
#  public | users               | table | nexoerp_admin
#  public | _prisma_migrations  | table | nexoerp_admin
# (3 rows)
```

---

### 5.5 Verificar Políticas RLS Creadas

```powershell
# Verificar políticas RLS en tabla users
psql -h $RDS_ENDPOINT -U nexoerp_admin -d nexoerp -p 5432 -c "SELECT tablename, policyname FROM pg_policies WHERE schemaname = 'public';"

# Output esperado:
#  tablename |         policyname
# -----------+-----------------------------
#  users     | tenant_isolation_select
#  users     | tenant_isolation_insert
#  users     | tenant_isolation_update
#  users     | tenant_isolation_delete
# (4 rows)
```

✅ **Checkpoint Prisma completo:**

- [x] 4 migraciones aplicadas
- [x] Tablas `companies` y `users` creadas
- [x] RLS policies activas en tabla `users`

---

## 6. Deploy de Seed Data (Opcional)

**⏱️ Tiempo estimado:** 2 minutos

### 6.1 Ejecutar Seed

```powershell
# Seed: Crear 2 empresas demo + RBAC system (módulos, permisos, roles)
npx prisma db seed

# Output esperado:
# 🌱 Seeding database...
# ✅ Created 2 companies
# ✅ Created RBAC system (5 roles, 50 permissions, 8 modules)
# ✅ Seed completed
```

---

### 6.2 Verificar Seed

```powershell
# Verificar empresas creadas
psql -h $RDS_ENDPOINT -U nexoerp_admin -d nexoerp -p 5432 -c "SELECT id, business_name, max_users FROM companies;"

# Output esperado:
#                   id                  |            business_name            | max_users
# --------------------------------------+------------------------------------+-----------
#  xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx | Empresa Demo Staging SA            |         5
#  yyyyyyyy-yyyy-yyyy-yyyy-yyyyyyyyyyyy | Empresa Test Aislamiento Ltda      |         3
# (2 rows)
```

⚠️ **NOTA:** En producción NO ejecutar seed. El seed es solo para desarrollo y staging.

---

## 7. Configuración de Amplify Hosting

**⏱️ Tiempo estimado:** 15 minutos

### 7.1 Conectar GitHub a AWS Amplify (Via Console)

**Opción A: AWS Console (Recomendado para primera vez)**

1. Ir a **AWS Amplify Console:**  
   https://console.aws.amazon.com/amplify/home?region=us-east-1

2. **Si ya existe un proyecto "NexoERP"** (desde sandbox):
   - Click en el proyecto
   - Ir a la pestaña **"Hosting"**
   - Click en **"Connect branch"**

3. **Si NO existe proyecto:**
   - Click en **"New app" → "Host web app"**
   - Seleccionar **"GitHub"** como source
   - Click "Authorize AWS Amplify" (OAuth login con GitHub)
   - Seleccionar repositorio: `nexoerp`
   - Branch: `staging`

4. **Configurar build settings:**
   - Amplify detectará automáticamente `amplify.yml`
   - Click "Next" → "Save and deploy"

⚠️ **ESPERA:** El deploy fallará porque faltan variables de entorno. Continúa al paso 7.2.

---

**Opción B: AWS CLI (Automatizado)**

```powershell
# Crear Personal Access Token en GitHub (si no tienes)
# https://github.com/settings/tokens/new
# Scopes requeridos: repo, admin:repo_hook

$GITHUB_TOKEN = "ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"  # REEMPLAZA CON TU TOKEN
$REPO_URL = "https://github.com/<OWNER>/nexoerp"  # REEMPLAZA <OWNER>

# Crear app Amplify (skip si ya existe)
$APP_ID = aws amplify create-app `
    --name "NexoERP" `
    --description "ERP multi-tenant para PYMEs Honduras" `
    --repository $REPO_URL `
    --oauth-token $GITHUB_TOKEN `
    --platform WEB_COMPUTE `
    --tags "Key=Project,Value=NexoERP" "Key=Environment,Value=staging" `
    --enable-auto-branch-creation `
    --auto-branch-creation-patterns "feat/*" "fix/*" `
    --query "app.appId" `
    --output text

Write-Host "App ID: $APP_ID" -ForegroundColor Cyan

# Conectar branch staging
aws amplify create-branch `
    --app-id $APP_ID `
    --branch-name staging `
    --description "Staging environment for QA and demos" `
    --enable-auto-build `
    --enable-pull-request-preview false `
    --stage PRODUCTION `
    --tags "Key=Environment,Value=staging"
```

---

### 7.2 Configurar Variables de Entorno en Amplify

**Via AWS Console (Recomendado):**

1. Ir a Amplify Console → App "NexoERP" → **"Environment variables"**
2. Click en **"Manage variables"**
3. Agregar las siguientes variables **(copiar/pegar values desde PowerShell outputs anteriores):**

| Variable                          | Valor                                                                                                               | Tipo       |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ---------- |
| `DATABASE_URL`                    | `postgresql://nexoerp_app:<PASSWORD>@<RDS_ENDPOINT>:5432/nexoerp?schema=public&sslmode=require&connection_limit=10` | **Secret** |
| `DIRECT_URL`                      | `postgresql://nexoerp_admin:<PASSWORD>@<RDS_ENDPOINT>:5432/nexoerp?schema=public&sslmode=require`                   | **Secret** |
| `NEXT_PUBLIC_AMPLIFY_REGION`      | `us-east-1`                                                                                                         | Plaintext  |
| `NEXT_PUBLIC_USER_POOL_ID`        | `us-east-1_adYn3n5fz`                                                                                               | Plaintext  |
| `NEXT_PUBLIC_USER_POOL_CLIENT_ID` | `<CLIENT_ID>` (obtener abajo)                                                                                       | Plaintext  |
| `NEXT_PUBLIC_S3_BUCKET`           | `amplify-nexoerp-marvin-sa-nexoerpdocumentsbucketb8-bimtcqkqm8s3`                                                   | Plaintext  |
| `NODE_ENV`                        | `production`                                                                                                        | Plaintext  |
| `NEXT_TELEMETRY_DISABLED`         | `1`                                                                                                                 | Plaintext  |

4. **IMPORTANTE:** Seleccionar **"Secret"** para `DATABASE_URL` y `DIRECT_URL`.

**Obtener User Pool Client ID:**

```powershell
# Obtener Client ID de Cognito
$CLIENT_ID = aws cognito-idp list-user-pool-clients `
    --user-pool-id us-east-1_adYn3n5fz `
    --max-results 10 `
    --query "UserPoolClients[0].ClientId" `
    --output text

Write-Host "User Pool Client ID: $CLIENT_ID" -ForegroundColor Cyan
```

---

**Via Script PowerShell (Alternativa):**

```powershell
# Ejecutar script de configuración automática
.\scripts\configure-amplify-staging.ps1 -AppId "<APP_ID>" -UserPoolClientId "<CLIENT_ID>"

# El script generará un archivo amplify-env-vars-staging.json con todas las variables
# Copiar/pegar manualmente en Amplify Console (AWS CLI no soporta --environment-variables con JSON directo)
```

---

### 7.3 Verificar Build Settings (amplify.yml)

```powershell
# Verificar que amplify.yml tenga la configuración correcta
Get-Content amplify.yml

# Output esperado:
# version: 1
# frontend:
#   phases:
#     preBuild:
#       commands:
#         - npm ci
#         - npx prisma generate
#     build:
#       commands:
#         - npm run build
#   artifacts:
#     baseDirectory: .next
#     files:
#       - '**/*'
#   cache:
#     paths:
#       - node_modules/**/*
#       - .next/cache/**/*
```

✅ **Checkpoint:** Build settings OK — incluye `npx prisma generate` en preBuild.

---

## 8. Primer Deploy y Validación

**⏱️ Tiempo estimado:** 15-20 minutos (build + tests)

### 8.1 Merge a Branch Staging

```powershell
# Asegurarse de que todos los tests pasan localmente
npm test

# Output esperado: PASSED (17/17 tests)

# Merge feat/fase-1-core-system → staging
git checkout staging
git merge feat/fase-1-core-system

# Resolver conflictos si hay (unlikely en primer merge)

# Push a GitHub (trigger Amplify deploy)
git push origin staging
```

---

### 8.2 Monitorear GitHub Actions CI

```powershell
# Ver último workflow run en GitHub
# https://github.com/<OWNER>/nexoerp/actions

# O via GitHub CLI:
gh run list --branch staging
```

**Quality gates esperados (CI debe pasar):**

- ✅ Lint (ESLint + Prettier)
- ✅ TypeScript check
- ✅ Tests (Vitest — 17/17 passing)
- ✅ Build (Next.js production)

⏱️ **Tiempo CI:** ~4-5 minutos

---

### 8.3 Monitorear Amplify Build

```powershell
# Ir a Amplify Console y ver build logs:
# https://console.aws.amazon.com/amplify/home?region=us-east-1#/<APP_ID>/staging

# O via AWS CLI:
$JOB_ID = aws amplify list-jobs `
    --app-id $APP_ID `
    --branch-name staging `
    --max-results 1 `
    --query "jobSummaries[0].jobId" `
    --output text

Write-Host "Job ID: $JOB_ID" -ForegroundColor Cyan

# Ver logs en tiempo real (polling cada 10 segundos)
while ($true) {
    $STATUS = aws amplify get-job `
        --app-id $APP_ID `
        --branch-name staging `
        --job-id $JOB_ID `
        --query "job.summary.status" `
        --output text

    Write-Host "Build Status: $STATUS" -ForegroundColor Yellow

    if ($STATUS -eq "SUCCEED") {
        Write-Host "✅ Build completed successfully" -ForegroundColor Green
        break
    } elseif ($STATUS -eq "FAILED") {
        Write-Host "❌ Build failed" -ForegroundColor Red
        break
    }

    Start-Sleep -Seconds 10
}
```

**Fases de build Amplify:**

1. **Provision** (30s) — Crear ambiente de build
2. **Build** (5-8 min) — `npm ci` + `npx prisma generate` + `npm run build`
3. **Deploy** (1-2 min) — Subir artifacts a CloudFront
4. **Verify** (30s) — Health check de la app

⏱️ **Tiempo total:** ~10-12 minutos

---

### 8.4 Obtener URL de Staging

```powershell
# Obtener URL del ambiente staging
$STAGING_URL = aws amplify get-branch `
    --app-id $APP_ID `
    --branch-name staging `
    --query "branch.branchName" `
    --output text

# La URL tendrá formato: https://staging.<random-id>.amplifyapp.com
$AMPLIFY_URL = "https://staging.d1234567890abc.amplifyapp.com"  # REEMPLAZA con tu URL real

Write-Host "🌐 Staging URL: $AMPLIFY_URL" -ForegroundColor Cyan

# Abrir en navegador
Start-Process $AMPLIFY_URL
```

---

### 8.5 Validación Funcional (Checklist Manual)

**8.5.1 Homepage Loads**

- [ ] Navegar a `$AMPLIFY_URL`
- [ ] Verificar que carga la landing page sin errores
- [ ] Abrir DevTools → Console → Verificar que no hay errores de JavaScript

---

**8.5.2 Login con Cognito**

- [ ] Click en "Login" o "Iniciar Sesión"
- [ ] Debería redirigir a Cognito Hosted UI
- [ ] Crear una cuenta de prueba:
  - Email: `test-staging@nexoerp.com`
  - Password: `Test123!@#`
  - Custom attributes (si el formulario los pide):
    - `custom:company_id`: Copiar ID de una de las empresas creadas en seed (ejecutar query en RDS)
    - `custom:role`: `ADMIN`
    - `custom:fullname`: `Usuario Test Staging`

```powershell
# Obtener company_id para testing
psql -h $RDS_ENDPOINT -U nexoerp_admin -d nexoerp -p 5432 -c "SELECT id, business_name FROM companies LIMIT 1;"

# Copiar el UUID del id
```

- [ ] Verificar email (Cognito envía código de verificación)
- [ ] Confirmar código
- [ ] **Validar Lambda PostConfirmation:**

```powershell
# Verificar que el usuario apareció en tabla users
psql -h $RDS_ENDPOINT -U nexoerp_admin -d nexoerp -p 5432 -c "SELECT id, email, full_name, company_id, role FROM users WHERE email = 'test-staging@nexoerp.com';"

# Output esperado: 1 row con datos del usuario
```

✅ **Checkpoint:** Usuario sincronizado Cognito ↔️ PostgreSQL.

---

**8.5.3 Dashboard Loads**

- [ ] Después de login, debería redirigir a `/dashboard`
- [ ] Verificar que carga sin errores
- [ ] Verificar que muestra información del usuario logueado

---

**8.5.4 Página de Usuarios (CRUD)**

- [ ] Navegar a `/dashboard/users`
- [ ] Verificar que carga la tabla de usuarios (TanStack Table)
- [ ] Debería mostrar solo el usuario recién creado (mismo `company_id`)
- [ ] Verificar multi-tenant isolation:
  - Logout
  - Crear otro usuario con `company_id` DIFERENTE
  - Login con segundo usuario
  - Navegar a `/dashboard/users`
  - Verificar que NO ve al primer usuario (isolation OK)

---

**8.5.5 API Endpoints**

```powershell
# Test API endpoint GET /api/v1/core/users (requiere auth token)
# Obtener token de Cognito (via login en navegador → DevTools → localStorage → copiar token)

$TOKEN = "eyJraWQiOi..."  # REEMPLAZA con token real

# Llamar API
Invoke-RestMethod -Uri "$AMPLIFY_URL/api/v1/core/users" `
    -Method GET `
    -Headers @{ Authorization = "Bearer $TOKEN" } `
    -ContentType "application/json"

# Output esperado: JSON con lista de usuarios del mismo company_id
```

---

### 8.6 Validación de RLS (Multi-Tenant Isolation)

**Test manual en RDS:**

```sql
-- Conectar a RDS como nexoerp_app (rol de aplicación)
-- Configurar company_id actual
SET LOCAL app.current_company_id = '<COMPANY_1_ID>';

-- Query users (debería ver solo users de company_1)
SELECT id, email, full_name, company_id FROM users;

-- Cambiar a company_2
SET LOCAL app.current_company_id = '<COMPANY_2_ID>';

-- Query users (debería ver solo users de company_2)
SELECT id, email, full_name, company_id FROM users;
```

✅ **Checkpoint RLS:** Aislamiento multi-tenant funcionando correctamente.

---

## 9. Monitoreo y CloudWatch

**⏱️ Tiempo estimado:** 10 minutos

### 9.1 Configurar Alarmas Básicas

```powershell
# Crear alarma: RDS CPU > 80%
aws cloudwatch put-metric-alarm `
    --alarm-name "NexoERP-Staging-RDS-HighCPU" `
    --alarm-description "RDS CPU usage exceeds 80%" `
    --metric-name CPUUtilization `
    --namespace AWS/RDS `
    --statistic Average `
    --period 300 `
    --threshold 80 `
    --comparison-operator GreaterThanThreshold `
    --evaluation-periods 2 `
    --dimensions "Name=DBInstanceIdentifier,Value=nexoerp-staging" `
    --treat-missing-data notBreaching

# Crear alarma: Lambda PostConfirmation errors > 5
aws cloudwatch put-metric-alarm `
    --alarm-name "NexoERP-Staging-Lambda-PostConfirmation-Errors" `
    --alarm-description "PostConfirmation Lambda errors exceed 5 in 5 minutes" `
    --metric-name Errors `
    --namespace AWS/Lambda `
    --statistic Sum `
    --period 300 `
    --threshold 5 `
    --comparison-operator GreaterThanThreshold `
    --evaluation-periods 1 `
    --dimensions "Name=FunctionName,Value=post-confirmation" `
    --treat-missing-data notBreaching

# Crear alarma: Amplify build failures
aws cloudwatch put-metric-alarm `
    --alarm-name "NexoERP-Staging-Amplify-BuildFailures" `
    --alarm-description "Amplify build failures detected" `
    --metric-name BuildFailures `
    --namespace AWS/Amplify `
    --statistic Sum `
    --period 300 `
    --threshold 1 `
    --comparison-operator GreaterThanThreshold `
    --evaluation-periods 1 `
    --dimensions "Name=App,Value=$APP_ID" "Name=Branch,Value=staging" `
    --treat-missing-data notBreaching
```

---

### 9.2 Configurar CloudWatch Logs Retention

```powershell
# RDS Logs: Retención 7 días
aws logs put-retention-policy `
    --log-group-name "/aws/rds/instance/nexoerp-staging/postgresql" `
    --retention-in-days 7

# Lambda Logs: Retención 7 días
aws logs put-retention-policy `
    --log-group-name "/aws/lambda/post-confirmation" `
    --retention-in-days 7
```

---

### 9.3 Ver Logs en Tiempo Real

```powershell
# Logs de Lambda PostConfirmation
aws logs tail "/aws/lambda/post-confirmation" --follow

# Logs de RDS (requiere habilitar log_statement en parameter group)
aws logs tail "/aws/rds/instance/nexoerp-staging/postgresql" --follow
```

---

## 10. Rollback Plan

### 10.1 Rollback de Amplify Deployment

**Via Console:**

1. Ir a Amplify Console → App → Branch staging → Build history
2. Seleccionar un build anterior exitoso
3. Click "Redeploy this build"

**Via CLI:**

```powershell
# Listar builds anteriores
aws amplify list-jobs `
    --app-id $APP_ID `
    --branch-name staging `
    --max-results 10

# Redeploy de un job específico
aws amplify start-job `
    --app-id $APP_ID `
    --branch-name staging `
    --job-id <JOB_ID_ANTERIOR>
```

---

### 10.2 Rollback de Migraciones Prisma

⚠️ **Prisma NO soporta rollback automático de migraciones.**

**Opciones:**

**A) Restore desde snapshot RDS:**

```powershell
# Listar snapshots disponibles
aws rds describe-db-snapshots `
    --db-instance-identifier nexoerp-staging `
    --query "DBSnapshots[*].[DBSnapshotIdentifier,SnapshotCreateTime]" `
    --output table

# Restore desde snapshot (crea nueva instancia)
aws rds restore-db-instance-from-db-snapshot `
    --db-instance-identifier nexoerp-staging-restored `
    --db-snapshot-identifier <SNAPSHOT_ID>

# Actualizar connection strings para apuntar a instancia restaurada
```

**B) Revertir migración manualmente:**

```powershell
# Conectar a RDS
psql -h $RDS_ENDPOINT -U nexoerp_admin -d nexoerp -p 5432

# Ejecutar SQL de rollback (DROP TABLE, DROP COLUMN, etc.)
# Depende de la migración específica

# Marcar migración como NO aplicada en _prisma_migrations
DELETE FROM "_prisma_migrations" WHERE migration_name = '<MIGRATION_NAME>';
```

---

### 10.3 Rollback de Lambda

**Via Console:**

1. Ir a Lambda Console → Function post-confirmation → Versions
2. Publish nueva versión desde versión anterior
3. Update alias staging para apuntar a versión anterior

**Via CLI:**

```powershell
# Listar versiones
aws lambda list-versions-by-function `
    --function-name post-confirmation

# Actualizar alias staging a versión anterior
aws lambda update-alias `
    --function-name post-confirmation `
    --name staging `
    --function-version <VERSION_NUMBER>
```

---

## 🎉 Deploy Completado

### Resumen de Infraestructura Staging

| Componente              | Estado | URL / Endpoint                                     | Costo/mes         |
| ----------------------- | ------ | -------------------------------------------------- | ----------------- |
| RDS PostgreSQL 16       | ✅     | `nexoerp-staging.<id>.us-east-1.rds.amazonaws.com` | $0.00 (Free Tier) |
| Lambda PostConfirmation | ✅     | Integrado con Cognito                              | $0.00             |
| Cognito User Pool       | ✅     | `us-east-1_adYn3n5fz`                              | $0.50/mes         |
| S3 Bucket               | ✅     | `amplify-nexoerp-...-bimtcqkqm8s3`                 | $0.00 (Free Tier) |
| Amplify Hosting         | ✅     | `https://staging.<id>.amplifyapp.com`              | $0.00 (Free Tier) |
| CloudWatch Logs         | ✅     | Retención 7 días                                   | $0.85/mes         |
| **TOTAL**               |        |                                                    | **$1.35/mes**     |

---

### Próximos Pasos

1. **Configurar dominio personalizado:**  
   `staging.nexoerp.com` → Amplify Custom Domain (requiere Route 53 + ACM)

2. **Configurar CORS whitelist:**  
   Solo permitir `staging.nexoerp.com` en vez de wildcard

3. **Habilitar Multi-AZ en RDS:**  
   Cuando el tráfico aumente (costo 2x: ~$31/mes)

4. **Agregar RDS Proxy:**  
   Si conectividad desde Lambda requiere connection pooling (+$11.95/mes)

5. **Configurar pipeline de E2E tests:**  
   Playwright tests contra staging URL (GitHub Actions scheduled)

6. **Validar presupuesto:**  
   Revisar AWS Cost Explorer después de 1 semana

7. **Documentar credenciales:**  
   Guardar endpoints, ARNs, secrets en gestor de contraseñas del equipo

---

### Troubleshooting Común

| Error                                    | Causa probable                          | Solución                                 |
| ---------------------------------------- | --------------------------------------- | ---------------------------------------- |
| Amplify build fail: "Cannot find module" | Falta `npx prisma generate` en preBuild | Verificar amplify.yml                    |
| Lambda PostConfirmation timeout          | RDS lento o Security Group bloqueando   | Verificar SG, aumentar timeout Lambda    |
| Login redirige a error 404               | Callback URL mal configurado en Cognito | Verificar NEXT*PUBLIC*\* env vars        |
| Tabla users vacía después de signup      | Lambda no se ejecutó o falló            | Ver CloudWatch Logs de post-confirmation |
| RLS bloquea queries (no data returned)   | `app.current_company_id` no configurado | Verificar Prisma Extension en código     |
| Build Amplify toma > 15 min              | node_modules re-download cada vez       | Verificar cache paths en amplify.yml     |

---

### Contacto

**En caso de problemas críticos:**

- Slack: `#nexoerp-devops`
- Email: `devops@nexoerp.com`
- GitHub Issues: Tag `@devops-team`

---

**Fecha de última actualización:** 16 marzo 2026  
**Versión del documento:** 1.0.0  
**Autor:** DevOps Agent NexoERP
