# DAR-INFRA-001: Arquitectura Híbrida CI/CD (GitHub Actions + AWS Amplify)

**Estado:** ✅ Implementado  
**Fecha:** 11 marzo 2026  
**Contexto:** F0-06 - GitHub Repository Setup  
**Arquitecto:** Marvin (Arquitecto NexoERP)

---

## Contexto

NexoERP usa **AWS Amplify Gen 2** como plataforma principal de hosting y deployment, que incluye:

- Build automático de Next.js 16
- Deploy a CloudFront + S3
- Provisión de backend (Cognito, S3 Storage, Lambda)
- Rollback automático si build falla
- Ambientes por rama (main → production, staging → staging)

### Pregunta Arquitectónica

**¿Necesitamos GitHub Actions si Amplify ya tiene CI/CD integrado?**

Amplify ejecuta builds en cada push a ramas configuradas, pero:

- ❌ NO ejecuta tests automatizados (Vitest, Playwright)
- ❌ NO valida linting (ESLint, Prettier)
- ❌ NO bloquea merges con checks automáticos
- ❌ Feedback lento (~5-10 min para build completo)
- ❌ Builds fallidos consumen presupuesto AWS

---

## Decisión

**Implementar arquitectura híbrida: GitHub Actions (quality gates) + AWS Amplify (production deploy)**

### Opción A: Solo AWS Amplify (rechazada) ❌

**Pros:**

- Cero costo adicional de CI
- Una sola herramienta (simplicidad)
- Type-check incluido en build de Next.js

**Contras:**

- Detectas errores TARDE (después de push a main/staging)
- No hay quality gates en PRs
- Tests manuales antes de merge (propenso a error humano)
- Builds fallidos en Amplify consumen presupuesto (~$0.01/min × 10 min = $0.10 por build fallido)
- Sin branch protection real basada en checks automáticos

**Por qué se rechazó:**

- Durante actualización Next.js 15 → 16, un cambio en `tenant-extension.ts` rompió 3/8 tests de aislamiento multi-tenant
- El error se detectó DESPUÉS de push, requiriendo múltiples iteraciones de fix
- Con GitHub Actions, el PR hubiera sido bloqueado automáticamente antes de merge
- **Lección:** Shift-left testing previene regresiones costosas

---

### Opción B: Solo GitHub Actions (rechazada) ❌

**Pros:**

- Control total sobre pipeline CI/CD
- Personalización ilimitada
- Mismo flujo para CI y deploy

**Contras:**

- Duplicar funcionalidad ya incluida en Amplify (build, deploy, backend provisioning)
- Complejidad adicional: configurar deployment a AWS manualmente
- Costo de GitHub Actions aumenta significativamente con deploys frecuentes
- Perder features de Amplify: preview environments, rollback automático, integración CloudFront/WAF

**Por qué se rechazó:**

- Amplify Gen 2 es la arquitectura base del proyecto (decisión del sponsor ya tomada)
- Duplicar deployment pipeline es sobre-ingeniería innecesaria
- Presupuesto limitado (~$50/mes) no justifica dos soluciones de deployment

---

### Opción C: GitHub Actions + AWS Amplify (SELECCIONADA) ✅

**Arquitectura:**

```
Developer → Feature Branch → GitHub PR
                                  ↓
                      GitHub Actions (2-3 min)
                      ├─ Lint & Format
                      ├─ TypeScript check
                      ├─ Unit tests (Vitest)
                      └─ Build verification
                                  ↓
                          ✅ All checks pass
                                  ↓
                      Manual code review
                                  ↓
                      Merge to staging/main
                                  ↓
                      AWS Amplify (5-10 min)
                      ├─ Build Next.js
                      ├─ Deploy CloudFront
                      └─ Provision backend
```

**Responsabilidades:**

| Componente         | Responsabilidad                                            | Cuándo ejecuta                  |
| ------------------ | ---------------------------------------------------------- | ------------------------------- |
| **GitHub Actions** | Quality gates (tests, lint, typecheck, build verification) | En PRs + push a main/staging    |
| **AWS Amplify**    | Production build + Deploy + Backend provisioning           | Después de merge a main/staging |

**Pros:**

- **Feedback rápido** en PRs (~2-3 min vs ~5-10 min de Amplify)
- **Previene builds costosos** fallidos en Amplify
- **Branch protection real** con checks automáticos obligatorios
- **Shift-left testing** (detectar errores antes de merge)
- **Gratis** dentro de límite GitHub Actions (2000 min/mes)
- **Best of both worlds:** Amplify hace lo que hace bien (deploy), GitHub Actions hace lo suyo (quality checks)
- **Mantiene beneficios Amplify:** Preview environments, rollback automático, integración AWS

**Contras:**

- Una herramienta adicional que configurar
- Requiere mantener dos archivos de configuración (`.github/workflows/ci.yml` + `amplify.yml`)

**Por qué se seleccionó:**

1. **Presupuesto:** GitHub Actions gratis (2000 min/mes = ~250 PRs), Amplify solo para deploys reales (~$40-50/mes sin cambios)
2. **Velocidad:** Feedback en 2-3 min en PR vs esperar 5-10 min de build Amplify completo
3. **Calidad:** Branch protection automática previene regresiones como la del caso Next.js 16
4. **Estándar industria:** Pattern usado por proyectos Next.js + Vercel/Amplify (e.g., shadcn/ui, NextAuth.js)

---

## Implementación

### GitHub Actions Workflow (`.github/workflows/ci.yml`)

**Jobs configurados:**

1. **`lint`:** ESLint + Prettier check (~1 min)
2. **`typecheck`:** TypeScript strict check (~1 min)
3. **`test`:** Vitest con PostgreSQL service container (~2-3 min)
4. **`build`:** Next.js build verification (~2-3 min)

**Total por PR:** ~6-8 minutos  
**Capacidad mensual:** ~250 PRs/mes (2000 min ÷ 8 min/PR)

### Branch Protection Rules

**Configuración para `main` y `staging`:**

```yaml
required_status_checks:
  strict: true
  contexts:
    - lint
    - typecheck
    - test
    - build

required_pull_request_reviews:
  required_approving_review_count: 1
  dismiss_stale_reviews: true

enforce_admins: true
required_linear_history: true
allow_force_pushes: false
```

**Resultado:** Imposible hacer merge sin que pasen los 4 checks + 1 review aprobado.

### AWS Amplify Configuration (`amplify.yml`)

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
```

**Amplify solo ejecuta:** Build + Deploy (NO tests, NO lint).

---

## Consecuencias

### Positivas ✅

1. **Menor tasa de builds fallidos en Amplify** (pre-validación en GitHub Actions)
2. **Feedback inmediato en PRs** (2-3 min vs 5-10 min)
3. **Enforcement automático de calidad** (lint, tests, typecheck obligatorios)
4. **Costo optimizado:** GitHub Actions gratis, Amplify solo para deploys válidos
5. **Trazabilidad:** Cada PR tiene historial de checks en GitHub
6. **Documentación implícita:** Template de PR estandarizado

### Negativas ⚠️

1. **Complejidad adicional:** Dos archivos de configuración que mantener
2. **Posible duplicación:** Tests corren en GitHub Actions Y potencialmente en Amplify (si se configura mal)
3. **Límite de minutos:** 2000 min/mes puede agotarse con equipo grande (mitigar con cache npm)

### Riesgos Mitigados 🛡️

| Riesgo                        | Sin GitHub Actions                | Con GitHub Actions                   |
| ----------------------------- | --------------------------------- | ------------------------------------ |
| **Merge de código roto**      | Posible (solo code review manual) | Bloqueado automáticamente            |
| **Regresión multi-tenant**    | No detectada hasta producción     | Detectada en PR (tests obligatorios) |
| **Builds costosos fallidos**  | $0.10-0.20 por build fallido      | Prevenido (build verification en CI) |
| **Deuda técnica lint/format** | Acumulable (no enforcement)       | Imposible (lint check obligatorio)   |

---

## Métricas de Éxito

### KPIs (Post-Implementación)

- [ ] **Tasa de builds exitosos en Amplify:** Target >95% (actualmente: baseline TBD)
- [ ] **Tiempo promedio de feedback en PR:** Target <5 min (GitHub Actions)
- [ ] **PRs bloqueados por checks:** Target >0 (evidencia de que funciona el gate)
- [ ] **Consumo mensual GitHub Actions:** Target <1500 min (75% del límite)
- [ ] **Costo Amplify:** Target mantener ~$40-50/mes (sin incremento)

### Validación (Primera Semana)

1. Crear PR de prueba que INTENCIONALMENTE falle lint → Verificar bloqueo
2. Crear PR de prueba que INTENCIONALMENTE falle tests → Verificar bloqueo
3. Crear PR de prueba que PASE todos los checks → Verificar merge permitido
4. Medir tiempo de ejecución promedio de workflow completo
5. Verificar que Amplify solo ejecute después de merge (no en cada push a feature branch)

---

## Alternativas Futuras

### Si GitHub Actions se vuelve costoso (>2000 min/mes)

**Opción 1:** Self-hosted runners en EC2 t4g.micro (~$6/mes)  
**Opción 2:** Reducir frecuencia de tests E2E (solo en push a main, no en PRs)  
**Opción 3:** Migrar a GitLab CI (10,000 min/mes gratis) — requiere migrar repo

### Si Amplify se vuelve costoso (>$100/mes)

**Opción 1:** Separar ambientes (staging en Vercel gratis, production en Amplify)  
**Opción 2:** Migrar a AWS CDK con ALB + Fargate (~$40-60/mes pero más control)  
**Opción 3:** On-premise deployment para clientes grandes (fuera de Cloud multi-tenant)

---

## Referencias

- **GitHub Actions Docs:** https://docs.github.com/en/actions
- **Amplify Gen 2 CI/CD:** https://docs.amplify.aws/gen2/deploy-and-host/
- **Branch Protection:** https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches
- **Prisma in CI:** https://www.prisma.io/docs/orm/prisma-migrate/workflows/ci-cd
- **Next.js 16 Testing:** https://nextjs.org/docs/app/building-your-application/testing

---

## Aprobaciones

- [x] Arquitecto de Software: Marvin
- [ ] DevOps Engineer: TBD (cuando se incorpore al equipo)
- [ ] Sponsor del Proyecto: TBD (presentar en reunión de revisión Fase 0)

---

## Historial de Revisiones

| Fecha      | Versión | Autor  | Cambios                                     |
| ---------- | ------- | ------ | ------------------------------------------- |
| 2026-03-11 | 1.0     | Marvin | Decisión inicial (GitHub Actions + Amplify) |
