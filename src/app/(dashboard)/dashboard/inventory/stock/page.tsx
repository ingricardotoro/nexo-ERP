'use client';

// src/app/(dashboard)/dashboard/inventory/stock/page.tsx
import { useCallback, useEffect, useState } from 'react';
import { RefreshCw, Search, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface StockRow {
  productId: string;
  productCode: string;
  productName: string;
  categoryName: string | null;
  uomSymbol: string;
  uomName: string;
  qtyOnHand: string;
  qtyReserved: string;
  qtyAvailable: string;
  costPrice: string;
  stockValue: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtL = (v: string | number) =>
  'L ' +
  parseFloat(String(v)).toLocaleString('es-HN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function StockPage() {
  const [rows, setRows] = useState<StockRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const fetchStock = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set('search', debouncedSearch);
      const res = await fetch(`/api/v1/inventory/stock?${params}`, { credentials: 'include' });
      if (!res.ok) return;
      const data = (await res.json()) as { success: boolean; data: StockRow[] };
      if (data.success) setRows(data.data);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch]);

  useEffect(() => {
    void fetchStock();
  }, [fetchStock]);

  const grandTotal = rows.reduce((s, r) => s + parseFloat(r.stockValue), 0);
  const totalProducts = rows.length;
  const productsWithStock = rows.filter((r) => parseFloat(r.qtyOnHand) > 0).length;

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Stock On-Hand</h1>
          <p className="text-muted-foreground text-sm">Existencias actuales por producto</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void fetchStock()} disabled={loading}>
          <RefreshCw className={`mr-1 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Actualizar
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: 'Productos activos', value: totalProducts.toString(), color: '' },
          {
            label: 'Con existencias',
            value: productsWithStock.toString(),
            color: 'text-green-600',
          },
          { label: 'Valor total', value: fmtL(grandTotal), color: 'text-blue-600' },
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

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="text-muted-foreground absolute top-2.5 left-3 h-4 w-4" />
        <Input
          placeholder="Buscar por producto o código..."
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
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
          ) : rows.length === 0 ? (
            <div className="flex h-40 flex-col items-center justify-center gap-2">
              <Package className="text-muted-foreground h-8 w-8" />
              <p className="text-muted-foreground text-sm">No hay productos registrados</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    {[
                      { label: 'Producto', cls: 'text-left' },
                      { label: 'Categoría', cls: 'text-left' },
                      { label: 'Disponible', cls: 'text-right' },
                      { label: 'Reservado', cls: 'text-right' },
                      { label: 'Total', cls: 'text-right' },
                      { label: 'Costo Unit.', cls: 'text-right' },
                      { label: 'Valor Stock', cls: 'text-right' },
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
                  {rows.map((r) => (
                    <tr key={r.productId} className="hover:bg-muted/30 border-b transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-medium">{r.productName}</p>
                        <p className="text-muted-foreground font-mono text-xs">{r.productCode}</p>
                      </td>
                      <td className="text-muted-foreground px-4 py-3 text-sm">
                        {r.categoryName ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        <span
                          className={
                            parseFloat(r.qtyAvailable) > 0
                              ? 'font-medium text-green-600'
                              : 'text-muted-foreground'
                          }
                        >
                          {parseFloat(r.qtyAvailable).toFixed(2)} {r.uomSymbol}
                        </span>
                      </td>
                      <td className="text-muted-foreground px-4 py-3 text-right tabular-nums">
                        {parseFloat(r.qtyReserved).toFixed(2)} {r.uomSymbol}
                      </td>
                      <td className="px-4 py-3 text-right font-medium tabular-nums">
                        {parseFloat(r.qtyOnHand).toFixed(2)} {r.uomSymbol}
                      </td>
                      <td className="text-muted-foreground px-4 py-3 text-right tabular-nums">
                        {fmtL(r.costPrice)}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums">
                        {fmtL(r.stockValue)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-muted/30 border-t">
                    <td
                      colSpan={6}
                      className="px-4 py-3 text-right text-xs font-semibold uppercase"
                    >
                      Valor total del inventario:
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-blue-600 tabular-nums">
                      {fmtL(grandTotal)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
