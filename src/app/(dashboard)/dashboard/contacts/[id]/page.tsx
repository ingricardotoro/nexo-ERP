// src/app/(dashboard)/contacts/[id]/page.tsx
'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, Edit, Trash2, Plus, MapPin, User, Loader2, Star } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { ContactTypeBadge } from '@/components/contacts/contact-type-badge';
import { ContactRoleBadge } from '@/components/contacts/contact-role-badge';
import { ContactStatusBadge } from '@/components/contacts/contact-status-badge';
import { formatRtn, type ContactType } from '@/lib/validations/contact.schema';
import {
  createContactAddressSchema,
  getAddressTypeLabel,
  type CreateContactAddressInput,
  type AddressType,
} from '@/lib/validations/contact-address.schema';
import {
  createContactPersonSchema,
  type CreateContactPersonInput,
} from '@/lib/validations/contact-person.schema';

interface ContactAddress {
  id: string;
  addressType: AddressType;
  addressLine1: string;
  addressLine2?: string | null;
  city: string;
  department?: string | null;
  country: string;
  postalCode?: string | null;
  isDefault: boolean;
}

interface ContactPerson {
  id: string;
  fullName: string;
  jobTitle?: string | null;
  email?: string | null;
  phone?: string | null;
  isPrimary: boolean;
  isActive: boolean;
}

interface ContactDetail {
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
  createdAt: string;
  updatedAt: string;
  paymentTerms?: { id: string; name: string; daysUntilDue: number } | null;
  addresses: ContactAddress[];
  persons: ContactPerson[];
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

const ADDRESS_TYPE_OPTIONS: { value: AddressType; label: string }[] = [
  { value: 'BILLING', label: 'Facturación' },
  { value: 'SHIPPING', label: 'Envío' },
  { value: 'FISCAL', label: 'Fiscal' },
  { value: 'OTHER', label: 'Otro' },
];

export default function ContactDetailPage() {
  const router = useRouter();
  const params = useParams();
  const contactId = params.id as string;

  const [contact, setContact] = useState<ContactDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // Address dialog state
  const [addressDialogOpen, setAddressDialogOpen] = useState(false);
  const [addressSubmitting, setAddressSubmitting] = useState(false);

  // Person dialog state
  const [personDialogOpen, setPersonDialogOpen] = useState(false);
  const [personSubmitting, setPersonSubmitting] = useState(false);

  const addressForm = useForm<CreateContactAddressInput>({
    resolver: zodResolver(createContactAddressSchema),
    defaultValues: {
      addressType: 'BILLING',
      addressLine1: '',
      addressLine2: '',
      city: '',
      department: '',
      country: 'HN',
      postalCode: '',
      isDefault: false,
    },
  });

  const personForm = useForm<CreateContactPersonInput>({
    resolver: zodResolver(createContactPersonSchema),
    defaultValues: {
      fullName: '',
      jobTitle: '',
      email: '',
      phone: '',
      isPrimary: false,
      isActive: true,
    },
  });

  const fetchContact = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/v1/contacts/${contactId}`, {
        credentials: 'include',
      });
      const payload = (await response.json()) as ApiResponse<ContactDetail>;

      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.error ?? 'Error al cargar el contacto');
      }

      setContact(payload.data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error desconocido';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [contactId]);

  useEffect(() => {
    void fetchContact();
  }, [fetchContact]);

  const handleDelete = async () => {
    try {
      const response = await fetch(`/api/v1/contacts/${contactId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const payload = (await response.json()) as ApiResponse<unknown>;

      if (!response.ok || !payload.success) {
        throw new Error(payload.error ?? 'Error al eliminar contacto');
      }

      toast.success('Contacto eliminado', {
        description: 'El contacto ha sido eliminado del sistema.',
      });
      router.push('/dashboard/contacts' as never);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No se pudo eliminar el contacto';
      toast.error('Error al eliminar contacto', { description: message });
    }
  };

  const handleAddAddress = async (data: CreateContactAddressInput) => {
    setAddressSubmitting(true);
    try {
      const body = {
        ...data,
        addressLine2: data.addressLine2 || null,
        department: data.department || null,
        postalCode: data.postalCode || null,
      };
      const response = await fetch(`/api/v1/contacts/${contactId}/addresses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      const payload = (await response.json()) as ApiResponse<unknown>;

      if (!response.ok || !payload.success) {
        throw new Error(payload.error ?? 'Error al agregar dirección');
      }

      toast.success('Dirección agregada exitosamente');
      addressForm.reset();
      setAddressDialogOpen(false);
      await fetchContact();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No se pudo agregar la dirección';
      toast.error('Error al agregar dirección', { description: message });
    } finally {
      setAddressSubmitting(false);
    }
  };

  const handleAddPerson = async (data: CreateContactPersonInput) => {
    setPersonSubmitting(true);
    try {
      const body = {
        ...data,
        jobTitle: data.jobTitle || null,
        email: data.email || null,
        phone: data.phone || null,
      };
      const response = await fetch(`/api/v1/contacts/${contactId}/persons`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      const payload = (await response.json()) as ApiResponse<unknown>;

      if (!response.ok || !payload.success) {
        throw new Error(payload.error ?? 'Error al agregar persona de contacto');
      }

      toast.success('Persona de contacto agregada exitosamente');
      personForm.reset();
      setPersonDialogOpen(false);
      await fetchContact();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'No se pudo agregar la persona de contacto';
      toast.error('Error al agregar persona de contacto', { description: message });
    } finally {
      setPersonSubmitting(false);
    }
  };

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

  if (error || !contact) {
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
          <h1 className="text-foreground text-3xl font-bold tracking-tight">Contacto</h1>
        </div>
        <Card className="p-6 text-center">
          <p className="text-destructive">{error ?? 'No se encontró el contacto.'}</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <Button
            variant="outline"
            size="icon"
            onClick={() => router.push('/dashboard/contacts' as never)}
            aria-label="Volver a contactos"
            className="shrink-0"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          </Button>
          <div>
            <h1 className="text-foreground text-3xl font-bold tracking-tight">
              {contact.legalName}
            </h1>
            {contact.tradeName && <p className="text-muted-foreground mt-1">{contact.tradeName}</p>}
            <div className="mt-2 flex flex-wrap gap-2">
              <ContactTypeBadge contactType={contact.contactType} />
              <ContactRoleBadge isCustomer={contact.isCustomer} isSupplier={contact.isSupplier} />
              <ContactStatusBadge isActive={contact.isActive} />
            </div>
          </div>
        </div>
        <div className="flex gap-2 sm:shrink-0">
          <Button
            variant="outline"
            onClick={() => router.push(`/dashboard/contacts/${contactId}/edit` as never)}
          >
            <Edit className="mr-2 h-4 w-4" aria-hidden="true" />
            Editar
          </Button>
          <Button variant="destructive" onClick={() => setDeleteDialogOpen(true)}>
            <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" />
            Eliminar
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="info">
        <TabsList>
          <TabsTrigger value="info">Información</TabsTrigger>
          <TabsTrigger value="addresses">
            Direcciones{' '}
            {contact.addresses.length > 0 && (
              <Badge variant="secondary" className="ml-1.5">
                {contact.addresses.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="persons">
            Personas de Contacto{' '}
            {contact.persons.length > 0 && (
              <Badge variant="secondary" className="ml-1.5">
                {contact.persons.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Tab: Información */}
        <TabsContent value="info">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Datos Generales</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                      RTN
                    </p>
                    <p className="mt-1 font-mono text-sm font-medium">{formatRtn(contact.rtn)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                      Tipo
                    </p>
                    <div className="mt-1">
                      <ContactTypeBadge contactType={contact.contactType} />
                    </div>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                      Rol
                    </p>
                    <div className="mt-1">
                      <ContactRoleBadge
                        isCustomer={contact.isCustomer}
                        isSupplier={contact.isSupplier}
                      />
                    </div>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                      Estado
                    </p>
                    <div className="mt-1">
                      <ContactStatusBadge isActive={contact.isActive} />
                    </div>
                  </div>
                </div>

                {contact.paymentTerms && (
                  <>
                    <Separator />
                    <div>
                      <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                        Términos de Pago
                      </p>
                      <p className="mt-1 text-sm">
                        {contact.paymentTerms.name}
                        {' — '}
                        {contact.paymentTerms.daysUntilDue === 0
                          ? 'Contado'
                          : `${contact.paymentTerms.daysUntilDue} días`}
                      </p>
                    </div>
                  </>
                )}

                {contact.notes && (
                  <>
                    <Separator />
                    <div>
                      <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                        Notas
                      </p>
                      <p className="mt-1 text-sm">{contact.notes}</p>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Información de Contacto</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                    Email
                  </p>
                  <p className="mt-1 text-sm">{contact.email ?? '—'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                    Teléfono
                  </p>
                  <p className="mt-1 text-sm">{contact.phone ?? '—'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                    Sitio Web
                  </p>
                  {contact.website ? (
                    <a
                      href={contact.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 block text-sm text-blue-600 hover:underline"
                    >
                      {contact.website}
                    </a>
                  ) : (
                    <p className="mt-1 text-sm">—</p>
                  )}
                </div>
                <Separator />
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                      Fecha Creación
                    </p>
                    <p className="mt-1 text-sm">
                      {format(new Date(contact.createdAt), 'dd/MM/yyyy')}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                      Última Actualización
                    </p>
                    <p className="mt-1 text-sm">
                      {format(new Date(contact.updatedAt), 'dd/MM/yyyy')}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Tab: Direcciones */}
        <TabsContent value="addresses">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5" aria-hidden="true" />
                  Direcciones
                </CardTitle>
                <CardDescription>Direcciones registradas para este contacto</CardDescription>
              </div>
              <Button onClick={() => setAddressDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
                Agregar Dirección
              </Button>
            </CardHeader>
            <CardContent>
              {contact.addresses.length === 0 ? (
                <div className="border-border flex flex-col items-center justify-center rounded-lg border py-12">
                  <MapPin className="text-muted-foreground h-8 w-8" aria-hidden="true" />
                  <p className="text-muted-foreground mt-3 text-center text-sm">
                    No hay direcciones registradas.
                  </p>
                  <p className="text-muted-foreground mt-1 text-center text-xs">
                    Agrega una dirección haciendo clic en &quot;Agregar Dirección&quot;.
                  </p>
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  {contact.addresses.map((address) => (
                    <div key={address.id} className="rounded-lg border p-4">
                      <div className="mb-2 flex items-center justify-between">
                        <Badge variant="secondary">
                          {getAddressTypeLabel(address.addressType)}
                        </Badge>
                        {address.isDefault && (
                          <Badge variant="default" className="text-xs">
                            Principal
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm font-medium">{address.addressLine1}</p>
                      {address.addressLine2 && (
                        <p className="text-muted-foreground text-sm">{address.addressLine2}</p>
                      )}
                      <p className="text-muted-foreground text-sm">
                        {address.city}
                        {address.department ? `, ${address.department}` : ''}
                      </p>
                      <p className="text-muted-foreground text-sm">
                        {address.country}
                        {address.postalCode ? ` ${address.postalCode}` : ''}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Personas de Contacto */}
        <TabsContent value="persons">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" aria-hidden="true" />
                  Personas de Contacto
                </CardTitle>
                <CardDescription>Personas de contacto asociadas a esta empresa</CardDescription>
              </div>
              <Button onClick={() => setPersonDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
                Agregar Persona
              </Button>
            </CardHeader>
            <CardContent>
              {contact.persons.length === 0 ? (
                <div className="border-border flex flex-col items-center justify-center rounded-lg border py-12">
                  <User className="text-muted-foreground h-8 w-8" aria-hidden="true" />
                  <p className="text-muted-foreground mt-3 text-center text-sm">
                    No hay personas de contacto registradas.
                  </p>
                  <p className="text-muted-foreground mt-1 text-center text-xs">
                    Agrega una persona haciendo clic en &quot;Agregar Persona&quot;.
                  </p>
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  {contact.persons.map((person) => (
                    <div key={person.id} className="rounded-lg border p-4">
                      <div className="mb-2 flex items-center justify-between">
                        <p className="font-medium">{person.fullName}</p>
                        <div className="flex gap-1">
                          {person.isPrimary && (
                            <Badge variant="default" className="text-xs">
                              <Star className="mr-1 h-3 w-3" aria-hidden="true" />
                              Principal
                            </Badge>
                          )}
                          <Badge variant={person.isActive ? 'default' : 'secondary'}>
                            {person.isActive ? 'Activo' : 'Inactivo'}
                          </Badge>
                        </div>
                      </div>
                      {person.jobTitle && (
                        <p className="text-muted-foreground text-sm">{person.jobTitle}</p>
                      )}
                      {person.email && (
                        <p className="text-muted-foreground text-sm">{person.email}</p>
                      )}
                      {person.phone && (
                        <p className="text-muted-foreground text-sm">{person.phone}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar contacto</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro de que deseas eliminar a <strong>{contact.legalName}</strong>? Esta
              acción no se puede deshacer y eliminará también todas sus direcciones y personas de
              contacto asociadas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add Address Dialog */}
      <Dialog
        open={addressDialogOpen}
        onOpenChange={(open) => {
          setAddressDialogOpen(open);
          if (!open) addressForm.reset();
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Agregar Dirección</DialogTitle>
            <DialogDescription>
              Ingresa los datos de la nueva dirección para este contacto.
            </DialogDescription>
          </DialogHeader>
          <Form {...addressForm}>
            <form onSubmit={addressForm.handleSubmit(handleAddAddress)} className="space-y-4">
              <FormField
                control={addressForm.control}
                name="addressType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel htmlFor="addressType">Tipo de Dirección</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger id="addressType">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {ADDRESS_TYPE_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={addressForm.control}
                name="addressLine1"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel htmlFor="addressLine1">Dirección *</FormLabel>
                    <FormControl>
                      <Input
                        id="addressLine1"
                        placeholder="Col. Palmira, Calle Principal #123"
                        autoFocus
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={addressForm.control}
                name="addressLine2"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel htmlFor="addressLine2">Dirección 2</FormLabel>
                    <FormControl>
                      <Input id="addressLine2" placeholder="Apto, local, piso..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={addressForm.control}
                  name="city"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel htmlFor="city">Ciudad *</FormLabel>
                      <FormControl>
                        <Input id="city" placeholder="Tegucigalpa" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={addressForm.control}
                  name="department"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel htmlFor="department">Departamento</FormLabel>
                      <FormControl>
                        <Input id="department" placeholder="Francisco Morazán" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={addressForm.control}
                  name="country"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel htmlFor="country">País (código ISO)</FormLabel>
                      <FormControl>
                        <Input id="country" placeholder="HN" maxLength={2} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={addressForm.control}
                  name="postalCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel htmlFor="postalCode">Código Postal</FormLabel>
                      <FormControl>
                        <Input id="postalCode" placeholder="11101" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={addressForm.control}
                name="isDefault"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <FormLabel htmlFor="isDefault">Dirección Principal</FormLabel>
                      <FormDescription className="text-xs">
                        Se usará por defecto en documentos
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        id="isDefault"
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setAddressDialogOpen(false)}
                  disabled={addressSubmitting}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={addressSubmitting}>
                  {addressSubmitting && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                  )}
                  {addressSubmitting ? 'Guardando...' : 'Agregar Dirección'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Add Person Dialog */}
      <Dialog
        open={personDialogOpen}
        onOpenChange={(open) => {
          setPersonDialogOpen(open);
          if (!open) personForm.reset();
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Agregar Persona de Contacto</DialogTitle>
            <DialogDescription>
              Ingresa los datos de la persona de contacto asociada a esta empresa.
            </DialogDescription>
          </DialogHeader>
          <Form {...personForm}>
            <form onSubmit={personForm.handleSubmit(handleAddPerson)} className="space-y-4">
              <FormField
                control={personForm.control}
                name="fullName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel htmlFor="personFullName">Nombre Completo *</FormLabel>
                    <FormControl>
                      <Input id="personFullName" placeholder="Juan Pérez" autoFocus {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={personForm.control}
                name="jobTitle"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel htmlFor="jobTitle">Cargo</FormLabel>
                    <FormControl>
                      <Input id="jobTitle" placeholder="Gerente de Compras" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={personForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel htmlFor="personEmail">Email</FormLabel>
                      <FormControl>
                        <Input
                          id="personEmail"
                          type="email"
                          placeholder="juan@empresa.hn"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={personForm.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel htmlFor="personPhone">Teléfono</FormLabel>
                      <FormControl>
                        <Input
                          id="personPhone"
                          type="tel"
                          placeholder="+504-9999-0000"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={personForm.control}
                  name="isPrimary"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                      <FormLabel htmlFor="isPrimary" className="text-sm">
                        Contacto Principal
                      </FormLabel>
                      <FormControl>
                        <Switch
                          id="isPrimary"
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={personForm.control}
                  name="isActive"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                      <FormLabel htmlFor="personIsActive" className="text-sm">
                        Activo
                      </FormLabel>
                      <FormControl>
                        <Switch
                          id="personIsActive"
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setPersonDialogOpen(false)}
                  disabled={personSubmitting}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={personSubmitting}>
                  {personSubmitting && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                  )}
                  {personSubmitting ? 'Guardando...' : 'Agregar Persona'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
