// src/components/users/user-role-badge.tsx
import { Badge } from '@/components/ui/badge';
import { getRoleLabel, getRoleBadgeVariant } from '@/lib/validations/user.schema';

interface UserRoleBadgeProps {
  role: string;
}

/**
 * Badge de rol de usuario con colores semánticos.
 * ADMIN=destructive, MANAGER=default, ACCOUNTANT=secondary, SALESPERSON=outline, AUDITOR=secondary.
 */
export function UserRoleBadge({ role }: Readonly<UserRoleBadgeProps>) {
  const label = getRoleLabel(role);
  const variant = getRoleBadgeVariant(role);

  return <Badge variant={variant}>{label}</Badge>;
}
