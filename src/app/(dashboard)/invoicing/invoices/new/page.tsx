// src/app/(dashboard)/invoicing/invoices/new/page.tsx
'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, useFieldArray, Controller, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, Plus, Trash2, Loader2, Calculator } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatCurrency, formatTaxRate } from '@/components/invoicing/format-currency';
import { InvoiceType } from '@prisma/client';

// Tipos locales
interface TaxRate {
  id: string;
  code: string;
  name: string;
  rate: number;
  isActive: boolean;
}

interface ContactOption {
  id: string;
  legalName: string;
  tradeName?: string | null;
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Schema local del formulario (sin .default() para compatibilidad con react-hook-form)
const invoiceFormSchema = z.object({
  invoiceType: z.nativeEnum(InvoiceType),
  issueDate: z.string().min(1, 'La fecha de emisión es requerida'),
  dueDate: z.string().optional(),
  contactId: z.string().uuid('Debes seleccionar un cliente válido'),
  paymentTermsId: z.string().uuid().optional(),
  currencyCode: z.string().length(3),
  exchangeRate: z.number().positive('El tipo de cambio debe ser mayor a 0'),
  notes: z.string().max(1000).optional(),
  lines: z
    .array(
      z.object({
        lineNumber: z.number().int().min(1),
        description: z.string().min(1, 'La descripción es requerida').max(500),
        quantity: z.number().positive('La cantidad debe ser mayor a 0'),
        unitPrice: z.number().nonnegative('El precio no puede ser negativo'),
        discountPct: z
          .number()
          .min(0, 'El descuento no puede ser negativo')
          .max(100, 'El descuento no puede superar el 100%'),
        taxRateId: z.string().uuid('Debes seleccionar una tasa de impuesto'),
        accountId: z.string().uuid().optional(),
      }),
    )
    .min(1, 'La factura debe tener al menos una línea'),
});

type InvoiceFormValues = z.infer<typeof invoiceFormSchema>;

// Valor de línea vacío por defecto
const emptyLine = {
  lineNumber: 1,
  description: '',
  quantity: 1,
  unitPrice: 0,
  discountPct: 0,
  taxRateId: '',
};

export default function NewInvoicePage() {
  const router = useRouter();

  const [taxRates, setTaxRates] = useState<TaxRate[]>([]);
  const [contacts, setContacts] = useState<ContactOption[]>([]);
  const [contactSearch, setContactSearch] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<InvoiceFormValues>({
    resolver: zodResolver(invoiceFormSchema) as Resolver<InvoiceFormValues>,
    defaultValues: {
      invoiceType: 'FACTURA',
      issueDate: new Date().toISOString().split('T')[0],
      dueDate: undefined,
      contactId: '',
      paymentTermsId: undefined,
      currencyCode: 'HNL',
      exchangeRate: 1,
      notes: '',
      lines: [{ ...emptyLine, lineNumber: 1 }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'lines',
  });

  // Cargar tasas de impuesto
  const fetchTaxRates = useCallback(async () => {
    try {
      const response = await fetch('/api/v1/invoicing/tax-rates', { credentials: 'include' });
      const payload = (await response.json()) as ApiResponse<TaxRate[]>;
      if (payload.success && payload.data) {
        setTaxRates(payload.data.filter((r) => r.isActive));
      }
    } catch {
      toast.error('No se pudieron cargar las tasas de impuesto');
    }
  }, []);

  // Cargar contactos (clientes)
  const fetchContacts = useCallback(async (search: string) => {
    try {
      const params = new URLSearchParams({ role: 'customer', limit: '50' });
      if (search.trim()) params.set('search', search.trim());
      const response = await fetch(`/api/v1/contacts?${params.toString()}`, {
        credentials: 'include',
      });
      const payload = (await response.json()) as ApiResponse<ContactOption[]>;
      if (payload.success && payload.data) {
        setContacts(payload.data);
      }
    } catch {
      // No bloquear el formulario
    }
  }, []);

  useEffect(() => {
    void fetchTaxRates();
    void fetchContacts('');
  }, [fetchTaxRates, fetchContacts]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchContacts(contactSearch);
    }, 300);
    return () => clearTimeout(timer);
  }, [contactSearch, fetchContacts]);

  // Obtener tasa de un taxRateId
  const getTaxRate = (taxRateId: string): number => {
    return taxRates.find((r) => r.id === taxRateId)?.rate ?? 0;
  };

  // Calcular totales dinámicamente
  const watchLines = form.watch('lines');
  const watchCurrency = form.watch('currencyCode');

  const lineTotals = watchLines.map((line) => {
    const qty = Number(line.quantity) || 0;
    const price = Number(line.unitPrice) || 0;
    const disc = Number(line.discountPct) || 0;
    const taxRate = getTaxRate(line.taxRateId);
    const base = qty * price * (1 - disc / 100);
    const tax = base * taxRate;
    return { base, tax, total: base + tax };
  });

  const subtotal = lineTotals.reduce((acc, l) => acc + l.base, 0);
  const isvTotal = lineTotals.reduce((acc, l) => acc + l.tax, 0);
  const total = subtotal + isvTotal;

  const onSubmit = async (data: InvoiceFormValues) => {
    setIsSubmitting(true);
    try {
      const body = {
        ...data,
        dueDate: data.dueDate || undefined,
        paymentTermsId: data.paymentTermsId || undefined,
        notes: data.notes || undefined,
        lines: data.lines.map((line, idx) => ({
          ...line,
          lineNumber: idx + 1,
        })),
      };

      const response = await fetch('/api/v1/invoicing/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });

      const payload = (await response.json()) as ApiResponse<{ id: string }>;

      if (!response.ok || !payload.success) {
        throw new Error(payload.error ?? 'Error al crear la factura');
      }

      toast.success('Factura guardada como borrador', {
        description: 'Puedes emitirla desde el detalle de la factura.',
      });

      if (payload.data?.id) {
        router.push(`/dashboard/invoicing/invoices/${payload.data.id}` as never);
      } else {
        router.push('/dashboard/invoicing/invoices' as never);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No se pudo guardar la factura';
      toast.error('Error al guardar factura', { description: message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const addLine = () => {
    append({
      ...emptyLine,
      lineNumber: fields.length + 1,
      taxRateId: taxRates[0]?.id ?? '',
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="outline"
          size="icon"
          onClick={() => router.push('/dashboard/invoicing/invoices' as never)}
          aria-label="Volver a facturas"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        </Button>
        <div>
          <h1 className="text-foreground text-3xl font-bold tracking-tight">Nueva Factura</h1>
          <p className="text-muted-foreground mt-1">
            Completa los datos y agrega las líneas de detalle
          </p>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Datos generales */}
          <Card>
            <CardHeader>
              <CardTitle>Datos del Documento</CardTitle>
              <CardDescription>Tipo de documento, cliente y fechas</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {/* Tipo de documento */}
                <FormField
                  control={form.control}
                  name="invoiceType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel htmlFor="invoiceType">Tipo de Documento *</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger id="invoiceType">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="FACTURA">Factura</SelectItem>
                          <SelectItem value="NOTA_CREDITO">Nota de Crédito</SelectItem>
                          <SelectItem value="NOTA_DEBITO">Nota de Débito</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Moneda */}
                <FormField
                  control={form.control}
                  name="currencyCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel htmlFor="currencyCode">Moneda *</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger id="currencyCode">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="HNL">Lempiras (HNL)</SelectItem>
                          <SelectItem value="USD">Dólares (USD)</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Tipo de cambio */}
                <FormField
                  control={form.control}
                  name="exchangeRate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel htmlFor="exchangeRate">Tipo de Cambio *</FormLabel>
                      <FormControl>
                        <Input
                          id="exchangeRate"
                          type="number"
                          step="0.0001"
                          min="0.0001"
                          placeholder="1.0000"
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || 1)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <Separator />

              <div className="grid gap-4 sm:grid-cols-2">
                {/* Cliente */}
                <div className="space-y-2">
                  <label htmlFor="contactSearch" className="text-sm font-medium">
                    Cliente *
                  </label>
                  <Input
                    id="contactSearch"
                    placeholder="Buscar cliente..."
                    value={contactSearch}
                    onChange={(e) => setContactSearch(e.target.value)}
                    aria-label="Buscar cliente"
                  />
                  <FormField
                    control={form.control}
                    name="contactId"
                    render={({ field }) => (
                      <FormItem>
                        <Select
                          value={field.value ?? 'none'}
                          onValueChange={(v) => field.onChange(v === 'none' ? '' : v)}
                        >
                          <FormControl>
                            <SelectTrigger aria-label="Seleccionar cliente">
                              <SelectValue placeholder="Selecciona un cliente" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="none">Selecciona un cliente</SelectItem>
                            {contacts.map((c) => (
                              <SelectItem key={c.id} value={c.id}>
                                {c.tradeName ?? c.legalName}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Fechas */}
                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={form.control}
                    name="issueDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel htmlFor="issueDate">Fecha Emisión *</FormLabel>
                        <FormControl>
                          <Input id="issueDate" type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="dueDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel htmlFor="dueDate">Fecha Vencimiento</FormLabel>
                        <FormControl>
                          <Input
                            id="dueDate"
                            type="date"
                            value={field.value ?? ''}
                            onChange={(e) => field.onChange(e.target.value || undefined)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* Notas */}
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel htmlFor="notes">Notas</FormLabel>
                    <FormControl>
                      <Input
                        id="notes"
                        placeholder="Observaciones o instrucciones de pago..."
                        value={field.value ?? ''}
                        onChange={field.onChange}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Líneas de detalle */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Calculator className="h-5 w-5" aria-hidden="true" />
                  Líneas de Detalle
                </CardTitle>
                <CardDescription>Productos o servicios facturados</CardDescription>
              </div>
              <Button type="button" variant="outline" onClick={addLine}>
                <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
                Agregar Línea
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {form.formState.errors.lines?.root && (
                <p className="text-destructive text-sm">
                  {form.formState.errors.lines.root.message}
                </p>
              )}
              {/* Tabla de líneas — scroll horizontal en móvil */}
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8">#</TableHead>
                      <TableHead className="min-w-48">Descripción</TableHead>
                      <TableHead className="w-24">Cantidad</TableHead>
                      <TableHead className="w-32">Precio Unit.</TableHead>
                      <TableHead className="w-24">Desc. %</TableHead>
                      <TableHead className="w-40">Tasa ISV</TableHead>
                      <TableHead className="w-28 text-right">Subtotal</TableHead>
                      <TableHead className="w-24 text-right">ISV</TableHead>
                      <TableHead className="w-28 text-right">Total</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {fields.map((field, index) => {
                      const lineTot = lineTotals[index] ?? { base: 0, tax: 0, total: 0 };
                      return (
                        <TableRow key={field.id}>
                          {/* Nro. de línea */}
                          <TableCell className="text-muted-foreground text-sm font-medium">
                            {index + 1}
                          </TableCell>

                          {/* Descripción */}
                          <TableCell>
                            <Controller
                              control={form.control}
                              name={`lines.${index}.description`}
                              render={({ field: f, fieldState }) => (
                                <div>
                                  <Input
                                    {...f}
                                    placeholder="Descripción del producto o servicio"
                                    aria-label={`Descripción de línea ${index + 1}`}
                                    className={fieldState.error ? 'border-destructive' : ''}
                                  />
                                  {fieldState.error && (
                                    <p className="text-destructive mt-1 text-xs">
                                      {fieldState.error.message}
                                    </p>
                                  )}
                                </div>
                              )}
                            />
                          </TableCell>

                          {/* Cantidad */}
                          <TableCell>
                            <Controller
                              control={form.control}
                              name={`lines.${index}.quantity`}
                              render={({ field: f, fieldState }) => (
                                <div>
                                  <Input
                                    type="number"
                                    step="0.0001"
                                    min="0.0001"
                                    placeholder="1"
                                    aria-label={`Cantidad de línea ${index + 1}`}
                                    value={f.value}
                                    onChange={(e) => f.onChange(parseFloat(e.target.value) || 0)}
                                    className={fieldState.error ? 'border-destructive' : ''}
                                  />
                                </div>
                              )}
                            />
                          </TableCell>

                          {/* Precio unitario */}
                          <TableCell>
                            <Controller
                              control={form.control}
                              name={`lines.${index}.unitPrice`}
                              render={({ field: f, fieldState }) => (
                                <div>
                                  <Input
                                    type="number"
                                    step="0.0001"
                                    min="0"
                                    placeholder="0.00"
                                    aria-label={`Precio unitario de línea ${index + 1}`}
                                    value={f.value}
                                    onChange={(e) => f.onChange(parseFloat(e.target.value) || 0)}
                                    className={fieldState.error ? 'border-destructive' : ''}
                                  />
                                </div>
                              )}
                            />
                          </TableCell>

                          {/* Descuento % */}
                          <TableCell>
                            <Controller
                              control={form.control}
                              name={`lines.${index}.discountPct`}
                              render={({ field: f }) => (
                                <Input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  max="100"
                                  placeholder="0"
                                  aria-label={`Descuento % de línea ${index + 1}`}
                                  value={f.value}
                                  onChange={(e) => f.onChange(parseFloat(e.target.value) || 0)}
                                />
                              )}
                            />
                          </TableCell>

                          {/* Tasa de ISV */}
                          <TableCell>
                            <Controller
                              control={form.control}
                              name={`lines.${index}.taxRateId`}
                              render={({ field: f, fieldState }) => (
                                <div>
                                  <Select value={f.value} onValueChange={f.onChange}>
                                    <SelectTrigger
                                      aria-label={`Tasa de impuesto de línea ${index + 1}`}
                                      className={fieldState.error ? 'border-destructive' : ''}
                                    >
                                      <SelectValue placeholder="Seleccionar" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {taxRates.map((rate) => (
                                        <SelectItem key={rate.id} value={rate.id}>
                                          {rate.name} ({formatTaxRate(rate.rate)})
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  {fieldState.error && (
                                    <p className="text-destructive mt-1 text-xs">
                                      {fieldState.error.message}
                                    </p>
                                  )}
                                </div>
                              )}
                            />
                          </TableCell>

                          {/* Subtotal (calculado) */}
                          <TableCell
                            className="text-right font-mono text-sm"
                            aria-live="polite"
                            aria-label={`Subtotal de línea ${index + 1}`}
                          >
                            {formatCurrency(lineTot.base, watchCurrency)}
                          </TableCell>

                          {/* ISV (calculado) */}
                          <TableCell
                            className="text-right font-mono text-sm"
                            aria-live="polite"
                            aria-label={`ISV de línea ${index + 1}`}
                          >
                            {formatCurrency(lineTot.tax, watchCurrency)}
                          </TableCell>

                          {/* Total (calculado) */}
                          <TableCell
                            className="text-right font-mono text-sm font-semibold"
                            aria-live="polite"
                            aria-label={`Total de línea ${index + 1}`}
                          >
                            {formatCurrency(lineTot.total, watchCurrency)}
                          </TableCell>

                          {/* Eliminar línea */}
                          <TableCell>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="text-destructive hover:text-destructive h-8 w-8"
                              onClick={() => remove(index)}
                              disabled={fields.length === 1}
                              aria-label={`Eliminar línea ${index + 1}`}
                            >
                              <Trash2 className="h-4 w-4" aria-hidden="true" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Totales */}
              <Separator />
              <div
                className="flex justify-end"
                aria-live="polite"
                aria-label="Totales de la factura"
              >
                <div className="w-full space-y-2 sm:w-72">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="font-mono">{formatCurrency(subtotal, watchCurrency)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">ISV Total</span>
                    <span className="font-mono">{formatCurrency(isvTotal, watchCurrency)}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between font-semibold">
                    <span>Total</span>
                    <span className="font-mono text-lg">
                      {formatCurrency(total, watchCurrency)}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Acciones */}
          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push('/dashboard/invoicing/invoices' as never)}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
              {isSubmitting ? 'Guardando...' : 'Guardar Borrador'}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
