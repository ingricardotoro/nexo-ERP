import { z } from 'zod';

const roleValues = ['ADMIN', 'MANAGER', 'ACCOUNTANT', 'SALESPERSON', 'AUDITOR'] as const;

export const createUserSchema = z.object({
  fullName: z
    .string()
    .min(3, 'El nombre debe tener al menos 3 caracteres')
    .max(100, 'El nombre no puede exceder 100 caracteres')
    .trim(),
  email: z.string().email('Email invalido').toLowerCase().trim(),
  phone: z
    .string()
    .regex(/^\+504-\d{4}-\d{4}$/, 'Formato de telefono invalido. Usa +504-XXXX-XXXX')
    .optional()
    .or(z.literal('')),
  role: z.enum(roleValues, { message: 'Rol invalido' }),
  isActive: z.boolean().default(true),
  avatarUrl: z.string().url('URL de avatar invalida').optional().or(z.literal('')),
});

export const updateUserSchema = createUserSchema
  .partial()
  .extend({
    id: z.string().min(1, 'ID de usuario requerido'),
  })
  .refine(
    (data) => Object.keys(data).some((key) => key !== 'id'),
    'Debes proporcionar al menos un campo para actualizar',
  );

export const userFiltersSchema = z.object({
  search: z.string().trim().optional(),
  role: z.enum(roleValues).optional(),
  isActive: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => {
      if (value === undefined) {
        return undefined;
      }
      return value === 'true';
    }),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  orderBy: z
    .enum(['fullName', 'email', 'role', 'isActive', 'createdAt', 'lastLoginAt'])
    .default('createdAt'),
  orderDir: z.enum(['asc', 'desc']).default('desc'),
});

export type CreateUserInput = z.input<typeof createUserSchema>;
export type UpdateUserInput = z.input<typeof updateUserSchema>;
export type UserFilters = z.output<typeof userFiltersSchema>;
export type UserRole = (typeof roleValues)[number];

export function canCreateUser(currentActiveCount: number, maxUsers: number): boolean {
  return currentActiveCount < maxUsers;
}

export function getRoleLabel(role: string): string {
  const labels: Record<string, string> = {
    ADMIN: 'Administrador',
    MANAGER: 'Gerente',
    ACCOUNTANT: 'Contador',
    SALESPERSON: 'Vendedor',
    AUDITOR: 'Auditor',
  };

  return labels[role] ?? role;
}

export function getRoleBadgeVariant(role: string): 'default' | 'secondary' | 'outline' | 'destructive' {
  const variants: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
    ADMIN: 'destructive',
    MANAGER: 'default',
    ACCOUNTANT: 'secondary',
    SALESPERSON: 'outline',
    AUDITOR: 'secondary',
  };

  return variants[role] ?? 'outline';
}
