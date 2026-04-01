// src/app/(dashboard)/invoicing/invoices/[id]/page.tsx
'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, Send, XCircle, Loader2, FileText, User } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
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
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  InvoiceStatusBadge,
  type InvoiceStatus,
} from '@/components/invoicing/invoice-status-badge';
import { InvoiceTypeBadge, type InvoiceType } from '@/components/invoicing/invoice-type-badge';
import { formatCurrency, formatTaxRate } from '@/components/invoicing/format-currency';

// Schema para anulación
const cancelSchema = z.object({
  cancelReason: z
    .string()
    .min(5, 'El motivo debe tener al menos 5 caracteres')
    .max(500, 'El motivo no puede superar los 500 caracteres'),
});
type CancelFormValues = z.infer<typeof cancelSchema>;

// Tipos de datos
interface InvoiceLine {
  id: string;
  lineNumber: number;
  description: string;
  quantity: number;
  unitPrice: number;
  discountPct: number;
  taxRate?: { id: string; code: string; name: string; rate: number } | null;
  subtotal: number;
  taxAmount: number;
  lineTotal: number;
}

interface InvoiceDetail {
  id: string;
  invoiceType: InvoiceType;
  invoiceNumber?: string | null;
  issueDate: string;
  dueDate?: string | null;
  currencyCode: string;
  exchangeRate: number;
  subtotal: number;
  taxAmount: number;
  total: number;
  status: InvoiceStatus;
  notes?: string | null;
  cancelReason?: string | null;
  contact?: {
    id: string;
    legalName: string;
    tradeName?: string | null;
    rtn?: string | null;
  } | null;
  lines: InvoiceLine[];
  createdAt: string;
  updatedAt: string;
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export default function InvoiceDetailPage() {
  const router = useRouter();
  const params = useParams();
  const invoiceId = params.id as string;

  const [invoice, setInvoice] = useState<InvoiceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Estados de acciones
  const [publishDialogOpen, setPublishDialogOpen] = useState(false);
  const [publishLoading, setPublishLoading] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);

  const cancelForm = useForm<CancelFormValues>({
    resolver: zodResolver(cancelSchema),
    defaultValues: { cancelReason: '' },
  });

  const fetchInvoice = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/v1/invoicing/invoices/${invoiceId}`, {
        credentials: 'include',
      });
      const payload = (await response.json()) as ApiResponse<InvoiceDetail>;

      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.error ?? 'Error al cargar la factura');
      }

      setInvoice(payload.data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error desconocido';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [invoiceId]);

  useEffect(() => {
    void fetchInvoice();
  }, [fetchInvoice]);

  // Emitir factura
  const handlePublish = async () => {
    setPublishLoading(true);
    try {
      const response = await fetch(`/api/v1/invoicing/invoices/${invoiceId}/publish`, {
        method: 'POST',
        credentials: 'include',
      });
      const payload = (await response.json()) as ApiResponse<InvoiceDetail>;

      if (!response.ok || !payload.success) {
        throw new Error(payload.error ?? 'Error al emitir la factura');
      }

      toast.success('Factura emitida exitosamente', {
        description: payload.message ?? `Número asignado: ${payload.data?.invoiceNumber ?? ''}`,
      });
      setPublishDialogOpen(false);
      await fetchInvoice();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No se pudo emitir la factura';
      toast.error('Error al emitir factura', { description: message });
    } finally {
      setPublishLoading(false);
    }
  };

  // Anular factura
  const handleCancel = async (data: CancelFormValues) => {
    try {
      const response = await fetch(`/api/v1/invoicing/invoices/${invoiceId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ cancelReason: data.cancelReason }),
      });
      const payload = (await response.json()) as ApiResponse<InvoiceDetail>;

      if (!response.ok || !payload.success) {
        throw new Error(payload.error ?? 'Error al anular la factura');
      }

      toast.success('Factura anulada', {
        description: payload.message,
      });
      cancelForm.reset();
      setCancelDialogOpen(false);
      await fetchInvoice();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No se pudo anular la factura';
      toast.error('Error al anular factura', { description: message });
    }
  };

  // Estado de carga
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10 rounded-md" />
          <div className="space-y-2">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-48" />
          </div>
        </div>
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  // Estado de error
  if (error || !invoice) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="icon"
            onClick={() => router.push('/dashboard/invoicing/invoices' as never)}
            aria-label="Volver a facturas"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          </Button>
          <h1 className="text-foreground text-3xl font-bold tracking-tight">Factura</h1>
        </div>
        <Card className="p-6 text-center">
          <p className="text-destructive">{error ?? 'No se encontró la factura.'}</p>
        </Card>
      </div>
    );
  }

  const isDraft = invoice.status === 'DRAFT';
  const isPublished = invoice.status === 'PUBLISHED';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <Button
            variant="outline"
            size="icon"
            onClick={() => router.push('/dashboard/invoicing/invoices' as never)}
            aria-label="Volver a facturas"
            className="shrink-0"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          </Button>
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-foreground text-3xl font-bold tracking-tight">
                {invoice.invoiceNumber ? (
                  <span className="font-mono">{invoice.invoiceNumber}</span>
                ) : (
                  'Factura en Borrador'
                )}
              </h1>
              <InvoiceStatusBadge status={invoice.status} />
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <InvoiceTypeBadge invoiceType={invoice.invoiceType} />
              {invoice.contact && (
                <span className="text-muted-foreground text-sm">
                  {invoice.contact.tradeName ?? invoice.contact.legalName}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Acciones según estado */}
        <div className="flex gap-2 sm:shrink-0">
          {isDraft && (
            <Button onClick={() => setPublishDialogOpen(true)}>
              <Send className="mr-2 h-4 w-4" aria-hidden="true" />
              Emitir Factura
            </Button>
          )}
          {isPublished && (
            <Button variant="destructive" onClick={() => setCancelDialogOpen(true)}>
              <XCircle className="mr-2 h-4 w-4" aria-hidden="true" />
              Anular Factura
            </Button>
          )}
        </div>
      </div>

      {/* Información general */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Datos del documento */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" aria-hidden="true" />
              Datos del Documento
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {invoice.invoiceNumber && (
              <div>
                <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                  Número SAR
                </p>
                <p className="mt-1 font-mono text-sm font-semibold">{invoice.invoiceNumber}</p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                  Tipo
                </p>
                <div className="mt-1">
                  <InvoiceTypeBadge invoiceType={invoice.invoiceType} />
                </div>
              </div>
              <div>
                <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                  Estado
                </p>
                <div className="mt-1">
                  <InvoiceStatusBadge status={invoice.status} />
                </div>
              </div>
              <div>
                <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                  Fecha Emisión
                </p>
                <p className="mt-1 text-sm">{format(new Date(invoice.issueDate), 'dd/MM/yyyy')}</p>
              </div>
              {invoice.dueDate && (
                <div>
                  <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                    Vencimiento
                  </p>
                  <p className="mt-1 text-sm">{format(new Date(invoice.dueDate), 'dd/MM/yyyy')}</p>
                </div>
              )}
              <div>
                <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                  Moneda
                </p>
                <p className="mt-1 text-sm">{invoice.currencyCode}</p>
              </div>
              {invoice.currencyCode !== 'HNL' && (
                <div>
                  <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                    Tipo de Cambio
                  </p>
                  <p className="mt-1 font-mono text-sm">{invoice.exchangeRate.toFixed(4)}</p>
                </div>
              )}
            </div>
            {invoice.notes && (
              <>
                <Separator />
                <div>
                  <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                    Notas
                  </p>
                  <p className="mt-1 text-sm">{invoice.notes}</p>
                </div>
              </>
            )}
            {invoice.cancelReason && (
              <>
                <Separator />
                <div>
                  <p className="text-xs font-medium tracking-wide text-red-600 uppercase">
                    Motivo de Anulación
                  </p>
                  <p className="mt-1 text-sm text-red-700">{invoice.cancelReason}</p>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Datos del cliente */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" aria-hidden="true" />
              Cliente
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {invoice.contact ? (
              <>
                <div>
                  <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                    Razón Social
                  </p>
                  <p className="mt-1 text-sm font-medium">{invoice.contact.legalName}</p>
                </div>
                {invoice.contact.tradeName && (
                  <div>
                    <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                      Nombre Comercial
                    </p>
                    <p className="mt-1 text-sm">{invoice.contact.tradeName}</p>
                  </div>
                )}
                {invoice.contact.rtn && (
                  <div>
                    <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                      RTN
                    </p>
                    <p className="mt-1 font-mono text-sm font-medium">{invoice.contact.rtn}</p>
                  </div>
                )}
              </>
            ) : (
              <p className="text-muted-foreground text-sm">Sin cliente asignado</p>
            )}

            <Separator />
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                  Creada
                </p>
                <p className="mt-1 text-sm">
                  {format(new Date(invoice.createdAt), 'dd/MM/yyyy HH:mm')}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                  Actualizada
                </p>
                <p className="mt-1 text-sm">
                  {format(new Date(invoice.updatedAt), 'dd/MM/yyyy HH:mm')}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Líneas de detalle */}
      <Card>
        <CardHeader>
          <CardTitle>Líneas de Detalle</CardTitle>
          <CardDescription>{invoice.lines.length} línea(s)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8">#</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead className="text-right">Cantidad</TableHead>
                  <TableHead className="text-right">Precio Unit.</TableHead>
                  <TableHead className="text-right">Desc. %</TableHead>
                  <TableHead>ISV</TableHead>
                  <TableHead className="text-right">Subtotal</TableHead>
                  <TableHead className="text-right">ISV</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoice.lines.map((line) => (
                  <TableRow key={line.id}>
                    <TableCell className="text-muted-foreground text-sm">
                      {line.lineNumber}
                    </TableCell>
                    <TableCell className="text-sm">{line.description}</TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {line.quantity.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {formatCurrency(line.unitPrice, invoice.currencyCode)}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {line.discountPct > 0 ? `${line.discountPct.toFixed(2)}%` : '—'}
                    </TableCell>
                    <TableCell className="text-sm">
                      {line.taxRate
                        ? `${line.taxRate.name} (${formatTaxRate(line.taxRate.rate)})`
                        : '—'}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {formatCurrency(line.subtotal, invoice.currencyCode)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {formatCurrency(line.taxAmount, invoice.currencyCode)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm font-semibold">
                      {formatCurrency(line.lineTotal, invoice.currencyCode)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Totales */}
          <Separator className="my-4" />
          <div className="flex justify-end">
            <div
              className="w-full space-y-2 sm:w-72"
              aria-label="Totales de la factura"
              aria-live="polite"
            >
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-mono">
                  {formatCurrency(invoice.subtotal, invoice.currencyCode)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">ISV Total</span>
                <span className="font-mono">
                  {formatCurrency(invoice.taxAmount, invoice.currencyCode)}
                </span>
              </div>
              <Separator />
              <div className="flex justify-between font-semibold">
                <span>Total</span>
                <span className="font-mono text-lg">
                  {formatCurrency(invoice.total, invoice.currencyCode)}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* AlertDialog: Confirmar emisión */}
      <AlertDialog open={publishDialogOpen} onOpenChange={setPublishDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Emitir Factura</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción asignará un número fiscal SAR y generará el asiento contable
              correspondiente. <strong>No se puede deshacer.</strong> Una vez emitida, solo podrás
              anularla con un motivo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={publishLoading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handlePublish}
              disabled={publishLoading}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {publishLoading && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
              )}
              {publishLoading ? 'Emitiendo...' : 'Emitir Factura'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog: Anular con motivo */}
      <Dialog
        open={cancelDialogOpen}
        onOpenChange={(open) => {
          setCancelDialogOpen(open);
          if (!open) cancelForm.reset();
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Anular Factura</DialogTitle>
            <DialogDescription>
              Indica el motivo de anulación de la factura{' '}
              <strong className="font-mono">{invoice.invoiceNumber}</strong>. Esta acción generará
              un asiento contable de reversión y no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <Form {...cancelForm}>
            <form onSubmit={cancelForm.handleSubmit(handleCancel)} className="space-y-4">
              <FormField
                control={cancelForm.control}
                name="cancelReason"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel htmlFor="cancelReason">Motivo de Anulación *</FormLabel>
                    <FormControl>
                      <textarea
                        id="cancelReason"
                        className="border-input bg-background placeholder:text-muted-foreground focus-visible:ring-ring flex min-h-24 w-full rounded-md border px-3 py-2 text-sm shadow-sm focus-visible:ring-1 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                        placeholder="Describe el motivo de la anulación (mínimo 5 caracteres)..."
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCancelDialogOpen(false)}
                  disabled={cancelForm.formState.isSubmitting}
                >
                  Volver
                </Button>
                <Button
                  type="submit"
                  variant="destructive"
                  disabled={cancelForm.formState.isSubmitting}
                >
                  {cancelForm.formState.isSubmitting && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                  )}
                  {cancelForm.formState.isSubmitting ? 'Anulando...' : 'Confirmar Anulación'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
