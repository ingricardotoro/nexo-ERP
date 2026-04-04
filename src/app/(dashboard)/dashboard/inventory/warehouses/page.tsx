'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus, Warehouse as WarehouseIcon, MapPin } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
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
import type { WarehouseRow } from '@/lib/services/inventory/warehouse.service';

// ─── Warehouse Form Dialog ────────────────────────────────────────────────────

function WarehouseFormDialog({
  open,
  editing,
  onClose,
  onSaved,
}: {
  open: boolean;
  editing: WarehouseRow | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ code: '', name: '', address: '', city: '' });

  useEffect(() => {
    if (editing) {
      setForm({
        code: editing.code,
        name: editing.name,
        address: editing.address ?? '',
        city: editing.city ?? '',
      });
    } else {
      setForm({ code: '', name: '', address: '', city: '' });
    }
  }, [editing]);

  const handleSubmit = async () => {
    if (!form.name) {
      toast.error('El nombre es requerido');
      return;
    }
    if (!editing && !form.code) {
      toast.error('El código es requerido');
      return;
    }
    setSaving(true);
    try {
      const url = editing
        ? `/api/v1/inventory/warehouses/${editing.id}`
        : '/api/v1/inventory/warehouses';
      const method = editing ? 'PATCH' : 'POST';
      const body = editing
        ? { name: form.name, address: form.address || undefined, city: form.city || undefined }
        : {
            code: form.code.toUpperCase(),
            name: form.name,
            address: form.address || undefined,
            city: form.city || undefined,
          };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      const payload = (await res.json()) as { success: boolean; error?: string; message?: string };
      if (!res.ok || !payload.success) {
        toast.error('Error al guardar', { description: payload.error });
        return;
      }
      toast.success(payload.message ?? (editing ? 'Almacén actualizado' : 'Almacén creado'));
      onSaved();
      onClose();
    } catch {
      toast.error('Error de conexión');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? 'Editar almacén' : 'Nuevo almacén'}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          {!editing && (
            <div className="space-y-1">
              <Label htmlFor="wh-code">
                Código <span className="text-destructive">*</span>
              </Label>
              <Input
                id="wh-code"
                placeholder="BGA, SPS, CEI..."
                maxLength={10}
                value={form.code}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
              />
              <p className="text-muted-foreground text-xs">
                Código corto único (máx. 10 caracteres, solo letras y números)
              </p>
            </div>
          )}
          <div className="space-y-1">
            <Label htmlFor="wh-name">
              Nombre <span className="text-destructive">*</span>
            </Label>
            <Input
              id="wh-name"
              placeholder="Bodega Central, Almacén Norte..."
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="wh-city">Ciudad</Label>
            <Input
              id="wh-city"
              placeholder="Tegucigalpa, San Pedro Sula..."
              value={form.city}
              onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="wh-address">Dirección</Label>
            <Input
              id="wh-address"
              placeholder="Dirección del almacén"
              value={form.address}
              onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? 'Guardando...' : editing ? 'Guardar cambios' : 'Crear almacén'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Warehouse Card ───────────────────────────────────────────────────────────

function WarehouseCard({
  warehouse,
  onEdit,
  onDeactivate,
}: {
  warehouse: WarehouseRow;
  onEdit: (w: WarehouseRow) => void;
  onDeactivate: (id: string) => void;
}) {
  return (
    <Card className={warehouse.isActive ? '' : 'opacity-60'}>
      <div className="p-5">
        <div className="mb-3 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 flex h-10 w-10 items-center justify-center rounded-lg">
              <WarehouseIcon className="text-primary h-5 w-5" />
            </div>
            <div>
              <h3 className="font-semibold">{warehouse.name}</h3>
              <p className="text-muted-foreground font-mono text-xs">{warehouse.code}</p>
            </div>
          </div>
          <Badge
            variant="outline"
            className={
              warehouse.isActive
                ? 'border-green-300 text-green-700'
                : 'border-gray-300 text-gray-500'
            }
          >
            {warehouse.isActive ? 'Activo' : 'Inactivo'}
          </Badge>
        </div>

        {(warehouse.city ?? warehouse.address) && (
          <div className="mb-3 flex items-center gap-1.5">
            <MapPin className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
            <p className="text-muted-foreground text-xs">
              {[warehouse.city, warehouse.address].filter(Boolean).join(' — ')}
            </p>
          </div>
        )}

        <p className="text-muted-foreground mb-4 text-sm">
          {warehouse.locationCount} ubicación{warehouse.locationCount !== 1 ? 'es' : ''}
        </p>

        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="flex-1" onClick={() => onEdit(warehouse)}>
            Editar
          </Button>
          {warehouse.isActive && (
            <Button
              size="sm"
              variant="outline"
              className="text-destructive flex-1"
              onClick={() => onDeactivate(warehouse.id)}
            >
              Desactivar
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function WarehousesPage() {
  const [warehouses, setWarehouses] = useState<WarehouseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<WarehouseRow | null>(null);
  const [deactivateId, setDeactivateId] = useState<string | null>(null);
  const [deactivating, setDeactivating] = useState(false);

  const fetchWarehouses = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/inventory/warehouses?activeOnly=false', {
        credentials: 'include',
        cache: 'no-store',
      });
      const payload = (await res.json()) as {
        success: boolean;
        data: WarehouseRow[];
        error?: string;
      };
      if (!res.ok || !payload.success) {
        toast.error(payload.error ?? 'Error al cargar almacenes');
        return;
      }
      setWarehouses(payload.data);
    } catch {
      toast.error('Error de conexión');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchWarehouses();
  }, [fetchWarehouses]);

  const handleDeactivate = async () => {
    if (!deactivateId) return;
    setDeactivating(true);
    try {
      const res = await fetch(`/api/v1/inventory/warehouses/${deactivateId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ isActive: false }),
      });
      const payload = (await res.json()) as { success: boolean; error?: string };
      if (!res.ok || !payload.success) {
        toast.error('Error al desactivar', { description: payload.error });
        return;
      }
      toast.success('Almacén desactivado');
      void fetchWarehouses();
    } catch {
      toast.error('Error de conexión');
    } finally {
      setDeactivateId(null);
      setDeactivating(false);
    }
  };

  const active = warehouses.filter((w) => w.isActive).length;

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Almacenes</h1>
          <p className="text-muted-foreground text-sm">
            Gestión de bodegas y ubicaciones de inventario
          </p>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setShowForm(true);
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          Nuevo almacén
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total', value: warehouses.length, color: '' },
          { label: 'Activos', value: active, color: 'text-green-600' },
          {
            label: 'Ubicaciones',
            value: warehouses.reduce((s, w) => s + w.locationCount, 0),
            color: '',
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

      {/* Grid */}
      {loading && warehouses.length === 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-muted h-40 animate-pulse rounded-lg" />
          ))}
        </div>
      ) : warehouses.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <WarehouseIcon className="text-muted-foreground mb-3 h-10 w-10" />
            <p className="font-medium">No hay almacenes configurados</p>
            <p className="text-muted-foreground mt-1 text-sm">
              Crea el primer almacén para comenzar a gestionar tu inventario.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {warehouses.map((w) => (
            <WarehouseCard
              key={w.id}
              warehouse={w}
              onEdit={(wh) => {
                setEditing(wh);
                setShowForm(true);
              }}
              onDeactivate={(id) => setDeactivateId(id)}
            />
          ))}
        </div>
      )}

      <WarehouseFormDialog
        open={showForm}
        editing={editing}
        onClose={() => {
          setShowForm(false);
          setEditing(null);
        }}
        onSaved={fetchWarehouses}
      />

      <AlertDialog open={!!deactivateId} onOpenChange={(o) => !o && setDeactivateId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desactivar almacén</AlertDialogTitle>
            <AlertDialogDescription>
              El almacén quedará inactivo. No podrás usarlo en nuevos movimientos de inventario,
              pero los registros existentes se conservan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDeactivate}
              disabled={deactivating}
            >
              {deactivating ? 'Desactivando...' : 'Desactivar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
