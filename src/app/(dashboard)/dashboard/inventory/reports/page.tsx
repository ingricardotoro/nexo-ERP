'use client';

// src/app/(dashboard)/dashboard/inventory/reports/page.tsx
import { useCallback, useEffect, useState } from 'react';
import { RefreshCw, Download, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
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

interface ValuationRow {
  productId: string;
  productCode: string;
  productName: string;
  categoryName: string | null;
  uomName: string;
  uomSymbol: string | null;
  costPrice: string;
  totalQty: number;
  totalValue: number;
}

interface ValuationData {
  rows: ValuationRow[];
  grandTotal: number;
  productCount: number;
}

interface Category {
  id: string;
  name: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtL = (v: number | string) =>
  'L ' +
  parseFloat(String(v)).toLocaleString('es-HN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

function exportCsv(rows: ValuationRow[], grandTotal: number) {
  const headers = ['Código', 'Producto', 'Categoría', 'UOM', 'Costo Unit.', 'Cantidad', 'Valor'];
  const lines = rows.map((r) =>
    [
      r.productCode,
      `"${r.productName.replace(/"/g, '""')}"`,
      r.categoryName ?? '',
      r.uomSymbol ?? r.uomName,
      r.costPrice,
      r.totalQty.toFixed(4),
      r.totalValue.toFixed(2),
    ].join(','),
  );
  lines.push(`,,,,, Total,${grandTotal.toFixed(2)}`);
  const csv = [headers.join(','), ...lines].join('\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `valoracion-inventario-${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function InventoryReportsPage() {
  const [data, setData] = useState<ValuationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [activeOnly, setActiveOnly] = useState('true');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ activeOnly });
      if (categoryFilter) params.set('categoryId', categoryFilter);
      const res = await fetch(`/api/v1/inventory/reports/valuation?${params}`, {
        credentials: 'include',
      });
      if (!res.ok) return;
      const payload = (await res.json()) as { success: boolean; data: ValuationData };
      if (payload.success) setData(payload.data);
    } finally {
      setLoading(false);
    }
  }, [categoryFilter, activeOnly]);

  const fetchCategories = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/inventory/products/categories', { credentials: 'include' });
      if (res.ok) {
        const d = (await res.json()) as { success: boolean; data: Category[] };
        if (d.success) setCategories(d.data);
      }
    } catch {
      // non-critical
    }
  }, []);

  useEffect(() => {
    void fetchData();
    void fetchCategories();
  }, [fetchData, fetchCategories]);

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Valorización de Inventario</h1>
          <p className="text-muted-foreground text-sm">
            Valor contable del inventario en ubicaciones internas
          </p>
        </div>
        <div className="flex gap-2">
          {data && data.rows.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportCsv(data.rows, data.grandTotal)}
            >
              <Download className="mr-1 h-4 w-4" />
              Exportar CSV
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => void fetchData()} disabled={loading}>
            <RefreshCw className={`mr-1 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <div className="p-4">
            <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              Productos con stock
            </p>
            <p className="mt-1 text-2xl font-bold">{loading ? '—' : (data?.productCount ?? 0)}</p>
          </div>
        </Card>
        <Card>
          <div className="p-4">
            <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              Valor total
            </p>
            <p className="mt-1 text-2xl font-bold text-blue-600 tabular-nums">
              {loading ? '—' : fmtL(data?.grandTotal ?? 0)}
            </p>
          </div>
        </Card>
        <Card>
          <div className="p-4">
            <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              Fecha del reporte
            </p>
            <p className="mt-1 text-2xl font-bold">{new Date().toLocaleDateString('es-HN')}</p>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Select
          value={categoryFilter}
          onValueChange={(v) => setCategoryFilter(v === 'ALL' ? '' : v)}
        >
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Todas las categorías" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todas las categorías</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={activeOnly} onValueChange={setActiveOnly}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="true">Solo activos</SelectItem>
            <SelectItem value="false">Todos</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : !data || data.rows.length === 0 ? (
            <div className="flex h-40 flex-col items-center justify-center gap-2">
              <BarChart3 className="text-muted-foreground h-8 w-8" />
              <p className="text-muted-foreground text-sm">Sin datos de inventario</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    {[
                      { label: 'Producto', cls: 'text-left' },
                      { label: 'Categoría', cls: 'text-left' },
                      { label: 'UOM', cls: 'text-left' },
                      { label: 'Costo Unit.', cls: 'text-right' },
                      { label: 'Cantidad', cls: 'text-right' },
                      { label: 'Valor', cls: 'text-right' },
                      { label: '% del Total', cls: 'text-right' },
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
                  {data.rows.map((r) => {
                    const pct =
                      data.grandTotal > 0
                        ? ((r.totalValue / data.grandTotal) * 100).toFixed(1)
                        : '0.0';
                    return (
                      <tr
                        key={r.productId}
                        className="hover:bg-muted/30 border-b transition-colors"
                      >
                        <td className="px-4 py-3">
                          <p className="font-medium">{r.productName}</p>
                          <p className="text-muted-foreground font-mono text-xs">{r.productCode}</p>
                        </td>
                        <td className="text-muted-foreground px-4 py-3 text-sm">
                          {r.categoryName ?? '—'}
                        </td>
                        <td className="text-muted-foreground px-4 py-3 text-sm">
                          {r.uomSymbol ?? r.uomName}
                        </td>
                        <td className="text-muted-foreground px-4 py-3 text-right tabular-nums">
                          {fmtL(r.costPrice)}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {r.totalQty.toFixed(4)}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold tabular-nums">
                          {fmtL(r.totalValue)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="bg-muted h-1.5 w-16 overflow-hidden rounded-full">
                              <div
                                className="h-full rounded-full bg-blue-500"
                                style={{ width: `${Math.min(parseFloat(pct), 100)}%` }}
                              />
                            </div>
                            <span className="text-muted-foreground w-10 text-right text-xs tabular-nums">
                              {pct}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-muted/30 border-t">
                    <td
                      colSpan={5}
                      className="px-4 py-3 text-right text-xs font-semibold uppercase"
                    >
                      Valor total:
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-blue-600 tabular-nums">
                      {fmtL(data.grandTotal)}
                    </td>
                    <td />
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
