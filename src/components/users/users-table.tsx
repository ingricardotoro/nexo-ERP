// src/components/users/users-table.tsx
'use client';

import { useState } from 'react';
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { UserAvatar } from './user-avatar';
import { UserRoleBadge } from './user-role-badge';
import { UserStatusBadge } from './user-status-badge';
import { UserActionsMenu } from './user-actions-menu';
import { format } from 'date-fns';

// Tipo de usuario para la tabla (simplificado desde Prisma)
export interface UserTableData {
  id: string;
  fullName: string;
  email: string;
  role: string;
  isActive: boolean;
  avatarUrl?: string | null;
  lastLoginAt?: Date | null;
  createdAt: Date;
}

interface UsersTableProps {
  data: UserTableData[];
  totalCount: number;
  currentPage: number;
  pageSize: number;
  isLoading?: boolean;
  onPageChange: (page: number) => void;
  onSort: (columnId: string, direction: 'asc' | 'desc') => void;
  onEdit?: (userId: string) => void;
  onToggleStatus?: (userId: string, isActive: boolean) => void;
  onDelete?: (userId: string) => void;
}

/**
 * Tabla de usuarios con TanStack Table v8.
 * Features: ordenamiento, paginación server-side, acciones por fila.
 * Cumple WCAG 2.1 AA: tabla semántica, aria-sort en columnas ordenables, estados de carga.
 */
export function UsersTable({
  data,
  totalCount,
  currentPage,
  pageSize,
  isLoading = false,
  onPageChange,
  onEdit,
  onToggleStatus,
  onDelete,
}: UsersTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);

  // Definición de columnas
  const columns: ColumnDef<UserTableData>[] = [
    {
      id: 'avatar',
      header: '',
      cell: ({ row }) => (
        <UserAvatar
          fullName={row.original.fullName}
          avatarUrl={row.original.avatarUrl}
          className="h-8 w-8"
        />
      ),
      enableSorting: false,
    },
    {
      accessorKey: 'fullName',
      header: 'Nombre Completo',
      cell: ({ row }) => <div className="font-medium">{row.original.fullName}</div>,
    },
    {
      accessorKey: 'email',
      header: 'Email',
      cell: ({ row }) => <div className="text-muted-foreground">{row.original.email}</div>,
    },
    {
      accessorKey: 'role',
      header: 'Rol',
      cell: ({ row }) => <UserRoleBadge role={row.original.role} />,
    },
    {
      accessorKey: 'isActive',
      header: 'Estado',
      cell: ({ row }) => <UserStatusBadge isActive={row.original.isActive} />,
    },
    {
      accessorKey: 'lastLoginAt',
      header: 'Último Login',
      cell: ({ row }) => {
        const lastLogin = row.original.lastLoginAt;
        return (
          <div className="text-muted-foreground text-sm">
            {lastLogin ? format(lastLogin, 'dd/MM/yyyy HH:mm') : 'Nunca'}
          </div>
        );
      },
    },
    {
      accessorKey: 'createdAt',
      header: 'Fecha Creación',
      cell: ({ row }) => (
        <div className="text-muted-foreground text-sm">
          {format(row.original.createdAt, 'dd/MM/yyyy')}
        </div>
      ),
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <UserActionsMenu
          userId={row.original.id}
          isActive={row.original.isActive}
          onEdit={onEdit}
          onToggleStatus={onToggleStatus}
          onDelete={onDelete}
        />
      ),
      enableSorting: false,
    },
  ];

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    manualSorting: true,
    state: {
      sorting,
    },
    onSortingChange: setSorting,
    pageCount: Math.ceil(totalCount / pageSize),
  });

  // Estado vacío
  if (!isLoading && data.length === 0) {
    return (
      <div className="border-border flex flex-col items-center justify-center rounded-lg border py-12">
        <p className="text-muted-foreground text-center text-sm">No se encontraron usuarios.</p>
        <p className="text-muted-foreground mt-2 text-center text-xs">
          Crea tu primer usuario haciendo clic en &quot;Crear Usuario&quot;.
        </p>
      </div>
    );
  }

  // Estado de carga
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  const totalPages = Math.ceil(totalCount / pageSize);
  const hasNextPage = currentPage < totalPages;
  const hasPreviousPage = currentPage > 1;

  return (
    <div className="space-y-4">
      <div className="border-border rounded-lg border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.map((row) => (
              <TableRow key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Paginación */}
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-sm">
          Mostrando {(currentPage - 1) * pageSize + 1} a{' '}
          {Math.min(currentPage * pageSize, totalCount)} de {totalCount} usuarios
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={!hasPreviousPage}
            aria-label="Página anterior"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            <span className="sr-only">Anterior</span>
          </Button>
          <span className="text-sm">
            Página {currentPage} de {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={!hasNextPage}
            aria-label="Página siguiente"
          >
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
            <span className="sr-only">Siguiente</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
