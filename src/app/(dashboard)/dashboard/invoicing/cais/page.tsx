// src/app/(dashboard)/invoicing/cais/page.tsx
'use client';

import { useCallback, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Shield, Loader2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { format, isPast, differenceInDays } from 'date-fns';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { createCaiSchema, type CreateCaiInput } from '@/lib/validations/cai.schema';

interface CaiData {
  id: string;
  caiCode: string;
  documentType: '01' | '03' | '04';
  establishmentCode: string;
  emissionPointCode: string;
  rangeFrom: number;
  rangeTo: number;
  currentSequence: number;
  issuedAt: string;
  expiresAt: string;
  isActive: boolean;
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  '01': 'Factura',
  '03': 'Nota de Crédito',
  '04': 'Nota de Débito',
};

function getCaiStatusBadge(cai: CaiData) {
  const expires = new Date(cai.expiresAt);
  const daysLeft = differenceInDays(expires, new Date());

  if (!cai.isActive) {
    return (
      <Badge variant="outline" className="border-gray-300 bg-gray-100 text-gray-600">
        Inactivo
      </Badge>
    );
  }
  if (isPast(expires)) {
    return (
      <Badge variant="outline" className="border-red-300 bg-red-50 text-red-700">
        Vencido
      </Badge>
    );
  }
  if (daysLeft <= 30) {
    return (
      <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-700">
        <AlertTriangle className="mr-1 h-3 w-3" aria-hidden="true" />
        Vence en {daysLeft}d
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="border-green-300 bg-green-50 text-green-700">
      Activo
    </Badge>
  );
}

const SKELETON_ROWS = 3;

export default function CaisPage() {
  const [cais, setCais] = useState<CaiData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const form = useForm<CreateCaiInput>({
    resolver: zodResolver(createCaiSchema),
    defaultValues: {
      caiCode: '',
      establishmentCode: '',
      emissionPointCode: '',
      documentType: '01',
      rangeFrom: 1,
      rangeTo: 1000,
      issuedAt: new Date().toISOString().split('T')[0],
      expiresAt: '',
    },
  });

  const fetchCais = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/v1/invoicing/cais', { credentials: 'include' });
      const payload = (await response.json()) as ApiResponse<CaiData[]>;

      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.error ?? 'Error al obtener CAIs');
      }
      setCais(payload.data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error desconocido';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchCais();
  }, [fetchCais]);

  const handleCreate = async (data: CreateCaiInput) => {
    try {
      const response = await fetch('/api/v1/invoicing/cais', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      const payload = (await response.json()) as ApiResponse<CaiData>;

      if (!response.ok || !payload.success) {
        throw new Error(payload.error ?? 'Error al registrar el CAI');
      }

      toast.success('CAI registrado exitosamente');
      form.reset();
      setCreateDialogOpen(false);
      await fetchCais();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No se pudo registrar el CAI';
      toast.error('Error al registrar CAI', { description: message });
    }
  };

  const handleToggleActive = async (caiId: string, newValue: boolean) => {
    setTogglingId(caiId);
    try {
      const response = await fetch(`/api/v1/invoicing/cais/${caiId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ isActive: newValue }),
      });
      const payload = (await response.json()) as ApiResponse<CaiData>;

      if (!response.ok || !payload.success) {
        throw new Error(payload.error ?? 'Error al actualizar el CAI');
      }

      toast.success(newValue ? 'CAI activado' : 'CAI desactivado');
      await fetchCais();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No se pudo actualizar el CAI';
      toast.error('Error al actualizar CAI', { description: message });
    } finally {
      setTogglingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-foreground text-3xl font-bold tracking-tight">Gestión de CAI</h1>
          <p className="text-muted-foreground mt-2">
            Código de Autorización de Impresión emitido por el SAR
          </p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
          Registrar CAI
        </Button>
      </div>

      {/* Tabla de CAIs */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" aria-hidden="true" />
            CAIs Registrados
          </CardTitle>
          <CardDescription>
            {loading ? 'Cargando...' : `${cais.length} CAI(s) registrado(s)`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && !loading && <p className="text-destructive mb-4 text-sm">{error}</p>}

          {loading ? (
            <div className="space-y-3" aria-label="Cargando CAIs" aria-busy="true">
              {Array.from({ length: SKELETON_ROWS }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full rounded-md" />
              ))}
            </div>
          ) : cais.length === 0 ? (
            <div className="border-border flex flex-col items-center justify-center rounded-lg border py-16">
              <Shield className="text-muted-foreground h-10 w-10" aria-hidden="true" />
              <p className="text-muted-foreground mt-4 text-center text-sm font-medium">
                No hay CAIs registrados
              </p>
              <p className="text-muted-foreground mt-1 text-center text-xs">
                Registra el primero con el botón &quot;Registrar CAI&quot;.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código CAI</TableHead>
                    <TableHead>Tipo Doc.</TableHead>
                    <TableHead>Establecimiento</TableHead>
                    <TableHead>Punto Emisión</TableHead>
                    <TableHead>Rango</TableHead>
                    <TableHead>Vigencia</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="w-20">Activo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cais.map((cai) => (
                    <TableRow key={cai.id}>
                      <TableCell>
                        <span
                          className="font-mono text-xs"
                          title={cai.caiCode}
                          aria-label={`Código CAI: ${cai.caiCode}`}
                        >
                          {cai.caiCode.slice(0, 13)}…
                        </span>
                      </TableCell>
                      <TableCell className="text-sm">
                        {DOCUMENT_TYPE_LABELS[cai.documentType] ?? cai.documentType}
                      </TableCell>
                      <TableCell className="font-mono text-sm">{cai.establishmentCode}</TableCell>
                      <TableCell className="font-mono text-sm">{cai.emissionPointCode}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {cai.rangeFrom.toLocaleString('es-HN')} —{' '}
                        {cai.rangeTo.toLocaleString('es-HN')}
                      </TableCell>
                      <TableCell className="text-sm">
                        <div>
                          <span className="text-muted-foreground text-xs">Emitido: </span>
                          {format(new Date(cai.issuedAt), 'dd/MM/yyyy')}
                        </div>
                        <div>
                          <span className="text-muted-foreground text-xs">Vence: </span>
                          {format(new Date(cai.expiresAt), 'dd/MM/yyyy')}
                        </div>
                      </TableCell>
                      <TableCell>{getCaiStatusBadge(cai)}</TableCell>
                      <TableCell>
                        <Switch
                          checked={cai.isActive}
                          onCheckedChange={(val) => void handleToggleActive(cai.id, val)}
                          disabled={togglingId === cai.id}
                          aria-label={`${cai.isActive ? 'Desactivar' : 'Activar'} CAI ${cai.caiCode.slice(0, 13)}`}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog: Registrar CAI */}
      <Dialog
        open={createDialogOpen}
        onOpenChange={(open) => {
          setCreateDialogOpen(open);
          if (!open) form.reset();
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Registrar Nuevo CAI</DialogTitle>
            <DialogDescription>
              Ingresa los datos del CAI emitido por el SAR para habilitar la facturación.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleCreate)} className="space-y-4">
              {/* Código CAI */}
              <FormField
                control={form.control}
                name="caiCode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel htmlFor="caiCode">Código CAI *</FormLabel>
                    <FormControl>
                      <Input
                        id="caiCode"
                        placeholder="A1B2C3-D4E5F6-G7H8I9-J0K1L2-M3N4O5-P6"
                        className="font-mono"
                        autoFocus
                        {...field}
                        onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                      />
                    </FormControl>
                    <FormDescription className="text-xs">
                      Formato: XXXXXX-XXXXXX-XXXXXX-XXXXXX-XXXXXX-XX
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-3 gap-3">
                {/* Tipo de documento */}
                <FormField
                  control={form.control}
                  name="documentType"
                  render={({ field }) => (
                    <FormItem className="col-span-3 sm:col-span-1">
                      <FormLabel htmlFor="documentType">Tipo Documento *</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger id="documentType">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="01">01 — Factura</SelectItem>
                          <SelectItem value="03">03 — Nota de Crédito</SelectItem>
                          <SelectItem value="04">04 — Nota de Débito</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Establecimiento */}
                <FormField
                  control={form.control}
                  name="establishmentCode"
                  render={({ field }) => (
                    <FormItem className="col-span-3 sm:col-span-1">
                      <FormLabel htmlFor="establishmentCode">Establecimiento *</FormLabel>
                      <FormControl>
                        <Input
                          id="establishmentCode"
                          placeholder="001"
                          maxLength={3}
                          className="font-mono"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Punto de emisión */}
                <FormField
                  control={form.control}
                  name="emissionPointCode"
                  render={({ field }) => (
                    <FormItem className="col-span-3 sm:col-span-1">
                      <FormLabel htmlFor="emissionPointCode">Punto Emisión *</FormLabel>
                      <FormControl>
                        <Input
                          id="emissionPointCode"
                          placeholder="001"
                          maxLength={3}
                          className="font-mono"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Rango de numeración */}
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="rangeFrom"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel htmlFor="rangeFrom">Rango Desde *</FormLabel>
                      <FormControl>
                        <Input
                          id="rangeFrom"
                          type="number"
                          min={1}
                          placeholder="1"
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="rangeTo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel htmlFor="rangeTo">Rango Hasta *</FormLabel>
                      <FormControl>
                        <Input
                          id="rangeTo"
                          type="number"
                          min={1}
                          placeholder="1000"
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Fechas */}
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="issuedAt"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel htmlFor="issuedAt">Fecha de Emisión *</FormLabel>
                      <FormControl>
                        <Input id="issuedAt" type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="expiresAt"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel htmlFor="expiresAt">Fecha de Vencimiento *</FormLabel>
                      <FormControl>
                        <Input id="expiresAt" type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

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
                  {form.formState.isSubmitting ? 'Guardando...' : 'Registrar CAI'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
