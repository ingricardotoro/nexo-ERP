---
name: Códigos HTTP que retorna handleApiError según el tipo de error
description: Referencia de qué status retorna handleApiError para diferentes tipos de Error, ZodError y AuthError
type: feedback
---

`src/lib/api/handle-error.ts` mapea errores a HTTP status de la siguiente forma:

| Tipo de error | Status retornado |
|---|---|
| `ZodError` | 422 |
| `Error` cuyo `.message` está en `NOT_FOUND_MESSAGES` | 404 |
| Cualquier otro `Error` (incluido `AuthError`) | 400 |
| Error desconocido (no-Error) | 500 |

**Importante:** `AuthError` extiende `Error` pero NO está en `NOT_FOUND_MESSAGES`, por lo que retorna **400**, no 401. Los tests de error de auth deben usar `toBeGreaterThanOrEqual(400)` o `toBe(400)`, no `toBe(401)`.

**Lista actual de `NOT_FOUND_MESSAGES`** (actualizar si crece):
- 'Contacto no encontrado'
- 'Dirección no encontrada'
- 'Persona de contacto no encontrada'
- 'Términos de pago no encontrados'
- 'Usuario no encontrado'
- 'Empresa no encontrada'

Los mensajes de error del módulo fiscal ('Año fiscal no encontrado', 'Período fiscal no encontrado') NO están en esta lista → retornan 400, no 404.

**How to apply:** Al escribir tests de API que esperan errores, verificar en `NOT_FOUND_MESSAGES` si el mensaje está listado para determinar si esperar 404 o 400.
