'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus, Package, Search, Tag } from 'lucide-react';
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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import type { ProductListResult, ProductRow } from '@/lib/services/inventory/product.service';
import type { UomRow } from '@/lib/services/inventory/uom.service';

// ─── Constants ────────────────────────────────────────────────────────────────

const TRACKING_LABELS: Record<string, string> = {
  NONE: 'Sin rastreo',
  LOT: 'Por lote',
  SERIAL: 'Por serie',
};

const TRACKING_COLORS: Record<string, string> = {
  NONE: 'border-gray-300 text-gray-600',
  LOT: 'border-blue-300 text-blue-700',
  SERIAL: 'border-purple-300 text-purple-700',
};

// ─── Product Form Dialog ──────────────────────────────────────────────────────

function ProductFormDialog({
  open,
  onClose,
  onSaved,
  uoms,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  uoms: UomRow[];
}) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    code: '',
    name: '',
    description: '',
    barcode: '',
    unitOfMeasureId: '',
    trackingType: 'NONE' as 'NONE' | 'LOT' | 'SERIAL',
    costPrice: '',
    salePrice: '',
  });

  const handleSubmit = async () => {
    if (!form.code || !form.name || !form.unitOfMeasureId) {
      toast.error('Código, nombre y unidad de medida son requeridos');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/v1/inventory/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          code: form.code.toUpperCase(),
          name: form.name,
          description: form.description || undefined,
          barcode: form.barcode || undefined,
          unitOfMeasureId: form.unitOfMeasureId,
          trackingType: form.trackingType,
          costPrice: form.costPrice ? parseFloat(form.costPrice) : 0,
          salePrice: form.salePrice ? parseFloat(form.salePrice) : 0,
        }),
      });
      const payload = (await res.json()) as { success: boolean; error?: string; message?: string };
      if (!res.ok || !payload.success) {
        toast.error('Error al crear producto', { description: payload.error });
        return;
      }
      toast.success(payload.message ?? 'Producto creado');
      onSaved();
      onClose();
      setForm({
        code: '',
        name: '',
        description: '',
        barcode: '',
        unitOfMeasureId: '',
        trackingType: 'NONE',
        costPrice: '',
        salePrice: '',
      });
    } catch {
      toast.error('Error de conexión');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nuevo producto</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="code">
                Código (SKU) <span className="text-destructive">*</span>
              </Label>
              <Input
                id="code"
                placeholder="PROD-001"
                value={form.code}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="barcode">Código de barras</Label>
              <Input
                id="barcode"
                placeholder="EAN / UPC"
                value={form.barcode}
                onChange={(e) => setForm((f) => ({ ...f, barcode: e.target.value }))}
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="name">
              Nombre <span className="text-destructive">*</span>
            </Label>
            <Input
              id="name"
              placeholder="Nombre del producto"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="description">Descripción</Label>
            <Input
              id="description"
              placeholder="Descripción opcional"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>
                Unidad de medida <span className="text-destructive">*</span>
              </Label>
              <Select
                value={form.unitOfMeasureId}
                onValueChange={(v) => setForm((f) => ({ ...f, unitOfMeasureId: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar..." />
                </SelectTrigger>
                <SelectContent>
                  {uoms.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.symbol} — {u.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Rastreo de lote</Label>
              <Select
                value={form.trackingType}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, trackingType: v as 'NONE' | 'LOT' | 'SERIAL' }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE">Sin rastreo</SelectItem>
                  <SelectItem value="LOT">Por lote</SelectItem>
                  <SelectItem value="SERIAL">Por serie</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="costPrice">Precio de costo (L)</Label>
              <Input
                id="costPrice"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={form.costPrice}
                onChange={(e) => setForm((f) => ({ ...f, costPrice: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="salePrice">Precio de venta (L)</Label>
              <Input
                id="salePrice"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={form.salePrice}
                onChange={(e) => setForm((f) => ({ ...f, salePrice: e.target.value }))}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? 'Guardando...' : 'Crear producto'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Product Row ──────────────────────────────────────────────────────────────

function ProductTableRow({
  product,
  onToggleActive,
}: {
  product: ProductRow;
  onToggleActive: (id: string, active: boolean) => void;
}) {
  const fmtL = (v: string) =>
    `L ${parseFloat(v).toLocaleString('es-HN', { minimumFractionDigits: 2 })}`;

  return (
    <tr className="hover:bg-muted/30 border-b transition-colors last:border-0">
      <td className="px-4 py-3">
        <p className="font-mono text-sm font-medium">{product.code}</p>
        {product.barcode && <p className="text-muted-foreground text-xs">{product.barcode}</p>}
      </td>
      <td className="px-4 py-3">
        <p className="text-sm font-medium">{product.name}</p>
        {product.categoryName && (
          <p className="text-muted-foreground text-xs">{product.categoryName}</p>
        )}
      </td>
      <td className="px-4 py-3">
        <span className="text-muted-foreground text-xs font-medium">
          {product.unitOfMeasureSymbol}
        </span>
      </td>
      <td className="px-4 py-3">
        <Badge
          variant="outline"
          className={`text-xs ${TRACKING_COLORS[product.trackingType] ?? ''}`}
        >
          {TRACKING_LABELS[product.trackingType] ?? product.trackingType}
        </Badge>
      </td>
      <td className="px-4 py-3 text-right text-sm tabular-nums">{fmtL(product.costPrice)}</td>
      <td className="px-4 py-3 text-right text-sm tabular-nums">{fmtL(product.salePrice)}</td>
      <td className="px-4 py-3">
        <Badge
          variant="outline"
          className={
            product.isActive ? 'border-green-300 text-green-700' : 'border-gray-300 text-gray-500'
          }
        >
          {product.isActive ? 'Activo' : 'Inactivo'}
        </Badge>
      </td>
      <td className="px-4 py-3">
        <Button
          size="sm"
          variant="ghost"
          className="h-7 text-xs"
          onClick={() => onToggleActive(product.id, !product.isActive)}
        >
          {product.isActive ? 'Desactivar' : 'Activar'}
        </Button>
      </td>
    </tr>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProductsPage() {
  const [result, setResult] = useState<ProductListResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [uoms, setUoms] = useState<UomRow[]>([]);
  const [search, setSearch] = useState('');
  const [trackingFilter, setTrackingFilter] = useState('');
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20', activeOnly: 'false' });
      if (search) params.set('search', search);
      if (trackingFilter) params.set('trackingType', trackingFilter);

      const res = await fetch(`/api/v1/inventory/products?${params}`, {
        credentials: 'include',
        cache: 'no-store',
      });
      const payload = (await res.json()) as ProductListResult & { error?: string };
      if (!res.ok || !payload.success) {
        toast.error(payload.error ?? 'Error al cargar productos');
        return;
      }
      setResult(payload);
    } catch {
      toast.error('Error de conexión');
    } finally {
      setLoading(false);
    }
  }, [page, search, trackingFilter]);

  const fetchUoms = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/inventory/uoms', { credentials: 'include' });
      if (res.ok) {
        const payload = (await res.json()) as { success: boolean; data: UomRow[] };
        if (payload.success) setUoms(payload.data);
      }
    } catch {
      // non-critical
    }
  }, []);

  useEffect(() => {
    void fetchProducts();
  }, [fetchProducts]);

  useEffect(() => {
    void fetchUoms();
  }, [fetchUoms]);

  const handleToggleActive = async (id: string, active: boolean) => {
    try {
      const res = await fetch(`/api/v1/inventory/products/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ isActive: active }),
      });
      const payload = (await res.json()) as { success: boolean; error?: string; message?: string };
      if (!res.ok || !payload.success) {
        toast.error('Error al actualizar', { description: payload.error });
        return;
      }
      toast.success(active ? 'Producto activado' : 'Producto desactivado');
      void fetchProducts();
    } catch {
      toast.error('Error de conexión');
    }
  };

  const products = result?.products ?? [];
  const pagination = result?.pagination;
  const active = products.filter((p) => p.isActive).length;

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Productos</h1>
          <p className="text-muted-foreground text-sm">
            Catálogo de productos con rastreo de lote y serie
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)} disabled={uoms.length === 0}>
          <Plus className="mr-2 h-4 w-4" />
          Nuevo producto
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: 'Total', value: pagination?.total ?? 0, color: '' },
          { label: 'Activos', value: active, color: 'text-green-600' },
          {
            label: 'Sin rastreo',
            value: products.filter((p) => p.trackingType === 'NONE').length,
            color: '',
          },
          {
            label: 'Con lote/serie',
            value: products.filter((p) => p.trackingType !== 'NONE').length,
            color: 'text-blue-600',
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
            placeholder="Buscar código, nombre o barcode..."
            className="pl-9"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <Select
          value={trackingFilter}
          onValueChange={(v) => {
            setTrackingFilter(v === 'ALL' ? '' : v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Rastreo..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos</SelectItem>
            <SelectItem value="NONE">Sin rastreo</SelectItem>
            <SelectItem value="LOT">Por lote</SelectItem>
            <SelectItem value="SERIAL">Por serie</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {loading && !result ? (
        <div className="bg-muted h-48 animate-pulse rounded-lg" />
      ) : products.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Package className="text-muted-foreground mb-3 h-10 w-10" />
            <p className="font-medium">No hay productos</p>
            <p className="text-muted-foreground mt-1 text-sm">
              {uoms.length === 0
                ? 'Primero crea una unidad de medida para poder agregar productos.'
                : 'Crea el primer producto para comenzar.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  {['Código', 'Nombre', 'UM', 'Rastreo', 'Costo', 'Precio venta', 'Estado', ''].map(
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
                {products.map((p) => (
                  <ProductTableRow key={p.id} product={p} onToggleActive={handleToggleActive} />
                ))}
              </tbody>
            </table>
          </div>

          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between border-t px-4 py-3">
              <p className="text-muted-foreground text-xs">
                {(page - 1) * 20 + 1}–{Math.min(page * 20, pagination.total)} de {pagination.total}{' '}
                productos
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

      {/* UoM hint */}
      {uoms.length === 0 && (
        <Card>
          <CardContent className="flex items-center gap-3 py-4">
            <Tag className="text-muted-foreground h-5 w-5 shrink-0" />
            <p className="text-muted-foreground text-sm">
              No hay unidades de medida configuradas. Contacta a un administrador para crearlas
              antes de agregar productos.
            </p>
          </CardContent>
        </Card>
      )}

      <ProductFormDialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onSaved={fetchProducts}
        uoms={uoms}
      />
    </div>
  );
}
