// src/components/contacts/contact-status-badge.tsx
import { Badge } from '@/components/ui/badge';

interface ContactStatusBadgeProps {
  isActive: boolean;
}

/**
 * Badge de estado de contacto (Activo / Inactivo).
 * Colores semánticos: verde=activo, gris=inactivo.
 */
export function ContactStatusBadge({ isActive }: Readonly<ContactStatusBadgeProps>) {
  return (
    <Badge variant={isActive ? 'default' : 'secondary'}>{isActive ? 'Activo' : 'Inactivo'}</Badge>
  );
}
