---
name: Patrón vi.hoisted para mocks que referencian variables externas
description: En NexoERP, vi.mock() con factories que referencian variables const falla con ReferenceError. Siempre usar vi.hoisted().
type: feedback
---

vi.mock() se hoisatea al tope del archivo antes de las declaraciones const/let.
Si la factory referencia una variable local, lanza: "Cannot access 'X' before initialization".

**Por qué:** vi.mock factories se ejecutan antes que cualquier código del módulo de test.

**Cómo aplicar:** Declarar los mocks con vi.hoisted() y desestructurar:

```typescript
// CORRECTO — patrón usado en middleware.test.ts y contact-import-service.test.ts
const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    contact: { findMany: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock('@/lib/db/prisma', () => ({
  default: prismaMock,
}));
```

```typescript
// INCORRECTO — lanza ReferenceError
const prismaMock = { contact: { findMany: vi.fn() } };
vi.mock('@/lib/db/prisma', () => ({ default: prismaMock })); // ERROR
```

Ejemplos en el proyecto:
- `src/__tests__/middleware.test.ts` — referencia para el patrón correcto
- `src/__tests__/unit/contact-import-service.test.ts`
- `src/__tests__/unit/contact-import-api.test.ts`
