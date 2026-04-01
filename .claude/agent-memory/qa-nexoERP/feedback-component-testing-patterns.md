---
name: Patrones de testing de componentes React con Radix y date-fns
description: Reglas para tests de componentes que usan Radix UI (DropdownMenu, Select) y fechas con date-fns en jsdom
type: feedback
---

## Fechas timezone-safe en tests de componentes

Cuando un componente usa `format(new Date(isoString), 'dd/MM/yyyy')` de date-fns, jsdom corre en UTC pero la zona horaria de Windows puede ser UTC-6. Una fecha como `2026-01-15T00:00:00.000Z` se convierte en `14/01/2026` en UTC-6.

**Regla:** Siempre usar mediodía UTC en strings de fecha para tests de componentes:
```typescript
issueDate: '2026-01-15T12:00:00.000Z' // correcto — zona horaria no afecta
issueDate: '2026-01-15T00:00:00.000Z' // incorrecto — puede desplazarse un día
```

**Why:** El entorno CI puede tener zona horaria diferente a la del developer. Mediodía UTC es safe para cualquier zona de las Américas.

**How to apply:** En cualquier dato de prueba que contenga fechas ISO que luego se formatean con date-fns.

---

## Radix UI DropdownMenu: usar userEvent, no fireEvent

Radix `DropdownMenu` usa portales DOM. `fireEvent.click()` no activa la lógica de apertura del portal en jsdom. `userEvent.setup()` sí funciona.

```typescript
// Correcto
const user = userEvent.setup();
await user.click(screen.getByRole('button', { name: /acciones/i }));
expect(await screen.findByText('Ver detalle')).toBeInTheDocument();

// Incorrecto — el menú no abre
fireEvent.click(screen.getByRole('button', { name: /acciones/i }));
expect(screen.getByText('Ver detalle')).toBeInTheDocument(); // falla
```

**Why:** Radix usa eventos de puntero (pointerdown, pointer events) que userEvent simula correctamente. fireEvent solo dispara el evento click sin la secuencia completa.

**How to apply:** En cualquier test que intente abrir DropdownMenu, Dialog, Popover, Select de Radix UI.

---

## getByRole('generic') falla cuando hay múltiples divs

`screen.getByRole('generic')` lanza error si hay múltiples `<div>` en el DOM (que es prácticamente siempre). Para encontrar un contenedor por accesibilidad, usar `getByLabelText` cuando tiene `aria-label`.

```typescript
// Correcto
expect(screen.getByLabelText('Cargando facturas')).toBeInTheDocument();

// Incorrecto — lanza "Found multiple elements"
const contenedor = screen.getByRole('generic');
```

**Why:** El rol 'generic' mapea a cualquier elemento sin rol explícito, que incluye todos los divs.

**How to apply:** Nunca usar getByRole('generic'). Preferir getByLabelText, getByTestId o container.querySelector.
