// src/app/(dashboard)/contacts/page.tsx
'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Plus, Upload, Users, ShoppingCart, Truck } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ContactsTable, type ContactTableData } from '@/components/contacts/contacts-table';
import { ContactImportDialog } from '@/components/contacts/contact-import-dialog';

interface ContactsApiResponse {
  success: boolean;
  data?: ContactTableData[];
  pagination?: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  error?: string;
}

interface MutationResponse {
  success: boolean;
  message?: string;
  error?: string;
}

export default function ContactsPage() {
  const router = useRouter();

  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [activeFilter, setActiveFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [sortBy, setSortBy] = useState('legalName');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const pageSize = 10;

  const [contacts, setContacts] = useState<ContactTableData[]>([]);
  const [totalContacts, setTotalContacts] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isRefetching, setIsRefetching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [totalCustomers, setTotalCustomers] = useState(0);
  const [totalSuppliers, setTotalSuppliers] = useState(0);
  const [importDialogOpen, setImportDialogOpen] = useState(false);

  const fetchContacts = useCallback(
    async (showMainLoading = false) => {
      if (showMainLoading) {
        setLoading(true);
      } else {
        setIsRefetching(true);
      }

      setError(null);

      try {
        const params = new URLSearchParams({
          page: String(currentPage),
          limit: String(pageSize),
          orderBy: sortBy,
          orderDir: sortDirection,
        });

        if (searchQuery.trim()) params.set('search', searchQuery.trim());
        if (typeFilter) params.set('type', typeFilter);
        if (roleFilter) params.set('role', roleFilter);
        if (activeFilter) params.set('isActive', activeFilter);

        const response = await fetch(`/api/v1/contacts?${params.toString()}`, {
          method: 'GET',
          cache: 'no-store',
          credentials: 'include',
        });

        const payload = (await response.json()) as ContactsApiResponse;

        if (!response.ok || !payload.success || !payload.data || !payload.pagination) {
          throw new Error(payload.error ?? 'Error al obtener contactos');
        }

        setContacts(payload.data);
        setTotalContacts(payload.pagination.total);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Error desconocido';
        setError(message);
        setContacts([]);
        setTotalContacts(0);
      } finally {
        setLoading(false);
        setIsRefetching(false);
      }
    },
    [
      currentPage,
      pageSize,
      searchQuery,
      typeFilter,
      roleFilter,
      activeFilter,
      sortBy,
      sortDirection,
    ],
  );

  const fetchStats = useCallback(async () => {
    try {
      const [customersRes, suppliersRes] = await Promise.all([
        fetch('/api/v1/contacts?role=customer&isActive=true&limit=1', { credentials: 'include' }),
        fetch('/api/v1/contacts?role=supplier&isActive=true&limit=1', { credentials: 'include' }),
      ]);
      const customersPayload = (await customersRes.json()) as ContactsApiResponse;
      const suppliersPayload = (await suppliersRes.json()) as ContactsApiResponse;

      if (customersPayload.success && customersPayload.pagination) {
        setTotalCustomers(customersPayload.pagination.total);
      }
      if (suppliersPayload.success && suppliersPayload.pagination) {
        setTotalSuppliers(suppliersPayload.pagination.total);
      }
    } catch {
      // Las estadísticas son secundarias; no bloquear la página por error
    }
  }, []);

  useEffect(() => {
    void fetchContacts(true);
  }, [fetchContacts]);

  useEffect(() => {
    void fetchStats();
  }, [fetchStats]);

  const handleToggleStatus = async (contactId: string, newStatus: boolean) => {
    try {
      const response = await fetch(`/api/v1/contacts/${contactId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ isActive: newStatus }),
      });

      const payload = (await response.json()) as MutationResponse;

      if (!response.ok || !payload.success) {
        throw new Error(payload.error ?? 'Error al cambiar estado');
      }

      toast.success(newStatus ? 'Contacto activado' : 'Contacto desactivado', {
        description: newStatus
          ? 'El contacto está ahora activo en el sistema.'
          : 'El contacto ha sido desactivado.',
      });

      await fetchContacts();
      void fetchStats();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No se pudo actualizar el estado';
      toast.error('Error al cambiar estado', { description: message });
    }
  };

  const handleDelete = async (contactId: string) => {
    try {
      const response = await fetch(`/api/v1/contacts/${contactId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      const payload = (await response.json()) as MutationResponse;

      if (!response.ok || !payload.success) {
        throw new Error(payload.error ?? 'Error al eliminar contacto');
      }

      toast.success('Contacto eliminado', {
        description: 'El contacto ha sido eliminado del sistema.',
      });

      await fetchContacts();
      void fetchStats();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No se pudo eliminar el contacto';
      toast.error('Error al eliminar contacto', { description: message });
    }
  };

  const handleSort = (columnId: string, direction: 'asc' | 'desc') => {
    setSortBy(columnId);
    setSortDirection(direction);
    setCurrentPage(1);
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setCurrentPage(1);
  };

  const handleFilterChange = (
    setter: React.Dispatch<React.SetStateAction<string>>,
    value: string,
  ) => {
    setter(value === 'all' ? '' : value);
    setCurrentPage(1);
  };

  return (
    <div className="space-y-6">
      {error && !loading && (
        <Card className="p-6 text-center">
          <span className="text-destructive">{error}</span>
        </Card>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-foreground text-3xl font-bold tracking-tight">Contactos</h1>
          <p className="text-muted-foreground mt-2">
            Gestiona clientes, proveedores y sus datos de contacto
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setImportDialogOpen(true)}>
            <Upload className="mr-2 h-4 w-4" aria-hidden="true" />
            Importar Excel
          </Button>
          <Button onClick={() => router.push('/dashboard/contacts/new' as never)}>
            <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
            Nuevo Contacto
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription className="flex items-center gap-1">
              <Users className="h-4 w-4" aria-hidden="true" />
              Total Contactos
            </CardDescription>
            <CardTitle className="text-4xl">{loading ? '—' : totalContacts}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-muted-foreground text-xs">contactos registrados en el sistema</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription className="flex items-center gap-1">
              <ShoppingCart className="h-4 w-4" aria-hidden="true" />
              Clientes Activos
            </CardDescription>
            <CardTitle className="text-4xl">{totalCustomers}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-muted-foreground text-xs">clientes con estado activo</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription className="flex items-center gap-1">
              <Truck className="h-4 w-4" aria-hidden="true" />
              Proveedores Activos
            </CardDescription>
            <CardTitle className="text-4xl">{totalSuppliers}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-muted-foreground text-xs">proveedores con estado activo</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filtrar Contactos</CardTitle>
          <CardDescription>Busca y filtra por nombre, RTN, tipo o rol</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search
                className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2"
                aria-hidden="true"
              />
              <Input
                type="search"
                placeholder="Buscar por nombre, RTN o email..."
                className="pl-9"
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                aria-label="Buscar contactos"
              />
            </div>
            <Select
              value={typeFilter || 'all'}
              onValueChange={(v) => handleFilterChange(setTypeFilter, v)}
            >
              <SelectTrigger className="w-full sm:w-44" aria-label="Filtrar por tipo">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los tipos</SelectItem>
                <SelectItem value="NATURAL">Persona Natural</SelectItem>
                <SelectItem value="JURIDICAL">Persona Jurídica</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={roleFilter || 'all'}
              onValueChange={(v) => handleFilterChange(setRoleFilter, v)}
            >
              <SelectTrigger className="w-full sm:w-44" aria-label="Filtrar por rol">
                <SelectValue placeholder="Rol" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los roles</SelectItem>
                <SelectItem value="customer">Clientes</SelectItem>
                <SelectItem value="supplier">Proveedores</SelectItem>
                <SelectItem value="both">Cliente / Proveedor</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={activeFilter || 'all'}
              onValueChange={(v) => handleFilterChange(setActiveFilter, v)}
            >
              <SelectTrigger className="w-full sm:w-40" aria-label="Filtrar por estado">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los estados</SelectItem>
                <SelectItem value="true">Activos</SelectItem>
                <SelectItem value="false">Inactivos</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Directorio de Contactos</CardTitle>
          <CardDescription>
            {totalContacts} {totalContacts === 1 ? 'contacto encontrado' : 'contactos encontrados'}
            {isRefetching ? ' — actualizando...' : ''}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ContactsTable
            data={contacts}
            totalCount={totalContacts}
            currentPage={currentPage}
            pageSize={pageSize}
            isLoading={loading || isRefetching}
            onPageChange={setCurrentPage}
            onSort={handleSort}
            onToggleStatus={handleToggleStatus}
            onDelete={handleDelete}
          />
        </CardContent>
      </Card>
      <ContactImportDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        onImportSuccess={() => {
          void fetchContacts();
          void fetchStats();
        }}
      />
    </div>
  );
}
