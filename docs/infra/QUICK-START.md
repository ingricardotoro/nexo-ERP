# Quick Start: Desplegar NexoERP Staging en 30 Minutos

## Pre-requisitos

- ✅ AWS CLI configurado: `aws configure` (región **us-east-1**)
- ✅ Node.js 20+ y npm instalados
- ✅ PostgreSQL client (psql) instalado
- ✅ Git configurado con acceso al repo NexoERP
- ✅ Cuenta AWS con permisos: RDS, Amplify, Cognito, Lambda, Secrets Manager

---

## Paso 1: Crear RDS PostgreSQL (10 min)

### 1.1 Crear VPC Resources

```powershell
# Obtener Default VPC
$VPC_ID = aws ec2 describe-vpcs --filters "Name=is-default,Values=true" --query "Vpcs[0].VpcId" --output text

# Obtener Subnets (mínimo 2 en diferentes AZs)
$SUBNETS = aws ec2 describe-subnets --filters "Name=vpc-id,Values=$VPC_ID" --query "Subnets[0:2].SubnetId" --output text
$SUBNET_1 = ($SUBNETS -split '\s+')[0]
$SUBNET_2 = ($SUBNETS -split '\s+')[1]

# Crear DB Subnet Group
aws rds create-db-subnet-group `
  --db-subnet-group-name nexoerp-staging-subnet-group `
  --db-subnet-group-description "NexoERP Staging Subnet Group" `
  --subnet-ids $SUBNET_1 $SUBNET_2
```

### 1.2 Crear Security Group

```powershell
# Crear Security Group
$SG_ID = aws ec2 create-security-group `
  --group-name nexoerp-staging-rds-sg `
  --description "Security group for NexoERP Staging RDS" `
  --vpc-id $VPC_ID `
  --query "GroupId" `
  --output text

# Permitir PostgreSQL (temporalmente desde anywhere — refinar después)
aws ec2 authorize-security-group-ingress `
  --group-id $SG_ID `
  --protocol tcp `
  --port 5432 `
  --cidr 0.0.0.0/0
```

### 1.3 Crear Secrets

```powershell
# Generar passwords seguros
$MASTER_PASSWORD = -join ((33..126) | Get-Random -Count 32 | ForEach-Object {[char]$_})
$APP_PASSWORD = -join ((33..126) | Get-Random -Count 32 | ForEach-Object {[char]$_})

# Crear secret master
aws secretsmanager create-secret `
  --name nexoerp/staging/rds/master `
  --secret-string "{\"username\":\"nexoerp_admin\",\"password\":\"$MASTER_PASSWORD\"}"

# Guardar passwords localmente (temporal)
@"
MASTER_PASSWORD=$MASTER_PASSWORD
APP_PASSWORD=$APP_PASSWORD
"@ | Out-File -FilePath rds-credentials.txt
```

### 1.4 Crear RDS Instance

```powershell
# Crear instancia (demora ~10 min)
aws rds create-db-instance `
  --db-instance-identifier nexoerp-staging `
  --db-instance-class db.t3.micro `
  --engine postgres `
  --engine-version 16.4 `
  --master-username nexoerp_admin `
  --master-user-password "$MASTER_PASSWORD" `
  --allocated-storage 20 `
  --storage-type gp3 `
  --db-subnet-group-name nexoerp-staging-subnet-group `
  --vpc-security-group-ids $SG_ID `
  --db-name nexoerp `
  --backup-retention-period 7 `
  --storage-encrypted `
  --publicly-accessible

# ⏳ Esperar hasta que esté disponible (tomar café)
aws rds wait db-instance-available --db-instance-identifier nexoerp-staging

# Obtener endpoint
$RDS_ENDPOINT = aws rds describe-db-instances `
  --db-instance-identifier nexoerp-staging `
  --query "DBInstances[0].Endpoint.Address" `
  --output text

Write-Host "✅ RDS Endpoint: $RDS_ENDPOINT" -ForegroundColor Green
```

---

## Paso 2: Configurar PostgreSQL (5 min)

```powershell
# Conectar a RDS
$env:PGPASSWORD = $MASTER_PASSWORD
psql -h $RDS_ENDPOINT -U nexoerp_admin -d nexoerp
```

Ejecutar en psql:

```sql
-- Crear extensiones
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "citext";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Crear rol de aplicación (usar $APP_PASSWORD generado antes)
CREATE ROLE nexoerp_app WITH LOGIN PASSWORD '<PEGAR_APP_PASSWORD_AQUI>';

-- Grant permisos
GRANT CONNECT ON DATABASE nexoerp TO nexoerp_app;
GRANT USAGE ON SCHEMA public TO nexoerp_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO nexoerp_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE ON SEQUENCES TO nexoerp_app;

-- Verificar
\dx
\du
\q
```

Guardar credenciales de app:

```powershell
# Crear secret app
aws secretsmanager create-secret `
  --name nexoerp/staging/rds/app `
  --secret-string "{\"username\":\"nexoerp_app\",\"password\":\"$APP_PASSWORD\",\"engine\":\"postgres\",\"host\":\"$RDS_ENDPOINT\",\"port\":5432,\"dbname\":\"nexoerp\"}"
```

---

## Paso 3: Aplicar Migraciones Prisma (3 min)

```powershell
cd c:\Users\MARVIN\OneDrive\Documentos\proyectos\ERP

# Crear .env.staging
@"
DATABASE_URL="postgresql://nexoerp_app:$APP_PASSWORD@$RDS_ENDPOINT:5432/nexoerp?schema=public&sslmode=require"
DIRECT_URL="postgresql://nexoerp_admin:$MASTER_PASSWORD@$RDS_ENDPOINT:5432/nexoerp?schema=public&sslmode=require"
"@ | Out-File -FilePath .env.staging -Encoding utf8

# Aplicar migraciones
npx prisma migrate deploy --schema=./prisma/schema

# Verificar
npx prisma migrate status --schema=./prisma/schema
```

Verificar RLS:

```powershell
psql -h $RDS_ENDPOINT -U nexoerp_admin -d nexoerp -c "SELECT tablename, policyname FROM pg_policies WHERE schemaname = 'public';"
# Esperado: 4 políticas en tabla 'users'
```

---

## Paso 4: Configurar Amplify Hosting (10 min)

### 4.1 Conectar GitHub (via Console)

1. Ir a: https://console.aws.amazon.com/amplify/home?region=us-east-1
2. Si existe sandbox: Click en el proyecto → **"Hosting"** → **"Connect branch"**
3. Si NO existe: **"New app"** → **"Host web app"** → GitHub
4. Autorizar GitHub → Seleccionar repo `nexoerp` → branch `staging`

### 4.2 Configurar Variables de Entorno

Ejecutar script de configuración:

```powershell
cd scripts
.\configure-amplify-staging.ps1 -AppId <TU_APP_ID>
```

El script generará un archivo `amplify-env-vars-staging.json` con las 8 variables.

**Configurar manualmente en Amplify Console:**

1. Ir a: https://console.aws.amazon.com/amplify/home?region=us-east-1#/<APP_ID>
2. **Environment variables** → **Manage variables**
3. Copiar las variables del output del script
4. **Importante:** Marcar `DATABASE_URL` y `DIRECT_URL` como **"Secret"**

### 4.3 Trigger Deploy

```powershell
# Opción A: Push a staging
git checkout staging
git merge feat/fase-1-core-system
git push origin staging

# Opción B: Trigger manualmente
aws amplify start-job `
  --app-id <APP_ID> `
  --branch-name staging `
  --job-type RELEASE
```

Monitorear build:

```powershell
# Ver últimos jobs
aws amplify list-jobs --app-id <APP_ID> --branch-name staging --max-results 5

# Seguir logs en tiempo real (Console)
# Ir a: https://console.aws.amazon.com/amplify/home?region=us-east-1#/<APP_ID>/YourApp/staging
```

---

## Paso 5: Validar Deployment (5 min)

### 5.1 Obtener URL Staging

```powershell
$STAGING_URL = aws amplify get-branch `
  --app-id <APP_ID> `
  --branch-name staging `
  --query "branch.defaultDomain" `
  --output text

Write-Host "🚀 Staging URL: https://$STAGING_URL" -ForegroundColor Cyan
start "https://$STAGING_URL"
```

### 5.2 Test End-to-End

1. **Sign Up:**
   - Email: `test@empresa1.com`
   - Password: `TestPass123!`
   - Custom attributes:
     - `custom:company_id`: Crear empresa primero en DB o usar UUID de empresa seed
     - `custom:role`: `ADMIN`
     - `custom:fullname`: `Usuario Test`

2. **Verificar Lambda PostConfirmation:**

   ```powershell
   aws logs tail /aws/lambda/postConfirmation-staging --follow
   ```

3. **Verificar en PostgreSQL:**

   ```powershell
   psql -h $RDS_ENDPOINT -U nexoerp_admin -d nexoerp -c "SELECT id, email, company_id FROM users WHERE email = 'test@empresa1.com';"
   ```

4. **Sign In:** Login con el usuario creado

---

## Paso 6: Monitorear Costos (1 min)

```powershell
# Ver costos del mes actual
aws ce get-cost-and-usage `
  --time-period Start=2026-03-01,End=2026-03-31 `
  --granularity MONTHLY `
  --metrics UnblendedCost `
  --group-by Type=DIMENSION,Key=SERVICE `
  --output table
```

**Configurar Budget Alert:**

1. Ir a: https://console.aws.amazon.com/billing/home#/budgets
2. **Create budget** → **Cost budget**
3. Budget amount: **$50/month**
4. Alert threshold: **80%** ($40)
5. Email: Tu email

---

## ✅ Checklist Final

- [ ] RDS PostgreSQL staging disponible
- [ ] Extensiones PostgreSQL instaladas
- [ ] Rol `nexoerp_app` creado con permisos
- [ ] Secrets Manager configurado (2 secrets)
- [ ] Migraciones Prisma aplicadas (4 migraciones)
- [ ] RLS verificado (4 políticas en `users`)
- [ ] Amplify conectado a GitHub
- [ ] Branch staging configurado
- [ ] 8 variables de entorno configuradas
- [ ] Primer deploy exitoso
- [ ] URL staging accesible
- [ ] Lambda PostConfirmation funciona
- [ ] Usuario de prueba creado y puede hacer login
- [ ] Budget alert configurado ($50/mes)

---

## 🎉 Felicitaciones

Tu ambiente de staging está listo. Costos estimados:

- **Con Free Tier (primeros 12 meses):** ~$1.35/mes
- **Sin Free Tier:** ~$22.82/mes (sin RDS Proxy)

**Próximos pasos:**

1. Ejecutar checklist completo: [CHECKLIST-STAGING-VALIDATION.md](../infra/CHECKLIST-STAGING-VALIDATION.md)
2. Configurar alarmas CloudWatch
3. Implementar API middleware para multi-tenant filtering
4. Desarrollo de módulo Core (CRUD Users & Companies)

---

## 🆘 Troubleshooting Rápido

**Build falla: "Cannot connect to database"**
→ Verificar Security Group permite 0.0.0.0/0 en puerto 5432

**Lambda falla: "Company not found"**
→ Crear empresa demo en PostgreSQL antes de registrar usuario

**Multi-tenant roto: Usuario ve datos de otra empresa**
→ Verificar RLS habilitado: `SELECT relrowsecurity FROM pg_class WHERE relname = 'users';`

**Costos > $15/mes en staging**
→ Verificar RDS Proxy NO está creado (solo producción)

---

**Última actualización:** 15 marzo 2026  
**Tiempo estimado total:** 30-45 minutos  
**Dificultad:** Intermedia (requiere familiaridad con AWS CLI)
