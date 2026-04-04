'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus, CheckCircle2, XCircle, Search, Trash2, ShoppingCart } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
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
import { Textarea } from '@/components/ui/textarea';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface SalesOrderRow {
  id: string;
  orderNumber: string | null;
  status: 'DRAFT' | 'CONFIRMED' | 'DELIVERED' | 'INVOICED' | 'CANCELLED';
  customerId: string;
  customerName: string;
  currencyCode: string;
  deliveryDate: Date;
  total: string;
  notes: string | null;
  confirmedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface Contact {
  id: string;
  legalName: string;
}

interface ProductRow {
  id: string;
  code: string;
  name: string;
  salePrice: string | null;
}

interface TaxRateRow {
  id: string;
  name: string;
  rate: string;
}

interface FormLine {
  id: number;
  productId: string;
  qtyOrdered: string;
  unitPrice: string;
  discountPct: string;
  taxRateId: string;
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Borrador',
  CONFIRMED: 'Confirmado',
  DELIVERED: 'Despachado',
  INVOICED: 'Facturado',
  CANCELLED: 'Cancelado',
};

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'text-yellow-600 border-yellow-300',
  CONFIRMED: 'text-blue-600 border-blue-300',
  DELIVERED: 'text-indigo-600 border-indigo-300',
  INVOICED: 'text-green-600 border-green-300',
  CANCELLED: 'text-red-500 border-red-300',
};

const fmtDate = (d: Date | string | null) => (d ? new Date(d).toLocaleDateString('es-HN') : '—');

const fmtL = (v: string | number) =>
  'L ' +
  parseFloat(String(v)).toLocaleString('es-HN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

// ─── CreateOrderDialog ─────────────────────────────────────────────────────────

function CreateOrderDialog({
  customers,
  products,
  taxRates,
  onCreated,
}: {
  customers: Contact[];
  products: ProductRow[];
  taxRates: TaxRateRow[];
  onCreated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [customerId, setCustomerId] = useState('');
  const [deliveryDate, setDeliveryDate] = useState(
    () => new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
  );
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<FormLine[]>([
    { id: 1, productId: '', qtyOrdered: '', unitPrice: '', discountPct: '0', taxRateId: '' },
  ]);
  const [nextId, setNextId] = useState(2);

  const defaultTaxRateId =
    taxRates.find((t) => parseFloat(t.rate) === 0.15)?.id ?? taxRates[0]?.id ?? '';

  const addLine = () => {
    setLines((prev) => [
      ...prev,
      {
        id: nextId,
        productId: '',
        qtyOrdered: '',
        unitPrice: '',
        discountPct: '0',
        taxRateId: defaultTaxRateId,
      },
    ]);
    setNextId((n) => n + 1);
  };

  const updateLine = (id: number, field: keyof FormLine, value: string) =>
    setLines((prev) => prev.map((l) => (l.id === id ? { ...l, [field]: value } : l)));

  const onProductSelect = (lineId: number, productId: string) => {
    const prod = products.find((p) => p.id === productId);
    setLines((prev) =>
      prev.map((l) =>
        l.id === lineId
          ? {
              ...l,
              productId,
              unitPrice: prod?.salePrice ? parseFloat(prod.salePrice).toFixed(2) : '',
              taxRateId: l.taxRateId || defaultTaxRateId,
            }
          : l,
      ),
    );
  };

  const removeLine = (id: number) => setLines((prev) => prev.filter((l) => l.id !== id));

  const calcLineTotal = (l: FormLine) => {
    const qty = parseFloat(l.qtyOrdered) || 0;
    const price = parseFloat(l.unitPrice) || 0;
    const disc = parseFloat(l.discountPct) || 0;
    const rate = parseFloat(taxRates.find((t) => t.id === l.taxRateId)?.rate ?? '0');
    const sub = qty * price * (1 - disc / 100);
    return sub + sub * rate;
  };

  const orderTotal = lines.reduce((acc, l) => acc + calcLineTotal(l), 0);

  const handleSubmit = async () => {
    if (!customerId) {
      toast.error('Selecciona un cliente');
      return;
    }
    if (lines.some((l) => !l.productId || !l.qtyOrdered || !l.unitPrice || !l.taxRateId)) {
      toast.error('Completa todas las líneas');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/v1/sales/orders', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId,
          deliveryDate: new Date(deliveryDate).toISOString(),
          notes: notes || undefined,
          lines: lines.map((l) => ({
            productId: l.productId,
            qtyOrdered: parseFloat(l.qtyOrdered),
            unitPrice: parseFloat(l.unitPrice),
            discountPct: parseFloat(l.discountPct) || 0,
            taxRateId: l.taxRateId,
          })),
        }),
      });
      const payload = (await res.json()) as { success: boolean; error?: string };
      if (!res.ok) throw new Error(payload.error ?? 'Error al crear');
      toast.success('Pedido de venta creado');
      setOpen(false);
      onCreated();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al crear pedido');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="mr-1 h-4 w-4" />
          Nuevo Pedido
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nuevo Pedido de Venta</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Cliente *</Label>
            <Select value={customerId} onValueChange={setCustomerId}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar cliente..." />
              </SelectTrigger>
              <SelectContent>
                {customers.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.legalName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Fecha de Entrega *</Label>
            <Input
              type="date"
              value={deliveryDate}
              onChange={(e) => setDeliveryDate(e.target.value)}
            />
          </div>
        </div>

        <div>
          <Label>Notas</Label>
          <Textarea
            placeholder="Observaciones..."
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        {/* Lines */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <Label>Líneas de Pedido</Label>
            <Button type="button" variant="outline" size="sm" onClick={addLine}>
              <Plus className="mr-1 h-3 w-3" />
              Agregar línea
            </Button>
          </div>
          <div className="overflow-x-auto rounded border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-3 py-2 text-left">Producto</th>
                  <th className="px-3 py-2 text-right">Cantidad</th>
                  <th className="px-3 py-2 text-right">Precio Unit.</th>
                  <th className="px-3 py-2 text-right">Desc %</th>
                  <th className="px-3 py-2 text-left">Impuesto</th>
                  <th className="px-3 py-2 text-right">Total</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {lines.map((l) => (
                  <tr key={l.id} className="border-t">
                    <td className="px-2 py-1">
                      <Select value={l.productId} onValueChange={(v) => onProductSelect(l.id, v)}>
                        <SelectTrigger className="h-8 w-48">
                          <SelectValue placeholder="Producto..." />
                        </SelectTrigger>
                        <SelectContent>
                          {products.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-2 py-1">
                      <Input
                        className="h-8 w-20 text-right"
                        type="number"
                        min="0"
                        step="0.0001"
                        value={l.qtyOrdered}
                        onChange={(e) => updateLine(l.id, 'qtyOrdered', e.target.value)}
                      />
                    </td>
                    <td className="px-2 py-1">
                      <Input
                        className="h-8 w-24 text-right"
                        type="number"
                        min="0"
                        step="0.0001"
                        value={l.unitPrice}
                        onChange={(e) => updateLine(l.id, 'unitPrice', e.target.value)}
                      />
                    </td>
                    <td className="px-2 py-1">
                      <Input
                        className="h-8 w-16 text-right"
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        value={l.discountPct}
                        onChange={(e) => updateLine(l.id, 'discountPct', e.target.value)}
                      />
                    </td>
                    <td className="px-2 py-1">
                      <Select
                        value={l.taxRateId}
                        onValueChange={(v) => updateLine(l.id, 'taxRateId', v)}
                      >
                        <SelectTrigger className="h-8 w-28">
                          <SelectValue placeholder="ISV..." />
                        </SelectTrigger>
                        <SelectContent>
                          {taxRates.map((t) => (
                            <SelectItem key={t.id} value={t.id}>
                              {t.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-2 py-1 text-right tabular-nums">{fmtL(calcLineTotal(l))}</td>
                    <td className="px-2 py-1">
                      {lines.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => removeLine(l.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t font-semibold">
                  <td colSpan={5} className="px-3 py-2 text-right">
                    Total:
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums">{fmtL(orderTotal)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? 'Guardando...' : 'Crear Pedido'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── SORow ─────────────────────────────────────────────────────────────────────

function SORow({ order, onAction }: { order: SalesOrderRow; onAction: () => void }) {
  const [confirming, setConfirming] = useState(false);
  const [showCancel, setShowCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  const handleConfirm = async () => {
    setConfirming(true);
    try {
      const res = await fetch(`/api/v1/sales/orders/${order.id}/confirm`, {
        method: 'POST',
        credentials: 'include',
      });
      const payload = (await res.json()) as { success: boolean; error?: string; message?: string };
      if (!res.ok) throw new Error(payload.error ?? 'Error');
      toast.success(payload.message ?? 'Pedido confirmado');
      onAction();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al confirmar');
    } finally {
      setConfirming(false);
    }
  };

  const handleCancel = async () => {
    if (!cancelReason.trim()) {
      toast.error('Indica el motivo de cancelación');
      return;
    }
    try {
      const res = await fetch(`/api/v1/sales/orders/${order.id}/cancel`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cancelReason }),
      });
      const payload = (await res.json()) as { success: boolean; error?: string };
      if (!res.ok) throw new Error(payload.error ?? 'Error');
      toast.success('Pedido cancelado');
      setShowCancel(false);
      onAction();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al cancelar');
    }
  };

  return (
    <>
      <tr className="hover:bg-muted/30 border-b transition-colors">
        <td className="px-4 py-3">
          <p className="font-mono text-sm font-medium">
            {order.orderNumber ?? <span className="text-muted-foreground italic">Borrador</span>}
          </p>
          <p className="text-muted-foreground text-xs">{fmtDate(order.createdAt)}</p>
        </td>
        <td className="px-4 py-3 text-sm">{order.customerName}</td>
        <td className="px-4 py-3 text-sm">{fmtDate(order.deliveryDate)}</td>
        <td className="px-4 py-3 text-right text-sm font-medium tabular-nums">
          {fmtL(order.total)}
        </td>
        <td className="px-4 py-3">
          <Badge variant="outline" className={`text-xs ${STATUS_COLORS[order.status] ?? ''}`}>
            {STATUS_LABELS[order.status] ?? order.status}
          </Badge>
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center justify-end gap-1">
            {order.status === 'DRAFT' && (
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-blue-600 hover:text-blue-700"
                disabled={confirming}
                title="Confirmar"
                onClick={handleConfirm}
              >
                <CheckCircle2 className="h-4 w-4" />
              </Button>
            )}
            {['DRAFT', 'CONFIRMED'].includes(order.status) && (
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-red-500 hover:text-red-600"
                title="Cancelar"
                onClick={() => setShowCancel(true)}
              >
                <XCircle className="h-4 w-4" />
              </Button>
            )}
          </div>
        </td>
      </tr>

      <AlertDialog open={showCancel} onOpenChange={setShowCancel}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar Pedido</AlertDialogTitle>
            <AlertDialogDescription>
              Indica el motivo de cancelación del pedido{' '}
              {order.orderNumber ? `#${order.orderNumber}` : 'borrador'}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2">
            <Textarea
              placeholder="Motivo de cancelación..."
              rows={3}
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setCancelReason('')}>Volver</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancel} className="bg-red-600 hover:bg-red-700">
              Cancelar Pedido
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function SalesOrdersPage() {
  const [orders, setOrders] = useState<SalesOrderRow[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);

  const [customers, setCustomers] = useState<Contact[]>([]);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [taxRates, setTaxRates] = useState<TaxRateRow[]>([]);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (search) params.set('search', search);
      if (statusFilter) params.set('status', statusFilter);
      const res = await fetch(`/api/v1/sales/orders?${params}`, { credentials: 'include' });
      if (!res.ok) return;
      const data = (await res.json()) as {
        success: boolean;
        orders: SalesOrderRow[];
        pagination: Pagination;
      };
      if (data.success) {
        setOrders(data.orders);
        setPagination(data.pagination);
      }
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter]);

  const fetchCatalogData = useCallback(async () => {
    try {
      const [custRes, prodRes, taxRes] = await Promise.all([
        fetch('/api/v1/contacts?isCustomer=true&limit=200', { credentials: 'include' }),
        fetch('/api/v1/inventory/products?activeOnly=true&limit=200', { credentials: 'include' }),
        fetch('/api/v1/invoicing/tax-rates', { credentials: 'include' }),
      ]);
      if (custRes.ok) {
        const d = (await custRes.json()) as {
          success: boolean;
          data?: Contact[];
          contacts?: Contact[];
        };
        setCustomers(d.data ?? d.contacts ?? []);
      }
      if (prodRes.ok) {
        const d = (await prodRes.json()) as { success: boolean; products: ProductRow[] };
        if (d.success) setProducts(d.products);
      }
      if (taxRes.ok) {
        const d = (await taxRes.json()) as { success: boolean; data: TaxRateRow[] };
        if (d.success) setTaxRates(d.data);
      }
    } catch {
      // non-critical
    }
  }, []);

  useEffect(() => {
    void fetchOrders();
  }, [fetchOrders]);
  useEffect(() => {
    void fetchCatalogData();
  }, [fetchCatalogData]);

  const draft = orders.filter((o) => o.status === 'DRAFT').length;
  const confirmed = orders.filter((o) => o.status === 'CONFIRMED').length;

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Pedidos de Venta</h1>
          <p className="text-muted-foreground text-sm">Gestión de pedidos SO/YYYY/NNNNN</p>
        </div>
        <CreateOrderDialog
          customers={customers}
          products={products}
          taxRates={taxRates}
          onCreated={() => {
            void fetchOrders();
          }}
        />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: 'Total', value: pagination?.total ?? 0, color: '' },
          { label: 'Borradores', value: draft, color: 'text-yellow-600' },
          { label: 'Confirmados', value: confirmed, color: 'text-blue-600' },
          { label: 'Páginas', value: `${page}/${pagination?.totalPages ?? 1}`, color: '' },
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
            placeholder="Buscar número SO o cliente..."
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
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Estado..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos</SelectItem>
            <SelectItem value="DRAFT">Borrador</SelectItem>
            <SelectItem value="CONFIRMED">Confirmado</SelectItem>
            <SelectItem value="DELIVERED">Despachado</SelectItem>
            <SelectItem value="INVOICED">Facturado</SelectItem>
            <SelectItem value="CANCELLED">Cancelado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="text-muted-foreground flex h-40 items-center justify-center text-sm">
              Cargando pedidos...
            </div>
          ) : orders.length === 0 ? (
            <div className="flex h-40 flex-col items-center justify-center gap-2">
              <ShoppingCart className="text-muted-foreground h-8 w-8" />
              <p className="text-muted-foreground text-sm">No hay pedidos de venta</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-muted-foreground px-4 py-3 text-left text-xs font-medium tracking-wide uppercase">
                      Pedido
                    </th>
                    <th className="text-muted-foreground px-4 py-3 text-left text-xs font-medium tracking-wide uppercase">
                      Cliente
                    </th>
                    <th className="text-muted-foreground px-4 py-3 text-left text-xs font-medium tracking-wide uppercase">
                      Fecha Entrega
                    </th>
                    <th className="text-muted-foreground px-4 py-3 text-right text-xs font-medium tracking-wide uppercase">
                      Total
                    </th>
                    <th className="text-muted-foreground px-4 py-3 text-left text-xs font-medium tracking-wide uppercase">
                      Estado
                    </th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o) => (
                    <SORow
                      key={o.id}
                      order={o}
                      onAction={() => {
                        void fetchOrders();
                      }}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between border-t px-4 py-3">
              <p className="text-muted-foreground text-xs">
                {(page - 1) * 20 + 1}–{Math.min(page * 20, pagination.total)} de {pagination.total}{' '}
                pedidos
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
        </CardContent>
      </Card>
    </div>
  );
}
