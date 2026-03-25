// src/components/contacts/contact-role-badge.tsx
import { Badge } from '@/components/ui/badge';
import { getContactRoleLabel, getContactRoleBadgeVariant } from '@/lib/validations/contact.schema';

interface ContactRoleBadgeProps {
  isCustomer: boolean;
  isSupplier: boolean;
}

/**
 * Badge del rol del contacto (Cliente / Proveedor / Cliente / Proveedor).
 * Colores semánticos según combinación de roles.
 */
export function ContactRoleBadge({ isCustomer, isSupplier }: Readonly<ContactRoleBadgeProps>) {
  const label = getContactRoleLabel(isCustomer, isSupplier);
  const variant = getContactRoleBadgeVariant(isCustomer, isSupplier);

  return <Badge variant={variant}>{label}</Badge>;
}
