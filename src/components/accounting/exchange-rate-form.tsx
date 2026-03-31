'use client';

// src/components/accounting/exchange-rate-form.tsx
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import type { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { upsertExchangeRateSchema } from '@/lib/validations/exchange-rate.schema';

// ─── Types ────────────────────────────────────────────────────────────────────

type FormValues = z.infer<typeof upsertExchangeRateSchema>;

interface CurrencyOption {
  code: string;
  name: string;
  symbol: string;
  isBase: boolean;
}

interface ExchangeRateFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ExchangeRateForm({ open, onOpenChange, onSaved }: ExchangeRateFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currencies, setCurrencies] = useState<CurrencyOption[]>([]);

  const today = new Date().toISOString().split('T')[0]!;

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(upsertExchangeRateSchema),
    defaultValues: {
      date: today,
      source: 'manual',
    },
  });

  const selectedCurrency = watch('currencyCode');

  // Cargar monedas al abrir (excluye moneda base)
  useEffect(() => {
    if (!open) return;

    const fetchCurrencies = async () => {
      try {
        const res = await fetch('/api/v1/accounting/currencies', { credentials: 'include' });
        const payload = (await res.json()) as {
          success: boolean;
          data: CurrencyOption[];
        };
        if (payload.success) {
          // Solo monedas no-base (no tiene sentido tasa para HNL)
          setCurrencies((payload.data ?? []).filter((c) => !c.isBase));
        }
      } catch {
        toast.error('Error al cargar monedas');
      }
    };

    void fetchCurrencies();
  }, [open]);

  const onSubmit = async (data: FormValues) => {
    setIsSubmitting(true);
    try {
      const response = await fetch('/api/v1/accounting/exchange-rates', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const payload = (await response.json()) as { success: boolean; error?: string };
      if (!response.ok || !payload.success) {
        toast.error('Error al guardar', { description: payload.error });
        return;
      }
      toast.success('Tipo de cambio registrado');
      reset({ date: today, source: 'manual' });
      onOpenChange(false);
      onSaved();
    } catch {
      toast.error('Error de conexión');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      reset({ date: today, source: 'manual' });
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar Tipo de Cambio</DialogTitle>
          <DialogDescription>
            Registra la tasa de cambio respecto al Lempira (HNL) para una fecha específica.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-2">
          {/* Moneda */}
          <div className="space-y-1.5">
            <Label>
              Moneda <span className="text-destructive">*</span>
            </Label>
            <Select
              onValueChange={(v) => setValue('currencyCode', v, { shouldValidate: true })}
              value={selectedCurrency ?? ''}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar moneda..." />
              </SelectTrigger>
              <SelectContent>
                {currencies.map((c) => (
                  <SelectItem key={c.code} value={c.code}>
                    {c.code} — {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.currencyCode && (
              <p className="text-destructive text-xs">{errors.currencyCode.message}</p>
            )}
          </div>

          {/* Fecha y Tasa */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="date">
                Fecha <span className="text-destructive">*</span>
              </Label>
              <Input id="date" type="date" {...register('date')} />
              {errors.date && <p className="text-destructive text-xs">{errors.date.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="rate">
                Tasa (1 {selectedCurrency ?? '???'} = ? HNL){' '}
                <span className="text-destructive">*</span>
              </Label>
              <Input
                id="rate"
                type="number"
                step="0.000001"
                min="0.000001"
                placeholder="Ej: 24.456700"
                {...register('rate')}
              />
              {errors.rate && <p className="text-destructive text-xs">{errors.rate.message}</p>}
            </div>
          </div>

          {/* Fuente */}
          <div className="space-y-1.5">
            <Label>Fuente</Label>
            <Select
              defaultValue="manual"
              onValueChange={(v) =>
                setValue('source', v as 'manual' | 'BCH' | 'API', { shouldValidate: true })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="manual">Manual</SelectItem>
                <SelectItem value="BCH">BCH (Banco Central de Honduras)</SelectItem>
                <SelectItem value="API">API externa</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={handleClose} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Guardando...' : 'Guardar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
