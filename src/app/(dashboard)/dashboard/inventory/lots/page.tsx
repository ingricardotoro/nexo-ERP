'use client';

import { useCallback, useEffect, useState } from 'react';
import { Search, AlertTriangle, Clock, CheckCircle2, XCircle } from 'lucide-react';
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
import type { LotRow } from '@/lib/services/inventory/lot.service';

// ─── Constants ────────────────────────────────────────────────────────────────

const ALERT_CONFIG = {
  ok: {
    label: 'Vigente',
    color: 'border-green-300 text-green-700',
    icon: CheckCircle2,
    iconColor: 'text-green-500',
  },
  warning: {
    label: 'Por vencer',
    color: 'border-yellow-300 text-yellow-700',
    icon: Clock,
    iconColor: 'text-yellow-500',
  },
  critical: {
    label: 'Crítico',
    color: 'border-red-300 text-red-700',
    icon: AlertTriangle,
    iconColor: 'text-red-500',
  },
  expired: {
    label: 'Vencido',
    color: 'border-gray-400 text-gray-600 line-through',
    icon: XCircle,
    iconColor: 'text-gray-400',
  },
};

const fmtDate = (d: Date | string | null) =>
  d
    ? new Date(d).toLocaleDateString('es-HN', { day: '2-digit', month: 'short', year: 'numeric' })
    : '—';

const fmtQty = (q: string) =>
  parseFloat(q).toLocaleString('es-HN', { minimumFractionDigits: 2, maximumFractionDigits: 4 });

// ─── Expiry Alert Banner ──────────────────────────────────────────────────────

function ExpiryAlertBanner({ lots }: { lots: LotRow[] }) {
  const expired = lots.filter((l) => l.alertLevel === 'expired');
  const critical = lots.filter((l) => l.alertLevel === 'critical');
  const warning = lots.filter((l) => l.alertLevel === 'warning');

  if (!expired.length && !critical.length && !warning.length) return null;

  return (
    <div className="space-y-2">
      {expired.length > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <XCircle className="h-5 w-5 shrink-0 text-red-500" />
          <p className="text-sm text-red-800">
            <span className="font-semibold">
              {expired.length} lote{expired.length > 1 ? 's' : ''} vencido
              {expired.length > 1 ? 's' : ''}
            </span>{' '}
            con stock disponible. Revisar y ajustar.
          </p>
        </div>
      )}
      {critical.length > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-orange-200 bg-orange-50 px-4 py-3">
          <AlertTriangle className="h-5 w-5 shrink-0 text-orange-500" />
          <p className="text-sm text-orange-800">
            <span className="font-semibold">
              {critical.length} lote{critical.length > 1 ? 's' : ''}
            </span>{' '}
            vencen en menos de 15 días.
          </p>
        </div>
      )}
      {warning.length > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3">
          <Clock className="h-5 w-5 shrink-0 text-yellow-500" />
          <p className="text-sm text-yellow-800">
            <span className="font-semibold">
              {warning.length} lote{warning.length > 1 ? 's' : ''}
            </span>{' '}
            vencen en menos de 30 días.
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Lot Row ──────────────────────────────────────────────────────────────────

function LotTableRow({ lot }: { lot: LotRow }) {
  const cfg = ALERT_CONFIG[lot.alertLevel];
  const AlertIcon = cfg.icon;

  return (
    <tr className="hover:bg-muted/30 border-b transition-colors last:border-0">
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <AlertIcon className={`h-4 w-4 shrink-0 ${cfg.iconColor}`} />
          <div>
            <p className="font-mono text-sm font-medium">{lot.lotNumber}</p>
            <p className="text-muted-foreground text-xs">
              {lot.productCode} — {lot.productName}
            </p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3 text-sm">{fmtDate(lot.manufacturingDate)}</td>
      <td className="px-4 py-3">
        {lot.expirationDate ? (
          <div>
            <p className={`text-sm ${lot.alertLevel !== 'ok' ? 'font-semibold' : ''}`}>
              {fmtDate(lot.expirationDate)}
            </p>
            {lot.daysUntilExpiry !== null && (
              <p className={`text-xs ${cfg.iconColor}`}>
                {lot.daysUntilExpiry < 0
                  ? `Vencido hace ${Math.abs(lot.daysUntilExpiry)} días`
                  : `${lot.daysUntilExpiry} días restantes`}
              </p>
            )}
          </div>
        ) : (
          <span className="text-muted-foreground text-sm">—</span>
        )}
      </td>
      <td className="px-4 py-3 text-right text-sm font-medium tabular-nums">
        {fmtQty(lot.totalStock)}
      </td>
      <td className="px-4 py-3 text-sm">{lot.supplierName ?? '—'}</td>
      <td className="px-4 py-3">
        <Badge variant="outline" className={`text-xs ${cfg.color}`}>
          {cfg.label}
        </Badge>
      </td>
    </tr>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LotsPage() {
  const [lots, setLots] = useState<LotRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [alertFilter, setAlertFilter] = useState('');
  const [withStockOnly, setWithStockOnly] = useState(true);

  const fetchLots = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ activeOnly: 'true' });
      if (search) params.set('search', search);
      if (withStockOnly) params.set('withStockOnly', 'true');

      const res = await fetch(`/api/v1/inventory/lots?${params}`, {
        credentials: 'include',
        cache: 'no-store',
      });
      const payload = (await res.json()) as { success: boolean; data: LotRow[]; error?: string };
      if (!res.ok || !payload.success) {
        toast.error(payload.error ?? 'Error al cargar lotes');
        return;
      }
      setLots(payload.data);
    } catch {
      toast.error('Error de conexión');
    } finally {
      setLoading(false);
    }
  }, [search, withStockOnly]);

  useEffect(() => {
    void fetchLots();
  }, [fetchLots]);

  const filtered = alertFilter ? lots.filter((l) => l.alertLevel === alertFilter) : lots;

  const expiredCount = lots.filter((l) => l.alertLevel === 'expired').length;
  const criticalCount = lots.filter((l) => l.alertLevel === 'critical').length;
  const warningCount = lots.filter((l) => l.alertLevel === 'warning').length;

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Lotes y Series</h1>
          <p className="text-muted-foreground text-sm">
            Trazabilidad de lotes con alertas FEFO (First Expiry First Out)
          </p>
        </div>
      </div>

      {/* Expiry alerts */}
      <ExpiryAlertBanner lots={lots} />

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: 'Total lotes', value: lots.length, color: '' },
          { label: 'Vencidos', value: expiredCount, color: expiredCount > 0 ? 'text-red-600' : '' },
          {
            label: 'Críticos',
            value: criticalCount,
            color: criticalCount > 0 ? 'text-orange-600' : '',
          },
          {
            label: 'Por vencer',
            value: warningCount,
            color: warningCount > 0 ? 'text-yellow-600' : '',
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
            placeholder="Buscar lote, producto o código..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={alertFilter} onValueChange={(v) => setAlertFilter(v === 'ALL' ? '' : v)}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Estado..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos</SelectItem>
            <SelectItem value="ok">Vigentes</SelectItem>
            <SelectItem value="warning">Por vencer</SelectItem>
            <SelectItem value="critical">Críticos</SelectItem>
            <SelectItem value="expired">Vencidos</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant={withStockOnly ? 'default' : 'outline'}
          size="sm"
          onClick={() => setWithStockOnly((v) => !v)}
        >
          {withStockOnly ? 'Con stock' : 'Todos'}
        </Button>
      </div>

      {/* Table */}
      {loading && !lots.length ? (
        <div className="bg-muted h-48 animate-pulse rounded-lg" />
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <CheckCircle2 className="text-muted-foreground mb-3 h-10 w-10" />
            <p className="font-medium">
              {lots.length === 0 ? 'No hay lotes registrados' : 'No hay lotes con ese filtro'}
            </p>
            <p className="text-muted-foreground mt-1 text-sm">
              Los lotes se crean automáticamente al registrar recepciones de productos con rastreo
              LOT o SERIAL.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  {['Lote / Producto', 'Fab.', 'Vencimiento', 'Stock', 'Proveedor', 'Estado'].map(
                    (h) => (
                      <th
                        key={h}
                        className="text-muted-foreground px-4 py-3 text-left text-xs font-medium uppercase"
                      >
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {filtered.map((lot) => (
                  <LotTableRow key={lot.id} lot={lot} />
                ))}
              </tbody>
            </table>
          </div>
          <div className="border-t px-4 py-2">
            <p className="text-muted-foreground text-xs">
              {filtered.length} lote{filtered.length !== 1 ? 's' : ''} — ordenados FEFO (vencimiento
              más próximo primero)
            </p>
          </div>
        </Card>
      )}
    </div>
  );
}
