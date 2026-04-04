'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus, Trash2, PackageCheck } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { ProductRow } from '@/lib/services/inventory/product.service';
import type { WarehouseRow } from '@/lib/services/inventory/warehouse.service';
import type { StockMoveRow } from '@/lib/services/inventory/stock-move.service';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Location {
  id: string;
  name: string;
  fullPath: string | null;
  locationType: string;
}

interface ReceptionLine {
  id: number;
  lotNumber: string;
  manufacturingDate: string;
  expirationDate: string;
  quantity: string;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ReceptionsPage() {
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseRow[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [recentMoves, setRecentMoves] = useState<StockMoveRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [nextLineId, setNextLineId] = useState(2);

  // Form state
  const [selectedProduct, setSelectedProduct] = useState('');
  const [selectedWarehouse, setSelectedWarehouse] = useState('');
  const [selectedToLocation, setSelectedToLocation] = useState('');
  const [selectedFromLocation, setSelectedFromLocation] = useState('');
  const [reference, setReference] = useState('');
  const [scheduledDate, setScheduledDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [lines, setLines] = useState<ReceptionLine[]>([
    { id: 1, lotNumber: '', manufacturingDate: '', expirationDate: '', quantity: '' },
  ]);

  const selectedProductData = products.find((p) => p.id === selectedProduct);
  const requiresLot = selectedProductData?.trackingType !== 'NONE';

  const fetchInitialData = useCallback(async () => {
    try {
      const [pRes, wRes] = await Promise.all([
        fetch('/api/v1/inventory/products?activeOnly=true&limit=200', { credentials: 'include' }),
        fetch('/api/v1/inventory/warehouses?activeOnly=true', { credentials: 'include' }),
      ]);

      if (pRes.ok) {
        const pp = (await pRes.json()) as { success: boolean; products: ProductRow[] };
        if (pp.success) setProducts(pp.products);
      }
      if (wRes.ok) {
        const ww = (await wRes.json()) as { success: boolean; data: WarehouseRow[] };
        if (ww.success) setWarehouses(ww.data);
      }
    } catch {
      toast.error('Error al cargar datos');
    }
  }, []);

  const fetchLocations = useCallback(async () => {
    if (!selectedWarehouse) return;
    try {
      const [intRes, supRes] = await Promise.all([
        fetch(
          `/api/v1/inventory/locations?warehouseId=${selectedWarehouse}&locationType=INTERNAL`,
          { credentials: 'include' },
        ),
        fetch(`/api/v1/inventory/locations?locationType=SUPPLIER`, { credentials: 'include' }),
      ]);
      if (intRes.ok) {
        const d = (await intRes.json()) as { success: boolean; data: Location[] };
        if (d.success) setLocations(d.data);
      }
      if (supRes.ok) {
        const d = (await supRes.json()) as { success: boolean; data: Location[] };
        if (d.success && d.data.length > 0) setSelectedFromLocation(d.data[0].id);
      }
    } catch {
      // non-critical
    }
  }, [selectedWarehouse]);

  const fetchRecentMoves = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/inventory/moves?limit=10', { credentials: 'include' });
      if (res.ok) {
        const d = (await res.json()) as { success: boolean; data: StockMoveRow[] };
        if (d.success) setRecentMoves(d.data);
      }
    } catch {
      // non-critical
    }
  }, []);

  useEffect(() => {
    void fetchInitialData();
  }, [fetchInitialData]);
  useEffect(() => {
    void fetchLocations();
  }, [fetchLocations]);
  useEffect(() => {
    void fetchRecentMoves();
  }, [fetchRecentMoves]);

  // Reset to-location when warehouse changes
  useEffect(() => {
    setSelectedToLocation('');
  }, [selectedWarehouse]);

  const addLine = () => {
    setLines((prev) => [
      ...prev,
      { id: nextLineId, lotNumber: '', manufacturingDate: '', expirationDate: '', quantity: '' },
    ]);
    setNextLineId((n) => n + 1);
  };

  const removeLine = (id: number) => {
    setLines((prev) => prev.filter((l) => l.id !== id));
  };

  const updateLine = (id: number, field: keyof ReceptionLine, value: string) => {
    setLines((prev) => prev.map((l) => (l.id === id ? { ...l, [field]: value } : l)));
  };

  const handleSubmit = async () => {
    if (!selectedProduct || !selectedToLocation || !selectedFromLocation) {
      toast.error('Selecciona producto y ubicaciones');
      return;
    }
    const invalidLines = lines.filter(
      (l) => !l.quantity || isNaN(parseFloat(l.quantity)) || parseFloat(l.quantity) <= 0,
    );
    if (invalidLines.length) {
      toast.error('Todas las líneas deben tener cantidad válida');
      return;
    }
    if (requiresLot && lines.some((l) => !l.lotNumber.trim())) {
      toast.error(
        `El producto requiere número de ${selectedProductData?.trackingType === 'SERIAL' ? 'serie' : 'lote'} en todas las líneas`,
      );
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/v1/inventory/receptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          productId: selectedProduct,
          fromLocationId: selectedFromLocation,
          toLocationId: selectedToLocation,
          scheduledDate: new Date(scheduledDate).toISOString(),
          reference: reference || undefined,
          lines: lines.map((l) => ({
            lotNumber: l.lotNumber || undefined,
            manufacturingDate: l.manufacturingDate
              ? new Date(l.manufacturingDate).toISOString()
              : undefined,
            expirationDate: l.expirationDate ? new Date(l.expirationDate).toISOString() : undefined,
            quantity: parseFloat(l.quantity),
          })),
        }),
      });
      const payload = (await res.json()) as { success: boolean; error?: string; message?: string };
      if (!res.ok || !payload.success) {
        toast.error('Error al registrar recepción', { description: payload.error });
        return;
      }
      toast.success(payload.message ?? 'Recepción registrada');
      // Reset form
      setSelectedProduct('');
      setReference('');
      setLines([{ id: 1, lotNumber: '', manufacturingDate: '', expirationDate: '', quantity: '' }]);
      void fetchRecentMoves();
    } catch {
      toast.error('Error de conexión');
    } finally {
      setSaving(false);
    }
  };

  const fmtDate = (d: Date | string) =>
    new Date(d).toLocaleDateString('es-HN', { day: '2-digit', month: 'short', year: 'numeric' });

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Nueva Recepción</h1>
        <p className="text-muted-foreground text-sm">
          Registrar entrada de mercancía de proveedor al almacén
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Form */}
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Datos de la recepción</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>
                    Producto <span className="text-destructive">*</span>
                  </Label>
                  <Select value={selectedProduct} onValueChange={setSelectedProduct}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar producto..." />
                    </SelectTrigger>
                    <SelectContent>
                      {products.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.code} — {p.name}
                          {p.trackingType !== 'NONE' && (
                            <span className="text-muted-foreground ml-1 text-xs">
                              ({p.trackingType === 'SERIAL' ? 'serie' : 'lote'})
                            </span>
                          )}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="ref">Referencia</Label>
                  <Input
                    id="ref"
                    placeholder="PO-2025-001, OC-001..."
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>
                    Almacén destino <span className="text-destructive">*</span>
                  </Label>
                  <Select value={selectedWarehouse} onValueChange={setSelectedWarehouse}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar almacén..." />
                    </SelectTrigger>
                    <SelectContent>
                      {warehouses.map((w) => (
                        <SelectItem key={w.id} value={w.id}>
                          {w.code} — {w.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>
                    Ubicación destino <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={selectedToLocation}
                    onValueChange={setSelectedToLocation}
                    disabled={!selectedWarehouse || locations.length === 0}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar ubicación..." />
                    </SelectTrigger>
                    <SelectContent>
                      {locations.map((l) => (
                        <SelectItem key={l.id} value={l.id}>
                          {l.fullPath ?? l.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="schedDate">Fecha</Label>
                <Input
                  id="schedDate"
                  type="date"
                  value={scheduledDate}
                  onChange={(e) => setScheduledDate(e.target.value)}
                  className="w-48"
                />
              </div>
            </CardContent>
          </Card>

          {/* Lines */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">
                  Líneas de recepción
                  {requiresLot && (
                    <span className="text-muted-foreground ml-2 text-xs font-normal">
                      (requiere{' '}
                      {selectedProductData?.trackingType === 'SERIAL'
                        ? 'número de serie'
                        : 'número de lote'}
                      )
                    </span>
                  )}
                </CardTitle>
                <Button size="sm" variant="outline" onClick={addLine}>
                  <Plus className="mr-1 h-3 w-3" />
                  Añadir línea
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {lines.map((line, idx) => (
                <div key={line.id} className="grid grid-cols-12 items-end gap-2">
                  <div className="col-span-1 flex items-center justify-center">
                    <span className="text-muted-foreground text-xs font-medium">{idx + 1}</span>
                  </div>

                  {requiresLot && (
                    <div className="col-span-3 space-y-1">
                      {idx === 0 && (
                        <Label className="text-xs">
                          {selectedProductData?.trackingType === 'SERIAL' ? 'N° Serie' : 'N° Lote'}{' '}
                          <span className="text-destructive">*</span>
                        </Label>
                      )}
                      <Input
                        placeholder="LOT-001"
                        value={line.lotNumber}
                        onChange={(e) => updateLine(line.id, 'lotNumber', e.target.value)}
                      />
                    </div>
                  )}

                  <div className={`${requiresLot ? 'col-span-2' : 'col-span-3'} space-y-1`}>
                    {idx === 0 && <Label className="text-xs">Fabricación</Label>}
                    <Input
                      type="date"
                      value={line.manufacturingDate}
                      onChange={(e) => updateLine(line.id, 'manufacturingDate', e.target.value)}
                    />
                  </div>

                  <div className={`${requiresLot ? 'col-span-2' : 'col-span-3'} space-y-1`}>
                    {idx === 0 && <Label className="text-xs">Vencimiento</Label>}
                    <Input
                      type="date"
                      value={line.expirationDate}
                      onChange={(e) => updateLine(line.id, 'expirationDate', e.target.value)}
                    />
                  </div>

                  <div className="col-span-2 space-y-1">
                    {idx === 0 && (
                      <Label className="text-xs">
                        Cantidad <span className="text-destructive">*</span>
                      </Label>
                    )}
                    <Input
                      type="number"
                      min="0.0001"
                      step="0.0001"
                      placeholder="0"
                      value={line.quantity}
                      onChange={(e) => updateLine(line.id, 'quantity', e.target.value)}
                    />
                  </div>

                  <div className="col-span-2 flex justify-end">
                    {lines.length > 1 && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive h-9 w-9 p-0"
                        onClick={() => removeLine(line.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}

              {/* Totals */}
              <div className="border-t pt-3">
                <p className="text-muted-foreground text-sm">
                  Total:{' '}
                  <span className="text-foreground font-semibold">
                    {lines
                      .reduce((s, l) => s + (parseFloat(l.quantity) || 0), 0)
                      .toLocaleString('es-HN', { minimumFractionDigits: 4 })}{' '}
                    {selectedProductData?.unitOfMeasureSymbol ?? 'unidades'}
                  </span>
                </p>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button
              size="lg"
              onClick={handleSubmit}
              disabled={saving || !selectedProduct || !selectedToLocation}
            >
              <PackageCheck className="mr-2 h-5 w-5" />
              {saving ? 'Registrando...' : 'Registrar recepción'}
            </Button>
          </div>
        </div>

        {/* Recent receptions */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recepciones recientes</CardTitle>
            </CardHeader>
            <CardContent>
              {recentMoves.length === 0 ? (
                <p className="text-muted-foreground py-4 text-center text-sm">
                  No hay recepciones recientes
                </p>
              ) : (
                <div className="space-y-3">
                  {recentMoves.slice(0, 8).map((move) => (
                    <div key={move.id} className="border-b pb-3 last:border-0 last:pb-0">
                      <p className="text-sm font-medium">{move.productName}</p>
                      <p className="text-muted-foreground text-xs">
                        {move.reference ?? '—'} · {fmtDate(move.doneDate ?? move.scheduledDate)}
                      </p>
                      <p className="mt-0.5 text-xs">
                        <span className="font-medium">
                          {parseFloat(move.qtyDone).toLocaleString('es-HN', {
                            minimumFractionDigits: 2,
                          })}
                        </span>{' '}
                        → {move.toLocationName}
                      </p>
                      {move.lines.some((l) => l.lotNumber) && (
                        <p className="text-muted-foreground text-xs">
                          Lotes:{' '}
                          {move.lines
                            .filter((l) => l.lotNumber)
                            .map((l) => l.lotNumber)
                            .join(', ')}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
