// src/components/users/user-actions-menu.tsx
'use client';

import { MoreHorizontal, Edit, Power, PowerOff, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface UserActionsMenuProps {
  userId: string;
  isActive: boolean;
  onEdit?: (userId: string) => void;
  onToggleStatus?: (userId: string, isActive: boolean) => void;
  onDelete?: (userId: string) => void;
}

/**
 * Menú de acciones por usuario (Editar, Activar/Desactivar, Eliminar).
 * Cumple WCAG 2.1 AA: aria-label en botón de acciones, navegación por teclado completa.
 */
export function UserActionsMenu({
  userId,
  isActive,
  onEdit,
  onToggleStatus,
  onDelete,
}: Readonly<UserActionsMenuProps>) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Acciones de usuario">
          <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel>Acciones</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => onEdit?.(userId)}>
          <Edit className="mr-2 h-4 w-4" aria-hidden="true" />
          <span>Editar</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onToggleStatus?.(userId, !isActive)}>
          {isActive ? (
            <>
              <PowerOff className="mr-2 h-4 w-4" aria-hidden="true" />
              <span>Desactivar</span>
            </>
          ) : (
            <>
              <Power className="mr-2 h-4 w-4" aria-hidden="true" />
              <span>Activar</span>
            </>
          )}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => onDelete?.(userId)}
          className="text-destructive focus:text-destructive"
        >
          <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" />
          <span>Eliminar</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
