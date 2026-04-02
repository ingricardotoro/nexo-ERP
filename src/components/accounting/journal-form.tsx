'use client';

// src/components/accounting/journal-form.tsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { toast } from 'sonner';
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
import { createJournalSchema, type CreateJournalInput } from '@/lib/validations/journal.schema';

// ─── Constants ────────────────────────────────────────────────────────────────

const JOURNAL_TYPE_LABELS: Record<string, string> = {
  GENERAL: 'Diario General',
  SALES: 'Libro de Ventas',
  PURCHASES: 'Libro de Compras',
  CASH: 'Caja y Efectivo',
  BANK: 'Bancos',
  PAYROLL: 'Nómina',
  ADJUSTMENT: 'Ajustes',
};

const JOURNAL_TYPES = Object.entries(JOURNAL_TYPE_LABELS);

// ─── Types ────────────────────────────────────────────────────────────────────

interface JournalFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function JournalForm({ open, onOpenChange, onCreated }: JournalFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors },
  } = useForm<CreateJournalInput>({
    resolver: zodResolver(createJournalSchema),
  });

  const onSubmit = async (data: CreateJournalInput) => {
    setIsSubmitting(true);
    try {
      const response = await fetch('/api/v1/accounting/journals', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const payload = (await response.json()) as { success: boolean; error?: string };

      if (!response.ok || !payload.success) {
        toast.error('Error al crear diario', { description: payload.error });
        return;
      }

      toast.success('Diario creado', { description: `${data.name} (${data.code})` });
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
          <DialogTitle>Nuevo Diario Contable</DialogTitle>
          <DialogDescription>
            Define un libro de diario para agrupar asientos del mismo tipo.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-2">
          {/* Name */}
          <div className="space-y-1.5">
            <Label htmlFor="name">
              Nombre <span className="text-destructive">*</span>
            </Label>
            <Input id="name" placeholder="Ej: Diario General" {...register('name')} />
            {errors.name && <p className="text-destructive text-xs">{errors.name.message}</p>}
          </div>

          {/* Code */}
          <div className="space-y-1.5">
            <Label htmlFor="code">
              Código <span className="text-destructive">*</span>
            </Label>
            <Input
              id="code"
              placeholder="Ej: DJ"
              maxLength={10}
              className="uppercase"
              {...register('code')}
              onChange={(e) => {
                e.target.value = e.target.value.toUpperCase();
                void register('code').onChange(e);
              }}
            />
            <p className="text-muted-foreground text-xs">
              Código corto único (máx. 10 caracteres, mayúsculas)
            </p>
            {errors.code && <p className="text-destructive text-xs">{errors.code.message}</p>}
          </div>

          {/* Journal Type */}
          <div className="space-y-1.5">
            <Label>
              Tipo <span className="text-destructive">*</span>
            </Label>
            <Select
              onValueChange={(v) => setValue('journalType', v as CreateJournalInput['journalType'])}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar tipo..." />
              </SelectTrigger>
              <SelectContent>
                {JOURNAL_TYPES.map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.journalType && (
              <p className="text-destructive text-xs">{errors.journalType.message}</p>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={handleClose} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Creando...' : 'Crear Diario'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
