// src/components/invoicing/invoices-table.tsx
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
import { ChevronLeft, ChevronRight, MoreHorizontal, Eye, FileText } from 'lucide-react';
import { InvoiceStatusBadge, type InvoiceStatus } from './invoice-status-badge';
import { InvoiceTypeBadge, type InvoiceType } from './invoice-type-badge';
import { formatCurrency } from './format-currency';
import { format } from 'date-fns';

export interface InvoiceTableData {
  id: string;
  invoiceType: InvoiceType;
  invoiceNumber?: string | null;
  issueDate: string;
  currencyCode: string;
  subtotal: number;
  taxAmount: number;
  total: number;
  status: InvoiceStatus;
  contact?: {
    id: string;
    legalName: string;
    tradeName?: string | null;
  } | null;
}

interface InvoicesTableProps {
  data: InvoiceTableData[];
  totalCount: number;
  currentPage: number;
  pageSize: number;
  isLoading?: boolean;
  onPageChange: (page: number) => void;
  onSort: (columnId: string, direction: 'asc' | 'desc') => void;
}

const SKELETON_ROWS = 5;

export function InvoicesTable({
  data,
  totalCount,
  currentPage,
  pageSize,
  isLoading,
  onPageChange,
  onSort,
}: InvoicesTableProps) {
  const router = useRouter();
  const [sorting, setSorting] = useState<SortingState>([]);

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  const columns: ColumnDef<InvoiceTableData>[] = [
    {
      accessorKey: 'invoiceNumber',
      header: '# Factura',
      cell: ({ row }) => {
        const num = row.original.invoiceNumber;
        return num ? (
          <span className="font-mono text-sm font-medium">{num}</span>
        ) : (
          <span className="text-muted-foreground text-sm">—</span>
        );
      },
    },
    {
      accessorKey: 'invoiceType',
      header: 'Tipo',
      cell: ({ row }) => <InvoiceTypeBadge invoiceType={row.original.invoiceType} />,
    },
    {
      accessorKey: 'contact',
      header: 'Cliente',
      cell: ({ row }) => {
        const contact = row.original.contact;
        return contact ? (
          <span className="text-sm font-medium">{contact.tradeName ?? contact.legalName}</span>
        ) : (
          <span className="text-muted-foreground text-sm">—</span>
        );
      },
    },
    {
      accessorKey: 'issueDate',
      header: 'Fecha',
      cell: ({ row }) => (
        <span className="text-sm">{format(new Date(row.original.issueDate), 'dd/MM/yyyy')}</span>
      ),
    },
    {
      accessorKey: 'subtotal',
      header: () => <span className="block text-right">Subtotal</span>,
      cell: ({ row }) => (
        <span className="block text-right font-mono text-sm">
          {formatCurrency(row.original.subtotal, row.original.currencyCode)}
        </span>
      ),
    },
    {
      accessorKey: 'taxAmount',
      header: () => <span className="block text-right">ISV</span>,
      cell: ({ row }) => (
        <span className="block text-right font-mono text-sm">
          {formatCurrency(row.original.taxAmount, row.original.currencyCode)}
        </span>
      ),
    },
    {
      accessorKey: 'total',
      header: () => <span className="block text-right">Total</span>,
      cell: ({ row }) => (
        <span className="block text-right font-mono text-sm font-semibold">
          {formatCurrency(row.original.total, row.original.currencyCode)}
        </span>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Estado',
      cell: ({ row }) => <InvoiceStatusBadge status={row.original.status} />,
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => {
        const invoice = row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                aria-label={`Acciones para factura ${invoice.invoiceNumber ?? invoice.id}`}
              >
                <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Acciones</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => router.push(`/dashboard/invoicing/invoices/${invoice.id}` as never)}
              >
                <Eye className="mr-2 h-4 w-4" aria-hidden="true" />
                Ver detalle
              </DropdownMenuItem>
              {invoice.status === 'PUBLISHED' && (
                <DropdownMenuItem
                  onClick={() =>
                    router.push(`/dashboard/invoicing/invoices/${invoice.id}` as never)
                  }
                >
                  <FileText className="mr-2 h-4 w-4" aria-hidden="true" />
                  Ver factura emitida
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualSorting: true,
    manualPagination: true,
    pageCount: totalPages,
    state: { sorting },
    onSortingChange: (updater) => {
      const next = typeof updater === 'function' ? updater(sorting) : updater;
      setSorting(next);
      if (next.length > 0) {
        onSort(next[0].id, next[0].desc ? 'desc' : 'asc');
      }
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-3" aria-label="Cargando facturas" aria-busy="true">
        {Array.from({ length: SKELETON_ROWS }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full rounded-md" />
        ))}
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="border-border flex flex-col items-center justify-center rounded-lg border py-16">
        <FileText className="text-muted-foreground h-10 w-10" aria-hidden="true" />
        <p className="text-muted-foreground mt-4 text-center text-sm font-medium">
          No se encontraron facturas
        </p>
        <p className="text-muted-foreground mt-1 text-center text-xs">
          Crea una nueva factura con el botón &quot;Nueva Factura&quot;.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Tabla — scroll horizontal en mobile */}
      <div className="overflow-x-auto rounded-md border">
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
              <TableRow
                key={row.id}
                className="hover:bg-muted/50 cursor-pointer"
                onClick={() =>
                  router.push(`/dashboard/invoicing/invoices/${row.original.id}` as never)
                }
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell
                    key={cell.id}
                    onClick={cell.column.id === 'actions' ? (e) => e.stopPropagation() : undefined}
                  >
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
          {totalCount === 0
            ? 'Sin resultados'
            : `Mostrando ${(currentPage - 1) * pageSize + 1}–${Math.min(currentPage * pageSize, totalCount)} de ${totalCount}`}
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage <= 1}
            aria-label="Página anterior"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </Button>
          <span className="text-sm">
            Página {currentPage} de {totalPages}
          </span>
          <Button
            variant="outline"
            size="icon"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage >= totalPages}
            aria-label="Página siguiente"
          >
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      </div>
    </div>
  );
}
