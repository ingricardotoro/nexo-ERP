// src/app/(dashboard)/dashboard/users/page.tsx
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { UsersTable, type UserTableData } from '@/components/users/users-table';
import { UserFormModal } from '@/components/users/user-form-modal';
import type { CreateUserInput } from '@/lib/validations/user.schema';
import { useTenant } from '@/lib/context/tenant-context';
import { UserEditModal } from './UserEditModal';

interface UsersApiResponse {
  success: boolean;
  data?: Array<{
    id: string;
    fullName: string;
    email: string;
    role: string;
    isActive: boolean;
    avatarUrl?: string | null;
    lastLoginAt?: string | null;
    createdAt: string;
  }>;
  pagination?: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  error?: string;
}

interface UserMutationResponse {
  success: boolean;
  data?: {
    id: string;
    fullName: string;
    email: string;
    role: string;
    isActive: boolean;
    avatarUrl?: string | null;
    lastLoginAt?: string | null;
    createdAt?: string;
    updatedAt?: string;
  };
  message?: string;
  error?: string;
}

function mapUserToTableData(user: {
  id: string;
  fullName: string;
  email: string;
  role: string;
  isActive: boolean;
  avatarUrl?: string | null;
  lastLoginAt?: string | null;
  createdAt?: string;
}): UserTableData {
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    avatarUrl: user.avatarUrl ?? null,
    createdAt: user.createdAt ? new Date(user.createdAt) : new Date(),
    lastLoginAt: user.lastLoginAt ? new Date(user.lastLoginAt) : null,
  };
}

export default function UsersPage() {
  const { tenant } = useTenant();

  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const pageSize = 10;

  const [users, setUsers] = useState<UserTableData[]>([]);
  const [totalUsers, setTotalUsers] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isRefetching, setIsRefetching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [userToEdit, setUserToEdit] = useState<UserTableData | null>(null);

  const maxUsers = tenant?.maxUsers ?? 0;
  const activeUsersInPage = useMemo(() => users.filter((user) => user.isActive).length, [users]);

  const fetchUsers = useCallback(
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

        if (searchQuery.trim()) {
          params.set('search', searchQuery.trim());
        }

        const response = await fetch(`/api/v1/core/users?${params.toString()}`, {
          method: 'GET',
          cache: 'no-store',
          credentials: 'include',
        });

        const payload = (await response.json()) as UsersApiResponse;

        if (!response.ok || !payload.success || !payload.data || !payload.pagination) {
          throw new Error(payload.error ?? 'Error al obtener usuarios');
        }

        setUsers(payload.data.map((user) => mapUserToTableData(user)));
        setTotalUsers(payload.pagination.total);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Error desconocido';
        setError(message);
        setUsers([]);
        setTotalUsers(0);
      } finally {
        setLoading(false);
        setIsRefetching(false);
      }
    },
    [currentPage, pageSize, searchQuery, sortBy, sortDirection],
  );

  useEffect(() => {
    void fetchUsers(true);
  }, [fetchUsers]);

  const handleCreateUser = async (data: CreateUserInput) => {
    try {
      const response = await fetch('/api/v1/core/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      const payload = (await response.json()) as UserMutationResponse;

      if (!response.ok || !payload.success) {
        throw new Error(payload.error ?? 'Error al crear usuario');
      }

      toast.success('Usuario creado exitosamente', {
        description: `${data.fullName} ha sido agregado al sistema.`,
      });

      setCurrentPage(1);
      await fetchUsers();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No se pudo crear el usuario';
      toast.error('Error al crear usuario', {
        description: message,
      });
      throw err;
    }
  };

  const handleEditUser = (userId: string) => {
    const user = users.find((candidate) => candidate.id === userId) || null;
    setUserToEdit(user);
    setEditModalOpen(true);
  };

  const handleUpdateUser = async (data: CreateUserInput) => {
    if (!userToEdit) return;

    try {
      const response = await fetch(`/api/v1/core/users/${userToEdit.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      const payload = (await response.json()) as UserMutationResponse;

      if (!response.ok || !payload.success) {
        throw new Error(payload.error ?? 'Error al actualizar usuario');
      }

      toast.success('Usuario actualizado', {
        description: 'Los datos del usuario han sido actualizados.',
      });

      setEditModalOpen(false);
      setUserToEdit(null);
      await fetchUsers();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No se pudo actualizar el usuario';
      toast.error('Error al editar usuario', {
        description: message,
      });
      throw err;
    }
  };

  const handleToggleStatus = async (userId: string, newStatus: boolean) => {
    try {
      const response = await fetch(`/api/v1/core/users/${userId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ isActive: newStatus }),
      });

      const payload = (await response.json()) as UserMutationResponse;

      if (!response.ok || !payload.success) {
        throw new Error(payload.error ?? 'Error al cambiar estado');
      }

      toast.success(newStatus ? 'Usuario activado' : 'Usuario desactivado', {
        description: newStatus
          ? 'El usuario ahora puede iniciar sesion.'
          : 'El usuario no podra iniciar sesion.',
      });

      await fetchUsers();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No se pudo actualizar el estado';
      toast.error('Error al cambiar estado', {
        description: message,
      });
    }
  };

  const handleDeleteUser = async (userId: string) => {
    try {
      if (!globalThis.confirm('¿Seguro que deseas eliminar este usuario?')) {
        return;
      }

      const response = await fetch(`/api/v1/core/users/${userId}`, {
        method: 'DELETE',
      });

      const payload = (await response.json()) as UserMutationResponse;

      if (!response.ok || !payload.success) {
        throw new Error(payload.error ?? 'Error al eliminar usuario');
      }

      toast.success('Usuario eliminado', {
        description: 'El usuario ha sido eliminado del sistema.',
      });

      await fetchUsers();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No se pudo eliminar el usuario';
      toast.error('Error al eliminar usuario', {
        description: message,
      });
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

  return (
    <div className="space-y-6">
      {loading && (
        <Card className="p-6 text-center">
          <span className="text-muted-foreground">Cargando usuarios...</span>
        </Card>
      )}

      {error && !loading && (
        <Card className="p-6 text-center">
          <span className="text-destructive">{error}</span>
        </Card>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-foreground text-3xl font-bold tracking-tight">Usuarios</h1>
          <p className="text-muted-foreground mt-2">
            Gestiona los usuarios de tu empresa y sus permisos
          </p>
        </div>
        <UserFormModal onSubmit={handleCreateUser} />
        {userToEdit ? (
          <UserEditModal
            open={editModalOpen}
            onOpenChange={(open: boolean) => {
              setEditModalOpen(open);
              if (!open) setUserToEdit(null);
            }}
            user={userToEdit}
            onSubmit={handleUpdateUser}
          />
        ) : null}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Usuarios Activos (pagina actual)</CardDescription>
            <CardTitle className="text-4xl">{activeUsersInPage}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-muted-foreground text-xs">de {totalUsers} usuarios registrados</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Licencias Disponibles</CardDescription>
            <CardTitle className="text-4xl">{Math.max(maxUsers - totalUsers, 0)}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-muted-foreground text-xs">limite de {maxUsers || '-'} usuarios</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Roles Asignados (pagina actual)</CardDescription>
            <CardTitle className="text-4xl">{new Set(users.map((user) => user.role)).size}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-muted-foreground text-xs">de 5 roles disponibles</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Buscar Usuarios</CardTitle>
          <CardDescription>Filtra por nombre o email</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <Search
              className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2"
              aria-hidden="true"
            />
            <Input
              type="search"
              placeholder="Buscar por nombre o email..."
              className="pl-9"
              value={searchQuery}
              onChange={(event) => handleSearchChange(event.target.value)}
              aria-label="Buscar usuarios"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Listado de Usuarios</CardTitle>
          <CardDescription>
            {totalUsers} {totalUsers === 1 ? 'usuario encontrado' : 'usuarios encontrados'}
            {isRefetching ? ' - actualizando...' : ''}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <UsersTable
            data={users}
            totalCount={totalUsers}
            currentPage={currentPage}
            pageSize={pageSize}
            isLoading={loading || isRefetching}
            onPageChange={setCurrentPage}
            onSort={handleSort}
            onEdit={handleEditUser}
            onToggleStatus={handleToggleStatus}
            onDelete={handleDeleteUser}
          />
        </CardContent>
      </Card>
    </div>
  );
}
