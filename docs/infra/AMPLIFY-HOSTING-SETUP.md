# AWS Amplify Hosting — Configuración Staging

## Objetivo

Conectar el repositorio GitHub al proyecto AWS Amplify y configurar el branch `staging` para auto-deploy continuo.

---

## Pre-requisitos

- Repositorio GitHub: `https://github.com/<OWNER>/nexoerp` (ajustar según tu repo)
- AWS Console access con permisos: `amplify:*`
- Branch `staging` existe en GitHub
- RDS PostgreSQL staging creado y funcional
- Secrets Manager configurado con credenciales de BD

---

## PASO 1: Conectar GitHub al Proyecto Amplify

### Opción A: Via AWS Console (Recomendado para primera vez)

1. Ir a **AWS Amplify Console**: https://console.aws.amazon.com/amplify/home?region=us-east-1
2. Si ya existe un proyecto Amplify (desde sandbox):
   - Click en el proyecto existente
   - Ir a la pestaña **"Hosting"**
   - Click en **"Connect branch"**
3. Si NO existe proyecto:
   - Click en **"New app" → "Host web app"**
   - Seleccionar **"GitHub"** como source
   - Autorizar AWS Amplify a acceder a tu cuenta GitHub (OAuth)
   - Seleccionar repositorio: `nexoerp`
   - Seleccionar branch: `staging`

### Opción B: Via AWS CLI (Automatizado)

```bash
# Crear Personal Access Token en GitHub (si no tienes)
# 1. Ir a github.com → Settings → Developer settings → Personal access tokens
# 2. Generate new token (classic)
# 3. Scopes: repo, admin:repo_hook
# 4. Guardar token (solo se muestra una vez)

$GITHUB_TOKEN = "ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
$REPO_URL = "https://github.com/<OWNER>/nexoerp"

# Crear app Amplify (si no existe)
aws amplify create-app `
  --name "NexoERP" `
  --description "ERP multi-tenant para PYMEs Honduras" `
  --repository $REPO_URL `
  --oauth-token $GITHUB_TOKEN `
  --platform WEB_COMPUTE `
  --iam-service-role-arn <IAM_ROLE_ARN> `
  --tags Project=NexoERP,Environment=staging `
  --enable-auto-branch-creation `
  --auto-branch-creation-patterns "feat/*" "fix/*"

# Output: App ID (app-xxxxxxxxxx) — guardar
```

---

## PASO 2: Configurar Branch Staging

```bash
# Conectar branch staging
aws amplify create-branch `
  --app-id <APP_ID> `
  --branch-name staging `
  --description "Staging environment for QA and demos" `
  --enable-auto-build `
  --enable-pull-request-preview false `
  --stage PRODUCTION `
  --tags Environment=staging

# Output: Branch ARN
```

---

## PASO 3: Configurar Variables de Entorno (Secrets)

**CRÍTICO:** Configurar variables de entorno en Amplify Console ANTES del primer deploy.

### Via AWS Console (Recomendado):

1. Ir a Amplify Console → App → **"Environment variables"**
2. Click en **"Manage variables"**
3. Agregar las siguientes variables:

| Variable                          | Valor                                                                                                                 | Tipo      |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------- | --------- |
| `DATABASE_URL`                    | `postgresql://nexoerp_app:<PASSWORD>@<PROXY_ENDPOINT>:5432/nexoerp?schema=public&sslmode=require&connection_limit=10` | Secret    |
| `DIRECT_URL`                      | `postgresql://nexoerp_admin:<PASSWORD>@<RDS_ENDPOINT>:5432/nexoerp?schema=public&sslmode=require`                     | Secret    |
| `NEXT_PUBLIC_AMPLIFY_REGION`      | `us-east-1`                                                                                                           | Plaintext |
| `NEXT_PUBLIC_USER_POOL_ID`        | `us-east-1_adYn3n5fz`                                                                                                 | Plaintext |
| `NEXT_PUBLIC_USER_POOL_CLIENT_ID` | `<CLIENT_ID>` (obtener de Cognito)                                                                                    | Plaintext |
| `NEXT_PUBLIC_S3_BUCKET`           | `amplify-nexoerp-marvin-sa-nexoerpdocumentsbucketb8-bimtcqkqm8s3`                                                     | Plaintext |
| `NODE_ENV`                        | `production`                                                                                                          | Plaintext |
| `NEXT_TELEMETRY_DISABLED`         | `1`                                                                                                                   | Plaintext |

4. **Importante:** Seleccionar **"Secret"** para `DATABASE_URL` y `DIRECT_URL` (se encriptarán en Secrets Manager automáticamente)

### Via AWS CLI:

```bash
# Obtener credenciales de Secrets Manager
$APP_SECRET = aws secretsmanager get-secret-value --secret-id nexoerp/staging/rds/app --query SecretString --output text | ConvertFrom-Json
$ADMIN_SECRET = aws secretsmanager get-secret-value --secret-id nexoerp/staging/rds/master --query SecretString --output text | ConvertFrom-Json

$PROXY_ENDPOINT = "nexoerp-staging-proxy.proxy-xxxxxxxxxx.us-east-1.rds.amazonaws.com"
$RDS_ENDPOINT = "nexoerp-staging.xxxxxxxxxx.us-east-1.rds.amazonaws.com"

# Configurar variables de entorno
aws amplify update-branch `
  --app-id <APP_ID> `
  --branch-name staging `
  --environment-variables @"
{
  "DATABASE_URL": "postgresql://$($APP_SECRET.username):$($APP_SECRET.password)@$PROXY_ENDPOINT:5432/nexoerp?schema=public&sslmode=require&connection_limit=10",
  "DIRECT_URL": "postgresql://$($ADMIN_SECRET.username):$($ADMIN_SECRET.password)@$RDS_ENDPOINT:5432/nexoerp?schema=public&sslmode=require",
  "NEXT_PUBLIC_AMPLIFY_REGION": "us-east-1",
  "NEXT_PUBLIC_USER_POOL_ID": "us-east-1_adYn3n5fz",
  "NEXT_PUBLIC_USER_POOL_CLIENT_ID": "<CLIENT_ID>",
  "NEXT_PUBLIC_S3_BUCKET": "amplify-nexoerp-marvin-sa-nexoerpdocumentsbucketb8-bimtcqkqm8s3",
  "NODE_ENV": "production",
  "NEXT_TELEMETRY_DISABLED": "1"
}
"@
```

**Obtener User Pool Client ID:**

```bash
aws cognito-idp list-user-pool-clients `
  --user-pool-id us-east-1_adYn3n5fz `
  --max-results 10 `
  --query "UserPoolClients[?ClientName=='nexoerp-client'].ClientId" `
  --output text
```

---

## PASO 4: Configurar Build Settings (amplify.yml)

Verificar que el archivo `amplify.yml` en la raíz del proyecto tenga la configuración correcta:

```yaml
version: 1
backend:
  phases:
    build:
      commands:
        - npm ci --cache .npm --prefer-offline
        - npx ampx pipeline-deploy --branch $AWS_BRANCH --app-id $AWS_APP_ID
frontend:
  phases:
    preBuild:
      commands:
        - npm ci --cache .npm --prefer-offline
    build:
      commands:
        # Generar Prisma Client (usa DATABASE_URL)
        - npx prisma generate --schema=./prisma/schema
        # Build Next.js
        - npm run build
  artifacts:
    baseDirectory: .next
    files:
      - '**/*'
  cache:
    paths:
      - .next/cache/**/*
      - .npm/**/*
```

**IMPORTANTE:** NO ejecutar `prisma migrate deploy` en el build de Amplify. Las migraciones se aplican manualmente o via CI/CD separado.

---

## PASO 5: Trigger First Deploy

```bash
# Trigger deploy manualmente (primera vez)
aws amplify start-job `
  --app-id <APP_ID> `
  --branch-name staging `
  --job-type RELEASE

# Monitorear progreso
aws amplify get-job `
  --app-id <APP_ID> `
  --branch-name staging `
  --job-id <JOB_ID>
```

O simplemente hacer push al branch `staging`:

```bash
git checkout staging
git merge feat/fase-1-core-system
git push origin staging
```

Amplify detectará el push y ejecutará el build automáticamente.

---

## PASO 6: Verificar Deploy

1. Ir a Amplify Console → App → Branch `staging` → **"Deployments"**
2. Verificar que las 4 etapas pasen:
   - ✅ Provision
   - ✅ Build (backend + frontend)
   - ✅ Deploy
   - ✅ Verify

3. Obtener URL de staging:

```bash
aws amplify get-branch `
  --app-id <APP_ID> `
  --branch-name staging `
  --query "branch.defaultDomain" `
  --output text
# Output: staging.xxxxxxxxxx.amplifyapp.com
```

4. Acceder a la URL y verificar:
   - ✅ Página de login se renderiza
   - ✅ Cognito User Pool se conecta
   - ✅ Console muestra logs sin errores de conexión a BD

---

## PASO 7: Configurar Custom Domain (Opcional)

Si tienes dominio `nexoerp.com`:

1. Ir a Amplify Console → App → **"Domain management"**
2. Click en **"Add domain"**
3. Ingresar dominio: `staging.nexoerp.com`
4. Seguir wizard para configurar DNS (Route 53 o external provider)
5. Esperar validación SSL/TLS (ACM certificate)

O via CLI:

```bash
aws amplify create-domain-association `
  --app-id <APP_ID> `
  --domain-name nexoerp.com `
  --sub-domain-settings "prefix=staging,branchName=staging"
```

---

## Troubleshooting

### Build falla en `npx prisma generate`

**Causa:** `DATABASE_URL` no configurada o inválida.

**Solución:** Verificar variable de entorno en Amplify Console.

```bash
aws amplify get-branch `
  --app-id <APP_ID> `
  --branch-name staging `
  --query "branch.environmentVariables"
```

### Lambda PostConfirmation falla con "Unable to connect to database"

**Causa:** Lambda no tiene permisos para conectar a RDS Proxy o `DATABASE_URL` incorrecta.

**Solución:**

1. Verificar Security Group de RDS Proxy permite tráfico desde Lambda
2. Configurar `DATABASE_URL` en Lambda environment variables (Amplify lo hace automáticamente)
3. Verificar logs en CloudWatch:

```bash
aws logs tail /aws/lambda/postConfirmation-staging --follow
```

### Build pasa pero app no se conecta a BD

**Causa:** `NEXT_PUBLIC_*` variables no propagadas al cliente.

**Solución:** Verificar que todas las variables con prefijo `NEXT_PUBLIC_` estén configuradas en Amplify Console y hacer rebuild.

---

## Costos Estimados (Amplify Hosting)

| Recurso         | Configuración              | Costo mensual           |
| --------------- | -------------------------- | ----------------------- |
| Amplify Hosting | Build minutes: ~50 min/mes | $0.00 (1000 min gratis) |
|                 | Data served: ~10 GB/mes    | $1.50                   |
|                 | Requests: ~100k/mes        | $0.00 (incluido)        |
| **TOTAL**       |                            | **~$1.50/mes**          |

---

## Próximos Pasos

1. ✅ Amplify conectado a GitHub
2. ✅ Branch staging configurado
3. ✅ Variables de entorno configuradas
4. ✅ Primer deploy exitoso
5. ⏳ Probar registro de usuario end-to-end
6. ⏳ Verificar Lambda PostConfirmation sincroniza user en Prisma
7. ⏳ Configurar production branch (después de validar staging)

---

**Documentado:** 15 marzo 2026  
**Próxima revisión:** Después de validar staging funcional
