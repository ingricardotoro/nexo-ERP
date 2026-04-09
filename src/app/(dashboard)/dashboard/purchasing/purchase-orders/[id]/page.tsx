'use client';

// src/app/(dashboard)/dashboard/purchasing/purchase-orders/[id]/page.tsx
import { useCallback, useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  PackageCheck,
  FileText,
  Plus,
  Trash2,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
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
  PurchaseOrderRow,
  PurchaseOrderLine,
} from '@/lib/services/purchasing/purchase-order.service';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface Contact {
  id: string;
  legalName: string;
}

interface ProductRow {
  id: string;
  code: string;
  name: string;
  costPrice: string | null;
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
  CONFIRMED: 'Confirmada',
  RECEIVED: 'Recibida',
  INVOICED: 'Facturada',
  CANCELLED: 'Cancelada',
};

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'text-yellow-700 border-yellow-300',
  CONFIRMED: 'text-blue-700 border-blue-300',
  RECEIVED: 'text-green-700 border-green-300',
  INVOICED: 'text-purple-700 border-purple-300',
  CANCELLED: 'text-gray-500 border-gray-300',
};

const fmtL = (v: string | number) =>
  'L ' +
  parseFloat(String(v)).toLocaleString('es-HN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const fmtDate = (d: Date | string | null) => (d ? new Date(d).toLocaleDateString('es-HN') : '—');

// ─── Read-only lines table ─────────────────────────────────────────────────────

function LinesTable({ lines }: { lines: PurchaseOrderLine[] }) {
  return (
    <div className="overflow-x-auto rounded border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          <tr>
            <th className="px-3 py-2 text-left">#</th>
            <th className="px-3 py-2 text-left">Producto</th>
            <th className="px-3 py-2 text-right">Cant. Pedida</th>
            <th className="px-3 py-2 text-right">Cant. Recibida</th>
            <th className="px-3 py-2 text-right">Precio Unit.</th>
            <th className="px-3 py-2 text-right">Desc %</th>
            <th className="px-3 py-2 text-left">Impuesto</th>
            <th className="px-3 py-2 text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l) => (
            <tr key={l.id} className="border-t">
              <td className="text-muted-foreground px-3 py-2 tabular-nums">{l.lineNumber}</td>
              <td className="px-3 py-2">
                <p className="font-medium">{l.productName}</p>
                <p className="text-muted-foreground text-xs">{l.productCode}</p>
              </td>
              <td className="px-3 py-2 text-right tabular-nums">
                {parseFloat(l.qtyOrdered).toFixed(2)}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">
                {parseFloat(l.qtyReceived).toFixed(2)}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">{fmtL(l.unitPrice)}</td>
              <td className="px-3 py-2 text-right tabular-nums">
                {parseFloat(l.discountPct) > 0 ? `${parseFloat(l.discountPct).toFixed(2)}%` : '—'}
              </td>
              <td className="px-3 py-2">{l.taxRateName}</td>
              <td className="px-3 py-2 text-right font-medium tabular-nums">{fmtL(l.total)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t">
            <td colSpan={7} className="px-3 py-2 text-right text-xs font-semibold uppercase">
              Total:
            </td>
            <td className="px-3 py-2 text-right font-bold tabular-nums">
              {fmtL(lines.reduce((s, l) => s + parseFloat(l.total), 0))}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

// ─── Editable form lines ───────────────────────────────────────────────────────

function EditableLines({
  lines,
  setLines,
  products,
  taxRates,
  defaultTaxRateId,
}: {
  lines: FormLine[];
  setLines: React.Dispatch<React.SetStateAction<FormLine[]>>;
  products: ProductRow[];
  taxRates: TaxRateRow[];
  defaultTaxRateId: string;
}) {
  const [nextId, setNextId] = useState(() => lines.length + 1);

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

  const removeLine = (id: number) => setLines((prev) => prev.filter((l) => l.id !== id));

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
              unitPrice: prod?.costPrice ? parseFloat(prod.costPrice).toFixed(2) : '',
              taxRateId: l.taxRateId || defaultTaxRateId,
            }
          : l,
      ),
    );
  };

  const calcLineTotal = (l: FormLine) => {
    const qty = parseFloat(l.qtyOrdered) || 0;
    const price = parseFloat(l.unitPrice) || 0;
    const disc = parseFloat(l.discountPct) || 0;
    const rate = parseFloat(taxRates.find((t) => t.id === l.taxRateId)?.rate ?? '0');
    const sub = qty * price * (1 - disc / 100);
    return sub + sub * rate;
  };

  const orderTotal = lines.reduce((acc, l) => acc + calcLineTotal(l), 0);

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <Label>Líneas de Orden</Label>
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
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function PurchaseOrderDetailPage() {
  const router = useRouter();
  const params = useParams();
  const orderId = params.id as string;

  const [order, setOrder] = useState<PurchaseOrderRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edit form state (DRAFT only)
  const [saving, setSaving] = useState(false);
  const [suppliers, setSuppliers] = useState<Contact[]>([]);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [taxRates, setTaxRates] = useState<TaxRateRow[]>([]);
  const [editSupplierId, setEditSupplierId] = useState('');
  const [editExpectedDate, setEditExpectedDate] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editLines, setEditLines] = useState<FormLine[]>([]);

  // Action states
  const [confirming, setConfirming] = useState(false);
  const [creatingInvoice, setCreatingInvoice] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  const fetchOrder = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/purchasing/purchase-orders/${orderId}`, {
        credentials: 'include',
      });
      const payload = (await res.json()) as {
        success: boolean;
        data?: PurchaseOrderRow;
        error?: string;
      };
      if (!res.ok || !payload.success || !payload.data) {
        throw new Error(payload.error ?? 'Error al cargar la orden');
      }
      const po = payload.data;
      setOrder(po);
      if (po.status === 'DRAFT') {
        setEditSupplierId(po.supplierId);
        setEditExpectedDate(new Date(po.expectedDate).toISOString().split('T')[0] ?? '');
        setEditNotes(po.notes ?? '');
        setEditLines(
          (po.lines ?? []).map((l, i) => ({
            id: i + 1,
            productId: l.productId,
            qtyOrdered: parseFloat(l.qtyOrdered).toString(),
            unitPrice: parseFloat(l.unitPrice).toString(),
            discountPct: parseFloat(l.discountPct).toString(),
            taxRateId: l.taxRateId,
          })),
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  const fetchCatalog = useCallback(async () => {
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
    void fetchOrder();
    void fetchCatalog();
  }, [fetchOrder, fetchCatalog]);

  const defaultTaxRateId =
    taxRates.find((t) => parseFloat(t.rate) === 0.15)?.id ?? taxRates[0]?.id ?? '';

  // ── Actions ──────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!editSupplierId) {
      toast.error('Selecciona un proveedor');
      return;
    }
    if (editLines.some((l) => !l.productId || !l.qtyOrdered || !l.unitPrice || !l.taxRateId)) {
      toast.error('Completa todas las líneas');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/v1/purchasing/purchase-orders/${orderId}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplierId: editSupplierId,
          expectedDate: new Date(editExpectedDate).toISOString(),
          notes: editNotes || undefined,
          lines: editLines.map((l) => ({
            productId: l.productId,
            qtyOrdered: parseFloat(l.qtyOrdered),
            unitPrice: parseFloat(l.unitPrice),
            discountPct: parseFloat(l.discountPct) || 0,
            taxRateId: l.taxRateId,
          })),
        }),
      });
      const payload = (await res.json()) as { success: boolean; error?: string };
      if (!res.ok) throw new Error(payload.error ?? 'Error al guardar');
      toast.success('Orden actualizada');
      await fetchOrder();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleConfirm = async () => {
    setConfirming(true);
    try {
      const res = await fetch(`/api/v1/purchasing/purchase-orders/${orderId}/confirm`, {
        method: 'POST',
        credentials: 'include',
      });
      const payload = (await res.json()) as { success: boolean; error?: string; message?: string };
      if (!res.ok) throw new Error(payload.error ?? 'Error al confirmar');
      toast.success(payload.message ?? 'Orden confirmada');
      await fetchOrder();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al confirmar');
    } finally {
      setConfirming(false);
    }
  };

  const handleCreateInvoice = async () => {
    setCreatingInvoice(true);
    try {
      const res = await fetch(
        `/api/v1/purchasing/purchase-orders/${orderId}/create-supplier-invoice`,
        { method: 'POST', credentials: 'include' },
      );
      const payload = (await res.json()) as {
        success: boolean;
        data?: { id: string };
        error?: string;
      };
      if (!res.ok) throw new Error(payload.error ?? 'Error al crear factura');
      toast.success('Factura de proveedor creada en borrador');
      if (payload.data?.id) {
        router.push(`/dashboard/invoicing/invoices/${payload.data.id}` as never);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al crear factura');
    } finally {
      setCreatingInvoice(false);
    }
  };

  const handleCancel = async () => {
    if (!cancelReason.trim()) {
      toast.error('Indica el motivo de cancelación');
      return;
    }
    try {
      const res = await fetch(`/api/v1/purchasing/purchase-orders/${orderId}/cancel`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cancelReason }),
      });
      const payload = (await res.json()) as { success: boolean; error?: string };
      if (!res.ok) throw new Error(payload.error ?? 'Error al cancelar');
      toast.success('Orden cancelada');
      setShowCancelDialog(false);
      await fetchOrder();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al cancelar');
    }
  };

  // ── Loading / Error states ────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-6 p-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10 rounded-md" />
          <div className="space-y-2">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-48" />
          </div>
        </div>
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="space-y-6 p-6">
        <Button
          variant="outline"
          size="icon"
          onClick={() => router.push('/dashboard/purchasing/purchase-orders' as never)}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <Card className="p-6 text-center">
          <p className="text-destructive">{error ?? 'Orden no encontrada.'}</p>
        </Card>
      </div>
    );
  }

  const isDraft = order.status === 'DRAFT';
  const isConfirmed = order.status === 'CONFIRMED';
  const isReceived = order.status === 'RECEIVED';
  const canCancel = isDraft || isConfirmed;
  const canInvoice = isConfirmed || isReceived;

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <Button
            variant="outline"
            size="icon"
            onClick={() => router.push('/dashboard/purchasing/purchase-orders' as never)}
            className="shrink-0"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-foreground text-3xl font-bold tracking-tight">
                {order.orderNumber ? (
                  <span className="font-mono">{order.orderNumber}</span>
                ) : (
                  'Orden en Borrador'
                )}
              </h1>
              <Badge variant="outline" className={`text-xs ${STATUS_COLORS[order.status] ?? ''}`}>
                {STATUS_LABELS[order.status] ?? order.status}
              </Badge>
            </div>
            <p className="text-muted-foreground mt-1 text-sm">{order.supplierName}</p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap gap-2 sm:shrink-0">
          {isDraft && (
            <>
              <Button variant="outline" onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {saving ? 'Guardando...' : 'Guardar Cambios'}
              </Button>
              <Button onClick={handleConfirm} disabled={confirming}>
                {confirming && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <CheckCircle2 className="mr-2 h-4 w-4" />
                {confirming ? 'Confirmando...' : 'Confirmar Orden'}
              </Button>
            </>
          )}
          {canInvoice && (
            <Button variant="outline" onClick={handleCreateInvoice} disabled={creatingInvoice}>
              {creatingInvoice && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <FileText className="mr-2 h-4 w-4" />
              {creatingInvoice ? 'Creando...' : 'Crear Factura Proveedor'}
            </Button>
          )}
          {isConfirmed && (
            <Button
              variant="outline"
              onClick={() =>
                router.push(`/dashboard/purchasing/purchase-orders/${orderId}/receive` as never)
              }
            >
              <PackageCheck className="mr-2 h-4 w-4" />
              Registrar Recepción
            </Button>
          )}
          {canCancel && (
            <Button variant="destructive" onClick={() => setShowCancelDialog(true)}>
              <XCircle className="mr-2 h-4 w-4" />
              Cancelar
            </Button>
          )}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Subtotal</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-mono text-2xl font-bold">{fmtL(order.subtotal)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">ISV</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-mono text-2xl font-bold">{fmtL(order.taxAmount)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-mono text-2xl font-bold text-blue-600">{fmtL(order.total)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Order details */}
      {isDraft ? (
        /* ── Editable form ── */
        <Card>
          <CardHeader>
            <CardTitle>Editar Orden de Compra</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Proveedor *</Label>
                <Select value={editSupplierId} onValueChange={setEditSupplierId}>
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
              <div>
                <Label>Fecha Esperada *</Label>
                <Input
                  type="date"
                  value={editExpectedDate}
                  onChange={(e) => setEditExpectedDate(e.target.value)}
                />
              </div>
            </div>
            <div>
              <Label>Notas</Label>
              <Textarea
                placeholder="Observaciones..."
                rows={2}
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
              />
            </div>
            <EditableLines
              lines={editLines}
              setLines={setEditLines}
              products={products}
              taxRates={taxRates}
              defaultTaxRateId={defaultTaxRateId}
            />
          </CardContent>
        </Card>
      ) : (
        /* ── Read-only view ── */
        <Card>
          <CardHeader>
            <CardTitle>Detalle de la Orden</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
              <div>
                <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                  Proveedor
                </p>
                <p className="mt-1 text-sm font-medium">{order.supplierName}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                  Fecha Esperada
                </p>
                <p className="mt-1 text-sm">{fmtDate(order.expectedDate)}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                  Moneda
                </p>
                <p className="mt-1 text-sm">{order.currencyCode}</p>
              </div>
              {order.warehouseName && (
                <div>
                  <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                    Bodega
                  </p>
                  <p className="mt-1 text-sm">{order.warehouseName}</p>
                </div>
              )}
              {order.confirmedAt && (
                <div>
                  <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                    Confirmada
                  </p>
                  <p className="mt-1 text-sm">{fmtDate(order.confirmedAt)}</p>
                </div>
              )}
              <div>
                <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                  Creada
                </p>
                <p className="mt-1 text-sm">{fmtDate(order.createdAt)}</p>
              </div>
            </div>
            {order.notes && (
              <>
                <Separator />
                <div>
                  <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                    Notas
                  </p>
                  <p className="mt-1 text-sm">{order.notes}</p>
                </div>
              </>
            )}
            <Separator />
            <LinesTable lines={order.lines ?? []} />
          </CardContent>
        </Card>
      )}

      {/* Cancel dialog */}
      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar Orden de Compra</AlertDialogTitle>
            <AlertDialogDescription>
              Indica el motivo de cancelación de la orden{' '}
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
              Cancelar Orden
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
