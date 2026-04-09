'use client';

// src/app/(dashboard)/dashboard/inventory/adjustments/page.tsx
import { useCallback, useEffect, useState } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface ProductRow {
  id: string;
  code: string;
  name: string;
}

interface Location {
  id: string;
  name: string;
  locationType: string;
}

interface AdjustmentResult {
  reference: string;
  productId: string;
  locationId: string;
  previousQty: string;
  newQty: string;
  delta: string;
  reason: string;
  notes: string | null;
}

const REASON_LABELS: Record<string, string> = {
  CONTEO_FISICO: 'Conteo físico',
  MERMA: 'Merma / Pérdida natural',
  DANO: 'Daño / Deterioro',
  DEVOLUCION: 'Devolución interna',
  OTRO: 'Otro',
};

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function AdjustmentsPage() {
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(false);

  // Form state
  const [productId, setProductId] = useState('');
  const [locationId, setLocationId] = useState('');
  const [newQuantity, setNewQuantity] = useState('');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');

  // Last result
  const [lastResult, setLastResult] = useState<AdjustmentResult | null>(null);

  const fetchCatalog = useCallback(async () => {
    try {
      const [prodRes, locRes] = await Promise.all([
        fetch('/api/v1/inventory/products?activeOnly=true&limit=500', { credentials: 'include' }),
        fetch('/api/v1/inventory/locations?locationType=INTERNAL', { credentials: 'include' }),
      ]);
      if (prodRes.ok) {
        const d = (await prodRes.json()) as { success: boolean; products: ProductRow[] };
        if (d.success) setProducts(d.products);
      }
      if (locRes.ok) {
        const d = (await locRes.json()) as { success: boolean; data: Location[] };
        if (d.success) setLocations(d.data);
      }
    } catch {
      // non-critical
    }
  }, []);

  useEffect(() => {
    void fetchCatalog();
  }, [fetchCatalog]);

  const handleSubmit = async () => {
    if (!productId) {
      toast.error('Selecciona un producto');
      return;
    }
    if (!locationId) {
      toast.error('Selecciona una ubicación');
      return;
    }
    if (newQuantity === '' || isNaN(parseFloat(newQuantity))) {
      toast.error('Ingresa una cantidad válida');
      return;
    }
    if (!reason) {
      toast.error('Selecciona el motivo del ajuste');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/v1/inventory/adjustments', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId,
          locationId,
          newQuantity: parseFloat(newQuantity),
          reason,
          notes: notes || undefined,
        }),
      });
      const payload = (await res.json()) as {
        success: boolean;
        data?: AdjustmentResult & { message?: string };
        error?: string;
      };
      if (!res.ok) throw new Error(payload.error ?? 'Error al registrar ajuste');

      if (payload.data?.message) {
        toast.info(payload.data.message);
        return;
      }

      toast.success(`Ajuste registrado — ${payload.data?.reference}`);
      setLastResult(payload.data ?? null);

      // Reset form
      setProductId('');
      setLocationId('');
      setNewQuantity('');
      setReason('');
      setNotes('');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al registrar ajuste');
    } finally {
      setLoading(false);
    }
  };

  const selectedProduct = products.find((p) => p.id === productId);
  const selectedLocation = locations.find((l) => l.id === locationId);

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Ajuste de Inventario</h1>
        <p className="text-muted-foreground text-sm">
          Establece la cantidad exacta de un producto en una ubicación
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <SlidersHorizontal className="h-5 w-5" />
              Nuevo Ajuste
            </CardTitle>
            <CardDescription>
              El sistema calculará la diferencia y creará el movimiento de inventario
              correspondiente.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Producto *</Label>
              <Select value={productId} onValueChange={setProductId}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar producto..." />
                </SelectTrigger>
                <SelectContent>
                  {products.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      <span className="font-mono text-xs text-gray-500">{p.code}</span> {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Ubicación *</Label>
              <Select value={locationId} onValueChange={setLocationId}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar ubicación..." />
                </SelectTrigger>
                <SelectContent>
                  {locations.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Nueva Cantidad *</Label>
              <Input
                type="number"
                min="0"
                step="0.0001"
                placeholder="0.0000"
                value={newQuantity}
                onChange={(e) => setNewQuantity(e.target.value)}
              />
              <p className="text-muted-foreground mt-1 text-xs">
                Ingresa la cantidad real contada o corregida
              </p>
            </div>

            <div>
              <Label>Motivo *</Label>
              <Select value={reason} onValueChange={setReason}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar motivo..." />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(REASON_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Notas</Label>
              <Textarea
                placeholder="Observaciones adicionales..."
                rows={2}
                maxLength={300}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            <Button onClick={handleSubmit} disabled={loading} className="w-full">
              {loading ? 'Registrando...' : 'Registrar Ajuste'}
            </Button>
          </CardContent>
        </Card>

        {/* Info + Last result */}
        <div className="space-y-4">
          {/* How it works */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Cómo funciona</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-start gap-3">
                <div className="bg-primary/10 text-primary flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold">
                  1
                </div>
                <p className="text-muted-foreground">
                  El sistema consulta la cantidad actual en la ubicación seleccionada.
                </p>
              </div>
              <div className="flex items-start gap-3">
                <div className="bg-primary/10 text-primary flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold">
                  2
                </div>
                <p className="text-muted-foreground">
                  Calcula la diferencia (<strong>delta</strong>) entre la cantidad actual y la
                  nueva.
                </p>
              </div>
              <div className="flex items-start gap-3">
                <div className="bg-primary/10 text-primary flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold">
                  3
                </div>
                <p className="text-muted-foreground">
                  Crea un movimiento de stock (<strong>ADJ/YYYY/NNNNN</strong>) y actualiza el
                  saldo.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Last result */}
          {lastResult && (
            <Card className="border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-green-700 dark:text-green-400">
                  Último ajuste registrado
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Referencia</span>
                  <span className="font-mono font-semibold">{lastResult.reference}</span>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Cantidad anterior</span>
                  <span className="tabular-nums">
                    {parseFloat(lastResult.previousQty).toFixed(4)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Cantidad nueva</span>
                  <span className="font-medium tabular-nums">
                    {parseFloat(lastResult.newQty).toFixed(4)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Delta</span>
                  <span
                    className={`font-semibold tabular-nums ${
                      parseFloat(lastResult.delta) >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}
                  >
                    {parseFloat(lastResult.delta) >= 0 ? '+' : ''}
                    {parseFloat(lastResult.delta).toFixed(4)}
                  </span>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Motivo</span>
                  <span>{REASON_LABELS[lastResult.reason] ?? lastResult.reason}</span>
                </div>
                {lastResult.notes && (
                  <p className="text-muted-foreground text-xs">{lastResult.notes}</p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Preview */}
          {selectedProduct && selectedLocation && newQuantity !== '' && (
            <Card className="border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-blue-700 dark:text-blue-400">
                  Vista previa
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                <p>
                  <span className="text-muted-foreground">Producto: </span>
                  <span className="font-medium">{selectedProduct.name}</span>
                </p>
                <p>
                  <span className="text-muted-foreground">Ubicación: </span>
                  <span className="font-medium">{selectedLocation.name}</span>
                </p>
                <p>
                  <span className="text-muted-foreground">Nueva cantidad: </span>
                  <span className="font-mono font-semibold">
                    {parseFloat(newQuantity || '0').toFixed(4)}
                  </span>
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
