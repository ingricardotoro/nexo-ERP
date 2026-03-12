# Configuración GitHub Actions CI/CD

> **Estado:** ✅ Implementado  
> **Fecha:** 11 marzo 2026  
> **Relacionado con:** F0-06 GitHub Repository Setup

---

## Arquitectura CI/CD

NexoERP usa una **arquitectura híbrida** para CI/CD:

- **GitHub Actions:** Quality gates en PRs (tests, lint, typecheck, build verification)
- **AWS Amplify Gen 2:** Build de producción + Deploy automático (main, staging)

### Flujo de Desarrollo

```
Feature Branch
      ↓
   Open PR → GitHub Actions (2-3 min)
      ↓           ├─ Lint & Format
      ↓           ├─ TypeScript check
      ↓           ├─ Unit/Integration tests (Vitest)
      ↓           └─ Build verification
      ↓
   Code Review (manual approval)
      ↓
   Merge to staging → AWS Amplify (5-10 min)
                         ├─ Build Next.js 16
                         ├─ Deploy to CloudFront
                         └─ Provision backend (Cognito, S3)
```

---

## Configuración del Workflow

**Archivo:** `.github/workflows/ci.yml`

### Jobs Configurados

#### 1. **Lint & Format**
- ESLint: `npm run lint`
- Prettier: `npm run format:check`
- Node.js 20 con npm cache

#### 2. **TypeScript Check**
- Type checking: `npm run typecheck`
- Genera Prisma Client antes de verificar tipos

#### 3. **Unit & Integration Tests**
- PostgreSQL 16 service container
- Ejecuta migraciones Prisma en DB de test
- Corre tests con Vitest: `npm run test`
- Genera coverage report (artifact 7 días)

**Configuración PostgreSQL CI:**
```yaml
services:
  postgres:
    image: postgres:16
    env:
      POSTGRES_USER: nexoerp_test
      POSTGRES_PASSWORD: test_password_ci
      POSTGRES_DB: nexoerp_test
    ports:
      - 5432:5432
```

#### 4. **Build Verification**
- Ejecuta build completo de Next.js: `npm run build`
- Verifica que directorio `.next` se genere correctamente
- NO hace deploy (lo hace Amplify)

### Triggers

```yaml
on:
  pull_request:
    branches: [main, staging]
  push:
    branches: [main, staging]
```

---

## Branch Protection Rules

### Configuración Recomendada en GitHub

**Para ramas `main` y `staging`:**

1. **Require a pull request before merging**
   - ✅ Require approvals: 1
   - ✅ Dismiss stale pull request approvals when new commits are pushed
   - ✅ Require review from Code Owners (configurar CODEOWNERS file)

2. **Require status checks to pass before merging**
   - ✅ Require branches to be up to date before merging
   - Status checks requeridos:
     - `lint` (Lint & Format)
     - `typecheck` (TypeScript Check)
     - `test` (Unit & Integration Tests)
     - `build` (Build Verification)

3. **Require conversation resolution before merging**
   - ✅ Enabled

4. **Require linear history**
   - ✅ Enabled (fuerza rebase o squash merge, no merge commits)

5. **Do not allow bypassing the above settings**
   - ✅ Enabled (ni siquiera admins pueden bypassear)

### Comando para configurar (GitHub CLI)

```bash
# Instalar GitHub CLI: https://cli.github.com/

# Configurar branch protection para main
gh api repos/:owner/:repo/branches/main/protection \
  --method PUT \
  --field required_status_checks='{"strict":true,"contexts":["lint","typecheck","test","build"]}' \
  --field enforce_admins=true \
  --field required_pull_request_reviews='{"required_approving_review_count":1,"dismiss_stale_reviews":true}' \
  --field required_linear_history=true \
  --field allow_force_pushes=false \
  --field allow_deletions=false

# Repetir para staging
gh api repos/:owner/:repo/branches/staging/protection \
  --method PUT \
  --field required_status_checks='{"strict":true,"contexts":["lint","typecheck","test","build"]}' \
  --field enforce_admins=true \
  --field required_pull_request_reviews='{"required_approving_review_count":1,"dismiss_stale_reviews":true}' \
  --field required_linear_history=true \
  --field allow_force_pushes=false \
  --field allow_deletions=false
```

---

## Secrets Requeridos

### GitHub Repository Secrets

Configurar en: **Settings → Secrets and variables → Actions**

| Secret Name | Descripción | Usado en |
|------------|-------------|----------|
| (ninguno requerido para CI básico) | Tests usan PostgreSQL local del service container | - |

**Nota:** AWS Amplify usa sus propias credenciales configuradas en la consola de Amplify (no en GitHub Secrets).

---

## Optimizaciones de Performance

### Cache de Dependencias npm

```yaml
- name: Setup Node.js 20
  uses: actions/setup-node@v4
  with:
    node-version: '20'
    cache: 'npm'  # ← Cache automático de node_modules
```

**Beneficios:**
- Primera ejecución: ~60s instalación
- Ejecuciones subsecuentes: ~10s (si package-lock.json no cambió)

### Cache de Prisma Client

```yaml
- name: Generate Prisma Client
  run: npm run db:generate
```

Prisma Client se regenera en cada job (rápido: ~5s).

---

## Presupuesto GitHub Actions

### Límites Free Tier

**GitHub Free / Pro:** 2000 minutos/mes  
**Consumo estimado NexoERP:**
- 1 PR típico: ~8 minutos (4 jobs × 2 min promedio)
- **Capacidad:** ~250 PRs/mes

**Suficiente para:** Equipo de 2-5 desarrolladores con 10-20 PRs/semana

### Monitoreo

Ver uso en: **Settings → Billing and plans → Plans and usage**

---

## Troubleshooting

### Tests fallan en CI pero pasan localmente

**Causa común:** Variables de entorno faltantes

**Solución:**
1. Verificar que `DATABASE_URL` esté configurada en el job `test`
2. Confirmar que migraciones Prisma se ejecuten antes de tests
3. Revisar logs del service container PostgreSQL

### Build falla con "Cannot find module"

**Causa común:** Prisma Client no generado

**Solución:**
```yaml
- name: Generate Prisma Client
  run: npm run db:generate
```

Debe ejecutarse ANTES de `npm run build` o `npm run typecheck`.

### PostgreSQL service container no responde

**Síntoma:** Tests timeout conectando a base de datos

**Solución:**
```yaml
services:
  postgres:
    options: >-
      --health-cmd pg_isready
      --health-interval 10s
      --health-timeout 5s
      --health-retries 5
```

Health checks aseguran que PostgreSQL esté listo antes de correr tests.

---

## Workflows Futuros (Post-MVP)

### E2E Tests con Playwright

```yaml
test-e2e:
  name: E2E Tests (Playwright)
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
    - run: npm ci
    - run: npx playwright install --with-deps
    - run: npm run test:e2e
```

**Consideración:** E2E tests son lentos (~5-10 min) y costosos. Ejecutar solo en:
- Push a `main` (pre-production validation)
- PRs con label `needs-e2e-tests`

### Changesets Release Automation

```yaml
release:
  name: Release
  if: github.ref == 'refs/heads/main'
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: changesets/action@v1
      with:
        publish: npm run release
      env:
        GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
```

**Flujo:**
1. Merge a `main` con changesets pendientes
2. GitHub Actions publica release automático
3. Actualiza CHANGELOG.md
4. Crea git tag con versión

---

## Integración con Amplify

### Configuración Amplify Console

**Branch tracking:**
- `main` → Production environment
- `staging` → Staging environment
- Feature branches → Preview environments (opcional, $$)

**Build settings** (`amplify.yml`):
```yaml
version: 1
frontend:
  phases:
    preBuild:
      commands:
        - npm ci
        - npx ampx generate outputs --branch $AWS_BRANCH
    build:
      commands:
        - npm run db:generate
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

**Variables de entorno Amplify:**
- `DATABASE_URL` → RDS connection string (staging/production)
- `NEXT_PUBLIC_APP_ENV` → `staging` | `production`

---

## Ventajas de la Arquitectura Híbrida

| Aspecto | GitHub Actions | AWS Amplify |
|---------|---------------|-------------|
| **Propósito** | Quality Gates (pre-merge) | Production Deploy (post-merge) |
| **Velocidad** | 2-3 min | 5-10 min |
| **Costo** | GRATIS (2000 min/mes) | ~$40-50/mes |
| **Feedback** | Inmediato en PR | Después de merge |
| **Rollback** | N/A (no hay deploy) | Automático si falla |
| **Database** | PostgreSQL local (CI) | RDS (staging/prod) |

**Conclusión:** GitHub Actions detecta problemas ANTES de gastar presupuesto Amplify en builds fallidos.

---

## Próximos Pasos

1. ✅ Crear `.github/workflows/ci.yml`
2. ✅ Crear `.github/PULL_REQUEST_TEMPLATE.md`
3. ⏳ Configurar branch protection rules en GitHub UI
4. ⏳ Crear primer PR y validar que checks pasen
5. ⏳ Opcional: Configurar CODEOWNERS file
6. ⏳ Opcional: Configurar E2E tests workflow

---

**Referencias:**
- GitHub Actions: https://docs.github.com/en/actions
- Branch Protection: https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches
- Amplify Gen 2 CI/CD: https://docs.amplify.aws/gen2/deploy-and-host/
