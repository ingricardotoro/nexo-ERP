// src/app/(dashboard)/invoicing/tax-rates/page.tsx
'use client';

import { useCallback, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Percent, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { createTaxRateSchema, type CreateTaxRateInput } from '@/lib/validations/tax-rate.schema';

interface TaxRateData {
  id: string;
  code: string;
  name: string;
  rate: number;
  isActive: boolean;
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

const SKELETON_ROWS = 4;

export default function TaxRatesPage() {
  const [taxRates, setTaxRates] = useState<TaxRateData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const form = useForm<CreateTaxRateInput>({
    resolver: zodResolver(createTaxRateSchema),
    defaultValues: {
      code: '',
      name: '',
      rate: 0.15,
    },
  });

  const fetchTaxRates = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/v1/invoicing/tax-rates', { credentials: 'include' });
      const payload = (await response.json()) as ApiResponse<TaxRateData[]>;

      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.error ?? 'Error al obtener tasas de impuesto');
      }
      setTaxRates(payload.data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error desconocido';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchTaxRates();
  }, [fetchTaxRates]);

  const handleCreate = async (data: CreateTaxRateInput) => {
    try {
      const response = await fetch('/api/v1/invoicing/tax-rates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      const payload = (await response.json()) as ApiResponse<TaxRateData>;

      if (!response.ok || !payload.success) {
        throw new Error(payload.error ?? 'Error al crear la tasa de impuesto');
      }

      toast.success('Tasa de impuesto creada exitosamente');
      form.reset();
      setCreateDialogOpen(false);
      await fetchTaxRates();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No se pudo crear la tasa';
      toast.error('Error al crear tasa de impuesto', { description: message });
    }
  };

  const handleToggleActive = async (rateId: string, newValue: boolean) => {
    setTogglingId(rateId);
    try {
      const response = await fetch(`/api/v1/invoicing/tax-rates/${rateId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ isActive: newValue }),
      });
      const payload = (await response.json()) as ApiResponse<TaxRateData>;

      if (!response.ok || !payload.success) {
        throw new Error(payload.error ?? 'Error al actualizar la tasa');
      }

      toast.success(newValue ? 'Tasa activada' : 'Tasa desactivada');
      await fetchTaxRates();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No se pudo actualizar la tasa';
      toast.error('Error al actualizar tasa', { description: message });
    } finally {
      setTogglingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-foreground text-3xl font-bold tracking-tight">Tasas de Impuesto</h1>
          <p className="text-muted-foreground mt-2">
            Configura las tasas de ISV aplicables en las facturas
          </p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
          Nueva Tasa
        </Button>
      </div>

      {/* Tabla */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Percent className="h-5 w-5" aria-hidden="true" />
            Tasas de Impuesto Configuradas
          </CardTitle>
          <CardDescription>
            {loading ? 'Cargando...' : `${taxRates.length} tasa(s) configurada(s)`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && !loading && <p className="text-destructive mb-4 text-sm">{error}</p>}

          {loading ? (
            <div className="space-y-3" aria-label="Cargando tasas de impuesto" aria-busy="true">
              {Array.from({ length: SKELETON_ROWS }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full rounded-md" />
              ))}
            </div>
          ) : taxRates.length === 0 ? (
            <div className="border-border flex flex-col items-center justify-center rounded-lg border py-16">
              <Percent className="text-muted-foreground h-10 w-10" aria-hidden="true" />
              <p className="text-muted-foreground mt-4 text-center text-sm font-medium">
                No hay tasas de impuesto configuradas
              </p>
              <p className="text-muted-foreground mt-1 text-center text-xs">
                Crea una tasa con el botón &quot;Nueva Tasa&quot; para comenzar a facturar.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead className="text-right">Tasa (%)</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="w-20">Activo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {taxRates.map((rate) => (
                  <TableRow key={rate.id}>
                    <TableCell>
                      <span className="font-mono text-sm font-semibold">{rate.code}</span>
                    </TableCell>
                    <TableCell className="text-sm">{rate.name}</TableCell>
                    <TableCell className="text-right font-mono text-sm font-semibold">
                      {(rate.rate * 100).toFixed(2)}%
                    </TableCell>
                    <TableCell>
                      {rate.isActive ? (
                        <Badge
                          variant="outline"
                          className="border-green-300 bg-green-50 text-green-700"
                        >
                          Activa
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="border-gray-300 bg-gray-100 text-gray-600"
                        >
                          Inactiva
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={rate.isActive}
                        onCheckedChange={(val) => void handleToggleActive(rate.id, val)}
                        disabled={togglingId === rate.id}
                        aria-label={`${rate.isActive ? 'Desactivar' : 'Activar'} tasa ${rate.name}`}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Dialog: Nueva Tasa */}
      <Dialog
        open={createDialogOpen}
        onOpenChange={(open) => {
          setCreateDialogOpen(open);
          if (!open) form.reset();
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Nueva Tasa de Impuesto</DialogTitle>
            <DialogDescription>
              Crea una nueva tasa de ISV para usar en las líneas de factura.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleCreate)} className="space-y-4">
              {/* Código */}
              <FormField
                control={form.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel htmlFor="rateCode">Código *</FormLabel>
                    <FormControl>
                      <Input
                        id="rateCode"
                        placeholder="ISV_15"
                        className="font-mono uppercase"
                        autoFocus
                        {...field}
                        onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                      />
                    </FormControl>
                    <FormDescription className="text-xs">
                      Solo letras mayúsculas, números y guión bajo
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Nombre */}
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel htmlFor="rateName">Nombre *</FormLabel>
                    <FormControl>
                      <Input id="rateName" placeholder="ISV 15%" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Tasa */}
              <FormField
                control={form.control}
                name="rate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel htmlFor="rateValue">Tasa (decimal) *</FormLabel>
                    <FormControl>
                      <Input
                        id="rateValue"
                        type="number"
                        step="0.01"
                        min="0"
                        max="1"
                        placeholder="0.15"
                        {...field}
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormDescription className="text-xs">
                      Ingresa el valor decimal: 0.15 para 15%, 0.18 para 18%, 0 para exento
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Preview */}
              {form.watch('rate') >= 0 && (
                <div className="bg-muted rounded-md p-3 text-sm">
                  <span className="text-muted-foreground">Equivale a: </span>
                  <span className="font-mono font-semibold">
                    {(form.watch('rate') * 100).toFixed(2)}%
                  </span>
                </div>
              )}

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCreateDialogOpen(false)}
                  disabled={form.formState.isSubmitting}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={form.formState.isSubmitting}>
                  {form.formState.isSubmitting && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                  )}
                  {form.formState.isSubmitting ? 'Guardando...' : 'Crear Tasa'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
