'use client';

// src/components/accounting/journal-entry-form.tsx
import { useEffect, useState } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Trash2, AlertCircle } from 'lucide-react';
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
import { AccountCombobox } from '@/components/accounting/account-combobox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { createJournalEntrySchema } from '@/lib/validations/journal-entry.schema';

// ─── Form type (resolved from schema) ────────────────────────────────────────

type FormValues = z.infer<typeof createJournalEntrySchema>;

// ─── Types ────────────────────────────────────────────────────────────────────

interface JournalOption {
  id: string;
  code: string;
  name: string;
}

interface PeriodOption {
  id: string;
  name: string;
  status: string;
}

interface AccountOption {
  id: string;
  code: string;
  name: string;
  allowDirectEntry: boolean;
}

interface AccountNode extends AccountOption {
  children?: AccountNode[];
}

function flattenAccounts(nodes: AccountNode[]): AccountOption[] {

  const result: AccountOption[] = [];
  const stack = [...nodes];
  while (stack.length > 0) {
    const node = stack.pop()!;
    result.push({ id: node.id, code: node.code, name: node.name, allowDirectEntry: node.allowDirectEntry });
    if (node.children?.length) stack.push(...node.children);
  }
  return result;
}

interface JournalEntryFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function JournalEntryForm({ open, onOpenChange, onCreated }: JournalEntryFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [journals, setJournals] = useState<JournalOption[]>([]);
  const [periods, setPeriods] = useState<PeriodOption[]>([]);
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [currencies, setCurrencies] = useState<{ code: string; name: string; isBase: boolean }[]>(
    [],
  );

  const today = new Date().toISOString().split('T')[0]!;

  const {
    register,
    handleSubmit,
    control,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(createJournalEntrySchema),
    defaultValues: {
      entryDate: today,
      currencyCode: 'HNL',
      exchangeRate: 1,
      lines: [
        { accountId: '', debit: 0, credit: 0 },
        { accountId: '', debit: 0, credit: 0 },
      ],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'lines' });
  const lines = watch('lines');
  const watchedCurrency = watch('currencyCode');
  const watchedDate = watch('entryDate');

  const totalDebit = lines?.reduce((s, l) => s + (Number(l.debit) || 0), 0) ?? 0;
  const totalCredit = lines?.reduce((s, l) => s + (Number(l.credit) || 0), 0) ?? 0;
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.001;

  // Auto-cargar tasa de cambio cuando cambia moneda o fecha
  useEffect(() => {
    if (!watchedCurrency || watchedCurrency === 'HNL' || !watchedDate) return;

    const fetchRate = async () => {
      try {
        const params = new URLSearchParams({ currencyCode: watchedCurrency, date: watchedDate });
        const res = await fetch(`/api/v1/accounting/exchange-rates/lookup?${params.toString()}`, {
          credentials: 'include',
        });
        if (res.ok) {
          const payload = (await res.json()) as { success: boolean; data?: { rate: string } };
          if (payload.success && payload.data) {
            setValue('exchangeRate', parseFloat(payload.data.rate));
          }
        }
      } catch {
        // silencioso — el usuario puede ingresar la tasa manualmente
      }
    };

    void fetchRate();
  }, [watchedCurrency, watchedDate, setValue]);

  // Cargar datos al abrir
  useEffect(() => {
    if (!open) return;

    const fetchData = async () => {
      try {
        const [journalsRes, fiscalYearsRes, accountsRes, currenciesRes] = await Promise.all([
          fetch('/api/v1/accounting/journals', { credentials: 'include' }),
          fetch('/api/v1/accounting/fiscal-years', { credentials: 'include' }),
          fetch('/api/v1/accounting/accounts', { credentials: 'include' }),
          fetch('/api/v1/accounting/currencies', { credentials: 'include' }),
        ]);

        const [journalsData, fiscalYearsData, accountsData, currenciesData] = await Promise.all([
          journalsRes.json() as Promise<{ success: boolean; data: JournalOption[] }>,
          fiscalYearsRes.json() as Promise<{
            success: boolean;
            data: Array<{
              id: string;
              status: string;
              isActive: boolean;
              periods?: PeriodOption[];
            }>;
          }>,
          accountsRes.json() as Promise<{ success: boolean; data: AccountNode[] }>,
          currenciesRes.json() as Promise<{
            success: boolean;
            data: { code: string; name: string; isBase: boolean }[];
          }>,
        ]);

        setJournals((journalsData.data ?? []).filter((j) => j));

        // Obtener períodos OPEN de años fiscales activos o abiertos
        const allPeriods: PeriodOption[] = [];
        for (const year of fiscalYearsData.data ?? []) {
          if (year.status === 'OPEN' || year.isActive) {
            for (const p of year.periods ?? []) {
              if (p.status === 'OPEN') allPeriods.push(p);
            }
          }
        }
        setPeriods(allPeriods);

        // Aplanar árbol jerárquico y filtrar solo cuentas con entrada directa
        setAccounts(flattenAccounts(accountsData.data ?? []).filter((a) => a.allowDirectEntry));

        setCurrencies(currenciesData.data ?? []);
      } catch {
        toast.error('Error al cargar datos del formulario');
      }
    };

    void fetchData();
  }, [open]);

  const onSubmit = async (data: FormValues) => {
    setIsSubmitting(true);
    try {
      const response = await fetch('/api/v1/accounting/journal-entries', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const payload = (await response.json()) as { success: boolean; error?: string };
      if (!response.ok || !payload.success) {
        toast.error('Error al crear asiento', { description: payload.error });
        return;
      }
      toast.success('Asiento creado en borrador');
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
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Nuevo Asiento Contable</DialogTitle>
          <DialogDescription>
            Registra un asiento de partida doble. Se guardará como borrador para revisión.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 pt-2">
          {/* Cabecera: diario, período, fecha */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>
                Diario <span className="text-destructive">*</span>
              </Label>
              <Select onValueChange={(v) => setValue('journalId', v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar..." />
                </SelectTrigger>
                <SelectContent>
                  {journals.map((j) => (
                    <SelectItem key={j.id} value={j.id}>
                      [{j.code}] {j.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.journalId && (
                <p className="text-destructive text-xs">{errors.journalId.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>
                Período <span className="text-destructive">*</span>
              </Label>
              <Select onValueChange={(v) => setValue('fiscalPeriodId', v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar..." />
                </SelectTrigger>
                <SelectContent>
                  {periods.length === 0 && (
                    <SelectItem value="__none__" disabled>
                      Sin períodos abiertos
                    </SelectItem>
                  )}
                  {periods.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.fiscalPeriodId && (
                <p className="text-destructive text-xs">{errors.fiscalPeriodId.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="entryDate">
                Fecha <span className="text-destructive">*</span>
              </Label>
              <Input id="entryDate" type="date" {...register('entryDate')} />
              {errors.entryDate && (
                <p className="text-destructive text-xs">{errors.entryDate.message}</p>
              )}
            </div>
          </div>

          {/* Moneda y tipo de cambio */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>
                Moneda <span className="text-destructive">*</span>
              </Label>
              <Select
                defaultValue="HNL"
                onValueChange={(v) => {
                  setValue('currencyCode', v);
                  if (v === 'HNL') setValue('exchangeRate', 1);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar..." />
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

            <div className="space-y-1.5">
              <Label htmlFor="exchangeRate">
                Tipo de cambio (→ HNL){' '}
                {watchedCurrency && watchedCurrency !== 'HNL' && (
                  <span className="text-muted-foreground text-xs">(auto-cargado)</span>
                )}
              </Label>
              <Input
                id="exchangeRate"
                type="number"
                step="0.000001"
                min="0.000001"
                placeholder="1.000000"
                disabled={watchedCurrency === 'HNL'}
                {...register('exchangeRate', { valueAsNumber: true })}
              />
              {errors.exchangeRate && (
                <p className="text-destructive text-xs">{errors.exchangeRate.message}</p>
              )}
            </div>
          </div>

          {/* Descripción y referencia */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="description">
                Descripción <span className="text-destructive">*</span>
              </Label>
              <Input
                id="description"
                placeholder="Ej: Pago de nómina enero 2026"
                {...register('description')}
              />
              {errors.description && (
                <p className="text-destructive text-xs">{errors.description.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="reference">Referencia</Label>
              <Input
                id="reference"
                placeholder="Ej: Factura #001, Cheque #234"
                {...register('reference')}
              />
            </div>
          </div>

          {/* Líneas de asiento */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold">
                Líneas del asiento <span className="text-destructive">*</span>
              </Label>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                onClick={() => append({ accountId: '', debit: 0, credit: 0 })}
              >
                <Plus className="mr-1 h-3 w-3" />
                Agregar línea
              </Button>
            </div>

            <div className="grid grid-cols-[2fr_1fr_1fr_auto] gap-2 px-1 text-xs font-medium text-gray-500 uppercase">
              <span>Cuenta</span>
              <span className="text-right">Débito (L)</span>
              <span className="text-right">Crédito (L)</span>
              <span />
            </div>

            {fields.map((field, index) => (
              <div key={field.id} className="grid grid-cols-[2fr_1fr_1fr_auto] items-start gap-2">
                <div className="space-y-1">
                  <AccountCombobox
                    accounts={accounts}
                    value={lines[index]?.accountId ?? ''}
                    onChange={(v) => setValue(`lines.${index}.accountId`, v, { shouldValidate: true })}
                    hasError={!!errors.lines?.[index]?.accountId}
                  />
                  {errors.lines?.[index]?.accountId && (
                    <p className="text-destructive text-xs">
                      {errors.lines[index]?.accountId?.message}
                    </p>
                  )}
                </div>

                <div>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    placeholder="0.00"
                    className="text-right text-sm"
                    {...register(`lines.${index}.debit`, { valueAsNumber: true })}
                  />
                </div>

                <div>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    placeholder="0.00"
                    className="text-right text-sm"
                    {...register(`lines.${index}.credit`, { valueAsNumber: true })}
                  />
                </div>

                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="text-destructive hover:text-destructive mt-0.5 h-8 w-8 p-0"
                  disabled={fields.length <= 2}
                  onClick={() => remove(index)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}

            {errors.lines?.root && (
              <p className="text-destructive text-xs">{errors.lines.root.message}</p>
            )}
          </div>

          {/* Totales y balance */}
          <div className="bg-muted/40 rounded-lg border px-4 py-3">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="text-right">
                <span className="text-muted-foreground text-xs uppercase">Total Débito</span>
                <p className="text-lg font-bold">
                  L{' '}
                  {totalDebit.toLocaleString('es-HN', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </p>
              </div>
              <div className="text-right">
                <span className="text-muted-foreground text-xs uppercase">Total Crédito</span>
                <p className="text-lg font-bold">
                  L{' '}
                  {totalCredit.toLocaleString('es-HN', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </p>
              </div>
            </div>
            {totalDebit > 0 && !isBalanced && (
              <div className="text-destructive mt-2 flex items-center gap-1.5 text-xs">
                <AlertCircle className="h-3.5 w-3.5" />
                <span>
                  Diferencia: L{' '}
                  {Math.abs(totalDebit - totalCredit).toLocaleString('es-HN', {
                    minimumFractionDigits: 2,
                  })}{' '}
                  — el asiento no está balanceado
                </span>
              </div>
            )}
            {totalDebit > 0 && isBalanced && (
              <p className="mt-1 text-center text-xs text-green-600">
                ✓ Asiento balanceado (partida doble)
              </p>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={handleClose} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Guardando...' : 'Guardar borrador'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
