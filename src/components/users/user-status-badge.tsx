// src/components/users/user-status-badge.tsx
import { Badge } from '@/components/ui/badge';

interface UserStatusBadgeProps {
  isActive: boolean;
}

/**
 * Badge de estado de usuario (Activo/Inactivo).
 * Colores semánticos: verde=activo, gris=inactivo.
 */
export function UserStatusBadge({ isActive }: UserStatusBadgeProps) {
  return (
    <Badge variant={isActive ? 'default' : 'secondary'}>{isActive ? 'Activo' : 'Inactivo'}</Badge>
  );
}
