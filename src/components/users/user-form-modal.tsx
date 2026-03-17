// src/components/users/user-form-modal.tsx
'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { UserForm } from './user-form';
import type { CreateUserInput } from '@/lib/validations/user.schema';

interface UserFormModalProps {
  onSubmit: (data: CreateUserInput) => Promise<void>;
}

/**
 * Modal wrapper para el formulario de usuario.
 * Abre un Dialog de shadcn/ui con el UserForm adentro.
 */
export function UserFormModal({ onSubmit }: UserFormModalProps) {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (data: CreateUserInput) => {
    setIsLoading(true);
    try {
      await onSubmit(data);
      setOpen(false);
    } catch (error) {
      console.error('Error al crear usuario:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
          Crear Usuario
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Nuevo Usuario</DialogTitle>
          <DialogDescription>
            Crea un nuevo usuario para tu equipo. Se enviará un email de invitación.
          </DialogDescription>
        </DialogHeader>
        <UserForm onSubmit={handleSubmit} isLoading={isLoading} mode="create" />
      </DialogContent>
    </Dialog>
  );
}
