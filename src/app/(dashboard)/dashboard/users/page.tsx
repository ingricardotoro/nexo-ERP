// src/app/(dashboard)/dashboard/users/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
import { UsersTable, type UserTableData } from '@/components/users/users-table';
import { UserFormModal } from '@/components/users/user-form-modal';
import type { CreateUserInput } from '@/lib/validations/user.schema';
import { UserEditModal } from './UserEditModal';

import { toast } from 'sonner';

export default function UsersPage() {
  // Estado y lógica de búsqueda y paginación
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;
  const [users, setUsers] = useState<UserTableData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Handler para crear usuario
  const handleCreateUser = async (data: CreateUserInput) => {
    try {
      const res = await fetch('/api/v1/core/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Error al crear usuario');
      const newUser = await res.json();
      setUsers((prev: UserTableData[]) => [
        ...prev,
        {
          ...newUser,
          createdAt: new Date(newUser.createdAt),
          lastLoginAt: newUser.lastLoginAt ? new Date(newUser.lastLoginAt) : null,
        },
      ]);
      toast.success('Usuario creado exitosamente', {
        description: `${data.fullName} ha sido agregado al sistema.`,
      });
    } catch (error) {
      console.error('Error al crear usuario:', error);
      toast.error('Error al crear usuario', {
        description: 'No se pudo crear el usuario. Intenta de nuevo.',
      });
      throw error;
    }
  };

  // Filtrar usuarios por búsqueda
  const filteredUsers = users.filter(
    (user) =>
      user.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase()),
  );
  // Cargar usuarios desde la API al montar
  useEffect(() => {
    const fetchUsers = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/v1/core/users');
        if (!res.ok) throw new Error('Error al obtener usuarios');
        const data = (await res.json()) as UserTableData[];
        setUsers(
          data.map((u: UserTableData) => ({
            ...u,
            createdAt: new Date(u.createdAt),
            lastLoginAt: u.lastLoginAt ? new Date(u.lastLoginAt) : null,
          })),
        );
      } catch (err) {
        if (err instanceof Error) {
          setError(err.message || 'Error desconocido');
        } else {
          setError('Error desconocido');
        }
      } finally {
        setLoading(false);
      }
    };
    fetchUsers();
  }, []);
  // (eliminado bloque residual de toast.error y throw error)

  // Modal de edición de usuario
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [userToEdit, setUserToEdit] = useState<UserTableData | null>(null);

  // Handler para abrir modal de edición
  const handleEditUser = (userId: string) => {
    const user = users.find((u: UserTableData) => u.id === userId) || null;
    setUserToEdit(user);
    setEditModalOpen(true);
  };

  // Handler para guardar cambios de edición
  const handleUpdateUser = async (data: CreateUserInput) => {
    if (!userToEdit) return;
    try {
      const res = await fetch(`/api/v1/core/users/${userToEdit.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Error al editar usuario');
      const updatedUser = await res.json();
      setUsers((prev: UserTableData[]) =>
        prev.map((u: UserTableData) =>
          u.id === userToEdit.id
            ? {
                ...u,
                ...updatedUser,
                createdAt: new Date(updatedUser.createdAt),
                lastLoginAt: updatedUser.lastLoginAt ? new Date(updatedUser.lastLoginAt) : null,
              }
            : u,
        ),
      );
      toast.success('Usuario actualizado', {
        description: 'Los datos del usuario han sido actualizados.',
      });
      setEditModalOpen(false);
      setUserToEdit(null);
    } catch (error) {
      console.error('Error al editar usuario:', error);
      toast.error('Error al editar usuario', {
        description: 'No se pudo actualizar el usuario.',
      });
    }
  };

  // Handler para activar/desactivar usuario
  const handleToggleStatus = async (userId: string, newStatus: boolean) => {
    try {
      const res = await fetch(`/api/v1/core/users/${userId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ isActive: newStatus }),
      });
      if (!res.ok) throw new Error('Error al cambiar estado');
      const updatedUser = await res.json();
      setUsers((prev: UserTableData[]) =>
        prev.map((u: UserTableData) =>
          u.id === userId
            ? {
                ...u,
                ...updatedUser,
                createdAt: new Date(updatedUser.createdAt),
                lastLoginAt: updatedUser.lastLoginAt ? new Date(updatedUser.lastLoginAt) : null,
              }
            : u,
        ),
      );
      toast.success(newStatus ? 'Usuario activado' : 'Usuario desactivado', {
        description: newStatus
          ? 'El usuario ahora puede iniciar sesión.'
          : 'El usuario no podrá iniciar sesión.',
      });
    } catch (error) {
      console.error('Error al cambiar estado:', error);
      toast.error('Error al cambiar estado', {
        description: 'No se pudo actualizar el estado del usuario.',
      });
    }
  };

  // Handler para eliminar usuario (soft delete)
  const handleDeleteUser = async (userId: string) => {
    try {
      // Confirmación simple (puedes mejorar con un modal)
      if (!globalThis.confirm('¿Seguro que deseas eliminar este usuario?')) return;
      const res = await fetch(`/api/v1/core/users/${userId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Error al eliminar usuario');
      setUsers((prev: UserTableData[]) => prev.filter((user: UserTableData) => user.id !== userId));
      toast.success('Usuario eliminado', {
        description: 'El usuario ha sido eliminado del sistema.',
      });
    } catch (error) {
      console.error('Error al eliminar usuario:', error);
      toast.error('Error al eliminar usuario', {
        description: 'No se pudo eliminar el usuario.',
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Estado de carga y error */}
      {loading && (
        <Card className="p-6 text-center">
          <span className="text-muted-foreground">Cargando usuarios...</span>
        </Card>
      )}
      {error && (
        <Card className="p-6 text-center">
          <span className="text-destructive">{error}</span>
        </Card>
      )}
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-foreground text-3xl font-bold tracking-tight">Usuarios</h1>
          <p className="text-muted-foreground mt-2">
            Gestiona los usuarios de tu empresa y sus permisos
          </p>
        </div>
        <UserFormModal onSubmit={handleCreateUser} />
        {/* Modal de edición */}
        {userToEdit && (
          <UserEditModal
            open={editModalOpen}
            onOpenChange={(open: boolean) => {
              setEditModalOpen(open);
              if (!open) setUserToEdit(null);
            }}
            user={userToEdit}
            onSubmit={handleUpdateUser}
          />
        )}
      </div>

      {/* Estadísticas */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Usuarios Activos</CardDescription>
            <CardTitle className="text-4xl">{users.filter((u) => u.isActive).length}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-muted-foreground text-xs">de {users.length} usuarios totales</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Licencias Disponibles</CardDescription>
            <CardTitle className="text-4xl">3</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-muted-foreground text-xs">límite de 5 usuarios</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Roles Asignados</CardDescription>
            <CardTitle className="text-4xl">{new Set(users.map((u) => u.role)).size}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-muted-foreground text-xs">de 5 roles disponibles</div>
          </CardContent>
        </Card>
      </div>

      {/* Búsqueda */}
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
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Buscar usuarios"
            />
          </div>
        </CardContent>
      </Card>

      {/* Tabla */}
      <Card>
        <CardHeader>
          <CardTitle>Listado de Usuarios</CardTitle>
          <CardDescription>
            {filteredUsers.length}{' '}
            {filteredUsers.length === 1 ? 'usuario encontrado' : 'usuarios encontrados'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <UsersTable
            data={filteredUsers}
            totalCount={filteredUsers.length}
            currentPage={currentPage}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onSort={(columnId, direction) =>
              console.warn('TODO: Implementar ordenamiento:', columnId, direction)
            }
            onEdit={handleEditUser}
            onToggleStatus={handleToggleStatus}
            onDelete={handleDeleteUser}
          />
        </CardContent>
      </Card>
    </div>
  );
}
