// src/app/(dashboard)/invoicing/invoices/page.tsx
'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, FileText, CheckCircle, XCircle } from 'lucide-react';
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
import { InvoicesTable, type InvoiceTableData } from '@/components/invoicing/invoices-table';

interface InvoicesApiResponse {
  success: boolean;
  data?: InvoiceTableData[];
  pagination?: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  error?: string;
}

export default function InvoicesPage() {
  const router = useRouter();

  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [sortBy, setSortBy] = useState('issueDate');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const pageSize = 20;

  const [invoices, setInvoices] = useState<InvoiceTableData[]>([]);
  const [totalInvoices, setTotalInvoices] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isRefetching, setIsRefetching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Stats
  const [totalEmitidas, setTotalEmitidas] = useState(0);
  const [totalPagadas, setTotalPagadas] = useState(0);
  const [totalAnuladas, setTotalAnuladas] = useState(0);

  const fetchInvoices = useCallback(
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
        });

        if (statusFilter) params.set('status', statusFilter);
        if (typeFilter) params.set('invoiceType', typeFilter);
        if (dateFrom) params.set('dateFrom', dateFrom);
        if (dateTo) params.set('dateTo', dateTo);

        const response = await fetch(`/api/v1/invoicing/invoices?${params.toString()}`, {
          method: 'GET',
          cache: 'no-store',
          credentials: 'include',
        });

        const payload = (await response.json()) as InvoicesApiResponse;

        if (!response.ok || !payload.success || !payload.data || !payload.pagination) {
          throw new Error(payload.error ?? 'Error al obtener facturas');
        }

        setInvoices(payload.data);
        setTotalInvoices(payload.pagination.total);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Error desconocido';
        setError(message);
        setInvoices([]);
        setTotalInvoices(0);
      } finally {
        setLoading(false);
        setIsRefetching(false);
      }
    },
    [currentPage, statusFilter, typeFilter, dateFrom, dateTo, sortBy, sortDirection],
  );

  const fetchStats = useCallback(async () => {
    try {
      const [emitidas, pagadas, anuladas] = await Promise.all([
        fetch('/api/v1/invoicing/invoices?status=PUBLISHED&limit=1', { credentials: 'include' }),
        fetch('/api/v1/invoicing/invoices?status=PAID&limit=1', { credentials: 'include' }),
        fetch('/api/v1/invoicing/invoices?status=CANCELLED&limit=1', { credentials: 'include' }),
      ]);
      const emitidasPayload = (await emitidas.json()) as InvoicesApiResponse;
      const pagadasPayload = (await pagadas.json()) as InvoicesApiResponse;
      const anuladasPayload = (await anuladas.json()) as InvoicesApiResponse;

      if (emitidasPayload.success && emitidasPayload.pagination)
        setTotalEmitidas(emitidasPayload.pagination.total);
      if (pagadasPayload.success && pagadasPayload.pagination)
        setTotalPagadas(pagadasPayload.pagination.total);
      if (anuladasPayload.success && anuladasPayload.pagination)
        setTotalAnuladas(anuladasPayload.pagination.total);
    } catch {
      // Las estadísticas son secundarias
    }
  }, []);

  useEffect(() => {
    void fetchInvoices(true);
  }, [fetchInvoices]);

  useEffect(() => {
    void fetchStats();
  }, [fetchStats]);

  const handleSort = (columnId: string, direction: 'asc' | 'desc') => {
    setSortBy(columnId);
    setSortDirection(direction);
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

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-foreground text-3xl font-bold tracking-tight">Facturas</h1>
          <p className="text-muted-foreground mt-2">
            Gestiona facturas de venta, notas de crédito y débito
          </p>
        </div>
        <Button onClick={() => router.push('/dashboard/invoicing/invoices/new' as never)}>
          <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
          Nueva Factura
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription className="flex items-center gap-1">
              <FileText className="h-4 w-4" aria-hidden="true" />
              Total Facturas
            </CardDescription>
            <CardTitle className="text-4xl">{loading ? '—' : totalInvoices}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-muted-foreground text-xs">facturas registradas</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription className="flex items-center gap-1">
              <CheckCircle className="h-4 w-4" aria-hidden="true" />
              Emitidas / Pagadas
            </CardDescription>
            <CardTitle className="text-4xl">{totalEmitidas + totalPagadas}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-muted-foreground text-xs">
              {totalEmitidas} emitidas · {totalPagadas} pagadas
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription className="flex items-center gap-1">
              <XCircle className="h-4 w-4" aria-hidden="true" />
              Anuladas
            </CardDescription>
            <CardTitle className="text-4xl">{totalAnuladas}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-muted-foreground text-xs">facturas anuladas</div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle>Filtrar Facturas</CardTitle>
          <CardDescription>Filtra por estado, tipo de documento o rango de fechas</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Select
              value={statusFilter || 'all'}
              onValueChange={(v) => handleFilterChange(setStatusFilter, v)}
            >
              <SelectTrigger className="w-full sm:w-44" aria-label="Filtrar por estado">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los estados</SelectItem>
                <SelectItem value="DRAFT">Borrador</SelectItem>
                <SelectItem value="PUBLISHED">Emitida</SelectItem>
                <SelectItem value="PAID">Pagada</SelectItem>
                <SelectItem value="CANCELLED">Anulada</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={typeFilter || 'all'}
              onValueChange={(v) => handleFilterChange(setTypeFilter, v)}
            >
              <SelectTrigger className="w-full sm:w-52" aria-label="Filtrar por tipo de documento">
                <SelectValue placeholder="Tipo de documento" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los tipos</SelectItem>
                <SelectItem value="FACTURA">Factura</SelectItem>
                <SelectItem value="NOTA_CREDITO">Nota de Crédito</SelectItem>
                <SelectItem value="NOTA_DEBITO">Nota de Débito</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex items-center gap-2">
              <div>
                <label htmlFor="dateFrom" className="text-muted-foreground mb-1 block text-xs">
                  Desde
                </label>
                <Input
                  id="dateFrom"
                  type="date"
                  className="w-40"
                  value={dateFrom}
                  onChange={(e) => {
                    setDateFrom(e.target.value);
                    setCurrentPage(1);
                  }}
                  aria-label="Fecha desde"
                />
              </div>
              <div>
                <label htmlFor="dateTo" className="text-muted-foreground mb-1 block text-xs">
                  Hasta
                </label>
                <Input
                  id="dateTo"
                  type="date"
                  className="w-40"
                  value={dateTo}
                  onChange={(e) => {
                    setDateTo(e.target.value);
                    setCurrentPage(1);
                  }}
                  aria-label="Fecha hasta"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabla */}
      <Card>
        <CardHeader>
          <CardTitle>Listado de Facturas</CardTitle>
          <CardDescription>
            {totalInvoices === 0
              ? 'Sin facturas'
              : `${totalInvoices} ${totalInvoices === 1 ? 'factura encontrada' : 'facturas encontradas'}`}
            {isRefetching ? ' — actualizando...' : ''}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <InvoicesTable
            data={invoices}
            totalCount={totalInvoices}
            currentPage={currentPage}
            pageSize={pageSize}
            isLoading={loading || isRefetching}
            onPageChange={setCurrentPage}
            onSort={handleSort}
          />
        </CardContent>
      </Card>
    </div>
  );
}
