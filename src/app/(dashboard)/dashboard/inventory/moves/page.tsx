'use client';

// src/app/(dashboard)/dashboard/inventory/moves/page.tsx
import { useCallback, useEffect, useState } from 'react';
import { RefreshCw, ArrowRight, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface StockMoveRow {
  id: string;
  productCode: string;
  productName: string;
  fromLocationName: string;
  toLocationName: string;
  state: 'DRAFT' | 'CONFIRMED' | 'DONE' | 'CANCELLED';
  qtyDemand: string;
  qtyDone: string;
  reference: string | null;
  scheduledDate: string;
  doneDate: string | null;
  createdAt: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATE_LABELS: Record<StockMoveRow['state'], string> = {
  DRAFT: 'Borrador',
  CONFIRMED: 'Confirmado',
  DONE: 'Completado',
  CANCELLED: 'Cancelado',
};

const STATE_VARIANT: Record<
  StockMoveRow['state'],
  'default' | 'secondary' | 'outline' | 'destructive'
> = {
  DRAFT: 'secondary',
  CONFIRMED: 'outline',
  DONE: 'default',
  CANCELLED: 'destructive',
};

function getMoveType(reference: string | null): string {
  if (!reference) return 'Movimiento';
  if (reference.startsWith('REC')) return 'Recepción';
  if (reference.startsWith('DEL')) return 'Despacho';
  if (reference.startsWith('ADJ')) return 'Ajuste';
  if (reference.startsWith('INV')) return 'Inventario';
  return 'Movimiento';
}

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('es-HN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function MovesPage() {
  const [moves, setMoves] = useState<StockMoveRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [stateFilter, setStateFilter] = useState('');
  const [limit, setLimit] = useState('50');

  const fetchMoves = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit });
      if (stateFilter) params.set('state', stateFilter);
      const res = await fetch(`/api/v1/inventory/moves?${params}`, { credentials: 'include' });
      if (!res.ok) return;
      const data = (await res.json()) as { success: boolean; data: StockMoveRow[] };
      if (data.success) setMoves(data.data);
    } finally {
      setLoading(false);
    }
  }, [stateFilter, limit]);

  useEffect(() => {
    void fetchMoves();
  }, [fetchMoves]);

  const doneCount = moves.filter((m) => m.state === 'DONE').length;
  const totalQtyDone = moves
    .filter((m) => m.state === 'DONE')
    .reduce((s, m) => s + parseFloat(m.qtyDone), 0);

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Movimientos de Stock</h1>
          <p className="text-muted-foreground text-sm">
            Historial de recepciones, despachos y ajustes de inventario
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void fetchMoves()} disabled={loading}>
          <RefreshCw className={`mr-1 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Actualizar
        </Button>
      </div>

      {/* Summary */}
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: 'Movimientos', value: moves.length.toString(), color: '' },
          { label: 'Completados', value: doneCount.toString(), color: 'text-green-600' },
          {
            label: 'Unidades movidas',
            value: totalQtyDone.toFixed(2),
            color: 'text-blue-600',
          },
        ].map(({ label, value, color }) => (
          <Card key={label}>
            <div className="p-4">
              <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                {label}
              </p>
              <p className={`mt-1 text-2xl font-bold tabular-nums ${color}`}>{value}</p>
            </div>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Select value={stateFilter} onValueChange={(v) => setStateFilter(v === 'ALL' ? '' : v)}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Todos los estados" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos los estados</SelectItem>
            <SelectItem value="DONE">Completado</SelectItem>
            <SelectItem value="CONFIRMED">Confirmado</SelectItem>
            <SelectItem value="DRAFT">Borrador</SelectItem>
            <SelectItem value="CANCELLED">Cancelado</SelectItem>
          </SelectContent>
        </Select>

        <Select value={limit} onValueChange={setLimit}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="25">25 registros</SelectItem>
            <SelectItem value="50">50 registros</SelectItem>
            <SelectItem value="100">100 registros</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : moves.length === 0 ? (
            <div className="flex h-40 flex-col items-center justify-center gap-2">
              <Package className="text-muted-foreground h-8 w-8" />
              <p className="text-muted-foreground text-sm">Sin movimientos registrados</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    {[
                      { label: 'Referencia', cls: 'text-left' },
                      { label: 'Tipo', cls: 'text-left' },
                      { label: 'Producto', cls: 'text-left' },
                      { label: 'Origen → Destino', cls: 'text-left' },
                      { label: 'Cant. Dem.', cls: 'text-right' },
                      { label: 'Cant. Real', cls: 'text-right' },
                      { label: 'Estado', cls: 'text-center' },
                      { label: 'Fecha', cls: 'text-right' },
                    ].map(({ label, cls }) => (
                      <th
                        key={label}
                        className={`text-muted-foreground px-4 py-3 text-xs font-medium tracking-wide uppercase ${cls}`}
                      >
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {moves.map((m) => (
                    <tr key={m.id} className="hover:bg-muted/30 border-b transition-colors">
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs font-medium">{m.reference ?? '—'}</span>
                      </td>
                      <td className="text-muted-foreground px-4 py-3 text-xs">
                        {getMoveType(m.reference)}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium">{m.productName}</p>
                        <p className="text-muted-foreground font-mono text-xs">{m.productCode}</p>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 text-xs">
                          <span className="text-muted-foreground max-w-[100px] truncate">
                            {m.fromLocationName}
                          </span>
                          <ArrowRight className="text-muted-foreground h-3 w-3 shrink-0" />
                          <span className="text-muted-foreground max-w-[100px] truncate">
                            {m.toLocationName}
                          </span>
                        </div>
                      </td>
                      <td className="text-muted-foreground px-4 py-3 text-right tabular-nums">
                        {parseFloat(m.qtyDemand).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-right font-medium tabular-nums">
                        {parseFloat(m.qtyDone).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Badge variant={STATE_VARIANT[m.state]} className="text-xs">
                          {STATE_LABELS[m.state]}
                        </Badge>
                      </td>
                      <td className="text-muted-foreground px-4 py-3 text-right text-xs tabular-nums">
                        {m.doneDate ? fmtDate(m.doneDate) : fmtDate(m.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
