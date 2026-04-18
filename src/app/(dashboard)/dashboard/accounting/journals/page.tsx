// src/app/(dashboard)/accounting/journals/page.tsx
'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus, BookOpen, Pencil, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { JournalForm } from '@/components/accounting/journal-form';
import type { JournalRow } from '@/lib/services/accounting/journal.service';

// ─── Constants ────────────────────────────────────────────────────────────────

const JOURNAL_TYPE_LABELS: Record<string, string> = {
  GENERAL: 'Diario General',
  SALES: 'Ventas',
  PURCHASES: 'Compras',
  CASH: 'Caja',
  BANK: 'Bancos',
  PAYROLL: 'Nómina',
  ADJUSTMENT: 'Ajustes',
};

const JOURNAL_TYPE_COLORS: Record<string, string> = {
  GENERAL: 'border-blue-300 text-blue-700 dark:text-blue-400',
  SALES: 'border-green-300 text-green-700 dark:text-green-400',
  PURCHASES: 'border-orange-300 text-orange-700 dark:text-orange-400',
  CASH: 'border-yellow-300 text-yellow-700 dark:text-yellow-400',
  BANK: 'border-indigo-300 text-indigo-700 dark:text-indigo-400',
  PAYROLL: 'border-purple-300 text-purple-700 dark:text-purple-400',
  ADJUSTMENT: 'border-gray-300 text-gray-600 dark:text-gray-400',
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface ApiResponse {
  success: boolean;
  data?: JournalRow[];
  error?: string;
}

// ─── Edit Dialog ──────────────────────────────────────────────────────────────

function EditJournalDialog({ journal, onUpdated }: { journal: JournalRow; onUpdated: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(journal.name);
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (!name.trim() || name === journal.name) {
      setOpen(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/accounting/journals/${journal.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      const payload = (await res.json()) as { success: boolean; error?: string };
      if (!res.ok || !payload.success) {
        toast.error('Error al actualizar', { description: payload.error });
        return;
      }
      toast.success('Diario actualizado');
      setOpen(false);
      onUpdated();
    } catch {
      toast.error('Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button
        size="sm"
        variant="ghost"
        className="h-7 w-7 p-0"
        onClick={() => {
          setName(journal.name);
          setOpen(true);
        }}
      >
        <Pencil className="h-3.5 w-3.5" />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Editar diario</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="edit-name">Nombre</Label>
              <Input
                id="edit-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && void handleSave()}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
                Cancelar
              </Button>
              <Button onClick={() => void handleSave()} disabled={loading}>
                {loading ? 'Guardando...' : 'Guardar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── Journal Row ──────────────────────────────────────────────────────────────

function JournalTableRow({ journal, onRefresh }: { journal: JournalRow; onRefresh: () => void }) {
  const [actionLoading, setActionLoading] = useState(false);

  const toggleActive = async () => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/v1/accounting/journals/${journal.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !journal.isActive }),
      });
      const payload = (await res.json()) as { success: boolean; error?: string };
      if (!res.ok || !payload.success) {
        toast.error('Error', { description: payload.error });
        return;
      }
      toast.success(journal.isActive ? 'Diario desactivado' : 'Diario activado');
      onRefresh();
    } catch {
      toast.error('Error de conexión');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/v1/accounting/journals/${journal.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const payload = (await res.json()) as { success: boolean; error?: string };
      if (!res.ok || !payload.success) {
        toast.error('Error al eliminar', { description: payload.error });
        return;
      }
      toast.success('Diario eliminado');
      onRefresh();
    } catch {
      toast.error('Error de conexión');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <tr className="hover:bg-muted/30 border-b transition-colors last:border-0">
      <td className="px-4 py-3">
        <span className="font-mono text-sm font-medium">{journal.code}</span>
      </td>
      <td className="px-4 py-3">
        <span className={journal.isActive ? '' : 'text-muted-foreground line-through'}>
          {journal.name}
        </span>
      </td>
      <td className="px-4 py-3">
        <Badge
          variant="outline"
          className={`text-xs ${JOURNAL_TYPE_COLORS[journal.journalType] ?? ''}`}
        >
          {JOURNAL_TYPE_LABELS[journal.journalType] ?? journal.journalType}
        </Badge>
      </td>
      <td className="px-4 py-3 text-center">
        <span className="text-muted-foreground text-sm">
          {journal.entriesCount > 0 ? journal.entriesCount : '—'}
        </span>
      </td>
      <td className="px-4 py-3 text-center">
        {journal.isActive ? (
          <span className="inline-flex items-center rounded-full border border-green-200 bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-700">
            Activo
          </span>
        ) : (
          <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs font-medium text-slate-500">
            Inactivo
          </span>
        )}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-1">
          <EditJournalDialog journal={journal} onUpdated={onRefresh} />

          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0"
            disabled={actionLoading}
            onClick={() => void toggleActive()}
            title={journal.isActive ? 'Desactivar' : 'Activar'}
          >
            {journal.isActive ? (
              <ToggleRight className="h-3.5 w-3.5 text-green-600" />
            ) : (
              <ToggleLeft className="text-muted-foreground h-3.5 w-3.5" />
            )}
          </Button>

          {journal.entriesCount === 0 && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive hover:text-destructive h-7 w-7 p-0"
                  disabled={actionLoading}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Eliminar diario</AlertDialogTitle>
                  <AlertDialogDescription>
                    ¿Eliminar el diario <strong>{journal.name}</strong> ({journal.code})? Esta
                    acción no se puede deshacer.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    onClick={() => void handleDelete()}
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

export default function JournalsPage() {
  const [journals, setJournals] = useState<JournalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  const fetchJournals = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/accounting/journals', {
        credentials: 'include',
        cache: 'no-store',
      });
      const payload = (await res.json()) as ApiResponse;
      if (!res.ok || !payload.success) {
        setError(payload.error ?? 'Error al cargar los diarios');
        return;
      }
      setJournals(payload.data ?? []);
    } catch {
      setError('Error de conexión. Verifica tu red e intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchJournals();
  }, [fetchJournals]);

  const activeCount = journals.filter((j) => j.isActive).length;
  const totalEntries = journals.reduce((sum, j) => sum + j.entriesCount, 0);

  // ── Loading ──────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-4 p-6">
        <div className="flex items-center justify-between">
          <div className="bg-muted h-7 w-48 animate-pulse rounded" />
          <div className="bg-muted h-9 w-36 animate-pulse rounded" />
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
          onClick={() => void fetchJournals()}
          className="text-primary mt-2 text-sm underline-offset-2 hover:underline"
        >
          Reintentar
        </button>
      </div>
    );
  }

  // ── Main ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Diarios Contables</h1>
          <p className="text-muted-foreground text-sm">
            Libros de diario para clasificar y agrupar asientos contables
          </p>
        </div>
        <Button onClick={() => setFormOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Nuevo Diario
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pt-4 pb-1">
            <CardTitle className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              Total diarios
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-4">
            <p className="text-2xl font-bold">{journals.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pt-4 pb-1">
            <CardTitle className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              Activos
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-4">
            <p className="text-2xl font-bold text-green-600">{activeCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pt-4 pb-1">
            <CardTitle className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              Total asientos
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-4">
            <p className="text-2xl font-bold">{totalEntries}</p>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      {journals.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <BookOpen className="text-muted-foreground mb-3 h-10 w-10" />
            <p className="font-medium">No hay diarios registrados</p>
            <p className="text-muted-foreground mt-1 text-sm">
              Crea los libros de diario para tu empresa.
            </p>
            <Button className="mt-4" onClick={() => setFormOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Crear primer diario
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
                    Código
                  </th>
                  <th className="text-muted-foreground px-4 py-3 text-left text-xs font-medium uppercase">
                    Nombre
                  </th>
                  <th className="text-muted-foreground px-4 py-3 text-left text-xs font-medium uppercase">
                    Tipo
                  </th>
                  <th className="text-muted-foreground px-4 py-3 text-center text-xs font-medium uppercase">
                    Asientos
                  </th>
                  <th className="text-muted-foreground px-4 py-3 text-center text-xs font-medium uppercase">
                    Estado
                  </th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {journals.map((journal) => (
                  <JournalTableRow key={journal.id} journal={journal} onRefresh={fetchJournals} />
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <JournalForm open={formOpen} onOpenChange={setFormOpen} onCreated={fetchJournals} />
    </div>
  );
}
