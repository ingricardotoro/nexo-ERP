# F0-06: Repositorio GitHub — Branch Protection + Templates

> **ID:** F0-06
> **Fase:** 0 — Fundación
> **Prioridad:** 🟡 Alta
> **Estimación:** 2–3 horas
> **Dependencias:** F0-01 (Setup proyecto), F0-04 (Tooling)
> **Bloquea a:** F0-09 (MCPs)

---

## 1. Objetivo

Configurar el repositorio GitHub con CI pipeline (GitHub Actions), branch protection rules, templates de PR e Issues, y el flujo de trabajo Git que el equipo seguirá durante todo el desarrollo.

---

## 2. Prerrequisitos

| Requisito                   | Detalle                               | Verificación              |
| --------------------------- | ------------------------------------- | ------------------------- |
| F0-01 y F0-04 completados   | Proyecto con tooling configurado      | `npm run lint` funciona   |
| F0-05 completado (opcional) | Tests configurados                    | `npx vitest run` funciona |
| Cuenta GitHub               | Con permisos para crear repositorios  | Login en github.com       |
| GitHub CLI                  | Instalado (opcional pero recomendado) | `gh --version`            |

---

## 3. Pasos de Implementación

### 3.1 Crear repositorio en GitHub

```powershell
# Opción A: Con GitHub CLI
gh repo create nexoerp --private --description "Sistema ERP modular para PYMEs hondureñas" --source=. --remote=origin

# Opción B: Manual
# 1. Crear repositorio en github.com (privado)
# 2. Conectar remote
git remote add origin https://github.com/{tu-usuario}/nexoerp.git
```

### 3.2 Configurar Git local

```powershell
# Configurar Git para el proyecto
git config core.autocrlf input  # Normalizar line endings a LF
git config pull.rebase true     # Rebase por defecto al pull

# Verificar ramas
git branch -m main              # Asegurar que la rama principal es 'main'
```

### 3.3 Crear rama `staging`

```powershell
# Crear y subir rama staging
git checkout -b staging
git push -u origin staging
git checkout main
```

### 3.4 Crear GitHub Actions CI Pipeline

```yaml
# .github/workflows/ci.yml
name: CI — NexoERP

on:
  push:
    branches: [main, staging]
  pull_request:
    branches: [main, staging]

# Cancelar runs previos del mismo PR/branch
concurrency:
  group: ${{ github.workflow }}-${{ github.event.pull_request.number || github.ref }}
  cancel-in-progress: true

env:
  NODE_VERSION: '20'
  # Desactivar telemetría de Next.js en CI
  NEXT_TELEMETRY_DISABLED: 1

jobs:
  # === Job 1: Lint + Typecheck ===
  quality:
    name: Lint & Typecheck
    runs-on: ubuntu-latest
    timeout-minutes: 10

    steps:
      - name: Checkout código
        uses: actions/checkout@v4

      - name: Configurar Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - name: Instalar dependencias
        run: npm ci

      - name: Generar Prisma Client
        run: npx prisma generate

      - name: ESLint
        run: npm run lint

      - name: TypeScript check
        run: npm run typecheck

      - name: Prettier check
        run: npm run format:check

  # === Job 2: Unit + Integration Tests ===
  test:
    name: Unit & Integration Tests
    runs-on: ubuntu-latest
    timeout-minutes: 15
    needs: quality

    steps:
      - name: Checkout código
        uses: actions/checkout@v4

      - name: Configurar Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - name: Instalar dependencias
        run: npm ci

      - name: Generar Prisma Client
        run: npx prisma generate

      - name: Ejecutar tests
        run: npx vitest run --coverage

      - name: Subir reporte de cobertura
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: coverage-report
          path: coverage/
          retention-days: 7

  # === Job 3: Build ===
  build:
    name: Build Next.js
    runs-on: ubuntu-latest
    timeout-minutes: 15
    needs: quality

    env:
      # Variables ficticias para que el build pase sin conexión real a AWS
      DATABASE_URL: 'postgresql://user:pass@localhost:5432/nexoerp'
      DIRECT_URL: 'postgresql://user:pass@localhost:5432/nexoerp'
      NEXT_PUBLIC_APP_URL: 'http://localhost:3000'

    steps:
      - name: Checkout código
        uses: actions/checkout@v4

      - name: Configurar Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - name: Instalar dependencias
        run: npm ci

      - name: Generar Prisma Client
        run: npx prisma generate

      - name: Build
        run: npm run build

  # === Job 4: E2E Tests (solo en push a staging o PRs a main) ===
  e2e:
    name: E2E Tests (Playwright)
    runs-on: ubuntu-latest
    timeout-minutes: 30
    needs: build
    if: github.base_ref == 'main' || github.ref == 'refs/heads/staging'

    env:
      DATABASE_URL: 'postgresql://user:pass@localhost:5432/nexoerp'
      DIRECT_URL: 'postgresql://user:pass@localhost:5432/nexoerp'
      NEXT_PUBLIC_APP_URL: 'http://localhost:3000'

    steps:
      - name: Checkout código
        uses: actions/checkout@v4

      - name: Configurar Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - name: Instalar dependencias
        run: npm ci

      - name: Generar Prisma Client
        run: npx prisma generate

      - name: Instalar Playwright Chromium
        run: npx playwright install --with-deps chromium

      - name: Ejecutar E2E tests
        run: npx playwright test

      - name: Subir reporte de Playwright
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 7
```

### 3.5 Crear PR Template

```markdown
<!-- .github/PULL_REQUEST_TEMPLATE.md -->

## Descripción

<!-- Describe brevemente qué cambios introduces y por qué -->

## Tipo de cambio

- [ ] 🐛 Bug fix (cambio que corrige un issue)
- [ ] ✨ Nueva funcionalidad (cambio que agrega funcionalidad)
- [ ] 💥 Breaking change (cambio que rompe compatibilidad)
- [ ] 📝 Documentación
- [ ] ♻️ Refactorización (no agrega funcionalidad ni corrige bugs)
- [ ] 🎨 Estilo / UI
- [ ] ⚡ Performance
- [ ] 🔧 Configuración / Infraestructura

## Módulo(s) afectado(s)

- [ ] Core
- [ ] Contactos
- [ ] Contabilidad
- [ ] Facturación
- [ ] Compras
- [ ] Ventas/CRM
- [ ] Inventarios
- [ ] Infraestructura

## Checklist

### General

- [ ] Mi código sigue las convenciones del proyecto
- [ ] He realizado self-review de mi código
- [ ] He comentado el código en áreas difíciles de entender
- [ ] He actualizado la documentación correspondiente
- [ ] Mis cambios no generan nuevos warnings

### Testing

- [ ] He agregado tests que prueban mi cambio
- [ ] Tests existentes pasan localmente
- [ ] Cobertura de tests ≥ 80% en lógica de negocio nueva

### Multi-tenant 🔒

- [ ] Las tablas nuevas incluyen `company_id` (si aplica)
- [ ] Las políticas RLS están creadas para tablas nuevas
- [ ] Los índices compuestos tienen `company_id` como primer campo
- [ ] He verificado que no hay filtración de datos entre tenants

### Fiscal 🇭🇳 (si aplica)

- [ ] Los cálculos de ISV son correctos (15%, 18%, exento)
- [ ] La numeración fiscal sigue el formato SAR
- [ ] Los reportes cumplen con requisitos del DET

## Screenshots / Videos (si hay cambios de UI)

<!-- Adjuntar capturas o grabaciones -->

## Notas adicionales

<!-- Cualquier contexto adicional para los reviewers -->
```

### 3.6 Crear Issue Templates

```yaml
# .github/ISSUE_TEMPLATE/bug_report.yml
name: 🐛 Reporte de Bug
description: Reportar un error en NexoERP
labels: ['bug', 'triage']
body:
  - type: markdown
    attributes:
      value: |
        Gracias por reportar este bug. Por favor completa la información para que podamos investigar.
  - type: textarea
    id: description
    attributes:
      label: Descripción del bug
      description: Describe claramente qué está mal
      placeholder: Al hacer X, esperaba Y pero ocurrió Z
    validations:
      required: true
  - type: textarea
    id: steps
    attributes:
      label: Pasos para reproducir
      description: Lista los pasos exactos para reproducir el error
      value: |
        1. Ir a '...'
        2. Hacer click en '...'
        3. Ver error
    validations:
      required: true
  - type: dropdown
    id: module
    attributes:
      label: Módulo afectado
      options:
        - Core
        - Contactos
        - Contabilidad
        - Facturación
        - Compras
        - Ventas/CRM
        - Inventarios
        - Infraestructura
    validations:
      required: true
  - type: dropdown
    id: severity
    attributes:
      label: Severidad
      options:
        - 🔴 Crítico (bloqueante, pérdida de datos)
        - 🟠 Alto (funcionalidad rota, sin workaround)
        - 🟡 Medio (funcionalidad degradada, hay workaround)
        - 🟢 Bajo (cosmético, menor)
    validations:
      required: true
  - type: textarea
    id: expected
    attributes:
      label: Comportamiento esperado
      description: Qué debería haber pasado
    validations:
      required: true
  - type: textarea
    id: screenshots
    attributes:
      label: Screenshots / Logs
      description: Adjuntar capturas, logs de consola, o mensajes de error
  - type: input
    id: environment
    attributes:
      label: Ambiente
      description: Local, Staging, Production
      placeholder: 'Local (Docker PG16)'
```

```yaml
# .github/ISSUE_TEMPLATE/feature_request.yml
name: ✨ Solicitud de Feature
description: Proponer una nueva funcionalidad para NexoERP
labels: ['enhancement']
body:
  - type: markdown
    attributes:
      value: |
        Describe la funcionalidad que te gustaría ver en NexoERP.
  - type: textarea
    id: description
    attributes:
      label: Descripción de la funcionalidad
      description: Describe claramente qué quieres lograr
      placeholder: Como [rol], quiero [funcionalidad] para [beneficio]
    validations:
      required: true
  - type: dropdown
    id: module
    attributes:
      label: Módulo relacionado
      options:
        - Core
        - Contactos
        - Contabilidad
        - Facturación
        - Compras
        - Ventas/CRM
        - Inventarios
        - Nuevo módulo
    validations:
      required: true
  - type: textarea
    id: alternatives
    attributes:
      label: Alternativas consideradas
      description: ¿Has considerado otras soluciones?
  - type: textarea
    id: context
    attributes:
      label: Contexto adicional
      description: Referencias a REQUIREMENTS.md, mockups, etc.
```

### 3.7 Configurar Branch Protection Rules

Configurar via GitHub CLI o manualmente en Settings → Branches:

```powershell
# Proteger main
gh api repos/{owner}/{repo}/branches/main/protection -X PUT --input - << 'EOF'
{
  "required_status_checks": {
    "strict": true,
    "contexts": ["Lint & Typecheck", "Unit & Integration Tests", "Build Next.js"]
  },
  "enforce_admins": false,
  "required_pull_request_reviews": {
    "required_approving_review_count": 1,
    "dismiss_stale_reviews": true,
    "require_code_owner_reviews": false
  },
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false
}
EOF

# Proteger staging (menos estricto)
gh api repos/{owner}/{repo}/branches/staging/protection -X PUT --input - << 'EOF'
{
  "required_status_checks": {
    "strict": false,
    "contexts": ["Lint & Typecheck", "Unit & Integration Tests", "Build Next.js"]
  },
  "enforce_admins": false,
  "required_pull_request_reviews": {
    "required_approving_review_count": 0
  },
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false
}
EOF
```

**Configuración manual (si no se usa CLI):**

**Rama `main`:**

- ✅ Require a pull request before merging
  - ✅ Required approvals: 1
  - ✅ Dismiss stale reviews
- ✅ Require status checks to pass
  - ✅ Require branches to be up to date
  - Status checks: `Lint & Typecheck`, `Unit & Integration Tests`, `Build Next.js`
- ✅ Do not allow force pushes
- ✅ Do not allow deletions

**Rama `staging`:**

- ✅ Require status checks to pass
  - Status checks: `Lint & Typecheck`, `Unit & Integration Tests`, `Build Next.js`
- ✅ Do not allow force pushes

### 3.8 Crear labels del proyecto

```powershell
# Crear labels para módulos y tipos
gh label create "module:core" --color "2563eb" --description "Módulo Core"
gh label create "module:contacts" --color "16a34a" --description "Módulo Contactos"
gh label create "module:accounting" --color "9333ea" --description "Módulo Contabilidad"
gh label create "module:invoicing" --color "dc2626" --description "Módulo Facturación"
gh label create "module:purchasing" --color "ea580c" --description "Módulo Compras"
gh label create "module:sales" --color "0891b2" --description "Módulo Ventas/CRM"
gh label create "module:inventory" --color "65a30d" --description "Módulo Inventarios"
gh label create "infra" --color "6b7280" --description "Infraestructura / DevOps"
gh label create "security" --color "b91c1c" --description "Seguridad"
gh label create "multi-tenant" --color "7c3aed" --description "Multi-tenancy / Aislamiento"
gh label create "fiscal-hn" --color "f59e0b" --description "Fiscal Honduras (SAR/DET)"
gh label create "phase:0" --color "e5e7eb" --description "Fase 0 — Fundación"
gh label create "phase:1" --color "d1d5db" --description "Fase 1 — Core System"
gh label create "phase:2" --color "9ca3af" --description "Fase 2 — Contabilidad + Contactos"
gh label create "phase:3" --color "6b7280" --description "Fase 3 — Facturación"
gh label create "phase:4" --color "4b5563" --description "Fase 4 — Compras + Ventas + Inventarios"
gh label create "priority:critical" --color "dc2626" --description "Prioridad Crítica"
gh label create "priority:high" --color "f97316" --description "Prioridad Alta"
gh label create "priority:medium" --color "eab308" --description "Prioridad Media"
gh label create "priority:low" --color "22c55e" --description "Prioridad Baja"
```

### 3.9 Primer push

```powershell
# Agregar todo
git add .
git commit -m "chore(config): initial project setup — NexoERP Fase 0"

# Push a main
git push -u origin main

# Push a staging
git checkout staging
git merge main
git push -u origin staging
git checkout main
```

---

## 4. Estructura Resultante

```
.github/
├── workflows/
│   └── ci.yml                       # CI pipeline
├── PULL_REQUEST_TEMPLATE.md         # Template de PRs
└── ISSUE_TEMPLATE/
    ├── bug_report.yml               # Template de bug reports
    └── feature_request.yml          # Template de feature requests
```

---

## 5. Criterios de Aceptación

| #   | Criterio                                                     | Verificación             |
| --- | ------------------------------------------------------------ | ------------------------ |
| 1   | Repositorio GitHub creado (privado)                          | `gh repo view`           |
| 2   | Ramas `main` y `staging` existen                             | `git branch -a`          |
| 3   | CI pipeline ejecuta en PRs a main y staging                  | Crear PR de prueba       |
| 4   | CI ejecuta: lint, typecheck, format check, tests, build      | Verificar jobs           |
| 5   | E2E tests solo ejecutan en PRs a main o push a staging       | Verificar condición `if` |
| 6   | Branch protection en `main` requiere 1 approval + CI passing | Settings → Branches      |
| 7   | Branch protection en `staging` requiere CI passing           | Settings → Branches      |
| 8   | PR template aparece al crear PR                              | Crear PR de prueba       |
| 9   | Issue templates aparecen al crear Issue                      | Crear issue de prueba    |
| 10  | Labels creados y organizados por módulo, fase, prioridad     | Issues → Labels          |
| 11  | Force push deshabilitado en main y staging                   | Settings verificado      |

---

## 6. Checklist de Verificación

```
□ Repositorio GitHub creado (privado)
□ Remote origin configurado
□ Ramas main y staging creadas y pushed
□ .github/workflows/ci.yml creado
□ CI pipeline tiene 4 jobs: quality, test, build, e2e
□ E2E condicionado a PRs a main / push a staging
□ .github/PULL_REQUEST_TEMPLATE.md creado
□ .github/ISSUE_TEMPLATE/bug_report.yml creado
□ .github/ISSUE_TEMPLATE/feature_request.yml creado
□ Branch protection en main configurada
□ Branch protection en staging configurada
□ Labels creados (módulos, fases, prioridades)
□ Primer commit pushed exitosamente
□ CI pipeline ejecuta y pasa en primer push
```

---

## 7. Flujo de Trabajo Git

```
1. Crear rama desde staging:
   git checkout staging
   git pull
   git checkout -b feature/NEXO-xxx-descripcion

2. Desarrollar (commits con Conventional Commits):
   git commit -m "feat(invoicing): add CAI validation"

3. Push y crear PR → staging:
   git push -u origin feature/NEXO-xxx-descripcion
   gh pr create --base staging

4. CI ejecuta → Review → Merge a staging

5. QA en staging → Crear PR staging → main

6. CI + E2E ejecuta → Review → Merge a main → Production deploy
```

---

## 8. Notas Técnicas

- **Concurrency control:** El CI cancela runs previos del mismo PR para ahorrar minutos de GitHub Actions.
- **Variables ficticias en build:** El job de build usa `DATABASE_URL` ficticio porque Next.js necesita Prisma Client generado para compilar, pero no conecta a la BD real.
- **E2E condicional:** Solo se ejecuta en PRs a `main` o push directo a `staging`, no en PRs a `staging` (para ahorrar tiempo/costo).
- **GitHub Actions gratis:** Repos privados tienen 2,000 minutos/mes gratis (GitHub Free). El pipeline típico usa ~5-10 min por run.
- **Artifacts:** Los reportes de cobertura y Playwright se suben como artifacts con 7 días de retención.
