// src/app/(dashboard)/accounting/fiscal-years/page.tsx
'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus, CalendarDays, ChevronDown, ChevronRight, Power, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { FiscalYearForm } from '@/components/accounting/fiscal-year-form';
import { FiscalPeriodsPanel } from '@/components/accounting/fiscal-periods-panel';
import type {
  FiscalYearDetail,
  FiscalYearSummary,
} from '@/lib/services/accounting/fiscal-year.service';

// ─── Types ────────────────────────────────────────────────────────────────────

interface FiscalYearsApiResponse {
  success: boolean;
  data?: FiscalYearSummary[];
  error?: string;
}

interface FiscalYearDetailApiResponse {
  success: boolean;
  data?: FiscalYearDetail;
  error?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function YearStatusBadge({ status, isActive }: { status: string; isActive: boolean }) {
  if (isActive) {
    return (
      <Badge className="bg-green-100 text-xs text-green-800 hover:bg-green-100 dark:bg-green-900/30 dark:text-green-300">
        Activo
      </Badge>
    );
  }
  if (status === 'OPEN') {
    return (
      <Badge variant="outline" className="border-blue-300 text-xs text-blue-700">
        Abierto
      </Badge>
    );
  }
  if (status === 'CLOSED') {
    return (
      <Badge variant="outline" className="text-muted-foreground text-xs">
        Cerrado
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="border-gray-400 text-xs text-gray-500">
      Bloqueado
    </Badge>
  );
}

function ProgressBar({
  open,
  closed,
  locked,
  total,
}: {
  open: number;
  closed: number;
  locked: number;
  total: number;
}) {
  if (total === 0) return null;
  const pctOpen = (open / total) * 100;
  const pctClosed = (closed / total) * 100;
  const pctLocked = (locked / total) * 100;
  return (
    <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
      <div className="bg-green-400" style={{ width: `${pctOpen}%` }} title={`${open} abiertos`} />
      <div
        className="bg-yellow-400"
        style={{ width: `${pctClosed}%` }}
        title={`${closed} cerrados`}
      />
      <div
        className="bg-gray-400"
        style={{ width: `${pctLocked}%` }}
        title={`${locked} bloqueados`}
      />
    </div>
  );
}

// ─── Year Card ────────────────────────────────────────────────────────────────

interface YearCardProps {
  summary: FiscalYearSummary;
  onRefresh: () => void;
}

function YearCard({ summary, onRefresh }: YearCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [detail, setDetail] = useState<FiscalYearDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const loadDetail = async () => {
    if (detail) return; // already loaded
    setLoadingDetail(true);
    try {
      const res = await fetch(`/api/v1/accounting/fiscal-years/${summary.id}`, {
        credentials: 'include',
        cache: 'no-store',
      });
      const payload = (await res.json()) as FiscalYearDetailApiResponse;
      if (payload.success && payload.data) setDetail(payload.data);
    } catch {
      toast.error('Error al cargar los períodos');
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleToggle = () => {
    if (!expanded) void loadDetail();
    setExpanded((v) => !v);
  };

  const refreshDetail = async () => {
    setDetail(null); // force reload
    setLoadingDetail(true);
    try {
      const res = await fetch(`/api/v1/accounting/fiscal-years/${summary.id}`, {
        credentials: 'include',
        cache: 'no-store',
      });
      const payload = (await res.json()) as FiscalYearDetailApiResponse;
      if (payload.success && payload.data) setDetail(payload.data);
    } catch {
      toast.error('Error al recargar los períodos');
    } finally {
      setLoadingDetail(false);
    }
    onRefresh();
  };

  const doYearAction = async (endpoint: string, successMsg: string) => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/v1/accounting/fiscal-years/${summary.id}/${endpoint}`, {
        method: 'POST',
        credentials: 'include',
      });
      const payload = (await res.json()) as { success: boolean; error?: string };
      if (!res.ok || !payload.success) {
        toast.error('Error', { description: payload.error });
        return;
      }
      toast.success(successMsg);
      onRefresh();
    } catch {
      toast.error('Error de conexión');
    } finally {
      setActionLoading(false);
    }
  };

  const formatDate = (d: Date) =>
    new Date(d).toLocaleDateString('es-HN', { day: '2-digit', month: 'short', year: 'numeric' });

  return (
    <Card className={summary.isActive ? 'ring-primary ring-1' : ''}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          {/* Left: title + meta */}
          <button
            className="flex flex-1 items-center gap-3 text-left"
            onClick={handleToggle}
            aria-expanded={expanded}
          >
            <span className="flex items-center gap-1.5 text-sm font-medium">
              {expanded ? (
                <ChevronDown className="text-muted-foreground h-4 w-4" />
              ) : (
                <ChevronRight className="text-muted-foreground h-4 w-4" />
              )}
              Ejercicio {summary.year}
            </span>
            <YearStatusBadge status={summary.status} isActive={summary.isActive} />
            <span className="text-muted-foreground text-xs">
              {formatDate(summary.startDate)} — {formatDate(summary.endDate)}
            </span>
          </button>

          {/* Right: actions */}
          <div className="flex shrink-0 gap-2">
            {/* Activate */}
            {!summary.isActive && summary.status === 'OPEN' && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                disabled={actionLoading}
                onClick={() => void doYearAction('activate', `Ejercicio ${summary.year} activado`)}
              >
                <Power className="mr-1 h-3 w-3" />
                Activar
              </Button>
            )}

            {/* Close year */}
            {summary.status === 'OPEN' && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    disabled={actionLoading}
                  >
                    <XCircle className="mr-1 h-3 w-3" />
                    Cerrar año
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Cerrar Ejercicio {summary.year}</AlertDialogTitle>
                    <AlertDialogDescription>
                      Esta acción cerrará todos los períodos ABIERTOS del ejercicio{' '}
                      <strong>{summary.year}</strong> ({summary.periodsOpen} período
                      {summary.periodsOpen !== 1 ? 's' : ''}) y marcará el año como CERRADO.
                      {summary.isActive && (
                        <span className="mt-1 block text-yellow-600 dark:text-yellow-400">
                          El año activo será desactivado.
                        </span>
                      )}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() =>
                        void doYearAction('close', `Ejercicio ${summary.year} cerrado`)
                      }
                    >
                      Cerrar ejercicio
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>

        {/* Period progress bar */}
        <div className="space-y-1 pt-1">
          <ProgressBar
            open={summary.periodsOpen}
            closed={summary.periodsClosed}
            locked={summary.periodsLocked}
            total={summary.periodsTotal}
          />
          <p className="text-muted-foreground text-xs">
            {summary.periodsOpen} abierto{summary.periodsOpen !== 1 ? 's' : ''} ·{' '}
            {summary.periodsClosed} cerrado{summary.periodsClosed !== 1 ? 's' : ''} ·{' '}
            {summary.periodsLocked} bloqueado{summary.periodsLocked !== 1 ? 's' : ''}
          </p>
        </div>
      </CardHeader>

      {/* Periods panel */}
      {expanded && (
        <CardContent className="border-t p-0">
          {loadingDetail ? (
            <div className="flex items-center justify-center py-8">
              <div className="border-primary h-6 w-6 animate-spin rounded-full border-2 border-t-transparent" />
            </div>
          ) : detail ? (
            <FiscalPeriodsPanel
              yearId={summary.id}
              yearStatus={summary.status}
              periods={detail.periods}
              onUpdated={refreshDetail}
            />
          ) : null}
        </CardContent>
      )}
    </Card>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function FiscalYearsPage() {
  const [years, setYears] = useState<FiscalYearSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  const fetchYears = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/accounting/fiscal-years', {
        credentials: 'include',
        cache: 'no-store',
      });
      const payload = (await res.json()) as FiscalYearsApiResponse;
      if (!res.ok || !payload.success) {
        setError(payload.error ?? 'Error al cargar los años fiscales');
        return;
      }
      setYears(payload.data ?? []);
    } catch {
      setError('Error de conexión. Verifica tu red e intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchYears();
  }, [fetchYears]);

  // ── Loading ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-4 p-6">
        <div className="flex items-center justify-between">
          <div className="bg-muted h-7 w-48 animate-pulse rounded" />
          <div className="bg-muted h-9 w-36 animate-pulse rounded" />
        </div>
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="bg-muted h-24 animate-pulse rounded-lg" />
        ))}
      </div>
    );
  }

  // ── Error ──────────────────────────────────────────────────────────────────

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center">
        <CalendarDays className="text-muted-foreground mb-3 h-10 w-10" />
        <p className="font-medium">{error}</p>
        <button
          onClick={() => void fetchYears()}
          className="text-primary mt-2 text-sm underline-offset-2 hover:underline"
        >
          Reintentar
        </button>
      </div>
    );
  }

  // ── Main ───────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Años Fiscales</h1>
          <p className="text-muted-foreground text-sm">
            Gestión de ejercicios contables y períodos fiscales mensuales
          </p>
        </div>
        <Button onClick={() => setFormOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Nuevo Año Fiscal
        </Button>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs">
        <span className="text-muted-foreground">Períodos:</span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-4 rounded-sm bg-green-400" /> Abiertos
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-4 rounded-sm bg-yellow-400" /> Cerrados
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-4 rounded-sm bg-gray-400" /> Bloqueados
        </span>
      </div>

      {/* Years list */}
      {years.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <CalendarDays className="text-muted-foreground mb-3 h-10 w-10" />
            <p className="font-medium">No hay años fiscales registrados</p>
            <p className="text-muted-foreground mt-1 text-sm">
              Crea el primer ejercicio contable para tu empresa.
            </p>
            <Button className="mt-4" onClick={() => setFormOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Crear primer año fiscal
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {years.map((year) => (
            <YearCard key={year.id} summary={year} onRefresh={fetchYears} />
          ))}
        </div>
      )}

      <FiscalYearForm open={formOpen} onOpenChange={setFormOpen} onCreated={fetchYears} />
    </div>
  );
}
