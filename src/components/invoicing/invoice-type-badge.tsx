// src/components/invoicing/invoice-type-badge.tsx
import { Badge } from '@/components/ui/badge';

export type InvoiceType = 'FACTURA' | 'NOTA_CREDITO' | 'NOTA_DEBITO';

interface InvoiceTypeBadgeProps {
  invoiceType: InvoiceType;
}

const TYPE_CONFIG: Record<InvoiceType, { label: string; className: string }> = {
  FACTURA: {
    label: 'Factura',
    className: 'bg-violet-50 text-violet-700 border-violet-300',
  },
  NOTA_CREDITO: {
    label: 'Nota de Crédito',
    className: 'bg-amber-50 text-amber-700 border-amber-300',
  },
  NOTA_DEBITO: {
    label: 'Nota de Débito',
    className: 'bg-orange-50 text-orange-700 border-orange-300',
  },
};

export function InvoiceTypeBadge({ invoiceType }: InvoiceTypeBadgeProps) {
  const config = TYPE_CONFIG[invoiceType] ?? TYPE_CONFIG.FACTURA;
  return (
    <Badge variant="outline" className={config.className}>
      {config.label}
    </Badge>
  );
}

export function getInvoiceTypeLabel(invoiceType: InvoiceType): string {
  return TYPE_CONFIG[invoiceType]?.label ?? invoiceType;
}
