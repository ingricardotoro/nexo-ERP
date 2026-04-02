// src/components/users/user-form.tsx
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Loader2 } from 'lucide-react';
import {
  createUserSchema,
  type CreateUserInput,
  getRoleLabel,
} from '@/lib/validations/user.schema';

interface UserFormProps {
  defaultValues?: Partial<CreateUserInput>;
  onSubmit: (data: CreateUserInput) => Promise<void>;
  isLoading?: boolean;
  mode?: 'create' | 'edit';
}

const roles = ['ADMIN', 'MANAGER', 'ACCOUNTANT', 'SALESPERSON', 'AUDITOR'] as const;

/**
 * Formulario de creación/edición de usuario.
 * React Hook Form 7 + Zod + shadcn/ui Form components.
 * Cumple WCAG 2.1 AA: labels asociados, validación inline, mensajes de error claros.
 */
export function UserForm({
  defaultValues,
  onSubmit,
  isLoading = false,
  mode = 'create',
}: UserFormProps) {
  const form = useForm<CreateUserInput>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      fullName: defaultValues?.fullName ?? '',
      email: defaultValues?.email ?? '',
      phone: defaultValues?.phone ?? '',
      role: defaultValues?.role ?? 'SALESPERSON',
      isActive: defaultValues?.isActive ?? true,
      avatarUrl: defaultValues?.avatarUrl ?? '',
    },
  });

  const handleSubmit = async (data: CreateUserInput) => {
    try {
      await onSubmit(data);
      if (mode === 'create') {
        form.reset();
      }
    } catch (error) {
      console.error('Error al guardar usuario:', error);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        {/* Nombre Completo */}
        <FormField
          control={form.control}
          name="fullName"
          render={({ field }) => (
            <FormItem>
              <FormLabel htmlFor="fullName">Nombre Completo</FormLabel>
              <FormControl>
                <Input id="fullName" placeholder="Juan Pérez" autoComplete="name" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Email */}
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel htmlFor="email">Email</FormLabel>
              <FormControl>
                <Input
                  id="email"
                  type="email"
                  placeholder="juan.perez@empresademo.hn"
                  autoComplete="email"
                  spellCheck={false}
                  {...field}
                />
              </FormControl>
              <FormDescription>
                Se usará para iniciar sesión y recibir notificaciones
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Teléfono */}
        <FormField
          control={form.control}
          name="phone"
          render={({ field }) => (
            <FormItem>
              <FormLabel htmlFor="phone">Teléfono (opcional)</FormLabel>
              <FormControl>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="+504-1234-5678"
                  autoComplete="tel"
                  {...field}
                />
              </FormControl>
              <FormDescription>Formato: +504-XXXX-XXXX</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Rol */}
        <FormField
          control={form.control}
          name="role"
          render={({ field }) => (
            <FormItem>
              <FormLabel htmlFor="role">Rol</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger id="role">
                    <SelectValue placeholder="Selecciona un rol" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {roles.map((role) => (
                    <SelectItem key={role} value={role}>
                      {getRoleLabel(role)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormDescription>Define los permisos del usuario en el sistema</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Estado Activo/Inactivo */}
        <FormField
          control={form.control}
          name="isActive"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <FormLabel htmlFor="isActive">Usuario Activo</FormLabel>
                <FormDescription>Los usuarios inactivos no podrán iniciar sesión</FormDescription>
              </div>
              <FormControl>
                <Switch id="isActive" checked={field.value} onCheckedChange={field.onChange} />
              </FormControl>
            </FormItem>
          )}
        />

        {/* Botones de acción */}
        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => form.reset()}>
            Cancelar
          </Button>
          <Button type="submit" disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
            {mode === 'create' ? 'Crear Usuario' : 'Guardar Cambios'}
          </Button>
        </div>
      </form>
    </Form>
  );
}
