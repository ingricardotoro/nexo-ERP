'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus, Ruler, Pencil, ToggleLeft, ToggleRight } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { UomRow } from '@/lib/services/inventory/uom.service';

// ─── Form Dialog ──────────────────────────────────────────────────────────────

function UomFormDialog({
  open,
  onOpenChange,
  editRow,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editRow: UomRow | null;
  onSaved: () => void;
}) {
  const [name, setName] = useState('');
  const [symbol, setSymbol] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setName(editRow?.name ?? '');
      setSymbol(editRow?.symbol ?? '');
    }
  }, [open, editRow]);

  const handleSubmit = async () => {
    if (!name.trim() || (!editRow && !symbol.trim())) {
      toast.error('Nombre y símbolo son requeridos');
      return;
    }
    setSaving(true);
    try {
      const url = editRow ? `/api/v1/inventory/uoms/${editRow.id}` : '/api/v1/inventory/uoms';
      const method = editRow ? 'PATCH' : 'POST';
      const body = editRow ? { name: name.trim() } : { name: name.trim(), symbol: symbol.trim() };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { success: boolean; error?: string; message?: string };
      if (!res.ok || !data.success) {
        toast.error('Error', { description: data.error });
        return;
      }
      toast.success(data.message ?? (editRow ? 'Unidad actualizada' : 'Unidad creada'));
      onSaved();
      onOpenChange(false);
    } catch {
      toast.error('Error de conexión');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{editRow ? 'Editar unidad de medida' : 'Nueva unidad de medida'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-1">
          <div className="space-y-1.5">
            <Label htmlFor="uom-name">
              Nombre <span className="text-destructive">*</span>
            </Label>
            <Input
              id="uom-name"
              placeholder="Ej: Kilogramo, Unidad, Litro"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void handleSubmit()}
            />
          </div>
          {!editRow && (
            <div className="space-y-1.5">
              <Label htmlFor="uom-symbol">
                Símbolo <span className="text-destructive">*</span>
              </Label>
              <Input
                id="uom-symbol"
                placeholder="Ej: KG, UND, LT"
                className="uppercase"
                maxLength={10}
                value={symbol}
                onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === 'Enter' && void handleSubmit()}
              />
              <p className="text-muted-foreground text-xs">
                Solo letras, números y /. No se puede cambiar después de crear.
              </p>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={saving || !name.trim()}>
            {saving ? 'Guardando...' : editRow ? 'Guardar cambios' : 'Crear unidad'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function UomsPage() {
  const [uoms, setUoms] = useState<UomRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editRow, setEditRow] = useState<UomRow | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const fetchUoms = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/inventory/uoms?activeOnly=false', {
        credentials: 'include',
        cache: 'no-store',
      });
      const payload = (await res.json()) as { success: boolean; data?: UomRow[]; error?: string };
      if (!res.ok || !payload.success) {
        toast.error(payload.error ?? 'Error al cargar unidades de medida');
        return;
      }
      setUoms(payload.data ?? []);
    } catch {
      toast.error('Error de conexión');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchUoms();
  }, [fetchUoms]);

  const handleToggle = async (uom: UomRow) => {
    setTogglingId(uom.id);
    try {
      const res = await fetch(`/api/v1/inventory/uoms/${uom.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ isActive: !uom.isActive }),
      });
      const payload = (await res.json()) as { success: boolean; error?: string };
      if (!res.ok || !payload.success) {
        toast.error('Error', { description: payload.error });
        return;
      }
      toast.success(uom.isActive ? 'Unidad desactivada' : 'Unidad activada');
      void fetchUoms();
    } catch {
      toast.error('Error de conexión');
    } finally {
      setTogglingId(null);
    }
  };

  const activeCount = uoms.filter((u) => u.isActive).length;

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Unidades de Medida</h1>
          <p className="text-muted-foreground text-sm">
            Unidades utilizadas para medir productos en inventario
          </p>
        </div>
        <Button
          onClick={() => {
            setEditRow(null);
            setFormOpen(true);
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          Nueva unidad
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Card>
          <div className="p-4">
            <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              Total
            </p>
            <p className="mt-1 text-2xl font-bold">{uoms.length}</p>
          </div>
        </Card>
        <Card>
          <div className="p-4">
            <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              Activas
            </p>
            <p className="mt-1 text-2xl font-bold text-green-600">{activeCount}</p>
          </div>
        </Card>
        <Card>
          <div className="p-4">
            <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              Con productos
            </p>
            <p className="mt-1 text-2xl font-bold text-blue-600">
              {uoms.filter((u) => u.productCount > 0).length}
            </p>
          </div>
        </Card>
      </div>

      {/* Table */}
      {loading ? (
        <div className="bg-muted h-48 animate-pulse rounded-lg" />
      ) : uoms.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Ruler className="text-muted-foreground mb-3 h-10 w-10" />
            <p className="font-medium">No hay unidades de medida</p>
            <p className="text-muted-foreground mt-1 text-sm">
              Crea la primera unidad para poder registrar productos.
            </p>
            <Button
              className="mt-4"
              onClick={() => {
                setEditRow(null);
                setFormOpen(true);
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              Crear primera unidad
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  {['Símbolo', 'Nombre', 'Productos', 'Estado', ''].map((h) => (
                    <th
                      key={h}
                      className="text-muted-foreground px-4 py-3 text-left text-xs font-medium uppercase"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {uoms.map((uom) => (
                  <tr
                    key={uom.id}
                    className="hover:bg-muted/30 border-b transition-colors last:border-0"
                  >
                    <td className="px-4 py-3">
                      <span className="font-mono text-sm font-semibold">{uom.symbol}</span>
                    </td>
                    <td className="px-4 py-3">{uom.name}</td>
                    <td className="px-4 py-3">
                      <span className="text-muted-foreground text-sm">
                        {uom.productCount > 0 ? uom.productCount : '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {uom.isActive ? (
                        <span className="inline-flex items-center rounded-full border border-green-200 bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-700">
                          Activa
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs font-medium text-slate-500">
                          Inactiva
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0"
                          onClick={() => {
                            setEditRow(uom);
                            setFormOpen(true);
                          }}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0"
                          disabled={togglingId === uom.id}
                          onClick={() => void handleToggle(uom)}
                          title={uom.isActive ? 'Desactivar' : 'Activar'}
                        >
                          {uom.isActive ? (
                            <ToggleRight className="h-3.5 w-3.5 text-green-600" />
                          ) : (
                            <ToggleLeft className="text-muted-foreground h-3.5 w-3.5" />
                          )}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <UomFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        editRow={editRow}
        onSaved={fetchUoms}
      />
    </div>
  );
}
