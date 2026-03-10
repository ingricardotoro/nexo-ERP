# Fase 0: Fundación — Overview

> **Fase:** 0 — Fundación
> **Duración estimada:** Semana 1–2
> **Objetivo:** Establecer el ambiente de desarrollo completo, la conexión a AWS, y toda la infraestructura base necesaria para que el equipo pueda iniciar el desarrollo de features en la Fase 1.

---

## Resumen de Tareas

| ID | Tarea | Descripción | Dependencias | Prioridad |
|----|-------|-------------|-------------|-----------|
| F0-01 | Setup proyecto | Inicializar Next.js 15 + TypeScript + Tailwind CSS 4 | — | 🔴 Crítica |
| F0-02 | Amplify Gen 2 | Configurar auth (Cognito), storage (S3), hosting | F0-01 | 🔴 Crítica |
| F0-03 | Prisma + PostgreSQL | Multi-file schema + Docker PostgreSQL local | F0-01 | 🔴 Crítica |
| F0-04 | Tooling | ESLint, Prettier, Husky, commitlint, Changesets | F0-01 | 🟡 Alta |
| F0-05 | Testing | Configurar Vitest + Playwright | F0-01, F0-04 | 🟡 Alta |
| F0-06 | Repositorio | GitHub con branch protection y PR templates | F0-01, F0-04 | 🟡 Alta |
| F0-07 | Ambientes | Configurar local (Docker), staging, production | F0-02, F0-03 | 🔴 Crítica |
| F0-08 | Documentación | ARCHITECTURE.md con ADRs | F0-01 a F0-07 | 🟢 Media |
| F0-09 | MCPs | Configurar GitHub, Context7, Notion | F0-06 | 🟢 Media |

---

## Grafo de Dependencias

```
F0-01 (Setup proyecto)
├──► F0-02 (Amplify Gen 2)
│    └──► F0-07 (Ambientes)
├──► F0-03 (Prisma + PostgreSQL)
│    └──► F0-07 (Ambientes)
├──► F0-04 (Tooling)
│    ├──► F0-05 (Testing)
│    └──► F0-06 (Repositorio)
│         └──► F0-09 (MCPs)
└──► F0-08 (Documentación) ← depende de todas las anteriores
```

---

## Orden de Ejecución Sugerido

### Bloque 1 — Paralelo (Día 1-2)
1. **F0-01** Setup proyecto ← PRIMERO, bloquea todo lo demás

### Bloque 2 — Paralelo (Día 2-4)
2. **F0-03** Prisma + PostgreSQL (puede hacerse en paralelo con F0-02)
3. **F0-02** Amplify Gen 2
4. **F0-04** Tooling

### Bloque 3 — Paralelo (Día 4-6)
5. **F0-05** Testing
6. **F0-06** Repositorio GitHub

### Bloque 4 — Paralelo (Día 6-8)
7. **F0-07** Ambientes
8. **F0-09** MCPs

### Bloque 5 — Final (Día 8-10)
9. **F0-08** Documentación ARCHITECTURE.md + ADRs

---

## Criterios de Completitud de la Fase 0

La Fase 0 se considera **completa** cuando:

- [ ] `npx next dev` levanta la aplicación sin errores en `localhost:3000`
- [ ] `npx ampx sandbox` conecta correctamente con servicios AWS (Cognito, S3)
- [ ] `docker compose up -d` levanta PostgreSQL 16 local y Prisma conecta
- [ ] `npx prisma migrate dev` ejecuta sin errores
- [ ] `npx prisma studio` muestra las tablas del schema base
- [ ] ESLint, Prettier, Husky, commitlint funcionan en pre-commit
- [ ] `npx vitest run` ejecuta la suite de tests sin errores
- [ ] `npx playwright test` ejecuta al menos un test de smoke
- [ ] El repositorio GitHub tiene branch protection en `main` y `staging`
- [ ] PR template está configurado y funcional
- [ ] Los ambientes local, staging y production están definidos (aunque staging/prod sin deploy real aún)
- [ ] `ARCHITECTURE.md` documenta la arquitectura y decisiones
- [ ] Al menos 3 ADRs iniciales documentados
- [ ] MCPs de GitHub, Context7 y Sequential Thinking configurados en `.claude/`
- [ ] El proyecto compila, pasa lint, pasa typecheck, y el CI podría ejecutarse

---

## Entregables de la Fase 0

```
nexoerp/
├── .claude/
│   ├── agents/                     # Sub-agentes IA (ya existentes)
│   ├── skills/                     # Skills (ya existentes)
│   └── settings.json               # Configuración de MCPs
├── .github/
│   ├── workflows/
│   │   └── ci.yml                  # GitHub Actions CI pipeline
│   ├── PULL_REQUEST_TEMPLATE.md    # Template de PRs
│   └── ISSUE_TEMPLATE/
│       ├── bug_report.md
│       └── feature_request.md
├── amplify/
│   ├── backend.ts                  # Punto de entrada IaC
│   ├── auth/
│   │   └── resource.ts             # Cognito config
│   ├── storage/
│   │   └── resource.ts             # S3 config
│   └── tsconfig.json
├── prisma/
│   └── schema/
│       ├── base.prisma             # Datasource, generator, enums
│       └── core.prisma             # Company (stub mínimo para F0)
├── src/
│   ├── app/
│   │   ├── layout.tsx              # Root layout
│   │   ├── page.tsx                # Landing / redirect
│   │   └── globals.css             # Tailwind imports
│   ├── lib/
│   │   └── db/
│   │       └── prisma.ts           # Singleton Prisma Client
│   └── __tests__/
│       └── smoke.test.ts           # Test básico de smoke
├── tests/
│   └── e2e/
│       └── smoke.spec.ts           # Playwright smoke test
├── docs/
│   ├── REQUIREMENTS.md             # (ya existente)
│   ├── ARCHITECTURE.md             # Nuevo
│   ├── adr/
│   │   ├── 001-next15-app-router.md
│   │   ├── 002-multi-tenant-rls.md
│   │   └── 003-api-first-rest.md
│   └── specs/
│       └── fase-0/                 # Estos specs
├── docker-compose.yml
├── .env.example
├── .env.local                      # (gitignored)
├── .eslintrc.json (o eslint.config.mjs)
├── .prettierrc
├── .commitlintrc.json
├── .changeset/
│   └── config.json
├── vitest.config.ts
├── playwright.config.ts
├── next.config.ts
├── tailwind.config.ts (si necesario con v4)
├── tsconfig.json
├── package.json
└── README.md
```

---

## Presupuesto AWS Fase 0

| Servicio | Costo estimado/mes | Notas |
|----------|---------------------|-------|
| Amplify Gen 2 Hosting | ~$5–15 | CI/CD + SSR hosting |
| Cognito User Pools | $0 | 50K MAU gratis |
| RDS PostgreSQL (db.t3.micro) | ~$15–25 | Base de datos principal |
| S3 | ~$1–5 | Almacenamiento de archivos |
| Secrets Manager | ~$2 | Credenciales seguras |
| VPC + NACLs + SGs | $0 | Arquitectura de red base |
| Shield Standard | $0 | Automático en CloudFront |
| CloudTrail (1 trail) | $0 | Primer trail gratuito |
| **Total Fase 0** | **~$23–47/mes** | |

---

## Archivos Spec de esta Fase

| Archivo | Tarea |
|---------|-------|
| [F0-01-setup-proyecto.md](F0-01-setup-proyecto.md) | Setup proyecto Next.js 15 |
| [F0-02-amplify-gen2.md](F0-02-amplify-gen2.md) | Amplify Gen 2 + Cognito + S3 |
| [F0-03-prisma-postgresql.md](F0-03-prisma-postgresql.md) | Prisma 6 + PostgreSQL 16 + Docker |
| [F0-04-tooling.md](F0-04-tooling.md) | ESLint, Prettier, Husky, commitlint, Changesets |
| [F0-05-testing.md](F0-05-testing.md) | Vitest + Playwright |
| [F0-06-repositorio.md](F0-06-repositorio.md) | GitHub, branch protection, templates |
| [F0-07-ambientes.md](F0-07-ambientes.md) | Docker, staging, production |
| [F0-08-documentacion.md](F0-08-documentacion.md) | ARCHITECTURE.md + ADRs |
| [F0-09-mcps.md](F0-09-mcps.md) | MCP Servers |
