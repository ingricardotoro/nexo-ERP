'use client';

// src/app/(dashboard)/dashboard/purchasing/purchase-orders/[id]/receive/page.tsx
import { useCallback, useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, PackageCheck, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import type { PurchaseOrderRow } from '@/lib/services/purchasing/purchase-order.service';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface ReceiveLine {
  lineId: string;
  productCode: string;
  productName: string;
  qtyOrdered: number;
  qtyReceived: number;
  qtyPending: number;
  inputQty: string;
}

const fmtL = (v: string | number) =>
  'L ' +
  parseFloat(String(v)).toLocaleString('es-HN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function POReceivePage() {
  const router = useRouter();
  const params = useParams();
  const orderId = params.id as string;

  const [order, setOrder] = useState<PurchaseOrderRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lines, setLines] = useState<ReceiveLine[]>([]);

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

      if (po.status !== 'CONFIRMED') {
        setError(
          `La orden está en estado "${po.status}" — solo se pueden recibir órdenes CONFIRMADAS`,
        );
        return;
      }

      setLines(
        (po.lines ?? []).map((l) => {
          const pending = Math.max(0, parseFloat(l.qtyOrdered) - parseFloat(l.qtyReceived));
          return {
            lineId: l.id,
            productCode: l.productCode,
            productName: l.productName,
            qtyOrdered: parseFloat(l.qtyOrdered),
            qtyReceived: parseFloat(l.qtyReceived),
            qtyPending: pending,
            inputQty: pending > 0 ? pending.toFixed(4) : '0',
          };
        }),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    void fetchOrder();
  }, [fetchOrder]);

  const updateLine = (lineId: string, value: string) => {
    setLines((prev) => prev.map((l) => (l.lineId === lineId ? { ...l, inputQty: value } : l)));
  };

  const handleReceive = async () => {
    const toReceive = lines.filter((l) => parseFloat(l.inputQty || '0') > 0);
    if (toReceive.length === 0) {
      toast.error('Ingresa al menos una cantidad a recibir');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/v1/purchasing/purchase-orders/${orderId}/receive`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lines: toReceive.map((l) => ({
            lineId: l.lineId,
            qtyReceived: parseFloat(l.inputQty),
          })),
        }),
      });
      const payload = (await res.json()) as {
        success: boolean;
        data?: PurchaseOrderRow;
        error?: string;
        message?: string;
      };
      if (!res.ok) throw new Error(payload.error ?? 'Error al registrar recepción');
      toast.success(payload.message ?? 'Recepción registrada');
      router.push(`/dashboard/purchasing/purchase-orders/${orderId}` as never);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al registrar recepción');
    } finally {
      setSaving(false);
    }
  };

  // ── States ───────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-6 p-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10 rounded-md" />
          <Skeleton className="h-8 w-64" />
        </div>
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
          onClick={() => router.push(`/dashboard/purchasing/purchase-orders/${orderId}` as never)}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <Card className="p-6 text-center">
          <p className="text-destructive">{error ?? 'Orden no encontrada.'}</p>
        </Card>
      </div>
    );
  }

  const totalToReceive = lines.reduce((s, l) => s + parseFloat(l.inputQty || '0'), 0);

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Button
          variant="outline"
          size="icon"
          onClick={() => router.push(`/dashboard/purchasing/purchase-orders/${orderId}` as never)}
          className="shrink-0"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">Registrar Recepción</h1>
            <Badge variant="outline" className="border-blue-300 text-xs text-blue-700">
              {order.orderNumber}
            </Badge>
          </div>
          <p className="text-muted-foreground mt-1 text-sm">
            Proveedor: <span className="font-medium">{order.supplierName}</span>
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PackageCheck className="h-5 w-5" />
            Cantidades Recibidas
          </CardTitle>
          <CardDescription>
            Ingresa la cantidad recibida por cada línea. Deja en 0 las líneas no recibidas.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-3 py-2 text-left">Producto</th>
                  <th className="px-3 py-2 text-right">Pedida</th>
                  <th className="px-3 py-2 text-right">Ya recibida</th>
                  <th className="px-3 py-2 text-right">Pendiente</th>
                  <th className="px-3 py-2 text-right">Recibir ahora</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l) => (
                  <tr key={l.lineId} className="border-t">
                    <td className="px-3 py-2">
                      <p className="font-medium">{l.productName}</p>
                      <p className="text-muted-foreground font-mono text-xs">{l.productCode}</p>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{l.qtyOrdered.toFixed(4)}</td>
                    <td className="px-3 py-2 text-right text-green-600 tabular-nums">
                      {l.qtyReceived.toFixed(4)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      <span
                        className={
                          l.qtyPending > 0 ? 'font-medium text-amber-600' : 'text-muted-foreground'
                        }
                      >
                        {l.qtyPending.toFixed(4)}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Input
                        type="number"
                        min="0"
                        step="0.0001"
                        className="h-8 w-28 text-right"
                        value={l.inputQty}
                        onChange={(e) => updateLine(l.lineId, e.target.value)}
                        disabled={l.qtyPending <= 0}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-muted/30 border-t">
                  <td colSpan={4} className="px-3 py-2 text-right text-xs font-semibold uppercase">
                    Total a recibir:
                  </td>
                  <td className="px-3 py-2 text-right font-bold tabular-nums">
                    {totalToReceive.toFixed(4)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="mt-4 flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={() =>
                router.push(`/dashboard/purchasing/purchase-orders/${orderId}` as never)
              }
            >
              Cancelar
            </Button>
            <Button onClick={handleReceive} disabled={saving || totalToReceive <= 0}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <PackageCheck className="mr-2 h-4 w-4" />
              {saving ? 'Registrando...' : 'Confirmar Recepción'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Order summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Resumen de la Orden</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm sm:grid-cols-3">
          <div>
            <p className="text-muted-foreground text-xs uppercase">Orden</p>
            <p className="font-mono font-medium">{order.orderNumber}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs uppercase">Fecha esperada</p>
            <p>{new Date(order.expectedDate).toLocaleDateString('es-HN')}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs uppercase">Total</p>
            <p className="font-semibold">{fmtL(order.total)}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
