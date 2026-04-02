---
name: Patrones de mock para $transaction con callback y array
description: Cómo mockear prisma.$transaction correctamente según el patrón de uso (callback vs array de promesas)
type: feedback
---

El servicio `fiscal-year.service.ts` usa `$transaction` de dos formas distintas:

1. **Callback pattern** (`createFiscalYear`): `prisma.$transaction(async (tx) => { ... })`
2. **Array pattern** (`activateYear`, `closeYear`): `prisma.$transaction([promise1, promise2])`

El mock debe manejar ambos en un único `mockImplementation`:

```typescript
prismaMock.$transaction.mockImplementation(
  async (arg: unknown) =>
    typeof arg === 'function'
      ? (arg as (tx: typeof prismaMock) => unknown)(prismaMock)
      : Promise.all(arg as Promise<unknown>[]),
);
```

**Why:** Si solo se usa `mockImplementation(async (cb) => cb(prismaMock))`, los tests de `activateYear` y `closeYear` rompen porque reciben un array, no una función. El tipo-guard `typeof arg === 'function'` discrimina correctamente.

**How to apply:** Usar siempre este mock combinado en el `beforeEach` de cualquier suite que cubra múltiples métodos del servicio fiscal. Si solo se cubre `createFiscalYear`, alcanza el callback simple.
