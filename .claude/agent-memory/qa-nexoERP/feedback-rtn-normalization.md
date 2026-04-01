---
name: Normalización RTN Honduras en tests de duplicados
description: normalizeRtn() elimina guiones. RTN con guiones de 13 dígitos produce string diferente al RTN de 14 dígitos sin guiones. Sincronizar valores en mocks de DB.
type: feedback
---

**Función:** `normalizeRtn(rtn)` en `src/lib/validations/contact.schema.ts`
Solo elimina guiones con `rtn.replace(/-/g, '')`.

**Comportamiento crítico para tests de duplicados:**

```
normalizeRtn('0801-1990-00001') → '0801199000001'  (13 dígitos — 4+4+5 con un guion extra)
normalizeRtn('08011990000014') → '08011990000014' (14 dígitos — sin guiones)
```

Estos dos RTNs son DISTINTOS. Para que un test de duplicado funcione, el mock de la DB
debe contener el valor normalizado que coincide exactamente con el RTN de entrada.

**Ejemplo correcto:**
```typescript
// Para detectar '0801-1990-00001' como duplicado:
prismaMock.contact.findMany.mockResolvedValue([
  { rtn: '0801199000001' }, // normalizado de '0801-1990-00001' = 13 dígitos
]);
```

**Nota:** El rtnSchema acepta 13 o 14 dígitos (regex `/^\d{13,14}$/`).
El RTN `'0801-1990-00001'` tiene 13 dígitos limpios (4+4+5=13), no 14.
