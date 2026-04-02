# NexoERP Staging — Checklist de Validación de Infraestructura

## Objetivo

Verificar que todos los componentes de infraestructura AWS para el ambiente de **staging** estén correctamente configurados y funcionales antes de comenzar desarrollo de Fase 1.

---

## ✅ FASE 1: Amazon RDS PostgreSQL

### 1.1 RDS Instance

- [ ] **RDS instance creada:** `nexoerp-staging`
  - Verificar: `aws rds describe-db-instances --db-instance-identifier nexoerp-staging --query "DBInstances[0].DBInstanceStatus"`
  - Esperado: `"available"`

- [ ] **Engine version correcta:** PostgreSQL 16.x
  - Verificar: `aws rds describe-db-instances --db-instance-identifier nexoerp-staging --query "DBInstances[0].EngineVersion"`

- [ ] **Instance class correcta:** db.t3.micro
  - Verificar: `aws rds describe-db-instances --db-instance-identifier nexoerp-staging --query "DBInstances[0].DBInstanceClass"`

- [ ] **Storage configurado:** 20 GB gp3, 3000 IOPS
  - Verificar: `aws rds describe-db-instances --db-instance-identifier nexoerp-staging --query "DBInstances[0].[AllocatedStorage, StorageType, Iops]"`

- [ ] **Backup retention:** 7 días
  - Verificar: `aws rds describe-db-instances --db-instance-identifier nexoerp-staging --query "DBInstances[0].BackupRetentionPeriod"`

- [ ] **Encryption enabled:** true
  - Verificar: `aws rds describe-db-instances --db-instance-identifier nexoerp-staging --query "DBInstances[0].StorageEncrypted"`

- [ ] **CloudWatch Logs enabled:** postgresql, upgrade
  - Verificar: `aws rds describe-db-instances --db-instance-identifier nexoerp-staging --query "DBInstances[0].EnabledCloudwatchLogsExports"`

### 1.2 Security Groups

- [ ] **Security Group creado:** `nexoerp-staging-rds-sg`
  - Verificar: `aws ec2 describe-security-groups --group-names nexoerp-staging-rds-sg`

- [ ] **Inbound rule PostgreSQL (5432)** configurada
  - Verificar: `aws ec2 describe-security-groups --group-names nexoerp-staging-rds-sg --query "SecurityGroups[0].IpPermissions"`

### 1.3 PostgreSQL Configuration

- [ ] **Extensiones instaladas:** uuid-ossp, pgcrypto, citext, pg_trgm
  - Conectar: `psql -h <RDS_ENDPOINT> -U nexoerp_admin -d nexoerp -c "\dx"`
  - Esperado: 4 extensiones + plpgsql

- [ ] **Rol de aplicación creado:** nexoerp_app
  - Verificar: `psql -h <RDS_ENDPOINT> -U nexoerp_admin -d nexoerp -c "\du"`

- [ ] **Permisos correctos para nexoerp_app:**
  - Verificar: `psql -h <RDS_ENDPOINT> -U nexoerp_admin -d nexoerp -c "SELECT * FROM information_schema.role_table_grants WHERE grantee = 'nexoerp_app';"`
  - Esperado: SELECT, INSERT, UPDATE, DELETE en todas las tablas

### 1.4 Secrets Manager

- [ ] **Secret master password creado:** `nexoerp/staging/rds/master`
  - Verificar: `aws secretsmanager describe-secret --secret-id nexoerp/staging/rds/master`

- [ ] **Secret app credentials creado:** `nexoerp/staging/rds/app`
  - Verificar: `aws secretsmanager describe-secret --secret-id nexoerp/staging/rds/app`

- [ ] **Secrets contienen todos los campos requeridos:**
  - Verificar: `aws secretsmanager get-secret-value --secret-id nexoerp/staging/rds/app --query SecretString`
  - Esperado: `{"username":"nexoerp_app","password":"***","engine":"postgres","host":"***","port":5432,"dbname":"nexoerp"}`

---

## ✅ FASE 2: RDS Proxy

### 2.1 Proxy Configuration

- [ ] **RDS Proxy creado:** `nexoerp-staging-proxy`
  - Verificar: `aws rds describe-db-proxies --db-proxy-name nexoerp-staging-proxy --query "DBProxies[0].Status"`
  - Esperado: `"available"`

- [ ] **Target registered:** nexoerp-staging
  - Verificar: `aws rds describe-db-proxy-targets --db-proxy-name nexoerp-staging-proxy`

- [ ] **Connection pooling configurado:** MaxConnectionsPercent=75, MaxIdleConnectionsPercent=50
  - Verificar: `aws rds describe-db-proxy-target-groups --db-proxy-name nexoerp-staging-proxy --query "TargetGroups[0].ConnectionPoolConfig"`

- [ ] **TLS requerido:** true
  - Verificar: `aws rds describe-db-proxies --db-proxy-name nexoerp-staging-proxy --query "DBProxies[0].RequireTLS"`

### 2.2 IAM Role

- [ ] **IAM Role creado:** NexoERPStagingRDSProxyRole
  - Verificar: `aws iam get-role --role-name NexoERPStagingRDSProxyRole`

- [ ] **Policy attached:** SecretsManagerReadWrite
  - Verificar: `aws iam list-attached-role-policies --role-name NexoERPStagingRDSProxyRole`

---

## ✅ FASE 3: Prisma Migrations

### 3.1 Migrations Applied

- [ ] **Todas las migraciones aplicadas correctamente**
  - Verificar: `npx prisma migrate status --schema=./prisma/schema`
  - Esperado: "Database schema is up to date!"

- [ ] **Tablas creadas:** companies, users, \_prisma_migrations
  - Verificar: `psql -h <RDS_ENDPOINT> -U nexoerp_admin -d nexoerp -c "\dt"`

- [ ] **Políticas RLS creadas:** 4 políticas en tabla users
  - Verificar: `psql -h <RDS_ENDPOINT> -U nexoerp_admin -d nexoerp -c "SELECT tablename, policyname FROM pg_policies WHERE schemaname = 'public';"`
  - Esperado: `tenant_isolation_select`, `tenant_isolation_insert`, `tenant_isolation_update`, `tenant_isolation_delete`

### 3.2 RLS Verification

- [ ] **RLS habilitado en tabla users**
  - Verificar: `psql -h <RDS_ENDPOINT> -U nexoerp_admin -d nexoerp -c "SELECT relname, relrowsecurity, relforcerowsecurity FROM pg_class WHERE relname = 'users';"`
  - Esperado: `relrowsecurity = true`, `relforcerowsecurity = false` (actualizado en migración 20260311183955)

- [ ] **Multi-tenant isolation funciona** (test manual — ver RDS-SETUP-STAGING.md §9)
  - [ ] Insertar 2 empresas y 2 usuarios (diferentes company_id)
  - [ ] Configurar `app.current_company_id` para empresa 1 → debe ver solo user de empresa 1
  - [ ] Configurar `app.current_company_id` para empresa 2 → debe ver solo user de empresa 2

---

## ✅ FASE 4: Amazon Cognito

### 4.1 User Pool Configuration

- [ ] **User Pool ID:** `us-east-1_adYn3n5fz`
  - Verificar: `aws cognito-idp describe-user-pool --user-pool-id us-east-1_adYn3n5fz --query "UserPool.Name"`

- [ ] **Custom attributes configurados:** custom:company_id, custom:role, custom:fullname
  - Verificar: `aws cognito-idp describe-user-pool --user-pool-id us-east-1_adYn3n5fz --query "UserPool.SchemaAttributes[?Name=='custom:company_id']"`

- [ ] **MFA configurado:** OPTIONAL, TOTP enabled
  - Verificar: `aws cognito-idp describe-user-pool --user-pool-id us-east-1_adYn3n5fz --query "UserPool.MfaConfiguration"`

- [ ] **Email verification:** MANDATORY
  - Verificar: `aws cognito-idp describe-user-pool --user-pool-id us-east-1_adYn3n5fz --query "UserPool.AutoVerifiedAttributes"`
  - Esperado: `["email"]`

### 4.2 User Pool Client

- [ ] **App client creado**
  - Verificar: `aws cognito-idp list-user-pool-clients --user-pool-id us-east-1_adYn3n5fz`

- [ ] **Client ID obtenido** (guardar para Amplify env vars)
  - Comando: `aws cognito-idp list-user-pool-clients --user-pool-id us-east-1_adYn3n5fz --query "UserPoolClients[0].ClientId" --output text`

---

## ✅ FASE 5: Lambda PostConfirmation

### 5.1 Lambda Function

- [ ] **Lambda function creada:** `post-confirmation-staging`
  - Verificar después del primer deploy de Amplify
  - Comando: `aws lambda list-functions --query "Functions[?contains(FunctionName, 'postConfirmation')]"`

- [ ] **Variables de entorno configuradas:** DATABASE_URL
  - Verificar: `aws lambda get-function-configuration --function-name <FUNCTION_NAME> --query "Environment.Variables"`

- [ ] **Timeout configurado:** 10 segundos
  - Verificar: `aws lambda get-function-configuration --function-name <FUNCTION_NAME> --query "Timeout"`

- [ ] **Memory configurado:** 512 MB
  - Verificar: `aws lambda get-function-configuration --function-name <FUNCTION_NAME> --query "MemorySize"`

### 5.2 Cognito Trigger

- [ ] **PostConfirmation trigger configurado en Cognito**
  - Verificar: `aws cognito-idp describe-user-pool --user-pool-id us-east-1_adYn3n5fz --query "UserPool.LambdaConfig.PostConfirmation"`
  - Esperado: ARN de la Lambda

### 5.3 Lambda Permissions

- [ ] **Lambda tiene permisos para conectar a RDS Proxy**
  - Verificar Security Group de Lambda permite outbound a RDS Proxy

- [ ] **Lambda en misma VPC que RDS Proxy** (si aplica)
  - Verificar: `aws lambda get-function-configuration --function-name <FUNCTION_NAME> --query "VpcConfig"`

---

## ✅ FASE 6: Amazon S3 (Storage)

### 6.1 S3 Bucket Configuration

- [ ] **Bucket creado:** `amplify-nexoerp-marvin-sa-nexoerpdocumentsbucketb8-bimtcqkqm8s3`
  - Verificar: `aws s3 ls | findstr nexoerp`

- [ ] **Block Public Access habilitado:**
  - Verificar: `aws s3api get-public-access-block --bucket amplify-nexoerp-marvin-sa-nexoerpdocumentsbucketb8-bimtcqkqm8s3`
  - Esperado: Todos los flags en `true`

- [ ] **Encryption habilitado:** SSE-S3 o SSE-KMS
  - Verificar: `aws s3api get-bucket-encryption --bucket amplify-nexoerp-marvin-sa-nexoerpdocumentsbucketb8-bimtcqkqm8s3`

### 6.2 Bucket Policies

- [ ] **Path-based access configurado:**
  - Verificar: `aws s3api get-bucket-policy --bucket amplify-nexoerp-marvin-sa-nexoerpdocumentsbucketb8-bimtcqkqm8s3`
  - Esperado: Policies para `logos/{entity_id}/*`, `documents/{entity_id}/*`, `temp/{entity_id}/*`

---

## ✅ FASE 7: AWS Amplify Hosting

### 7.1 App Configuration

- [ ] **App conectada a GitHub:** nexoerp
  - Verificar en Amplify Console

- [ ] **Branch staging configurado:**
  - Verificar: `aws amplify list-branches --app-id <APP_ID> --query "branches[?branchName=='staging']"`

- [ ] **Auto-build habilitado:**
  - Verificar: `aws amplify get-branch --app-id <APP_ID> --branch-name staging --query "branch.enableAutoBuild"`
  - Esperado: `true`

### 7.2 Environment Variables

- [ ] **8 variables de entorno configuradas:**
  - [ ] `DATABASE_URL` (Secret)
  - [ ] `DIRECT_URL` (Secret)
  - [ ] `NEXT_PUBLIC_AMPLIFY_REGION`
  - [ ] `NEXT_PUBLIC_USER_POOL_ID`
  - [ ] `NEXT_PUBLIC_USER_POOL_CLIENT_ID`
  - [ ] `NEXT_PUBLIC_S3_BUCKET`
  - [ ] `NODE_ENV`
  - [ ] `NEXT_TELEMETRY_DISABLED`

- Verificar: `aws amplify get-branch --app-id <APP_ID> --branch-name staging --query "branch.environmentVariables"`

### 7.3 Build Configuration

- [ ] **amplify.yml configurado correctamente** (ver AMPLIFY-HOSTING-SETUP.md)
  - [ ] Backend build: `npx ampx pipeline-deploy`
  - [ ] Frontend preBuild: `npm ci` + `npx prisma generate`
  - [ ] Frontend build: `npm run build`

### 7.4 First Deploy

- [ ] **Primer deploy exitoso:**
  - Verificar: `aws amplify list-jobs --app-id <APP_ID> --branch-name staging --max-results 1`
  - Esperado: `jobStatus: "SUCCEED"`

- [ ] **URL staging disponible:**
  - Obtener: `aws amplify get-branch --app-id <APP_ID> --branch-name staging --query "branch.defaultDomain" --output text`
  - Acceder a URL y verificar página de login se renderiza

---

## ✅ FASE 8: End-to-End Testing

### 8.1 User Registration Flow

- [ ] **Registrar usuario de prueba:**
  1. Ir a URL staging → "Sign Up"
  2. Ingresar email, password, custom attributes (company_id de empresa demo, role, fullname)
  3. Confirmar email con código recibido
  4. **Verificar en CloudWatch Logs** que Lambda PostConfirmation se ejecutó exitosamente
  5. **Verificar en PostgreSQL** que el usuario fue creado en tabla `users`:
     ```sql
     SELECT id, email, company_id, role FROM users WHERE email = '<TEST_EMAIL>';
     ```

- [ ] **Login exitoso con usuario creado:**
  1. Ir a URL staging → "Sign In"
  2. Ingresar email y password
  3. **Verificar** que la app redirige a dashboard o página principal

### 8.2 Multi-Tenant Isolation (E2E)

- [ ] **Registrar 2 usuarios de empresas diferentes:**
  - User 1: company_id = `<EMPRESA_1_UUID>`
  - User 2: company_id = `<EMPRESA_2_UUID>`

- [ ] **Verificar aislamiento en aplicación:**
  1. Login como User 1 → debe ver solo datos de Empresa 1
  2. Logout → Login como User 2 → debe ver solo datos de Empresa 2
  3. **Verificar en logs** que los queries incluyen filter por `company_id` (Prisma Extension)

---

## ✅ FASE 9: Monitoring & Alerts

### 9.1 CloudWatch Logs

- [ ] **Logs habilitados para RDS:**
  - Log Groups: `/aws/rds/instance/nexoerp-staging/postgresql`, `/aws/rds/instance/nexoerp-staging/upgrade`

- [ ] **Logs habilitados para Lambda:**
  - Log Group: `/aws/lambda/postConfirmation-staging`

- [ ] **Logs Insights queries funcionales:**
  - Query: `fields @timestamp, @message | filter @message like /ERROR/ | sort @timestamp desc | limit 20`

### 9.2 CloudWatch Alarms (Opcional para staging, obligatorio para producción)

- [ ] **Alarm: RDS CPU > 80%**
- [ ] **Alarm: RDS Connections > 80**
- [ ] **Alarm: Lambda Errors > 5/minuto**
- [ ] **Alarm: Amplify Build Failed**

---

## 📊 Resumen de Validación

| Fase | Componente              | Status |
| ---- | ----------------------- | ------ |
| 1    | RDS PostgreSQL          | ⬜     |
| 2    | RDS Proxy               | ⬜     |
| 3    | Prisma Migrations       | ⬜     |
| 4    | Cognito                 | ⬜     |
| 5    | Lambda PostConfirmation | ⬜     |
| 6    | S3 Storage              | ⬜     |
| 7    | Amplify Hosting         | ⬜     |
| 8    | E2E Testing             | ⬜     |
| 9    | Monitoring              | ⬜     |

**Leyenda:**

- ⬜ Pendiente
- ✅ Completado
- ❌ Falló (requiere investigación)

---

## 🔄 Próximos Pasos (después de completar checklist)

1. [ ] Documentar issues encontrados durante validación
2. [ ] Actualizar costos reales vs estimados (AWS Cost Explorer)
3. [ ] Crear runbook de troubleshooting para staging
4. [ ] Planificar configuración de production environment
5. [ ] Definir estrategia de rollback para deployments

---

**Última actualización:** 15 marzo 2026  
**Responsable validación:** DevOps Team  
**Siguiente revisión:** Después de primer deploy a production
