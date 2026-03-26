// src/components/contacts/contact-type-badge.tsx
import { Badge } from '@/components/ui/badge';
import {
  getContactTypeLabel,
  getContactTypeVariant,
  type ContactType,
} from '@/lib/validations/contact.schema';

interface ContactTypeBadgeProps {
  contactType: ContactType;
}

/**
 * Badge del tipo de contacto (Persona Natural / Persona Jurídica).
 * Colores semánticos según el tipo.
 */
export function ContactTypeBadge({ contactType }: Readonly<ContactTypeBadgeProps>) {
  const label = getContactTypeLabel(contactType);
  const variant = getContactTypeVariant(contactType);

  return <Badge variant={variant}>{label}</Badge>;
}
