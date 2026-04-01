// src/app/(dashboard)/accounting/entries/page.tsx
'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus, BookOpen, CheckCircle2, XCircle, FileText, Search } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
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
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { JournalEntryForm } from '@/components/accounting/journal-entry-form';
import type {
  JournalEntrySummary,
  JournalEntryListResult,
} from '@/lib/services/accounting/journal-entry.service';

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Borrador',
  POSTED: 'Publicado',
  CANCELLED: 'Anulado',
};

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'border-yellow-300 text-yellow-700 dark:text-yellow-400',
  POSTED: 'border-green-300 text-green-700 dark:text-green-400',
  CANCELLED: 'border-gray-300 text-gray-500 dark:text-gray-400 line-through',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatMoney(val: string) {
  return `L ${parseFloat(val).toLocaleString('es-HN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(d: Date) {
  return new Date(d).toLocaleDateString('es-HN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

// ─── Entry Row ────────────────────────────────────────────────────────────────

function EntryRow({ entry, onRefresh }: { entry: JournalEntrySummary; onRefresh: () => void }) {
  const [loading, setLoading] = useState(false);

  const doAction = async (url: string, method: string, successMsg: string) => {
    setLoading(true);
    try {
      const res = await fetch(url, { method, credentials: 'include' });
      const payload = (await res.json()) as { success: boolean; error?: string; message?: string };
      if (!res.ok || !payload.success) {
        toast.error('Error', { description: payload.error });
        return;
      }
      toast.success(payload.message ?? successMsg);
      onRefresh();
    } catch {
      toast.error('Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  const isBalanced = Math.abs(parseFloat(entry.totalDebit) - parseFloat(entry.totalCredit)) < 0.01;

  return (
    <tr className="hover:bg-muted/30 border-b transition-colors last:border-0">
      <td className="px-4 py-3 text-sm">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground font-mono text-xs">
            {entry.journalCode}-{String(entry.entryNumber).padStart(4, '0')}
          </span>
        </div>
      </td>
      <td className="px-4 py-3 text-sm">{formatDate(entry.entryDate)}</td>
      <td className="max-w-[200px] px-4 py-3">
        <p className="truncate text-sm">{entry.description}</p>
        {entry.reference && (
          <p className="text-muted-foreground truncate text-xs">{entry.reference}</p>
        )}
      </td>
      <td className="hidden px-4 py-3 text-sm md:table-cell">{entry.fiscalPeriodName}</td>
      <td className="px-4 py-3 text-right text-sm font-medium">{formatMoney(entry.totalDebit)}</td>
      <td className="px-4 py-3">
        <Badge variant="outline" className={`text-xs ${STATUS_COLORS[entry.status] ?? ''}`}>
          {STATUS_LABELS[entry.status] ?? entry.status}
        </Badge>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-1">
          {/* Publicar */}
          {entry.status === 'DRAFT' && isBalanced && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs text-green-700"
                  disabled={loading}
                >
                  <CheckCircle2 className="mr-1 h-3 w-3" />
                  Publicar
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Publicar asiento</AlertDialogTitle>
                  <AlertDialogDescription>
                    Al publicar el asiento{' '}
                    <strong>
                      {entry.journalCode}-{String(entry.entryNumber).padStart(4, '0')}
                    </strong>
                    , quedará contabilizado y <strong>no podrá editarse</strong>. Solo podrá
                    anularse mediante un contraasiento.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-green-600 text-white hover:bg-green-700"
                    onClick={() =>
                      void doAction(
                        `/api/v1/accounting/journal-entries/${entry.id}/post`,
                        'POST',
                        'Asiento publicado',
                      )
                    }
                  >
                    Publicar
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}

          {/* Anular */}
          {entry.status === 'POSTED' && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-destructive h-7 text-xs"
                  disabled={loading}
                >
                  <XCircle className="mr-1 h-3 w-3" />
                  Anular
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Anular asiento</AlertDialogTitle>
                  <AlertDialogDescription>
                    Se generará un <strong>contraasiento</strong> que revierte el efecto contable de{' '}
                    <strong>
                      {entry.journalCode}-{String(entry.entryNumber).padStart(4, '0')}
                    </strong>
                    . Esta operación queda registrada en la pista de auditoría.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    onClick={() =>
                      void doAction(
                        `/api/v1/accounting/journal-entries/${entry.id}/cancel`,
                        'POST',
                        'Asiento anulado',
                      )
                    }
                  >
                    Anular y generar contraasiento
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}

          {/* Eliminar borrador */}
          {entry.status === 'DRAFT' && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive hover:text-destructive h-7 w-7 p-0"
                  disabled={loading}
                >
                  <XCircle className="h-3.5 w-3.5" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Eliminar borrador</AlertDialogTitle>
                  <AlertDialogDescription>
                    ¿Eliminar el borrador{' '}
                    <strong>
                      {entry.journalCode}-{String(entry.entryNumber).padStart(4, '0')}
                    </strong>
                    ? Esta acción no se puede deshacer.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    onClick={() =>
                      void doAction(
                        `/api/v1/accounting/journal-entries/${entry.id}`,
                        'DELETE',
                        'Borrador eliminado',
                      )
                    }
                  >
                    Eliminar
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </td>
    </tr>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function JournalEntriesPage() {
  const [result, setResult] = useState<JournalEntryListResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  // Filtros
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (search) params.set('search', search);
      if (statusFilter) params.set('status', statusFilter);

      const res = await fetch(`/api/v1/accounting/journal-entries?${params.toString()}`, {
        credentials: 'include',
        cache: 'no-store',
      });
      const payload = (await res.json()) as JournalEntryListResult & {
        success: boolean;
        error?: string;
      };
      if (!res.ok || !payload.success) {
        setError(payload.error ?? 'Error al cargar los asientos');
        return;
      }
      setResult(payload);
    } catch {
      setError('Error de conexión. Verifica tu red e intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter]);

  useEffect(() => {
    void fetchEntries();
  }, [fetchEntries]);

  // Stats rápidas
  const entries = result?.entries ?? [];
  const drafts = entries.filter((e) => e.status === 'DRAFT').length;
  const posted = entries.filter((e) => e.status === 'POSTED').length;

  // ── Loading ──────────────────────────────────────────────────────────────

  if (loading && !result) {
    return (
      <div className="space-y-4 p-6">
        <div className="flex items-center justify-between">
          <div className="bg-muted h-7 w-48 animate-pulse rounded" />
          <div className="bg-muted h-9 w-40 animate-pulse rounded" />
        </div>
        <div className="bg-muted h-64 animate-pulse rounded-lg" />
      </div>
    );
  }

  // ── Error ────────────────────────────────────────────────────────────────

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center">
        <BookOpen className="text-muted-foreground mb-3 h-10 w-10" />
        <p className="font-medium">{error}</p>
        <button
          onClick={() => void fetchEntries()}
          className="text-primary mt-2 text-sm underline-offset-2 hover:underline"
        >
          Reintentar
        </button>
      </div>
    );
  }

  const pagination = result?.pagination;

  // ── Main ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Asientos Contables</h1>
          <p className="text-muted-foreground text-sm">
            Registro de partidas dobles por diario y período fiscal
          </p>
        </div>
        <Button onClick={() => setFormOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Nuevo Asiento
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <CardHeader className="pt-4 pb-1">
            <CardTitle className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              Total (página)
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-4">
            <p className="text-2xl font-bold">{pagination?.total ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pt-4 pb-1">
            <CardTitle className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              Borradores
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-4">
            <p className="text-2xl font-bold text-yellow-600">{drafts}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pt-4 pb-1">
            <CardTitle className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              Publicados
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-4">
            <p className="text-2xl font-bold text-green-600">{posted}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pt-4 pb-1">
            <CardTitle className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              Páginas
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-4">
            <p className="text-2xl font-bold">
              {page}/{pagination?.totalPages ?? 1}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3">
        <div className="relative min-w-[200px] flex-1">
          <Search className="text-muted-foreground absolute top-2.5 left-3 h-4 w-4" />
          <Input
            placeholder="Buscar descripción o referencia..."
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
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Estado..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos</SelectItem>
            <SelectItem value="DRAFT">Borrador</SelectItem>
            <SelectItem value="POSTED">Publicado</SelectItem>
            <SelectItem value="CANCELLED">Anulado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {entries.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="text-muted-foreground mb-3 h-10 w-10" />
            <p className="font-medium">No hay asientos contables</p>
            <p className="text-muted-foreground mt-1 text-sm">
              Crea el primer asiento de partida doble.
            </p>
            <Button className="mt-4" onClick={() => setFormOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Crear primer asiento
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-muted-foreground px-4 py-3 text-left text-xs font-medium uppercase">
                    N° Asiento
                  </th>
                  <th className="text-muted-foreground px-4 py-3 text-left text-xs font-medium uppercase">
                    Fecha
                  </th>
                  <th className="text-muted-foreground px-4 py-3 text-left text-xs font-medium uppercase">
                    Descripción
                  </th>
                  <th className="text-muted-foreground hidden px-4 py-3 text-left text-xs font-medium uppercase md:table-cell">
                    Período
                  </th>
                  <th className="text-muted-foreground px-4 py-3 text-right text-xs font-medium uppercase">
                    Total
                  </th>
                  <th className="text-muted-foreground px-4 py-3 text-left text-xs font-medium uppercase">
                    Estado
                  </th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <EntryRow key={entry.id} entry={entry} onRefresh={fetchEntries} />
                ))}
              </tbody>
            </table>
          </div>

          {/* Paginación */}
          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between border-t px-4 py-3">
              <p className="text-muted-foreground text-xs">
                {(page - 1) * 20 + 1}–{Math.min(page * 20, pagination.total)} de {pagination.total}{' '}
                asientos
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

      <JournalEntryForm open={formOpen} onOpenChange={setFormOpen} onCreated={fetchEntries} />
    </div>
  );
}
