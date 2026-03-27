'use client';

// src/components/accounting/fiscal-periods-panel.tsx
import { useState } from 'react';
import { Lock, X, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import type { FiscalPeriodRow } from '@/lib/services/accounting/fiscal-year.service';

// ─── Types ────────────────────────────────────────────────────────────────────

interface FiscalPeriodsPanelProps {
  yearId: string;
  yearStatus: string;
  periods: FiscalPeriodRow[];
  onUpdated: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  if (status === 'OPEN') {
    return (
      <Badge
        variant="outline"
        className="border-green-300 text-xs text-green-700 dark:text-green-400"
      >
        Abierto
      </Badge>
    );
  }
  if (status === 'CLOSED') {
    return (
      <Badge
        variant="outline"
        className="border-yellow-300 text-xs text-yellow-700 dark:text-yellow-400"
      >
        Cerrado
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="border-gray-400 text-xs text-gray-600 dark:text-gray-400">
      Bloqueado
    </Badge>
  );
}

// ─── Row actions ─────────────────────────────────────────────────────────────

interface PeriodActionsProps {
  period: FiscalPeriodRow;
  yearId: string;
  yearStatus: string;
  onUpdated: () => void;
}

function PeriodActions({ period, yearId, yearStatus, onUpdated }: PeriodActionsProps) {
  const [loading, setLoading] = useState(false);

  const yearClosed = yearStatus === 'CLOSED' || yearStatus === 'LOCKED';

  const doAction = async (action: 'close' | 'lock') => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/v1/accounting/fiscal-years/${yearId}/periods/${period.id}`,
        {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action }),
        },
      );
      const payload = (await response.json()) as {
        success: boolean;
        error?: string;
        message?: string;
      };

      if (!response.ok || !payload.success) {
        toast.error('Error', { description: payload.error });
        return;
      }

      toast.success(payload.message ?? 'Período actualizado');
      onUpdated();
    } catch {
      toast.error('Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  if (period.status === 'LOCKED' || yearClosed) return null;

  if (period.status === 'OPEN') {
    return (
      <Button
        size="sm"
        variant="outline"
        className="h-7 text-xs"
        disabled={loading}
        onClick={() => void doAction('close')}
      >
        <X className="mr-1 h-3 w-3" />
        Cerrar
      </Button>
    );
  }

  // CLOSED → Lock (irreversible, needs confirm)
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button size="sm" variant="outline" className="h-7 text-xs" disabled={loading}>
          <Lock className="mr-1 h-3 w-3" />
          Bloquear
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Bloquear período</AlertDialogTitle>
          <AlertDialogDescription>
            ¿Estás seguro? Bloquear <strong>{period.name}</strong> es una operación{' '}
            <strong>irreversible</strong>. No se podrán registrar ni modificar asientos en este
            período.
            {period.journalEntriesCount > 0 && (
              <span className="mt-1 block">
                Este período tiene <strong>{period.journalEntriesCount}</strong> asiento(s)
                registrado(s).
              </span>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={() => void doAction('lock')}
          >
            Bloquear período
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function FiscalPeriodsPanel({
  yearId,
  yearStatus,
  periods,
  onUpdated,
}: FiscalPeriodsPanelProps) {
  if (periods.length === 0) {
    return (
      <p className="text-muted-foreground py-4 text-center text-sm">
        No hay períodos generados para este año fiscal.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b">
            <th className="text-muted-foreground px-4 py-2 text-left text-xs font-medium uppercase">
              #
            </th>
            <th className="text-muted-foreground px-4 py-2 text-left text-xs font-medium uppercase">
              Período
            </th>
            <th className="text-muted-foreground hidden px-4 py-2 text-left text-xs font-medium uppercase sm:table-cell">
              Desde
            </th>
            <th className="text-muted-foreground hidden px-4 py-2 text-left text-xs font-medium uppercase sm:table-cell">
              Hasta
            </th>
            <th className="text-muted-foreground px-4 py-2 text-center text-xs font-medium uppercase">
              Estado
            </th>
            <th className="text-muted-foreground hidden px-4 py-2 text-center text-xs font-medium uppercase md:table-cell">
              Asientos
            </th>
            <th className="px-4 py-2" />
          </tr>
        </thead>
        <tbody>
          {periods.map((period) => (
            <tr
              key={period.id}
              className="hover:bg-muted/30 border-b transition-colors last:border-0"
            >
              <td className="text-muted-foreground px-4 py-2 text-center text-xs">
                {period.periodNumber}
              </td>
              <td className="px-4 py-2 font-medium">{period.name}</td>
              <td className="text-muted-foreground hidden px-4 py-2 text-xs sm:table-cell">
                {new Date(period.startDate).toLocaleDateString('es-HN')}
              </td>
              <td className="text-muted-foreground hidden px-4 py-2 text-xs sm:table-cell">
                {new Date(period.endDate).toLocaleDateString('es-HN')}
              </td>
              <td className="px-4 py-2 text-center">
                <StatusBadge status={period.status} />
              </td>
              <td className="text-muted-foreground hidden px-4 py-2 text-center text-sm md:table-cell">
                {period.journalEntriesCount > 0 ? (
                  <span className="flex items-center justify-center gap-1">
                    <CheckCircle className="h-3 w-3 text-green-500" />
                    {period.journalEntriesCount}
                  </span>
                ) : (
                  <span className="text-xs">—</span>
                )}
              </td>
              <td className="px-4 py-2 text-right">
                <PeriodActions
                  period={period}
                  yearId={yearId}
                  yearStatus={yearStatus}
                  onUpdated={onUpdated}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
