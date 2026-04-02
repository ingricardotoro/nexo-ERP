---
name: Comportamiento de refine con path en Zod y cómo lo reporta el servicio
description: refine con path va a fieldErrors, sin path va a formErrors. El servicio mapea ambos de forma diferente.
type: feedback
---

**Comportamiento Zod:**
- `refine(fn, { message: '...', path: ['campo'] })` → error en `fieldErrors.campo`
- `refine(fn, { message: '...' })` (sin path) → error en `formErrors`

**Cómo ContactImportService mapea los errores (contact-import.service.ts):**

```typescript
const fieldErrors = result.error.flatten().fieldErrors;
for (const [field, messages] of Object.entries(fieldErrors)) {
  errors.push({ row: rowNum, field, message: messages?.[0] ?? 'Valor inválido' });
}
// Errores de refine SIN path (raíz):
const formErrors = result.error.flatten().formErrors;
for (const msg of formErrors) {
  errors.push({ row: rowNum, field: 'es_cliente/es_proveedor', message: msg });
}
```

**Para `contactImportRowSchemaWithRefine`:**
El refine tiene `path: ['es_cliente']`, por lo que el error va a `fieldErrors.es_cliente`.
El servicio lo mapea como `{ field: 'es_cliente', message: '... al menos cliente o proveedor' }`.

**Test correcto:**
```typescript
const tieneError = resultado.errors.some(
  (e) => e.field === 'es_cliente' || e.field === 'es_cliente/es_proveedor',
);
expect(tieneError).toBe(true);
```

No asumir que el campo es siempre `'es_cliente/es_proveedor'` — eso solo ocurre si
el refine se define sin path (raíz → formErrors → field = 'es_cliente/es_proveedor').
