// src/components/invoicing/invoice-status-badge.tsx
import { Badge } from '@/components/ui/badge';

export type InvoiceStatus = 'DRAFT' | 'PUBLISHED' | 'PAID' | 'CANCELLED';

interface InvoiceStatusBadgeProps {
  status: InvoiceStatus;
}

const STATUS_CONFIG: Record<InvoiceStatus, { label: string; className: string }> = {
  DRAFT: {
    label: 'Borrador',
    className: 'bg-gray-100 text-gray-700 border-gray-300',
  },
  PUBLISHED: {
    label: 'Emitida',
    className: 'bg-blue-50 text-blue-700 border-blue-300',
  },
  PAID: {
    label: 'Pagada',
    className: 'bg-green-50 text-green-700 border-green-300',
  },
  CANCELLED: {
    label: 'Anulada',
    className: 'bg-red-50 text-red-700 border-red-300',
  },
};

export function InvoiceStatusBadge({ status }: InvoiceStatusBadgeProps) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.DRAFT;
  return (
    <Badge variant="outline" className={config.className}>
      {config.label}
    </Badge>
  );
}

export function getInvoiceStatusLabel(status: InvoiceStatus): string {
  return STATUS_CONFIG[status]?.label ?? status;
}
