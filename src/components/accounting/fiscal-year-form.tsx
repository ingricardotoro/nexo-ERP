'use client';

// src/components/accounting/fiscal-year-form.tsx
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  createFiscalYearSchema,
  type CreateFiscalYearInput,
} from '@/lib/validations/fiscal-year.schema';

// ─── Types ────────────────────────────────────────────────────────────────────

interface FiscalYearFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function FiscalYearForm({ open, onOpenChange, onCreated }: FiscalYearFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const currentYear = new Date().getFullYear();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<CreateFiscalYearInput>({
    resolver: zodResolver(createFiscalYearSchema),
    defaultValues: {
      year: currentYear,
      startDate: `${currentYear}-01-01`,
      endDate: `${currentYear}-12-31`,
    },
  });

  const watchedYear = watch('year');

  // Auto-fill standard dates when year changes
  const handleYearChange = (value: string) => {
    const y = parseInt(value, 10);
    if (!isNaN(y) && y >= 2000 && y <= 2099) {
      setValue('startDate', `${y}-01-01`);
      setValue('endDate', `${y}-12-31`);
    }
  };

  const onSubmit = async (data: CreateFiscalYearInput) => {
    setIsSubmitting(true);
    try {
      const response = await fetch('/api/v1/accounting/fiscal-years', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const payload = (await response.json()) as { success: boolean; error?: string };

      if (!response.ok || !payload.success) {
        toast.error('Error al crear año fiscal', { description: payload.error });
        return;
      }

      toast.success('Año fiscal creado', {
        description: `Ejercicio ${data.year} con 12 períodos mensuales generados`,
      });
      reset();
      onOpenChange(false);
      onCreated();
    } catch {
      toast.error('Error de conexión');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      reset();
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nuevo Año Fiscal</DialogTitle>
          <DialogDescription>
            Se crearán automáticamente 12 períodos mensuales para el ejercicio.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-2">
          {/* Year */}
          <div className="space-y-1.5">
            <Label htmlFor="year">
              Año fiscal <span className="text-destructive">*</span>
            </Label>
            <Input
              id="year"
              type="number"
              min={2000}
              max={2099}
              placeholder={String(currentYear)}
              {...register('year', { valueAsNumber: true })}
              onChange={(e) => {
                register('year').onChange(e);
                handleYearChange(e.target.value);
              }}
            />
            {errors.year && <p className="text-destructive text-xs">{errors.year.message}</p>}
          </div>

          {/* Date range */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="startDate">
                Fecha inicio <span className="text-destructive">*</span>
              </Label>
              <Input id="startDate" type="date" {...register('startDate')} />
              {errors.startDate && (
                <p className="text-destructive text-xs">{errors.startDate.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="endDate">
                Fecha fin <span className="text-destructive">*</span>
              </Label>
              <Input id="endDate" type="date" {...register('endDate')} />
              {errors.endDate && (
                <p className="text-destructive text-xs">{errors.endDate.message}</p>
              )}
            </div>
          </div>

          <p className="text-muted-foreground text-xs">
            Año <strong>{watchedYear}</strong>: Los 12 períodos mensuales se generarán
            automáticamente desde la fecha de inicio.
          </p>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={handleClose} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Creando...' : 'Crear Año Fiscal'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
