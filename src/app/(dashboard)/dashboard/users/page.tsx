// src/app/(dashboard)/dashboard/users/page.tsx
'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
import { UsersTable, type UserTableData } from '@/components/users/users-table';
import { UserFormModal } from '@/components/users/user-form-modal';
import type { CreateUserInput } from '@/lib/validations/user.schema';
import { toast } from 'sonner';

// Datos mock para desarrollo (temporal, reemplazar con API)
const mockUsers: UserTableData[] = [
  {
    id: '1',
    fullName: 'Admin Usuario',
    email: 'admin@empresademo.hn',
    role: 'ADMIN',
    isActive: true,
    avatarUrl: null,
    lastLoginAt: new Date('2026-03-15T10:30:00'),
    createdAt: new Date('2026-03-01T08:00:00'),
  },
  {
    id: '2',
    fullName: 'Contador Principal',
    email: 'contador@empresademo.hn',
    role: 'ACCOUNTANT',
    isActive: true,
    avatarUrl: null,
    lastLoginAt: new Date('2026-03-14T15:20:00'),
    createdAt: new Date('2026-03-02T09:00:00'),
  },
];

export default function UsersPage() {
  const [users, setUsers] = useState<UserTableData[]>(mockUsers);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const pageSize = 10;

  // Filtrar usuarios por búsqueda
  const filteredUsers = users.filter(
    (user) =>
      user.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  // Handler para crear usuario
  const handleCreateUser = async (data: CreateUserInput) => {
    try {
      // TODO: Llamar API POST /api/v1/core/users
      console.warn('TODO: Implementar creación de usuario (API pendiente):', data);

      // Mock: agregar usuario a la lista
      const newUser: UserTableData = {
        id: String(users.length + 1),
        fullName: data.fullName,
        email: data.email,
        role: data.role,
        isActive: data.isActive ?? true,
        avatarUrl: data.avatarUrl || null,
        lastLoginAt: null,
        createdAt: new Date(),
      };
      setUsers([...users, newUser]);

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

  // Handler para editar usuario
  const handleEditUser = (userId: string) => {
    // TODO: Abrir modal con datos del usuario
    console.warn('TODO: Implementar edición de usuario (API pendiente):', userId);
    toast.info('Función en desarrollo', {
      description: 'La edición de usuarios estará disponible pronto.',
    });
  };

  // Handler para activar/desactivar usuario
  const handleToggleStatus = async (userId: string, newStatus: boolean) => {
    try {
      // TODO: Llamar API PUT /api/v1/core/users/:id
      console.warn('TODO: Implementar cambio de estado (API pendiente):', userId, newStatus);

      // Mock: actualizar estado en la lista
      setUsers(users.map((user) => (user.id === userId ? { ...user, isActive: newStatus } : user)));

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
      // TODO: Mostrar AlertDialog de confirmación antes de eliminar
      // TODO: Llamar API DELETE /api/v1/core/users/:id
      console.warn('TODO: Implementar eliminación de usuario (API pendiente):', userId);

      // Mock: eliminar de la lista
      setUsers(users.filter((user) => user.id !== userId));

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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-foreground text-3xl font-bold tracking-tight">Usuarios</h1>
          <p className="text-muted-foreground mt-2">
            Gestiona los usuarios de tu empresa y sus permisos
          </p>
        </div>
        <UserFormModal onSubmit={handleCreateUser} />
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
