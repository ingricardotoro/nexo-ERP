# Módulo de Usuarios - NexoERP

Este módulo implementa el CRUD completo de usuarios para el sistema ERP multi-tenant.

## Estructura de Archivos

```
src/
├── lib/
│   ├── validations/
│   │   └── user.schema.ts              # Schemas Zod compartidos (frontend + backend)
│   └── services/
│       └── core/
│           └── user.service.ts         # Lógica de negocio
├── components/
│   └── users/
│       ├── user-avatar.tsx             # Avatar con fallback a iniciales
│       ├── user-status-badge.tsx       # Badge Activo/Inactivo
│       ├── user-role-badge.tsx         # Badge de rol con colores semánticos
│       ├── user-actions-menu.tsx       # Dropdown de acciones por usuario
│       ├── users-table.tsx             # Tabla con TanStack Table v8
│       ├── user-form.tsx               # Formulario con React Hook Form + Zod
│       └── user-form-modal.tsx         # Modal wrapper del formulario
└── app/
    ├── (dashboard)/
    │   └── dashboard/
    │       └── users/
    │           └── page.tsx            # Página principal de usuarios
    └── api/
        └── v1/
            └── core/
                └── users/
                    ├── route.ts        # GET (listar) y POST (crear)
                    └── [id]/
                        └── route.ts    # GET, PUT, DELETE por ID
```

## Componentes

### `user-avatar.tsx`

- Avatar con imagen o iniciales como fallback
- Props: `fullName`, `avatarUrl?`, `className?`
- Cumple WCAG 2.1 AA con alt text descriptivo

### `user-status-badge.tsx`

- Badge de estado (Activo/Inactivo)
- Colores semánticos: verde=activo, gris=inactivo
- Props: `isActive`

### `user-role-badge.tsx`

- Badge de rol con colores por tipo
- ADMIN=destructive, MANAGER=default, etc.
- Props: `role`

### `user-actions-menu.tsx`

- Dropdown menu con acciones: Editar, Activar/Desactivar, Eliminar
- Navegación por teclado completa
- Props: `userId`, `isActive`, handlers opcionales

### `users-table.tsx`

- Tabla con TanStack Table v8
- Features: paginación server-side, ordenamiento, estados de carga/vacío
- Columnas: Avatar, Nombre, Email, Rol, Estado, Último Login, Fecha Creación, Acciones
- Props: `data`, `totalCount`, `currentPage`, `pageSize`, handlers

### `user-form.tsx`

- Formulario con React Hook Form 7 + Zod
- Validación inline, mensajes de error claros
- Campos: Nombre, Email, Teléfono, Rol, Estado Activo
- Props: `defaultValues?`, `onSubmit`, `isLoading`, `mode`

### `user-form-modal.tsx`

- Modal de shadcn/ui que envuelve el UserForm
- Abre dialog al hacer clic en "Crear Usuario"
- Props: `onSubmit`

## API Routes

### `GET /api/v1/core/users`

Lista usuarios de la empresa con filtros y paginación.

**Query Parameters:**

- `search?: string` - Buscar por nombre o email
- `role?: string` - Filtrar por rol (ADMIN, MANAGER, etc.)
- `isActive?: 'true' | 'false'` - Filtrar por estado
- `page?: number` - Página (default: 1)
- `limit?: number` - Items por página (max: 100, default: 10)
- `orderBy?: string` - Campo de ordenamiento (default: createdAt)
- `orderDir?: 'asc' | 'desc'` - Dirección (default: desc)

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "fullName": "string",
      "email": "string",
      "role": "ADMIN",
      "isActive": true,
      "lastLoginAt": "2026-03-15T10:30:00Z",
      "createdAt": "2026-03-01T08:00:00Z",
      "updatedAt": "2026-03-01T08:00:00Z"
    }
  ],
  "pagination": {
    "total": 10,
    "page": 1,
    "limit": 10,
    "totalPages": 1
  }
}
```

### `POST /api/v1/core/users`

Crear un nuevo usuario.

**Body:**

```json
{
  "fullName": "string",
  "email": "string",
  "phone": "string (opcional, formato +504-XXXX-XXXX)",
  "role": "ADMIN | MANAGER | ACCOUNTANT | SALESPERSON | AUDITOR",
  "isActive": true,
  "avatarUrl": "string (opcional)"
}
```

**Validaciones:**

- Email único por empresa
- Límite de `max_users` no excedido
- Formato de teléfono correcto si se proporciona

**Response (201):**

```json
{
  "success": true,
  "data": {
    /* usuario creado */
  },
  "message": "Usuario creado exitosamente"
}
```

### `GET /api/v1/core/users/:id`

Obtener detalles de un usuario.

### `PUT /api/v1/core/users/:id`

Actualizar un usuario existente.

**Body:** Igual que POST pero todos los campos opcionales.

### `DELETE /api/v1/core/users/:id`

Eliminar un usuario (soft delete).

**Validaciones:**

- No eliminar el último ADMINISTRADOR de la empresa

## Schemas de Validación (Zod)

Ver `src/lib/validations/user.schema.ts` para:

- `createUserSchema` - Validación de creación
- `updateUserSchema` - Validación de actualización
- `userFiltersSchema` - Validación de query params
- Helpers: `getRoleLabel()`, `getRoleBadgeVariant()`, `canCreateUser()`

## Accesibilidad (WCAG 2.1 AA)

✅ **Implementado:**

- Labels asociados a todos los inputs (`htmlFor`/`id`)
- aria-label en botones de íconos
- Navegación por teclado completa
- Contraste de colores suficiente (4.5:1)
- Estados de carga con Skeleton
- Estados vacíos con mensajes útiles
- Mensajes de error específicos en español
- Focus visible en elementos interactivos

## Testing

Para probar el módulo:

1. Iniciar servidor: `npm run dev`
2. Ir a http://localhost:3001/dashboard/users
3. Probar:
   - Crear usuario con el botón "Crear Usuario"
   - Buscar por nombre/email
   - Ordenar columnas (en desarrollo)
   - Activar/Desactivar usuario
   - Eliminar usuario

## Pendientes (Fase 1)

- [ ] Conectar con Cognito para creación real de usuarios
- [ ] Middleware de autenticación para extraer `company_id` del JWT
- [ ] Edición de usuarios (modal con datos precargados)
- [ ] AlertDialog de confirmación antes de eliminar
- [ ] Exportar usuarios a CSV/Excel
- [ ] Filtros avanzados (multi-select de roles)
- [ ] Upload de foto de perfil a S3
- [ ] Validación de último ADMINISTRADOR antes de eliminar/desactivar

## Stack Tecnológico

- **UI:** shadcn/ui (New York style) + Tailwind CSS 4
- **Formularios:** React Hook Form 7 + Zod 3
- **Tablas:** TanStack Table 8
- **Notificaciones:** Sonner (toasts)
- **Validación:** Zod (compartida frontend/backend)
- **Backend:** Next.js 15 API Routes + Prisma 6
- **Base de Datos:** PostgreSQL 16 con Row-Level Security (RLS)

## Notas de Desarrollo

- Los datos mock se usan temporalmente hasta que se implemente el middleware de autenticación en Fase 1
- El `company_id` se pasa por ahora via header `x-company-id` (mock)
- Los usuarios creados usan IDs temporales (`temp-{timestamp}`) que serán reemplazados por Cognito subs en prod
- El soft delete usa `isActive` (boolean)
