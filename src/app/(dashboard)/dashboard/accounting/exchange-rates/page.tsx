'use client';

// src/app/(dashboard)/accounting/exchange-rates/page.tsx
import { useCallback, useEffect, useState } from 'react';
import { Plus, Trash2, Globe, Building2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { Badge } from '@/components/ui/badge';
import { ExchangeRateForm } from '@/components/accounting/exchange-rate-form';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ExchangeRateRow {
  id: string;
  currencyCode: string;
  currencyName: string;
  currencySymbol: string;
  date: string;
  rate: string;
  source: string | null;
  isGlobal: boolean;
}

interface ListResult {
  data: ExchangeRateRow[];
  total: number;
  page: number;
  totalPages: number;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ExchangeRatesPage() {
  const [rates, setRates] = useState<ExchangeRateRow[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [currencyFilter, setCurrencyFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const fetchRates = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (currencyFilter) params.set('currencyCode', currencyFilter.toUpperCase());
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);

      const res = await fetch(`/api/v1/accounting/exchange-rates?${params.toString()}`, {
        credentials: 'include',
      });
      const payload = (await res.json()) as ListResult & { success: boolean };
      if (payload.success) {
        setRates(payload.data ?? []);
        setTotal(payload.total ?? 0);
        setTotalPages(payload.totalPages ?? 1);
      }
    } catch {
      toast.error('Error al cargar tipos de cambio');
    } finally {
      setIsLoading(false);
    }
  }, [page, currencyFilter, dateFrom, dateTo]);

  useEffect(() => {
    void fetchRates();
  }, [fetchRates]);

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      const res = await fetch(`/api/v1/accounting/exchange-rates/${deleteId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const payload = (await res.json()) as { success: boolean; error?: string };
      if (!res.ok || !payload.success) {
        toast.error('Error al eliminar', { description: payload.error });
        return;
      }
      toast.success('Tipo de cambio eliminado');
      void fetchRates();
    } catch {
      toast.error('Error de conexión');
    } finally {
      setDeleteId(null);
    }
  };

  const formatRate = (rate: string, currencyCode: string) => {
    const n = parseFloat(rate);
    return `1 ${currencyCode} = L ${n.toLocaleString('es-HN', { minimumFractionDigits: 4, maximumFractionDigits: 6 })}`;
  };

  const formatDate = (dateStr: string) =>
    new Date(dateStr + 'T00:00:00').toLocaleDateString('es-HN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tipos de Cambio</h1>
          <p className="text-muted-foreground text-sm">
            Tasas de cambio respecto al Lempira hondureño (HNL)
          </p>
        </div>
        <Button onClick={() => setFormOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Nueva tasa
        </Button>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3">
        <Input
          placeholder="Moneda (ej: USD)"
          value={currencyFilter}
          onChange={(e) => {
            setCurrencyFilter(e.target.value);
            setPage(1);
          }}
          className="w-36 uppercase"
          maxLength={3}
        />
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-sm">Desde</span>
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => {
              setDateFrom(e.target.value);
              setPage(1);
            }}
            className="w-40"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-sm">Hasta</span>
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => {
              setDateTo(e.target.value);
              setPage(1);
            }}
            className="w-40"
          />
        </div>
        {(currencyFilter || dateFrom || dateTo) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setCurrencyFilter('');
              setDateFrom('');
              setDateTo('');
              setPage(1);
            }}
          >
            Limpiar
          </Button>
        )}
      </div>

      {/* Leyenda */}
      <div className="text-muted-foreground flex items-center gap-4 text-xs">
        <span className="flex items-center gap-1">
          <Building2 className="h-3.5 w-3.5" /> Tasa de tu empresa (editable)
        </span>
        <span className="flex items-center gap-1">
          <Globe className="h-3.5 w-3.5" /> Tasa global de plataforma (solo lectura)
        </span>
      </div>

      {/* Tabla */}
      <div className="rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50 border-b">
              <th className="px-4 py-3 text-left font-medium">Moneda</th>
              <th className="px-4 py-3 text-left font-medium">Fecha</th>
              <th className="px-4 py-3 text-left font-medium">Tasa</th>
              <th className="px-4 py-3 text-left font-medium">Fuente</th>
              <th className="px-4 py-3 text-left font-medium">Origen</th>
              <th className="px-4 py-3 text-right font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={6} className="text-muted-foreground px-4 py-8 text-center text-sm">
                  Cargando...
                </td>
              </tr>
            )}
            {!isLoading && rates.length === 0 && (
              <tr>
                <td colSpan={6} className="text-muted-foreground px-4 py-8 text-center text-sm">
                  No hay tasas de cambio registradas
                </td>
              </tr>
            )}
            {!isLoading &&
              rates.map((r) => (
                <tr
                  key={r.id}
                  className="hover:bg-muted/30 border-b transition-colors last:border-0"
                >
                  <td className="px-4 py-3">
                    <span className="font-semibold">{r.currencyCode}</span>
                    <span className="text-muted-foreground ml-1.5 text-xs">{r.currencyName}</span>
                  </td>
                  <td className="px-4 py-3 tabular-nums">{formatDate(r.date)}</td>
                  <td className="px-4 py-3 font-mono text-sm tabular-nums">
                    {formatRate(r.rate, r.currencyCode)}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-muted-foreground text-xs">{r.source ?? '—'}</span>
                  </td>
                  <td className="px-4 py-3">
                    {r.isGlobal ? (
                      <Badge variant="secondary" className="gap-1 text-xs">
                        <Globe className="h-3 w-3" />
                        Global
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="gap-1 text-xs">
                        <Building2 className="h-3 w-3" />
                        Empresa
                      </Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {!r.isGlobal && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive h-7 w-7 p-0"
                        onClick={() => setDeleteId(r.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {/* Paginación */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            {total} tasa{total !== 1 ? 's' : ''} · Página {page} de {totalPages}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Siguiente
            </Button>
          </div>
        </div>
      )}

      {/* Form dialog */}
      <ExchangeRateForm open={formOpen} onOpenChange={setFormOpen} onSaved={fetchRates} />

      {/* Confirm delete */}
      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar tipo de cambio?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Solo se pueden eliminar tasas propias de tu empresa.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
