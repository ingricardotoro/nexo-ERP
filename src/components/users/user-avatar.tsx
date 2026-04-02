// src/components/users/user-avatar.tsx
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface UserAvatarProps {
  fullName: string;
  avatarUrl?: string | null;
  className?: string;
}

/**
 * Avatar de usuario con fallback a iniciales.
 * Cumple WCAG 2.1 AA: alt text descriptivo, contraste suficiente.
 */
export function UserAvatar({ fullName, avatarUrl, className }: Readonly<UserAvatarProps>) {
  // Generar iniciales desde el nombre completo
  const initials = fullName
    .split(' ')
    .map((word) => word[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <Avatar className={className}>
      <AvatarImage src={avatarUrl || ''} alt={`Avatar de ${fullName}`} />
      <AvatarFallback>{initials}</AvatarFallback>
    </Avatar>
  );
}
