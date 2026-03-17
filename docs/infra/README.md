# NexoERP Staging — Guía de Implementación Completa

## 🚀 Inicio Rápido

**¿Primera vez desplegando staging?** → Lee primero **[STAGING-DEPLOY-GUIDE.md](./STAGING-DEPLOY-GUIDE.md)**  
Documento ejecutable con comandos listos para copiar/pegar (60-90 minutos).

---

## 🎯 Resumen Ejecutivo

Este documento consolida la configuración completa de infraestructura AWS para el ambiente de **staging** de NexoERP. Los recursos están diseñados para soportar un ERP multi-tenant con aislamiento estricto por empresa (Row-Level Security), cumplimiento fiscal hondureño (SAR), y un presupuesto máximo de ~$50/mes.

---

## 📋 Componentes de Infraestructura

### 1. Amazon RDS PostgreSQL 16

**Propósito:** Base de datos central con multi-tenancy isolation (RLS)

**Configuración:**

- Instance: `db.t3.micro` (2 vCPU, 1 GB RAM)
- Storage: 20 GB gp3 (3,000 IOPS incluidos)
- Backup: 7 días de retención
- Encryption: AES-256 en reposo
- Multi-AZ: No (staging)

**Costo:** $15.92/mes (Free Tier: $0.00 primeros 12 meses)

**Documentación:** [docs/infra/RDS-SETUP-STAGING.md](./RDS-SETUP-STAGING.md)

---

### 2. RDS Proxy (Opcional)

**Propósito:** Connection pooling para Next.js serverless (Amplify)

**Configuración:**

- MaxConnectionsPercent: 75%
- MaxIdleConnectionsPercent: 50%
- ConnectionBorrowTimeout: 120s
- TLS: Requerido

**Costo:** $11.95/mes

**⚠️ Recomendación:** Deshabilitar en staging para reducir costos (usar conexiones directas). Habilitar solo en producción.

**Documentación:** [docs/infra/RDS-SETUP-STAGING.md §7](./RDS-SETUP-STAGING.md#paso-7-configurar-rds-proxy-connection-pooling)

---

### 3. AWS Lambda PostConfirmation

**Propósito:** Sincronizar usuarios de Cognito → PostgreSQL automáticamente

**Trigger:** Post-Confirmation (después de verificar email)

**Configuración:**

- Runtime: Node.js 20.x (via Amplify Gen 2)
- Timeout: 10 segundos
- Memory: 512 MB
- Env vars: `DATABASE_URL` (via RDS Proxy o directo)

**Costo:** $0.00 (Free Tier perpetuo: 1M requests/mes)

**Archivos:**

- [`amplify/functions/post-confirmation/handler.ts`](../../amplify/functions/post-confirmation/handler.ts)
- [`amplify/functions/post-confirmation/resource.ts`](../../amplify/functions/post-confirmation/resource.ts)

---

### 4. Amazon Cognito User Pool

**Propósito:** Autenticación, autorización, gestión de usuarios

**User Pool ID:** `us-east-1_adYn3n5fz` (existente)

**Custom Attributes:**

- `custom:company_id` (UUID) — Tenant ID
- `custom:role` (String) — Rol RBAC (ADMIN, MANAGER, ACCOUNTANT, SALESPERSON, AUDITOR)
- `custom:fullname` (String) — Nombre completo

**Features:**

- Email verification: Obligatoria
- MFA: Opcional (TOTP)
- Advanced Security: Habilitada ($0.50/mes)

**Costo:** $0.50/mes

---

### 5. Amazon S3 (Storage)

**Propósito:** Almacenamiento de documentos de empresas (logos, facturas, reportes)

**Bucket:** `amplify-nexoerp-marvin-sa-nexoerpdocumentsbucketb8-bimtcqkqm8s3` (existente)

**Estructura de paths:**

```
logos/{company_id}/*
documents/{company_id}/*
temp/{company_id}/*
```

**Seguridad:**

- Block Public Access: Habilitado
- Encryption: SSE-S3
- Access: Solo via pre-signed URLs

**Costo:** $0.22/mes (Free Tier: $0.00 primeros 12 meses)

---

### 6. AWS Amplify Hosting

**Propósito:** Hosting serverless de Next.js 15 con auto-deploy

**Branch:** `staging` (auto-deploy habilitado)

**Build Settings:**

- Pre-build: `npm ci` + `npx prisma generate`
- Build: `npm run build`
- Artifacts: `.next/**/*`
- Cache: `node_modules`, `.next/cache`

**Variables de entorno (8):**

- `DATABASE_URL` (Secret) — RDS Proxy o directo
- `DIRECT_URL` (Secret) — RDS directo (migraciones)
- `NEXT_PUBLIC_AMPLIFY_REGION`
- `NEXT_PUBLIC_USER_POOL_ID`
- `NEXT_PUBLIC_USER_POOL_CLIENT_ID`
- `NEXT_PUBLIC_S3_BUCKET`
- `NODE_ENV`
- `NEXT_TELEMETRY_DISABLED`

**Costo:** $3.00/mes (Free Tier: $0.00 primeros 12 meses)

**Documentación:** [docs/infra/AMPLIFY-HOSTING-SETUP.md](./AMPLIFY-HOSTING-SETUP.md)

---

### 7. AWS Secrets Manager

**Propósito:** Gestión segura de credenciales de base de datos

**Secrets:**

- `nexoerp/staging/rds/master` — Credenciales master user (nexoerp_admin)
- `nexoerp/staging/rds/app` — Credenciales app user (nexoerp_app)

**Costo:** $0.85/mes

---

### 8. Amazon CloudWatch

**Propósito:** Logs, métricas, alarmas

**Log Groups:**

- `/aws/rds/instance/nexoerp-staging/postgresql`
- `/aws/rds/instance/nexoerp-staging/upgrade`
- `/aws/lambda/postConfirmation-staging`

**Alarmas (recomendadas):**

- RDS CPU > 80%
- RDS Connections > 80
- Lambda Errors > 5/min
- Build Failed (Amplify)

**Costo:** $4.06/mes (Free Tier: $0.00 primeros 12 meses)

---

## 💰 Costos Proyectados

### Escenario Optimizado (Sin RDS Proxy en Staging)

| Servicio        | Con Free Tier    | Sin Free Tier     |
| --------------- | ---------------- | ----------------- |
| RDS PostgreSQL  | **$0.00**        | **$15.92**        |
| ~~RDS Proxy~~   | ~~$0.00~~        | ~~$0.00~~         |
| Lambda          | **$0.00**        | **$0.00**         |
| Cognito         | **$0.50**        | **$0.50**         |
| S3              | **$0.00**        | **$0.22**         |
| Amplify         | **$0.00**        | **$3.00**         |
| Secrets Manager | **$0.85**        | **$0.85**         |
| CloudWatch      | **$0.00**        | **$2.33**         |
| **TOTAL**       | **$1.35/mes** ✅ | **$22.82/mes** ✅ |

**🎯 Presupuesto restante:** ~$27.18/mes para producción o servicios futuros (SES, SQS, WAF, GuardDuty)

**Documentación completa:** [docs/infra/COSTOS-ESTIMADOS-STAGING.md](./COSTOS-ESTIMADOS-STAGING.md)

---

## 🔒 Seguridad Multi-Tenant

### 4 Capas de Aislamiento

1. **Frontend Context:** `useCompany()` hook extrae `company_id` del JWT
2. **API Middleware:** Valida token y pasa `companyId` a servicios
3. **Prisma Extension:** Filtra automáticamente todos los queries con `company_id`
4. **PostgreSQL RLS:** Row-Level Security como fallback (defense-in-depth)

### Políticas RLS Aplicadas

```sql
-- users table (y todas las tablas de negocio futuras)
CREATE POLICY "tenant_isolation_select" ON users
  FOR SELECT USING (company_id = current_setting('app.current_company_id', TRUE)::uuid);

CREATE POLICY "tenant_isolation_insert" ON users
  FOR INSERT WITH CHECK (company_id = current_setting('app.current_company_id', TRUE)::uuid);

CREATE POLICY "tenant_isolation_update" ON users
  FOR UPDATE USING (company_id = current_setting('app.current_company_id', TRUE)::uuid);

CREATE POLICY "tenant_isolation_delete" ON users
  FOR DELETE USING (company_id = current_setting('app.current_company_id', TRUE)::uuid);
```

**Validación:** [docs/infra/CHECKLIST-STAGING-VALIDATION.md §3.2](./CHECKLIST-STAGING-VALIDATION.md#32-rls-verification)

---

## 🚀 Orden de Ejecución

### Fase 1: Crear RDS PostgreSQL (30-45 min)

1. Crear VPC y subnets (o usar Default VPC)
2. Crear DB Subnet Group
3. Crear Security Group
4. Crear Secrets Manager secrets
5. Crear RDS instance (esperar ~10 min)
6. Configurar extensiones PostgreSQL
7. Crear rol de aplicación (`nexoerp_app`)
8. **(Opcional)** Crear RDS Proxy — **Recomendación: skip en staging**

**Guía paso a paso:** [docs/infra/RDS-SETUP-STAGING.md](./RDS-SETUP-STAGING.md)

---

### Fase 2: Aplicar Migraciones Prisma (5 min)

```powershell
# Configurar .env.staging con DATABASE_URL y DIRECT_URL
# Ver script: scripts/configure-amplify-staging.ps1

# Aplicar migraciones
npx prisma migrate deploy --schema=./prisma/schema

# Verificar migraciones
npx prisma migrate status --schema=./prisma/schema

# Verificar RLS
psql -h <RDS_ENDPOINT> -U nexoerp_admin -d nexoerp -c "SELECT tablename, policyname FROM pg_policies WHERE schemaname = 'public';"
```

---

### Fase 3: Configurar Amplify Hosting (15 min)

1. Conectar repositorio GitHub al proyecto Amplify
2. Configurar branch `staging`
3. Configurar 8 variables de entorno (ver AMPLIFY-HOSTING-SETUP.md)
4. Trigger primer deploy: `git push origin staging`
5. Verificar build exitoso
6. Obtener URL staging: `staging.xxxxxxxxxx.amplifyapp.com`

**Script de apoyo:** [scripts/configure-amplify-staging.ps1](../../scripts/configure-amplify-staging.ps1)

**Guía paso a paso:** [docs/infra/AMPLIFY-HOSTING-SETUP.md](./AMPLIFY-HOSTING-SETUP.md)

---

### Fase 4: Validar End-to-End (20 min)

1. Acceder a URL staging
2. Registrar usuario de prueba (con custom attributes)
3. Confirmar email
4. Verificar en CloudWatch Logs que Lambda PostConfirmation se ejecutó
5. Verificar en PostgreSQL que usuario fue creado
6. Login con usuario creado
7. Verificar multi-tenant isolation (registrar 2 usuarios de empresas diferentes)

**Checklist completo:** [docs/infra/CHECKLIST-STAGING-VALIDATION.md](./CHECKLIST-STAGING-VALIDATION.md)

---

## 📊 Monitoreo Post-Deploy

### Métricas Clave a Revisar (Primera Semana)

| Métrica           | Threshold | Acción si se excede           |
| ----------------- | --------- | ----------------------------- |
| RDS CPU           | > 60%     | Investigar queries lentos     |
| RDS Connections   | > 50      | Considerar RDS Proxy          |
| Lambda Errors     | > 2%      | Revisar logs PostConfirmation |
| Build Duration    | > 5 min   | Optimizar dependencias        |
| Response Time P95 | > 2s      | Investigar performance        |
| **Costos AWS**    | > $15/mes | Revisar AWS Cost Explorer     |

### Comandos de Monitoreo

```powershell
# Ver costos del mes actual
aws ce get-cost-and-usage `
  --time-period Start=2026-03-01,End=2026-03-31 `
  --granularity MONTHLY `
  --metrics UnblendedCost `
  --group-by Type=DIMENSION,Key=SERVICE

# Ver logs Lambda PostConfirmation
aws logs tail /aws/lambda/postConfirmation-staging --follow

# Ver métricas RDS
aws cloudwatch get-metric-statistics `
  --namespace AWS/RDS `
  --metric-name CPUUtilization `
  --dimensions Name=DBInstanceIdentifier,Value=nexoerp-staging `
  --start-time 2026-03-15T00:00:00Z `
  --end-time 2026-03-15T23:59:59Z `
  --period 3600 `
  --statistics Average
```

---

## ⚠️ Riesgos y Mitigaciones

| Riesgo                                 | Probabilidad | Impacto | Mitigación                                                   |
| -------------------------------------- | ------------ | ------- | ------------------------------------------------------------ |
| **Agotamiento de conexiones RDS**      | Media        | Alto    | Configurar RDS Proxy o connection pooling en app             |
| **Lambda timeout en PostConfirmation** | Baja         | Alto    | Aumentar timeout a 15s, optimizar query Prisma               |
| **Costo > $50/mes**                    | Baja         | Medio   | Deshabilitar RDS Proxy staging, configurar AWS Budget alerts |
| **RLS bypass accidental**              | Baja         | Crítico | Tests automatizados de multi-tenant isolation en CI          |
| **Exposición de credentials**          | Baja         | Crítico | Secrets Manager + IAM least privilege + .gitignore           |

---

## 🎯 Próximos Pasos

### Inmediato (Post-Deploy Staging)

- [ ] Ejecutar checklist de validación completo
- [ ] Configurar AWS Budgets con alertas ($15, $25, $40, $50)
- [ ] Documentar issues encontrados durante deploy
- [ ] Verificar costos reales después de 1 semana de uso

### Corto Plazo (1-2 semanas)

- [ ] Implementar API middleware para extraer `company_id` del JWT
- [ ] Completar módulo Core (CRUD Users & Companies)
- [ ] E2E tests de multi-tenant isolation en CI
- [ ] Configurar alarmas CloudWatch en staging

### Mediano Plazo (1-2 meses)

- [ ] Planificar configuración de production environment
- [ ] Implementar RDS Proxy en production (si staging funciona sin él)
- [ ] Configurar custom domain: `staging.nexoerp.com`
- [ ] Migrar de staging a production con zero downtime

---

## 📚 Documentación de Referencia

| Documento                                                            | Propósito                                 |
| -------------------------------------------------------------------- | ----------------------------------------- |
| [RDS-SETUP-STAGING.md](./RDS-SETUP-STAGING.md)                       | Guía completa de setup RDS + RDS Proxy    |
| [AMPLIFY-HOSTING-SETUP.md](./AMPLIFY-HOSTING-SETUP.md)               | Configuración Amplify + GitHub + env vars |
| [CHECKLIST-STAGING-VALIDATION.md](./CHECKLIST-STAGING-VALIDATION.md) | Checklist de validación post-deploy       |
| [COSTOS-ESTIMADOS-STAGING.md](./COSTOS-ESTIMADOS-STAGING.md)         | Desglose detallado de costos AWS          |

**Scripts:**

- [configure-amplify-staging.ps1](../../scripts/configure-amplify-staging.ps1) — Configurar env vars en Amplify

**Código:**

- [amplify/functions/post-confirmation/](../../amplify/functions/post-confirmation/) — Lambda handler
- [amplify/backend.ts](../../amplify/backend.ts) — Definición de backend
- [amplify/auth/resource.ts](../../amplify/auth/resource.ts) — Configuración Cognito

---

## 🆘 Troubleshooting

### Build falla en Amplify: "Cannot connect to database"

**Causa:** `DATABASE_URL` no configurada o RDS no accesible desde Amplify

**Solución:**

1. Verificar que RDS Security Group permite tráfico desde `0.0.0.0/0` (temporalmente)
2. Verificar que `DATABASE_URL` está configurada en Amplify Console
3. Verificar formato: `postgresql://user:pass@host:5432/dbname?schema=public&sslmode=require`

### Lambda PostConfirmation falla: "User creation failed"

**Causa:** Company no existe, max_users alcanzado, o constraint violation

**Solución:**

1. Verificar en CloudWatch Logs el error exacto
2. Verificar que la empresa con `custom:company_id` existe en tabla `companies`
3. Verificar que la empresa no ha alcanzado su límite `max_users`
4. Verificar que el `custom:role` es uno de los 5 roles válidos

### Multi-tenant isolation roto: Usuario ve datos de otra empresa

**Causa:** RLS no habilitado, o Prisma Extension no configurada

**Solución:**

1. Verificar RLS habilitado: `SELECT relname, relrowsecurity FROM pg_class WHERE relname = 'users';`
2. Verificar políticas RLS: `SELECT tablename, policyname FROM pg_policies;`
3. Verificar que API middleware está pasando `companyId` a Prisma Extension
4. Ejecutar test manual de RLS (ver CHECKLIST §3.2)

---

**Última actualización:** 15 marzo 2026  
**Autor:** DevOps Team NexoERP  
**Próxima revisión:** Después del primer mes de uso en staging (abril 2026)
