'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, ShoppingCart, CheckCircle2, XCircle, Search, Trash2 } from 'lucide-react';
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
import type {
  PurchaseOrderRow,
  PurchaseOrderListResult,
} from '@/lib/services/purchasing/purchase-order.service';
import type { ProductRow } from '@/lib/services/inventory/product.service';
import type { TaxRateRow } from '@/lib/services/invoicing/tax-rate.service';

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Borrador',
  CONFIRMED: 'Confirmada',
  RECEIVED: 'Recibida',
  INVOICED: 'Facturada',
  CANCELLED: 'Cancelada',
};

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'border-yellow-300 text-yellow-700',
  CONFIRMED: 'border-blue-300 text-blue-700',
  RECEIVED: 'border-green-300 text-green-700',
  INVOICED: 'border-purple-300 text-purple-700',
  CANCELLED: 'border-gray-300 text-gray-500 line-through',
};

const fmtL = (v: string | number) =>
  `L ${parseFloat(String(v)).toLocaleString('es-HN', { minimumFractionDigits: 2 })}`;

const fmtDate = (d: Date | string) =>
  new Date(d).toLocaleDateString('es-HN', { day: '2-digit', month: 'short', year: 'numeric' });

// ─── Types ────────────────────────────────────────────────────────────────────

interface Contact {
  id: string;
  legalName: string;
}

interface FormLine {
  id: number;
  productId: string;
  qtyOrdered: string;
  unitPrice: string;
  discountPct: string;
  taxRateId: string;
}

// ─── Create Dialog ────────────────────────────────────────────────────────────

function CreateOrderDialog({
  open,
  onClose,
  onSaved,
  suppliers,
  products,
  taxRates,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  suppliers: Contact[];
  products: ProductRow[];
  taxRates: TaxRateRow[];
}) {
  const [saving, setSaving] = useState(false);
  const [supplierId, setSupplierId] = useState('');
  const [expectedDate, setExpectedDate] = useState(
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
    const product = products.find((p) => p.id === productId);
    setLines((prev) =>
      prev.map((l) =>
        l.id === lineId
          ? {
              ...l,
              productId,
              unitPrice: product ? parseFloat(product.costPrice).toFixed(4) : '',
              taxRateId: defaultTaxRateId,
            }
          : l,
      ),
    );
  };

  const calcLineTotal = (l: FormLine) => {
    const qty = parseFloat(l.qtyOrdered) || 0;
    const price = parseFloat(l.unitPrice) || 0;
    const disc = parseFloat(l.discountPct) || 0;
    const taxRate = taxRates.find((t) => t.id === l.taxRateId);
    const rate = taxRate ? parseFloat(taxRate.rate) : 0;
    const sub = qty * price * (1 - disc / 100);
    return sub + sub * rate;
  };

  const orderTotal = lines.reduce((s, l) => s + calcLineTotal(l), 0);

  const handleSubmit = async () => {
    if (!supplierId || !expectedDate) {
      toast.error('Proveedor y fecha esperada son requeridos');
      return;
    }
    const invalidLines = lines.filter((l) => !l.productId || !l.qtyOrdered || !l.taxRateId);
    if (invalidLines.length) {
      toast.error('Todas las líneas deben tener producto, cantidad y tasa de impuesto');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/v1/purchasing/purchase-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          supplierId,
          expectedDate: new Date(expectedDate).toISOString(),
          notes: notes || undefined,
          lines: lines.map((l) => ({
            productId: l.productId,
            qtyOrdered: parseFloat(l.qtyOrdered),
            unitPrice: parseFloat(l.unitPrice) || 0,
            discountPct: parseFloat(l.discountPct) || 0,
            taxRateId: l.taxRateId,
          })),
        }),
      });
      const payload = (await res.json()) as { success: boolean; error?: string; message?: string };
      if (!res.ok || !payload.success) {
        toast.error('Error al crear OC', { description: payload.error });
        return;
      }
      toast.success(payload.message ?? 'Orden de compra creada');
      onSaved();
      onClose();
    } catch {
      toast.error('Error de conexión');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Nueva Orden de Compra</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>
                Proveedor <span className="text-destructive">*</span>
              </Label>
              <Select value={supplierId} onValueChange={setSupplierId}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar proveedor..." />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.legalName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="exp-date">
                Fecha esperada <span className="text-destructive">*</span>
              </Label>
              <Input
                id="exp-date"
                type="date"
                value={expectedDate}
                onChange={(e) => setExpectedDate(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="po-notes">Notas</Label>
            <Input
              id="po-notes"
              placeholder="Instrucciones al proveedor..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {/* Lines */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Líneas de compra</Label>
              <Button size="sm" variant="outline" onClick={addLine}>
                <Plus className="mr-1 h-3 w-3" />
                Añadir línea
              </Button>
            </div>

            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    {['Producto', 'Cant.', 'Precio unit.', 'Desc.%', 'ISV', 'Total', ''].map(
                      (h) => (
                        <th
                          key={h}
                          className="text-muted-foreground px-3 py-2 text-left text-xs font-medium"
                        >
                          {h}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line) => (
                    <tr key={line.id} className="border-t">
                      <td className="px-2 py-1.5">
                        <Select
                          value={line.productId}
                          onValueChange={(v) => onProductSelect(line.id, v)}
                        >
                          <SelectTrigger className="h-8 w-40">
                            <SelectValue placeholder="Producto..." />
                          </SelectTrigger>
                          <SelectContent>
                            {products.map((p) => (
                              <SelectItem key={p.id} value={p.id}>
                                {p.code} — {p.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-2 py-1.5">
                        <Input
                          className="h-8 w-20"
                          type="number"
                          min="0"
                          step="0.0001"
                          placeholder="1"
                          value={line.qtyOrdered}
                          onChange={(e) => updateLine(line.id, 'qtyOrdered', e.target.value)}
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <Input
                          className="h-8 w-24"
                          type="number"
                          min="0"
                          step="0.0001"
                          placeholder="0.00"
                          value={line.unitPrice}
                          onChange={(e) => updateLine(line.id, 'unitPrice', e.target.value)}
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <Input
                          className="h-8 w-16"
                          type="number"
                          min="0"
                          max="100"
                          placeholder="0"
                          value={line.discountPct}
                          onChange={(e) => updateLine(line.id, 'discountPct', e.target.value)}
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <Select
                          value={line.taxRateId}
                          onValueChange={(v) => updateLine(line.id, 'taxRateId', v)}
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
                      <td className="px-2 py-1.5 text-right tabular-nums">
                        {fmtL(calcLineTotal(line).toFixed(2))}
                      </td>
                      <td className="px-2 py-1.5">
                        {lines.length > 1 && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive h-8 w-8 p-0"
                            onClick={() => setLines((prev) => prev.filter((l) => l.id !== line.id))}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-muted/30">
                  <tr>
                    <td colSpan={5} className="px-3 py-2 text-right text-sm font-medium">
                      Total estimado:
                    </td>
                    <td className="px-3 py-2 text-right text-sm font-bold tabular-nums">
                      {fmtL(orderTotal.toFixed(2))}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? 'Creando...' : 'Crear orden de compra'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── PO Row ───────────────────────────────────────────────────────────────────

function PORow({
  order,
  onConfirm,
  onCancel,
}: {
  order: Omit<PurchaseOrderRow, 'lines'>;
  onConfirm: (id: string) => void;
  onCancel: (id: string) => void;
}) {
  return (
    <tr className="hover:bg-muted/30 border-b transition-colors last:border-0">
      <td className="px-4 py-3">
        <Link
          href={`/dashboard/purchasing/purchase-orders/${order.id}`}
          className="hover:text-primary font-mono text-sm font-medium hover:underline"
        >
          {order.orderNumber ?? <span className="text-muted-foreground italic">Borrador</span>}
        </Link>
        <p className="text-muted-foreground text-xs">{fmtDate(order.createdAt)}</p>
      </td>
      <td className="px-4 py-3 text-sm">{order.supplierName}</td>
      <td className="px-4 py-3 text-sm">{fmtDate(order.expectedDate)}</td>
      <td className="px-4 py-3 text-right text-sm font-medium tabular-nums">{fmtL(order.total)}</td>
      <td className="px-4 py-3">
        <Badge variant="outline" className={`text-xs ${STATUS_COLORS[order.status] ?? ''}`}>
          {STATUS_LABELS[order.status] ?? order.status}
        </Badge>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-1">
          {order.status === 'DRAFT' && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 gap-1 text-xs text-blue-700"
              onClick={() => onConfirm(order.id)}
            >
              <CheckCircle2 className="h-3 w-3" />
              Confirmar
            </Button>
          )}
          {['DRAFT', 'CONFIRMED'].includes(order.status) && (
            <Button
              size="sm"
              variant="outline"
              className="text-destructive h-7 gap-1 text-xs"
              onClick={() => onCancel(order.id)}
            >
              <XCircle className="h-3 w-3" />
              Cancelar
            </Button>
          )}
        </div>
      </td>
    </tr>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PurchaseOrdersPage() {
  const [result, setResult] = useState<PurchaseOrderListResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);

  // Catalog data
  const [suppliers, setSuppliers] = useState<Contact[]>([]);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [taxRates, setTaxRates] = useState<TaxRateRow[]>([]);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (search) params.set('search', search);
      if (statusFilter) params.set('status', statusFilter);
      const res = await fetch(`/api/v1/purchasing/purchase-orders?${params}`, {
        credentials: 'include',
        cache: 'no-store',
      });
      const payload = (await res.json()) as PurchaseOrderListResult & { error?: string };
      if (!res.ok || !payload.success) {
        toast.error(payload.error ?? 'Error al cargar órdenes');
        return;
      }
      setResult(payload);
    } catch {
      toast.error('Error de conexión');
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter]);

  const fetchCatalogData = useCallback(async () => {
    try {
      const [suppRes, prodRes, taxRes] = await Promise.all([
        fetch('/api/v1/contacts?isSupplier=true&limit=200', { credentials: 'include' }),
        fetch('/api/v1/inventory/products?activeOnly=true&limit=200', { credentials: 'include' }),
        fetch('/api/v1/invoicing/tax-rates', { credentials: 'include' }),
      ]);
      if (suppRes.ok) {
        const d = (await suppRes.json()) as {
          success: boolean;
          data?: Contact[];
          contacts?: Contact[];
        };
        setSuppliers(d.data ?? d.contacts ?? []);
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

  const handleConfirm = async (id: string) => {
    try {
      const res = await fetch(`/api/v1/purchasing/purchase-orders/${id}/confirm`, {
        method: 'POST',
        credentials: 'include',
      });
      const payload = (await res.json()) as { success: boolean; error?: string; message?: string };
      if (!res.ok || !payload.success) {
        toast.error('Error al confirmar', { description: payload.error });
        return;
      }
      toast.success(payload.message ?? 'Orden confirmada');
      void fetchOrders();
    } catch {
      toast.error('Error de conexión');
    }
  };

  const handleCancel = async () => {
    if (!cancelId) return;
    setCancelling(true);
    try {
      const res = await fetch(`/api/v1/purchasing/purchase-orders/${cancelId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ cancelReason: cancelReason || 'Cancelación manual' }),
      });
      const payload = (await res.json()) as { success: boolean; error?: string; message?: string };
      if (!res.ok || !payload.success) {
        toast.error('Error al cancelar', { description: payload.error });
        return;
      }
      toast.success(payload.message ?? 'Orden cancelada');
      void fetchOrders();
    } catch {
      toast.error('Error de conexión');
    } finally {
      setCancelId(null);
      setCancelReason('');
      setCancelling(false);
    }
  };

  const orders = result?.orders ?? [];
  const pagination = result?.pagination;
  const draft = orders.filter((o) => o.status === 'DRAFT').length;
  const confirmed = orders.filter((o) => o.status === 'CONFIRMED').length;

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Órdenes de Compra</h1>
          <p className="text-muted-foreground text-sm">
            Gestión de órdenes de compra a proveedores
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)} disabled={suppliers.length === 0}>
          <Plus className="mr-2 h-4 w-4" />
          Nueva OC
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: 'Total', value: pagination?.total ?? 0, color: '' },
          { label: 'Borradores', value: draft, color: 'text-yellow-600' },
          { label: 'Confirmadas', value: confirmed, color: 'text-blue-600' },
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
            placeholder="Buscar número OC o proveedor..."
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
            <SelectItem value="CONFIRMED">Confirmada</SelectItem>
            <SelectItem value="RECEIVED">Recibida</SelectItem>
            <SelectItem value="INVOICED">Facturada</SelectItem>
            <SelectItem value="CANCELLED">Cancelada</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {loading && !result ? (
        <div className="bg-muted h-48 animate-pulse rounded-lg" />
      ) : orders.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <ShoppingCart className="text-muted-foreground mb-3 h-10 w-10" />
            <p className="font-medium">No hay órdenes de compra</p>
            <p className="text-muted-foreground mt-1 text-sm">
              {suppliers.length === 0
                ? 'Primero configura proveedores en el módulo de Contactos.'
                : 'Crea la primera orden de compra para comenzar.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  {['N° OC', 'Proveedor', 'Fecha esperada', 'Total', 'Estado', ''].map((h) => (
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
                {orders.map((o) => (
                  <PORow
                    key={o.id}
                    order={o}
                    onConfirm={handleConfirm}
                    onCancel={(id) => setCancelId(id)}
                  />
                ))}
              </tbody>
            </table>
          </div>

          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between border-t px-4 py-3">
              <p className="text-muted-foreground text-xs">
                {(page - 1) * 20 + 1}–{Math.min(page * 20, pagination.total)} de {pagination.total}{' '}
                órdenes
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

      <CreateOrderDialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onSaved={fetchOrders}
        suppliers={suppliers}
        products={products}
        taxRates={taxRates}
      />

      <AlertDialog open={!!cancelId} onOpenChange={(o) => !o && setCancelId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar orden de compra</AlertDialogTitle>
            <AlertDialogDescription>
              La orden quedará cancelada. Ingresa el motivo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2">
            <Input
              placeholder="Motivo de cancelación..."
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Volver</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleCancel}
              disabled={cancelling}
            >
              {cancelling ? 'Cancelando...' : 'Cancelar orden'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
