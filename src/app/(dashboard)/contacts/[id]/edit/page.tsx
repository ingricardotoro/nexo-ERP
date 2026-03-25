// src/app/(dashboard)/contacts/[id]/edit/page.tsx
'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
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
import {
  createContactSchema,
  type CreateContactInput,
  type ContactType,
} from '@/lib/validations/contact.schema';

interface ContactData {
  id: string;
  contactType: ContactType;
  legalName: string;
  tradeName?: string | null;
  rtn?: string | null;
  isCustomer: boolean;
  isSupplier: boolean;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  isActive: boolean;
  notes?: string | null;
  paymentTerms?: { id: string; name: string; daysUntilDue: number } | null;
}

interface PaymentTerm {
  id: string;
  name: string;
  daysUntilDue: number;
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export default function EditContactPage() {
  const router = useRouter();
  const params = useParams();
  const contactId = params.id as string;

  const [contact, setContact] = useState<ContactData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
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

  const fetchContact = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const response = await fetch(`/api/v1/contacts/${contactId}`, {
        credentials: 'include',
      });
      const payload = (await response.json()) as ApiResponse<ContactData>;

      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.error ?? 'Error al cargar el contacto');
      }

      const data = payload.data;
      setContact(data);

      form.reset({
        contactType: data.contactType,
        legalName: data.legalName,
        tradeName: data.tradeName ?? '',
        rtn: data.rtn ?? '',
        isCustomer: data.isCustomer,
        isSupplier: data.isSupplier,
        email: data.email ?? '',
        phone: data.phone ?? '',
        website: data.website ?? '',
        paymentTermsId: data.paymentTerms?.id ?? null,
        isActive: data.isActive,
        notes: data.notes ?? '',
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error desconocido';
      setFetchError(message);
    } finally {
      setLoading(false);
    }
  }, [contactId, form]);

  const fetchPaymentTerms = useCallback(async () => {
    try {
      const response = await fetch('/api/v1/contacts/payment-terms', {
        credentials: 'include',
      });
      const payload = (await response.json()) as ApiResponse<PaymentTerm[]>;
      if (payload.success && payload.data) {
        setPaymentTerms(payload.data);
      }
    } catch {
      // Términos de pago son opcionales
    }
  }, []);

  useEffect(() => {
    void fetchContact();
    void fetchPaymentTerms();
  }, [fetchContact, fetchPaymentTerms]);

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

      const response = await fetch(`/api/v1/contacts/${contactId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });

      const payload = (await response.json()) as ApiResponse<unknown>;

      if (!response.ok || !payload.success) {
        throw new Error(payload.error ?? 'Error al actualizar contacto');
      }

      toast.success('Contacto actualizado exitosamente', {
        description: 'Los datos del contacto han sido guardados.',
      });

      router.push(`/dashboard/contacts/${contactId}` as never);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No se pudo actualizar el contacto';
      toast.error('Error al actualizar contacto', { description: message });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10 rounded-md" />
          <div className="space-y-2">
            <Skeleton className="h-8 w-56" />
            <Skeleton className="h-4 w-40" />
          </div>
        </div>
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (fetchError || !contact) {
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
          <h1 className="text-foreground text-3xl font-bold tracking-tight">Editar Contacto</h1>
        </div>
        <Card className="p-6 text-center">
          <p className="text-destructive">{fetchError ?? 'No se encontró el contacto.'}</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="outline"
          size="icon"
          onClick={() => router.push(`/dashboard/contacts/${contactId}` as never)}
          aria-label="Volver al detalle del contacto"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        </Button>
        <div>
          <h1 className="text-foreground text-3xl font-bold tracking-tight">Editar Contacto</h1>
          <p className="text-muted-foreground mt-1">{contact.legalName}</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Datos del Contacto</CardTitle>
          <CardDescription>
            Modifica la información del contacto. Los campos con * son obligatorios.
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
                          <SelectValue />
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
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
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
                  onClick={() => router.push(`/dashboard/contacts/${contactId}` as never)}
                  disabled={isSubmitting}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                  )}
                  {isSubmitting ? 'Guardando...' : 'Guardar Cambios'}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
