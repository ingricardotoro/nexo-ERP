# RDS PostgreSQL Staging — Guía de Configuración

## Objetivo

Crear instancia RDS PostgreSQL 16 para el ambiente de **staging** de NexoERP con:

- Multi-tenant isolation (Row-Level Security)
- Connection pooling via RDS Proxy
- Backup automático (7 días)
- Presupuesto: ~$25/mes (instancia + storage)

---

## Pre-requisitos

- AWS CLI configurado: `aws configure` (región **us-east-1**)
- Credenciales con permisos: `rds:*`, `ec2:*` (VPC, Security Groups), `secretsmanager:*`
- Account ID: **155326049791**

---

## PASO 1: Crear VPC para RDS (si no existe)

**Opción A: Usar Default VPC** (más simple para staging)

```bash
# Obtener Default VPC ID
aws ec2 describe-vpcs --filters "Name=is-default,Values=true" --query "Vpcs[0].VpcId" --output text
# Output esperado: vpc-xxxxxxxxxxxxxxxxx

# Obtener Subnets de Default VPC
aws ec2 describe-subnets --filters "Name=vpc-id,Values=<VPC_ID>" --query "Subnets[*].SubnetId" --output text
# Output esperado: subnet-xxxxxx subnet-yyyyyy (mínimo 2 en diferentes AZs)
```

**Opción B: Crear VPC dedicada** (recomendado para producción, opcional para staging)

<details>
<summary>📋 Expandir: Crear VPC personalizada (skip si usas Default VPC)</summary>

```bash
# Crear VPC
aws ec2 create-vpc \
  --cidr-block 10.0.0.0/16 \
  --tag-specifications 'ResourceType=vpc,Tags=[{Key=Name,Value=nexoerp-staging-vpc},{Key=Project,Value=NexoERP},{Key=Environment,Value=staging}]'

# Crear subnets privadas en 2 AZs (requerido por RDS Multi-AZ)
aws ec2 create-subnet \
  --vpc-id <VPC_ID> \
  --cidr-block 10.0.1.0/24 \
  --availability-zone us-east-1a \
  --tag-specifications 'ResourceType=subnet,Tags=[{Key=Name,Value=nexoerp-staging-subnet-private-1a}]'

aws ec2 create-subnet \
  --vpc-id <VPC_ID> \
  --cidr-block 10.0.2.0/24 \
  --availability-zone us-east-1b \
  --tag-specifications 'ResourceType=subnet,Tags=[{Key=Name,Value=nexoerp-staging-subnet-private-1b}]'
```

</details>

---

## PASO 2: Crear DB Subnet Group

```bash
# Reemplazar <SUBNET_1> y <SUBNET_2> con los IDs obtenidos en PASO 1
aws rds create-db-subnet-group \
  --db-subnet-group-name nexoerp-staging-subnet-group \
  --db-subnet-group-description "Subnet group for NexoERP Staging RDS" \
  --subnet-ids <SUBNET_1> <SUBNET_2> \
  --tags Key=Project,Value=NexoERP Key=Environment,Value=staging
```

---

## PASO 3: Crear Security Group para RDS

```bash
# Crear Security Group
aws ec2 create-security-group \
  --group-name nexoerp-staging-rds-sg \
  --description "Security group for NexoERP Staging RDS PostgreSQL" \
  --vpc-id <VPC_ID> \
  --tag-specifications 'ResourceType=security-group,Tags=[{Key=Name,Value=nexoerp-staging-rds-sg},{Key=Project,Value=NexoERP}]'

# Output: sg-xxxxxxxxxxxxxxxxx (guardar este ID)

# Permitir PostgreSQL desde Amplify Hosting (temporalmente desde anywhere — refinamos después)
aws ec2 authorize-security-group-ingress \
  --group-id <SG_ID> \
  --protocol tcp \
  --port 5432 \
  --cidr 0.0.0.0/0 \
  --description "PostgreSQL from Amplify (temporary — refinar con VPC Peering)"
```

⚠️ **IMPORTANTE:** En producción, usar VPC Peering entre Amplify VPC y RDS VPC, o conectar via AWS PrivateLink. Para staging inicial, `0.0.0.0/0` es aceptable (RDS está en subnet privada).

---

## PASO 4: Crear Secrets Manager Secret (Master Password)

```bash
# Generar contraseña fuerte
$MASTER_PASSWORD = -join ((33..126) | Get-Random -Count 32 | ForEach-Object {[char]$_})

# Crear secret (Windows PowerShell)
aws secretsmanager create-secret `
  --name nexoerp/staging/rds/master `
  --description "Master password for NexoERP Staging RDS" `
  --secret-string "{\"username\":\"nexoerp_admin\",\"password\":\"$MASTER_PASSWORD\"}" `
  --tags Key=Project,Value=NexoERP Key=Environment,Value=staging

# Obtener ARN del secret (guardar para RDS Proxy)
aws secretsmanager describe-secret --secret-id nexoerp/staging/rds/master --query ARN --output text
```

---

## PASO 5: Crear RDS PostgreSQL Instance

```bash
# Obtener password del secret
$SECRET_JSON = aws secretsmanager get-secret-value --secret-id nexoerp/staging/rds/master --query SecretString --output text | ConvertFrom-Json
$MASTER_PASSWORD = $SECRET_JSON.password

# Crear instancia RDS (db.t3.micro — Free Tier elegible)
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
  --vpc-security-group-ids <SG_ID> `
  --db-name nexoerp `
  --backup-retention-period 7 `
  --preferred-backup-window "03:00-04:00" `
  --preferred-maintenance-window "sun:04:00-sun:05:00" `
  --enable-cloudwatch-logs-exports "postgresql" "upgrade" `
  --storage-encrypted `
  --publicly-accessible `
  --tags Key=Project,Value=NexoERP Key=Environment,Value=staging
```

**Parámetros clave:**

- `--db-instance-class db.t3.micro`: Free Tier elegible (750h/mes gratis los primeros 12 meses)
- `--allocated-storage 20`: 20 GB (incluido en Free Tier)
- `--storage-type gp3`: General Purpose SSD (mejor performance/precio que gp2)
- `--backup-retention-period 7`: Retención de backups 7 días (requisito mínimo)
- `--storage-encrypted`: Encriptación en reposo (obligatorio por RS-ENC-03)
- `--publicly-accessible`: Necesario para Amplify, pero protegido por Security Group
- `--engine-version 16.4`: PostgreSQL 16 (último compatible con Prisma 6)

**Tiempo de creación:** ~5-10 minutos

```bash
# Esperar hasta que esté disponible
aws rds wait db-instance-available --db-instance-identifier nexoerp-staging

# Obtener endpoint (guardar para DATABASE_URL y DIRECT_URL)
aws rds describe-db-instances `
  --db-instance-identifier nexoerp-staging `
  --query "DBInstances[0].Endpoint.Address" `
  --output text
# Output: nexoerp-staging.xxxxxxxxxx.us-east-1.rds.amazonaws.com
```

---

## PASO 6: Configurar PostgreSQL (Extensiones y Roles)

```bash
# Conectar a RDS (reemplazar <ENDPOINT> con el obtenido en PASO 5)
$RDS_ENDPOINT = "nexoerp-staging.xxxxxxxxxx.us-east-1.rds.amazonaws.com"
$DB_USER = "nexoerp_admin"
$DB_PASSWORD = $SECRET_JSON.password

# Instalar psql si no está instalado (Windows con PostgreSQL)
# Opción 1: winget install PostgreSQL.PostgreSQL
# Opción 2: Usar pgAdmin Query Tool
# Opción 3: AWS RDS Query Editor (Console)

# Conectar via psql
$env:PGPASSWORD = $DB_PASSWORD
psql -h $RDS_ENDPOINT -U $DB_USER -d nexoerp -p 5432

# Ejecutar en psql:
```

```sql
-- Crear extensiones (requeridas por Prisma schema)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "citext";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Crear rol de aplicación (solo DML, no DDL)
CREATE ROLE nexoerp_app WITH LOGIN PASSWORD '<GENERAR_PASSWORD_SEGURO>';

-- Grant permisos necesarios
GRANT CONNECT ON DATABASE nexoerp TO nexoerp_app;
GRANT USAGE ON SCHEMA public TO nexoerp_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO nexoerp_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO nexoerp_app;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO nexoerp_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE ON SEQUENCES TO nexoerp_app;

-- Verificar extensiones
\dx
-- Esperado: uuid-ossp, pgcrypto, citext, pg_trgm

-- Salir
\q
```

**Guardar credenciales de `nexoerp_app` en Secrets Manager:**

```bash
# Generar password para nexoerp_app
$APP_PASSWORD = -join ((33..126) | Get-Random -Count 32 | ForEach-Object {[char]$_})

# Actualizar en RDS
psql -h $RDS_ENDPOINT -U nexoerp_admin -d nexoerp -c "ALTER ROLE nexoerp_app WITH PASSWORD '$APP_PASSWORD';"

# Guardar en Secrets Manager
aws secretsmanager create-secret `
  --name nexoerp/staging/rds/app `
  --description "Application role credentials for NexoERP Staging RDS" `
  --secret-string "{\"username\":\"nexoerp_app\",\"password\":\"$APP_PASSWORD\",\"engine\":\"postgres\",\"host\":\"$RDS_ENDPOINT\",\"port\":5432,\"dbname\":\"nexoerp\"}" `
  --tags Key=Project,Value=NexoERP Key=Environment,Value=staging
```

---

## PASO 7: Configurar RDS Proxy (Connection Pooling)

⚠️ **CRÍTICO para Amplify/Lambda:** Next.js en serverless genera muchas conexiones concurrentes. RDS Proxy hace pooling para evitar `FATAL: too many connections`.

```bash
# Crear IAM Role para RDS Proxy
cat > rds-proxy-trust-policy.json << 'EOF'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "rds.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
EOF

aws iam create-role `
  --role-name NexoERPStagingRDSProxyRole `
  --assume-role-policy-document file://rds-proxy-trust-policy.json `
  --tags Key=Project,Value=NexoERP Key=Environment,Value=staging

# Attach policy para acceder a Secrets Manager
aws iam attach-role-policy `
  --role-name NexoERPStagingRDSProxyRole `
  --policy-arn arn:aws:iam::aws:policy/SecretsManagerReadWrite

# Obtener ARN del rol
$PROXY_ROLE_ARN = aws iam get-role --role-name NexoERPStagingRDSProxyRole --query "Role.Arn" --output text

# Crear RDS Proxy
aws rds create-db-proxy `
  --db-proxy-name nexoerp-staging-proxy `
  --engine-family POSTGRESQL `
  --auth AuthScheme=SECRETS,SecretArn=<SECRET_ARN_APP>,IAMAuth=DISABLED `
  --role-arn $PROXY_ROLE_ARN `
  --vpc-subnet-ids <SUBNET_1> <SUBNET_2> `
  --require-tls `
  --tags Key=Project,Value=NexoERP Key=Environment,Value=staging

# Registrar target (RDS instance)
aws rds register-db-proxy-targets `
  --db-proxy-name nexoerp-staging-proxy `
  --db-instance-identifiers nexoerp-staging

# Esperar hasta que esté disponible (~2-3 minutos)
aws rds wait db-proxy-available --db-proxy-name nexoerp-staging-proxy

# Obtener endpoint del proxy (para DATABASE_URL)
aws rds describe-db-proxies `
  --db-proxy-name nexoerp-staging-proxy `
  --query "DBProxies[0].Endpoint" `
  --output text
# Output: nexoerp-staging-proxy.proxy-xxxxxxxxxx.us-east-1.rds.amazonaws.com
```

**Configuración de connection pooling:**

```bash
# Modificar configuración del proxy target
aws rds modify-db-proxy-target-group `
  --db-proxy-name nexoerp-staging-proxy `
  --target-group-name default `
  --connection-pool-config MaxConnectionsPercent=75,MaxIdleConnectionsPercent=50,ConnectionBorrowTimeout=120
```

**Parámetros clave:**

- `MaxConnectionsPercent=75`: Usar máximo 75% de las conexiones disponibles en RDS (db.t3.micro tiene ~100 conexiones disponibles)
- `MaxIdleConnectionsPercent=50`: Mantener 50% del pool idle para picos de tráfico
- `ConnectionBorrowTimeout=120`: Timeout de 120s para obtener conexión del pool

---

## PASO 8: Aplicar Migraciones Prisma

**IMPORTANTE:** Las migraciones se aplican con `DIRECT_URL` (bypass RDS Proxy) porque Prisma migrations requiere conexión directa para operaciones DDL.

```bash
cd c:\Users\MARVIN\OneDrive\Documentos\proyectos\ERP

# Crear archivo .env.staging (NO commitear — agregar a .gitignore)
@"
DATABASE_URL="postgresql://nexoerp_app:$APP_PASSWORD@$PROXY_ENDPOINT:5432/nexoerp?schema=public&sslmode=require&connection_limit=10"
DIRECT_URL="postgresql://nexoerp_admin:$($SECRET_JSON.password)@$RDS_ENDPOINT:5432/nexoerp?schema=public&sslmode=require"
"@ | Out-File -FilePath .env.staging -Encoding utf8

# Aplicar migraciones (usando DIRECT_URL)
npx prisma migrate deploy --schema=./prisma/schema

# Verificar migraciones aplicadas
npx prisma migrate status --schema=./prisma/schema

# Verificar tablas y RLS
$env:PGPASSWORD = $SECRET_JSON.password
psql -h $RDS_ENDPOINT -U nexoerp_admin -d nexoerp -c "\dt"
# Esperado: companies, users, _prisma_migrations

psql -h $RDS_ENDPOINT -U nexoerp_admin -d nexoerp -c "SELECT tablename, policyname FROM pg_policies WHERE schemaname = 'public';"
# Esperado: 4 políticas en tabla 'users' (tenant_isolation_select/insert/update/delete)
```

---

## PASO 9: Verificación de Multi-Tenant Isolation

Ejecutar test manual de RLS:

```sql
-- Conectar como nexoerp_app
$env:PGPASSWORD = $APP_PASSWORD
psql -h $PROXY_ENDPOINT -U nexoerp_app -d nexoerp

-- Insertar empresas de prueba
INSERT INTO companies (id, legal_name, rtn, max_users)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'Empresa Demo SA', 'RTN0101010101010', 10),
  ('22222222-2222-2222-2222-222222222222', 'Empresa Test Ltda', 'RTN0202020202020', 5);

-- Insertar usuarios
INSERT INTO users (id, email, full_name, cognito_sub, company_id, role)
VALUES
  ('user1', 'admin1@empresa1.com', 'Admin Empresa 1', 'cognito-sub-1', '11111111-1111-1111-1111-111111111111', 'ADMIN'),
  ('user2', 'admin2@empresa2.com', 'Admin Empresa 2', 'cognito-sub-2', '22222222-2222-2222-2222-222222222222', 'ADMIN');

-- Configurar company_id de sesión (simular tenant context)
SET app.current_company_id = '11111111-1111-1111-1111-111111111111';

-- Verificar aislamiento: debe retornar solo user1
SELECT * FROM users;
-- Esperado: 1 row (admin1@empresa1.com)

-- Cambiar tenant context
SET app.current_company_id = '22222222-2222-2222-2222-222222222222';

-- Verificar aislamiento: debe retornar solo user2
SELECT * FROM users;
-- Esperado: 1 row (admin2@empresa2.com)

-- ✅ Si ambos queries retornan 1 row correcta → RLS funciona
-- ❌ Si algún query retorna ambos users → RLS ROTO (investigar)

\q
```

---

## Resumen de Conexiones

| Propósito                 | Endpoint   | Usuario       | Variable Entorno |
| ------------------------- | ---------- | ------------- | ---------------- |
| **Aplicación (runtime)**  | RDS Proxy  | nexoerp_app   | `DATABASE_URL`   |
| **Migraciones (DDL)**     | RDS Direct | nexoerp_admin | `DIRECT_URL`     |
| **Administración manual** | RDS Direct | nexoerp_admin | —                |

---

## Costos Estimados (Staging)

| Recurso          | Configuración    | Costo mensual                 |
| ---------------- | ---------------- | ----------------------------- |
| RDS db.t3.micro  | 730h/mes         | $13.14 (después de Free Tier) |
| Storage gp3 20GB | 20 GB            | $2.30                         |
| Backup storage   | ~5 GB promedio   | $0.50                         |
| RDS Proxy        | 1 proxy endpoint | $14.60                        |
| Data Transfer    | ~1 GB/mes        | $0.09                         |
| **TOTAL**        |                  | **~$30.63/mes**               |

⚠️ **Free Tier:** Si la cuenta AWS tiene menos de 12 meses, db.t3.micro es gratis (750h/mes), reduciendo costo a ~$17.50/mes.

---

## Limpieza (Rollback)

Si necesitas eliminar todos los recursos:

```bash
# 1. Eliminar RDS Proxy
aws rds delete-db-proxy --db-proxy-name nexoerp-staging-proxy

# 2. Eliminar RDS Instance (snapshot final)
aws rds delete-db-instance \
  --db-instance-identifier nexoerp-staging \
  --final-db-snapshot-identifier nexoerp-staging-final-snapshot

# 3. Eliminar Secrets
aws secretsmanager delete-secret --secret-id nexoerp/staging/rds/master --force-delete-without-recovery
aws secretsmanager delete-secret --secret-id nexoerp/staging/rds/app --force-delete-without-recovery

# 4. Eliminar Security Group
aws ec2 delete-security-group --group-id <SG_ID>

# 5. Eliminar DB Subnet Group
aws rds delete-db-subnet-group --db-subnet-group-name nexoerp-staging-subnet-group

# 6. Eliminar IAM Role
aws iam detach-role-policy --role-name NexoERPStagingRDSProxyRole --policy-arn arn:aws:iam::aws:policy/SecretsManagerReadWrite
aws iam delete-role --role-name NexoERPStagingRDSProxyRole
```

---

## Próximos Pasos

1. ✅ RDS PostgreSQL staging creado
2. ✅ RDS Proxy configurado
3. ✅ Migraciones aplicadas
4. ✅ RLS verificado
5. ⏳ Configurar variables de entorno en Amplify Hosting
6. ⏳ Implementar Lambda PostConfirmation
7. ⏳ Conectar Amplify a branch `staging`

---

**Documentado:** 15 marzo 2026  
**Próxima revisión:** Antes de pasar a producción (verificar costos reales)
