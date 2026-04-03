'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus, ShoppingBag, CheckCircle2, Search } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import type {
  SupplierInvoiceRow,
  SupplierInvoiceListResult,
} from '@/lib/services/invoicing/supplier-invoice.service';

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Borrador',
  POSTED: 'Registrada',
  PAID: 'Pagada',
  CANCELLED: 'Anulada',
};

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'border-yellow-300 text-yellow-700',
  POSTED: 'border-blue-300 text-blue-700',
  PAID: 'border-green-300 text-green-700',
  CANCELLED: 'border-gray-300 text-gray-500 line-through',
};

const TYPE_LABELS: Record<string, string> = {
  FACTURA_COMPRA: 'Factura Compra',
  NOTA_CREDITO_COMPRA: 'N. Crédito Compra',
  NOTA_DEBITO_COMPRA: 'N. Débito Compra',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtL = (v: string) =>
  `L ${parseFloat(v).toLocaleString('es-HN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtDate = (d: Date | string) =>
  new Date(d).toLocaleDateString('es-HN', { day: '2-digit', month: 'short', year: 'numeric' });

// ─── Row component ────────────────────────────────────────────────────────────

function InvoiceRow({
  inv,
  onRefresh,
}: {
  inv: Omit<SupplierInvoiceRow, 'lines'>;
  onRefresh: () => void;
}) {
  const [loading, setLoading] = useState(false);

  const doPost = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/invoicing/supplier-invoices/${inv.id}/post`, {
        method: 'POST',
        credentials: 'include',
      });
      const payload = (await res.json()) as { success: boolean; error?: string; message?: string };
      if (!res.ok || !payload.success) {
        toast.error('Error', { description: payload.error });
        return;
      }
      toast.success(payload.message ?? 'Factura registrada');
      onRefresh();
    } catch {
      toast.error('Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <tr className="hover:bg-muted/30 border-b transition-colors last:border-0">
      <td className="px-4 py-3">
        <p className="text-sm font-medium">{inv.supplierInvoiceNumber ?? '(sin número)'}</p>
        <p className="text-muted-foreground text-xs">
          {TYPE_LABELS[inv.invoiceType] ?? inv.invoiceType}
        </p>
      </td>
      <td className="px-4 py-3 text-sm">{inv.contactName}</td>
      <td className="px-4 py-3 text-sm tabular-nums">{fmtDate(inv.issueDate)}</td>
      <td className="px-4 py-3 text-right text-sm font-medium tabular-nums">{fmtL(inv.total)}</td>
      <td className="px-4 py-3">
        <Badge variant="outline" className={`text-xs ${STATUS_COLORS[inv.status] ?? ''}`}>
          {STATUS_LABELS[inv.status] ?? inv.status}
        </Badge>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-1">
          {inv.status === 'DRAFT' && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 gap-1 text-xs text-blue-700"
              disabled={loading}
              onClick={doPost}
            >
              <CheckCircle2 className="h-3 w-3" />
              Registrar
            </Button>
          )}
        </div>
      </td>
    </tr>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SupplierInvoicesPage() {
  const [result, setResult] = useState<SupplierInvoiceListResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (search) params.set('search', search);
      if (statusFilter) params.set('status', statusFilter);

      const res = await fetch(`/api/v1/invoicing/supplier-invoices?${params.toString()}`, {
        credentials: 'include',
        cache: 'no-store',
      });
      const payload = (await res.json()) as SupplierInvoiceListResult & {
        success: boolean;
        error?: string;
      };
      if (!res.ok || !payload.success) {
        toast.error(payload.error ?? 'Error al cargar facturas');
        return;
      }
      setResult(payload);
    } catch {
      toast.error('Error de conexión');
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter]);

  useEffect(() => {
    void fetchInvoices();
  }, [fetchInvoices]);

  const handleCancel = async () => {
    if (!cancelId) return;
    setCancelling(true);
    try {
      const res = await fetch(`/api/v1/invoicing/supplier-invoices/${cancelId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ cancelReason: cancelReason || 'Anulación manual' }),
      });
      const payload = (await res.json()) as { success: boolean; error?: string; message?: string };
      if (!res.ok || !payload.success) {
        toast.error('Error al anular', { description: payload.error });
        return;
      }
      toast.success(payload.message ?? 'Factura anulada');
      void fetchInvoices();
    } catch {
      toast.error('Error de conexión');
    } finally {
      setCancelId(null);
      setCancelReason('');
      setCancelling(false);
    }
  };

  const invoices = result?.invoices ?? [];
  const pagination = result?.pagination;
  const draft = invoices.filter((i) => i.status === 'DRAFT').length;
  const posted = invoices.filter((i) => i.status === 'POSTED').length;

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Facturas de Proveedor</h1>
          <p className="text-muted-foreground text-sm">
            Gestión de facturas de compra, notas de crédito y débito de proveedores
          </p>
        </div>
        <Button disabled title="Próximamente: formulario de nueva factura de compra">
          <Plus className="mr-2 h-4 w-4" />
          Nueva factura
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: 'Total', value: pagination?.total ?? 0, color: '' },
          { label: 'Borradores', value: draft, color: 'text-yellow-600' },
          { label: 'Registradas', value: posted, color: 'text-blue-600' },
          {
            label: 'Páginas',
            value: `${page}/${pagination?.totalPages ?? 1}`,
            color: '',
          },
        ].map(({ label, value, color }) => (
          <Card key={label}>
            <div className="p-4">
              <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                {label}
              </p>
              <p className={`mt-1 text-2xl font-bold ${color}`}>{value}</p>
            </div>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative min-w-[200px] flex-1">
          <Search className="text-muted-foreground absolute top-2.5 left-3 h-4 w-4" />
          <Input
            placeholder="Buscar proveedor o N° factura..."
            className="pl-9"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <Select
          value={statusFilter}
          onValueChange={(v) => {
            setStatusFilter(v === 'ALL' ? '' : v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Estado..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos</SelectItem>
            <SelectItem value="DRAFT">Borrador</SelectItem>
            <SelectItem value="POSTED">Registrada</SelectItem>
            <SelectItem value="PAID">Pagada</SelectItem>
            <SelectItem value="CANCELLED">Anulada</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {loading && !result ? (
        <div className="bg-muted h-48 animate-pulse rounded-lg" />
      ) : invoices.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <ShoppingBag className="text-muted-foreground mb-3 h-10 w-10" />
            <p className="font-medium">No hay facturas de proveedor</p>
            <p className="text-muted-foreground mt-1 text-sm">
              Registra la primera factura de compra para comenzar.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  {['N° / Tipo', 'Proveedor', 'Fecha', 'Total', 'Estado', ''].map((h) => (
                    <th
                      key={h}
                      className="text-muted-foreground px-4 py-3 text-left text-xs font-medium uppercase"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <InvoiceRow key={inv.id} inv={inv} onRefresh={fetchInvoices} />
                ))}
              </tbody>
            </table>
          </div>

          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between border-t px-4 py-3">
              <p className="text-muted-foreground text-xs">
                {(page - 1) * 20 + 1}–{Math.min(page * 20, pagination.total)} de {pagination.total}{' '}
                facturas
              </p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Anterior
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page >= pagination.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Siguiente
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Cancel dialog */}
      <AlertDialog open={!!cancelId} onOpenChange={(o) => !o && setCancelId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Anular factura de proveedor</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción generará un contraasiento si la factura estaba registrada. Ingresa el
              motivo de anulación.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2">
            <Input
              placeholder="Motivo de anulación..."
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleCancel}
              disabled={cancelling}
            >
              {cancelling ? 'Anulando...' : 'Anular factura'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
