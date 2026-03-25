// src/app/(dashboard)/contacts/new/page.tsx
'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { createContactSchema, type CreateContactInput } from '@/lib/validations/contact.schema';

interface PaymentTerm {
  id: string;
  name: string;
  daysUntilDue: number;
}

interface PaymentTermsResponse {
  success: boolean;
  data?: PaymentTerm[];
  error?: string;
}

interface MutationResponse {
  success: boolean;
  data?: { id: string };
  error?: string;
}

export default function NewContactPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [paymentTerms, setPaymentTerms] = useState<PaymentTerm[]>([]);

  const form = useForm<CreateContactInput>({
    resolver: zodResolver(createContactSchema),
    defaultValues: {
      contactType: 'NATURAL',
      legalName: '',
      tradeName: '',
      rtn: '',
      isCustomer: true,
      isSupplier: false,
      email: '',
      phone: '',
      website: '',
      paymentTermsId: null,
      isActive: true,
      notes: '',
    },
  });

  const fetchPaymentTerms = useCallback(async () => {
    try {
      const response = await fetch('/api/v1/contacts/payment-terms', {
        credentials: 'include',
      });
      const payload = (await response.json()) as PaymentTermsResponse;
      if (payload.success && payload.data) {
        setPaymentTerms(payload.data);
      }
    } catch {
      // Los términos de pago son opcionales; no bloquear el formulario
    }
  }, []);

  useEffect(() => {
    void fetchPaymentTerms();
  }, [fetchPaymentTerms]);

  const onSubmit = async (data: CreateContactInput) => {
    setIsSubmitting(true);
    try {
      const body = {
        ...data,
        rtn: data.rtn || null,
        tradeName: data.tradeName || null,
        email: data.email || null,
        phone: data.phone || null,
        website: data.website || null,
        notes: data.notes || null,
        paymentTermsId: data.paymentTermsId || null,
      };

      const response = await fetch('/api/v1/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });

      const payload = (await response.json()) as MutationResponse;

      if (!response.ok || !payload.success) {
        throw new Error(payload.error ?? 'Error al crear contacto');
      }

      toast.success('Contacto creado exitosamente', {
        description: `${data.legalName} ha sido agregado al directorio.`,
      });

      router.push('/dashboard/contacts' as never);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No se pudo crear el contacto';
      toast.error('Error al crear contacto', { description: message });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="outline"
          size="icon"
          onClick={() => router.push('/dashboard/contacts' as never)}
          aria-label="Volver a contactos"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        </Button>
        <div>
          <h1 className="text-foreground text-3xl font-bold tracking-tight">Nuevo Contacto</h1>
          <p className="text-muted-foreground mt-1">Registra un nuevo cliente o proveedor</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Datos del Contacto</CardTitle>
          <CardDescription>
            Completa la información del contacto. Los campos con * son obligatorios.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Tipo de persona */}
              <FormField
                control={form.control}
                name="contactType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel htmlFor="contactType">Tipo de Persona *</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger id="contactType">
                          <SelectValue placeholder="Selecciona el tipo" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="NATURAL">Persona Natural</SelectItem>
                        <SelectItem value="JURIDICAL">Persona Jurídica</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid gap-4 sm:grid-cols-2">
                {/* Nombre / Razón Social */}
                <FormField
                  control={form.control}
                  name="legalName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel htmlFor="legalName">Nombre / Razón Social *</FormLabel>
                      <FormControl>
                        <Input
                          id="legalName"
                          placeholder="Empresa Hondureña S.A. de C.V."
                          autoFocus
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Nombre Comercial */}
                <FormField
                  control={form.control}
                  name="tradeName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel htmlFor="tradeName">Nombre Comercial</FormLabel>
                      <FormControl>
                        <Input
                          id="tradeName"
                          placeholder="Nombre comercial (opcional)"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* RTN */}
              <FormField
                control={form.control}
                name="rtn"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel htmlFor="rtn">RTN</FormLabel>
                    <FormControl>
                      <Input
                        id="rtn"
                        placeholder="0801-1990-00001"
                        className="font-mono"
                        {...field}
                        value={field.value ?? ''}
                      />
                    </FormControl>
                    <FormDescription>
                      Formato: DDDD-DDDD-DDDDD (ej: 0801-1990-00001). Obligatorio para facturación
                      fiscal SAR.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Separator />

              {/* Roles */}
              <div>
                <p className="text-foreground mb-3 text-sm font-medium">Rol del Contacto *</p>
                <p className="text-muted-foreground mb-4 text-xs">
                  El contacto debe ser al menos cliente o proveedor.
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="isCustomer"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel htmlFor="isCustomer">Cliente</FormLabel>
                          <FormDescription>Puede comprar productos o servicios</FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            id="isCustomer"
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="isSupplier"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel htmlFor="isSupplier">Proveedor</FormLabel>
                          <FormDescription>Puede proveer productos o servicios</FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            id="isSupplier"
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
                {form.formState.errors.isCustomer && (
                  <p className="text-destructive mt-2 text-sm">
                    {form.formState.errors.isCustomer.message}
                  </p>
                )}
              </div>

              <Separator />

              {/* Información de contacto */}
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel htmlFor="email">Email</FormLabel>
                      <FormControl>
                        <Input
                          id="email"
                          type="email"
                          placeholder="contacto@empresa.hn"
                          autoComplete="email"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel htmlFor="phone">Teléfono</FormLabel>
                      <FormControl>
                        <Input
                          id="phone"
                          type="tel"
                          placeholder="+504-2222-3333"
                          autoComplete="tel"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="website"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel htmlFor="website">Sitio Web</FormLabel>
                    <FormControl>
                      <Input
                        id="website"
                        type="url"
                        placeholder="https://www.empresa.hn"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Separator />

              {/* Términos de pago */}
              <FormField
                control={form.control}
                name="paymentTermsId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel htmlFor="paymentTermsId">Términos de Pago</FormLabel>
                    <Select
                      value={field.value ?? 'none'}
                      onValueChange={(v) => field.onChange(v === 'none' ? null : v)}
                    >
                      <FormControl>
                        <SelectTrigger id="paymentTermsId">
                          <SelectValue placeholder="Sin términos de pago asignados" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">Sin términos de pago</SelectItem>
                        {paymentTerms.map((term) => (
                          <SelectItem key={term.id} value={term.id}>
                            {term.name}{' '}
                            {term.daysUntilDue === 0 ? '(Contado)' : `(${term.daysUntilDue} días)`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>Define los días de crédito para este contacto</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Notas */}
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel htmlFor="notes">Notas</FormLabel>
                    <FormControl>
                      <Textarea
                        id="notes"
                        placeholder="Información adicional del contacto..."
                        className="resize-none"
                        rows={3}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Estado activo */}
              <FormField
                control={form.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel htmlFor="isActive">Contacto Activo</FormLabel>
                      <FormDescription>
                        Los contactos inactivos no aparecerán en formularios de facturas
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        id="isActive"
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <div className="flex justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push('/dashboard/contacts' as never)}
                  disabled={isSubmitting}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                  )}
                  {isSubmitting ? 'Guardando...' : 'Crear Contacto'}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
