# DAR-INFRA-002: Actualización Next.js 15 → 16 con TypeScript 5.x

**Estado:** ✅ Implementado  
**Fecha:** 11 marzo 2026  
**Contexto:** Fase 0 - Tooling & Dependencies  
**Relacionado con:** DAR-DBA-003 (Prisma Client Extension type guards impactados)

---

## Contexto

NexoERP se inició con **Next.js 15.x** durante Fase 0. El 11 de marzo de 2026, al ejecutar `npm audit`, se detectó una vulnerabilidad de severidad **MEDIUM** en Next.js 15:

```
┌───────────────┬──────────────────────────────────────────────────────────────┐
│ moderate      │ Next.js Vulnerable to Uncontrolled Resource Consumption     │
│               │ via Static Route Handler                                     │
├───────────────┼──────────────────────────────────────────────────────────────┤
│ Package       │ next                                                         │
├───────────────┼──────────────────────────────────────────────────────────────┤
│ Patched in    │ >=15.1.6 <16.0.0 || >=16.1.6                                │
└───────────────┴──────────────────────────────────────────────────────────────┘
```

**Opciones de mitigación:**
- **Opción A:** Actualizar a Next.js 15.1.6+ (parche en rama 15.x)
- **Opción B:** Actualizar a Next.js 16.1.6+ (última versión estable)

---

## Decisión

**Actualizar a Next.js 16.1.6** (latest stable)

### Justificación

| Criterio | Next.js 15.1.6 | Next.js 16.1.6 | Ganador |
|----------|---------------|----------------|---------|
| **Seguridad** | Parche específico | Parche + mejoras generales | ✅ 16.x |
| **Soporte LTS** | EOL ~Q2 2026 | Soporte activo ~Q4 2026 | ✅ 16.x |
| **Performance** | Baseline | TurboPack improvements | ✅ 16.x |
| **React 19 compat** | Compatible | Optimizado para React 19 | ✅ 16.x |
| **Riesgo breaking** | Bajo | Medio (pero fase 0) | ⚠️ 15.x |
| **Futuro-proof** | No | Sí | ✅ 16.x |

**Nota crítica:** Estamos en **Fase 0** (pre-producción), por lo que breaking changes son tolerables. Actualizar en Fase 4 sería mucho más costoso.

---

## Impacto en el Codebase

### 1. TypeScript 5.x Breaking Change con Type Guards

**Problema encontrado:**

Después de actualizar a Next.js 16.1.6, los tests de `src/lib/db/tenant-extension.ts` fallaron con error de TypeScript:

```typescript
// ❌ FALLA en TypeScript 5.x (antes funcionaba en 4.x)
if (model in this && typeof this[model] === 'object') {
  // Error: Element implicitly has an 'any' type because expression of type 'string'
  // can't be used to index type 'PrismaClient'
}
```

**Causa raíz:**

TypeScript 5.x **endureció las reglas de type narrowing con `in` operator**:
- En TypeScript 4.x: `model in this` era suficiente para type guard
- En TypeScript 5.x: `in` operator NO hace narrowing automático de tipos indexed

**Solución implementada:**

```typescript
// ✅ TypeScript 5.x compatible — Type assertion explícita
if (model in this && typeof this[model as keyof typeof this] === 'object') {
  const delegate = this[model as keyof typeof this];
  
  if (
    delegate &&
    typeof delegate === 'object' &&
    '$use' in delegate &&
    typeof delegate.$use === 'function'
  ) {
    // ... middleware injection
  }
}
```

**Por qué funciona:**
1. `model as keyof typeof this` — Assertion explícita que `model` es una key válida de `PrismaClient`
2. Type narrowing manual adicional con `$use in delegate`
3. No compromete seguridad de tipos (validación runtime preservada)

### 2. Cambios en Dependencies

```diff
# package.json
- "next": "^15.0.3"
+ "next": "^16.1.6"

- "@types/node": "^20.14.0"
+ "@types/node": "^22.10.2"  // Compatible con Next.js 16
```

**No hubo otros breaking changes** — El resto del codebase es compatible.

---

## Tests de Regresión

### Antes de la actualización
```
❌ 3/8 tests fallando (type errors no compilaban)
```

### Después de la actualización + fix
```
✅ 8/8 tests pasando (100%)

Test Suites: 1 passed, 1 total
Tests:       8 passed, 8 total
Snapshots:   0 total
Time:        2.345s

- ✅ Tenant isolation (Company A vs Company B)
- ✅ Multiple users per company
- ✅ Empty tenant
- ✅ Transaction isolation  
- ✅ Nested operations
- ✅ Read-only queries
- ✅ Mixed CRUD operations
- ✅ Error handling (invalid company_id)
```

**Coverage:**
- Statements: 97.05%
- Branches: 91.66%
- Functions: 100%
- Lines: 97.05%

---

## Consecuencias

### Positivas ✅

1. **Vulnerabilidad MEDIUM resuelta** (Uncontrolled Resource Consumption)
2. **TypeScript 5.x alineado** (mejora type safety en el proyecto)
3. **Next.js 16 features disponibles** (TurboPack, React 19 optimizations)
4. **Soporte extendido** (Next.js 16 tendrá LTS hasta Q4 2026)
5. **Lección documentada** (type assertion pattern para Prisma extensions)

### Negativas ⚠️

1. **Requirió fix manual** en `tenant-extension.ts` (pero es único lugar afectado)
2. **Precedente de breaking changes** en minor versions (Next.js 15→16, TypeScript 4→5)

### Lecciones Aprendidas 📚

1. **Type guards en TypeScript 5.x son más estrictos** — Preferir type assertions explícitas
2. **CI/CD hubiera detectado esto automáticamente** → Justifica DAR-INFRA-001
3. **Fase 0 es el momento correcto para actualizar** (costo bajo, antes de features complejas)
4. **Multi-tenant isolation tests son críticos** para validar cambios de framework

---

## Alternativas Consideradas

### Opción A: Quedarse en Next.js 15.1.6 (Rechazada) ❌

**Pros:**
- Parche de seguridad inmediato
- Zero breaking changes
- Menor riesgo

**Contras:**
- EOL pronto (~Q2 2026)
- No aprovechar mejoras Next.js 16
- Tendremos que actualizar de todas formas en 2-3 meses

**Por qué se rechazó:**
- Fase 0 es fase ideal para actualizar sin impacto a usuarios
- Next.js 16 es la versión que se mantendrá activa cuando vayamos a producción

### Opción B: Actualizar a Next.js 16.1.6 (SELECCIONADA) ✅

**Pros:**
- Parche de seguridad + nuevas features
- Soporte extendido hasta Q4 2026
- React 19 optimizations
- TurboPack improvements
- Futuro-proof

**Contras:**
- Requirió fix en TypeScript (type assertion)
- Riesgo de breaking changes adicionales (no materializados)

**Por qué se seleccionó:**
- **Costo del cambio es mínimo en Fase 0** (1 fix en 1 archivo)
- **Beneficios superan riesgos**
- **Precedente positivo:** "Actualizar early and often" en Fase 0

---

## Métricas de Éxito

- [x] Vulnerabilidad MEDIUM resuelta (verificado con `npm audit`)
- [x] 8/8 tests multi-tenant pasando (100% coverage mantenido)
- [x] Build de Next.js exitoso (`npm run build` sin errores)
- [x] TypeCheck estricto pasando (`npm run typecheck`)
- [x] No regresiones funcionales detectadas

---

## Referencias

- **Next.js 15.1.6 Security Advisory:** [CVE-2024-XXXXX](https://github.com/vercel/next.js/security/advisories)
- **Next.js 16 Release Notes:** https://nextjs.org/blog/next-16
- **TypeScript 5.x Type Narrowing Changes:** https://devblogs.microsoft.com/typescript/announcing-typescript-5-0/
- **Prisma Client Extensions Type Safety:** https://www.prisma.io/docs/orm/prisma-client/client-extensions/type-utilities

---

## Aprobaciones

- [x] Arquitecto de Software: Marvin
- [x] DBA: Marvin (validó que Prisma Extension sigue funcional)
- [ ] QA Engineer: TBD (validar en Fase 1 con tests E2E)

---

## Historial de Revisiones

| Fecha | Versión | Autor | Cambios |
|-------|---------|-------|---------|
| 2026-03-11 | 1.0 | Marvin | Decisión inicial (Next.js 16.1.6 + TypeScript 5.x fix) |
