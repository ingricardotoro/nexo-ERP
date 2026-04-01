// src/app/(dashboard)/accounting/accounts/page.tsx
'use client';

import { useCallback, useEffect, useState } from 'react';
import { BookOpen, Search, Layers, ArrowDownLeft, ArrowUpRight, FileText } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AccountsTree } from '@/components/accounting/accounts-tree';
import type { AccountNode, AccountStats } from '@/lib/services/accounting/account.service';

// ─── Types ────────────────────────────────────────────────────────────────────

interface AccountsApiResponse {
  success: boolean;
  data?: AccountNode[];
  stats?: AccountStats;
  error?: string;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<AccountNode[]>([]);
  const [stats, setStats] = useState<AccountStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  const fetchAccounts = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/v1/accounting/accounts', {
        credentials: 'include',
        cache: 'no-store',
      });

      const payload = (await response.json()) as AccountsApiResponse;

      if (!response.ok || !payload.success) {
        setError(payload.error ?? 'Error al cargar el plan de cuentas');
        return;
      }

      setAccounts(payload.data ?? []);
      setStats(payload.stats ?? null);
    } catch {
      setError('Error de conexión. Verifica tu red e intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchAccounts();
  }, [fetchAccounts]);

  // ── Render helpers ──────────────────────────────────────────────────────────

  const renderStats = () => {
    if (!stats) return null;
    const debitCount =
      (stats.byType.ASSET ?? 0) + (stats.byType.COST ?? 0) + (stats.byType.EXPENSE ?? 0);
    const creditCount =
      (stats.byType.LIABILITY ?? 0) + (stats.byType.EQUITY ?? 0) + (stats.byType.INCOME ?? 0);

    return (
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <CardHeader className="pt-4 pb-2">
            <CardDescription className="flex items-center gap-1 text-xs">
              <Layers className="h-3.5 w-3.5" />
              Total Cuentas
            </CardDescription>
          </CardHeader>
          <CardContent className="pb-4">
            <p className="text-2xl font-bold">{stats.total}</p>
            <p className="text-muted-foreground text-xs">{stats.active} activas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pt-4 pb-2">
            <CardDescription className="flex items-center gap-1 text-xs">
              <FileText className="h-3.5 w-3.5" />
              Cuentas Hoja
            </CardDescription>
          </CardHeader>
          <CardContent className="pb-4">
            <p className="text-2xl font-bold">{stats.leafAccounts}</p>
            <p className="text-muted-foreground text-xs">Admiten asientos</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pt-4 pb-2">
            <CardDescription className="flex items-center gap-1 text-xs">
              <ArrowDownLeft className="h-3.5 w-3.5 text-blue-500" />
              Cuentas Deudoras
            </CardDescription>
          </CardHeader>
          <CardContent className="pb-4">
            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{debitCount}</p>
            <p className="text-muted-foreground text-xs">Activos + Costos + Gastos</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pt-4 pb-2">
            <CardDescription className="flex items-center gap-1 text-xs">
              <ArrowUpRight className="h-3.5 w-3.5 text-emerald-500" />
              Cuentas Acreedoras
            </CardDescription>
          </CardHeader>
          <CardContent className="pb-4">
            <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {creditCount}
            </p>
            <p className="text-muted-foreground text-xs">Pasivos + Patrimonio + Ingresos</p>
          </CardContent>
        </Card>
      </div>
    );
  };

  // ── Loading skeleton ────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-6 p-6">
        <div className="space-y-1">
          <div className="bg-muted h-7 w-48 animate-pulse rounded" />
          <div className="bg-muted h-4 w-72 animate-pulse rounded" />
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-muted h-24 animate-pulse rounded-lg" />
          ))}
        </div>
        <div className="bg-muted h-96 animate-pulse rounded-lg" />
      </div>
    );
  }

  // ── Error state ─────────────────────────────────────────────────────────────

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center">
        <BookOpen className="text-muted-foreground mb-3 h-10 w-10" />
        <p className="font-medium">{error}</p>
        <button
          onClick={() => void fetchAccounts()}
          className="text-primary mt-2 text-sm underline-offset-2 hover:underline"
        >
          Reintentar
        </button>
      </div>
    );
  }

  // ── Main render ─────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Plan de Cuentas</h1>
          <p className="text-muted-foreground text-sm">
            Catálogo NIIF Honduras — vista jerárquica del plan contable
          </p>
        </div>
      </div>

      {/* Stats */}
      {renderStats()}

      {/* Filters + Tree */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Catálogo de Cuentas</CardTitle>
          <CardDescription>
            Haz clic en el código de una cuenta padre para expandir o colapsar sus subcuentas.
          </CardDescription>
        </CardHeader>

        {/* Search & Filter bar */}
        <div className="flex flex-col gap-3 px-6 pb-4 sm:flex-row">
          <div className="relative flex-1">
            <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
            <Input
              placeholder="Buscar por código o nombre..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select
            value={typeFilter || 'all'}
            onValueChange={(v) => setTypeFilter(v === 'all' ? '' : v)}
          >
            <SelectTrigger className="w-full sm:w-44">
              <SelectValue placeholder="Tipo de cuenta" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los tipos</SelectItem>
              <SelectItem value="ASSET">Activo</SelectItem>
              <SelectItem value="LIABILITY">Pasivo</SelectItem>
              <SelectItem value="EQUITY">Patrimonio</SelectItem>
              <SelectItem value="INCOME">Ingreso</SelectItem>
              <SelectItem value="COST">Costo</SelectItem>
              <SelectItem value="EXPENSE">Gasto</SelectItem>
              <SelectItem value="CONTRA">Contra</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <CardContent className="p-0">
          <AccountsTree
            roots={accounts}
            searchQuery={searchQuery.trim().toLowerCase()}
            typeFilter={typeFilter}
          />
        </CardContent>
      </Card>
    </div>
  );
}
