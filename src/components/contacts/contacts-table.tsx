// src/components/contacts/contacts-table.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  Eye,
  Edit,
  Power,
  PowerOff,
  Trash2,
} from 'lucide-react';
import { ContactTypeBadge } from './contact-type-badge';
import { ContactRoleBadge } from './contact-role-badge';
import { ContactStatusBadge } from './contact-status-badge';
import { formatRtn, type ContactType } from '@/lib/validations/contact.schema';

export interface ContactTableData {
  id: string;
  contactType: ContactType;
  legalName: string;
  tradeName?: string | null;
  rtn?: string | null;
  isCustomer: boolean;
  isSupplier: boolean;
  email?: string | null;
  phone?: string | null;
  isActive: boolean;
  createdAt: string;
}

interface ContactsTableProps {
  data: ContactTableData[];
  totalCount: number;
  currentPage: number;
  pageSize: number;
  isLoading?: boolean;
  onPageChange: (page: number) => void;
  onSort: (columnId: string, direction: 'asc' | 'desc') => void;
  onToggleStatus?: (contactId: string, isActive: boolean) => Promise<void>;
  onDelete?: (contactId: string) => Promise<void>;
}

/**
 * Tabla de contactos con TanStack Table v8.
 * Features: ordenamiento server-side, paginación server-side, acciones por fila.
 * Cumple WCAG 2.1 AA: tabla semántica, aria-sort en columnas ordenables, estados de carga.
 */
export function ContactsTable({
  data,
  totalCount,
  currentPage,
  pageSize,
  isLoading = false,
  onPageChange,
  onSort,
  onToggleStatus,
  onDelete,
}: ContactsTableProps) {
  const router = useRouter();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [contactToDelete, setContactToDelete] = useState<ContactTableData | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const handleDeleteClick = (contact: ContactTableData) => {
    setContactToDelete(contact);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!contactToDelete || !onDelete) return;
    setActionLoading(contactToDelete.id);
    try {
      await onDelete(contactToDelete.id);
    } finally {
      setActionLoading(null);
      setDeleteDialogOpen(false);
      setContactToDelete(null);
    }
  };

  const handleToggleStatus = async (contact: ContactTableData) => {
    if (!onToggleStatus) return;
    setActionLoading(contact.id);
    try {
      await onToggleStatus(contact.id, !contact.isActive);
    } finally {
      setActionLoading(null);
    }
  };

  const columns: ColumnDef<ContactTableData>[] = [
    {
      accessorKey: 'legalName',
      header: 'Nombre / Razón Social',
      cell: ({ row }) => (
        <div>
          <div className="font-medium">{row.original.legalName}</div>
          {row.original.tradeName && (
            <div className="text-muted-foreground text-xs">{row.original.tradeName}</div>
          )}
        </div>
      ),
    },
    {
      accessorKey: 'contactType',
      header: 'Tipo',
      cell: ({ row }) => <ContactTypeBadge contactType={row.original.contactType} />,
      enableSorting: false,
    },
    {
      id: 'role',
      header: 'Rol',
      cell: ({ row }) => (
        <ContactRoleBadge
          isCustomer={row.original.isCustomer}
          isSupplier={row.original.isSupplier}
        />
      ),
      enableSorting: false,
    },
    {
      accessorKey: 'rtn',
      header: 'RTN',
      cell: ({ row }) => <span className="font-mono text-sm">{formatRtn(row.original.rtn)}</span>,
      enableSorting: false,
    },
    {
      accessorKey: 'email',
      header: 'Email',
      cell: ({ row }) => (
        <div className="text-muted-foreground text-sm">{row.original.email ?? '—'}</div>
      ),
    },
    {
      accessorKey: 'isActive',
      header: 'Estado',
      cell: ({ row }) => <ContactStatusBadge isActive={row.original.isActive} />,
      enableSorting: false,
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => {
        const contact = row.original;
        const isThisLoading = actionLoading === contact.id;

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Acciones para ${contact.legalName}`}
                disabled={isThisLoading}
              >
                <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuLabel>Acciones</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => router.push(`/dashboard/contacts/${contact.id}` as never)}
              >
                <Eye className="mr-2 h-4 w-4" aria-hidden="true" />
                <span>Ver detalle</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => router.push(`/dashboard/contacts/${contact.id}/edit` as never)}
              >
                <Edit className="mr-2 h-4 w-4" aria-hidden="true" />
                <span>Editar</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleToggleStatus(contact)}>
                {contact.isActive ? (
                  <>
                    <PowerOff className="mr-2 h-4 w-4" aria-hidden="true" />
                    <span>Desactivar</span>
                  </>
                ) : (
                  <>
                    <Power className="mr-2 h-4 w-4" aria-hidden="true" />
                    <span>Activar</span>
                  </>
                )}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => handleDeleteClick(contact)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" />
                <span>Eliminar</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
      enableSorting: false,
    },
  ];

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    manualSorting: true,
    state: { sorting },
    onSortingChange: (updater) => {
      setSorting((prev) => {
        const next = typeof updater === 'function' ? updater(prev) : updater;
        const first = next[0];
        if (first?.id) {
          onSort(first.id, first.desc ? 'desc' : 'asc');
        }
        return next;
      });
    },
    pageCount: Math.ceil(totalCount / pageSize),
  });

  if (!isLoading && data.length === 0) {
    return (
      <div className="border-border flex flex-col items-center justify-center rounded-lg border py-12">
        <p className="text-muted-foreground text-center text-sm">No se encontraron contactos.</p>
        <p className="text-muted-foreground mt-2 text-center text-xs">
          Crea tu primer contacto haciendo clic en &quot;Nuevo Contacto&quot;.
        </p>
      </div>
    );
  }

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
    <>
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

        <div className="flex items-center justify-between">
          <p className="text-muted-foreground text-sm">
            Mostrando {(currentPage - 1) * pageSize + 1} a{' '}
            {Math.min(currentPage * pageSize, totalCount)} de {totalCount}{' '}
            {totalCount === 1 ? 'contacto' : 'contactos'}
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

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar contacto</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro de que deseas eliminar a <strong>{contactToDelete?.legalName}</strong>?
              Esta acción no se puede deshacer y eliminará también sus direcciones y personas de
              contacto asociadas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
