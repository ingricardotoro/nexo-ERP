'use client';

// src/app/(dashboard)/dashboard/accounting/accounts/page.tsx
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import {
  BookOpen,
  Search,
  Layers,
  ArrowDownLeft,
  ArrowUpRight,
  FileText,
  Plus,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { AccountsTree } from '@/components/accounting/accounts-tree';
import { AccountCombobox, type AccountOption } from '@/components/accounting/account-combobox';
import { useTenant } from '@/lib/context/tenant-context';
import { createAccountSchema } from '@/lib/validations/account.schema';
import type {
  AccountNode,
  AccountStats,
  CreateAccountInput,
} from '@/lib/services/accounting/account.service';

interface AccountsApiResponse {
  success: boolean;
  data?: AccountNode[];
  stats?: AccountStats;
  error?: string;
}

const ACCOUNT_TYPE_OPTIONS = [
  { value: 'ASSET', label: 'Activo' },
  { value: 'LIABILITY', label: 'Pasivo' },
  { value: 'EQUITY', label: 'Patrimonio' },
  { value: 'INCOME', label: 'Ingreso' },
  { value: 'COST', label: 'Costo' },
  { value: 'EXPENSE', label: 'Gasto' },
  { value: 'CONTRA', label: 'Contra' },
] as const;

const ACCOUNT_NATURE_OPTIONS = [
  { value: 'DEBIT', label: 'Deudora (D)' },
  { value: 'CREDIT', label: 'Acreedora (C)' },
] as const;

export default function AccountsPage() {
  const { session, companyId } = useTenant();
  const canWrite = ['ADMIN', 'ACCOUNTANT'].includes(session?.role ?? '');

  const [accounts, setAccounts] = useState<AccountNode[]>([]);
  const [stats, setStats] = useState<AccountStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [reportFilter, setReportFilter] = useState<'all' | 'in_reports' | 'not_in_reports'>('all');

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<AccountNode | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState<AccountNode | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const flatAllAccounts = useMemo<AccountOption[]>(() => {
    const result: AccountOption[] = [];
    const stack = [...accounts];
    while (stack.length > 0) {
      const node = stack.pop()!;
      result.push({ id: node.id, code: node.code, name: node.name });
      if (node.children?.length) stack.push(...node.children);
    }
    return result.sort((a, b) => a.code.localeCompare(b.code));
  }, [accounts]);

  const parentOptions = useMemo<AccountOption[]>(() => {
    if (!editingAccount) return flatAllAccounts;
    return flatAllAccounts.filter((a) => a.id !== editingAccount.id);
  }, [flatAllAccounts, editingAccount]);

  const form = useForm<CreateAccountInput>({
    resolver: zodResolver(createAccountSchema) as Resolver<CreateAccountInput>,
    defaultValues: {
      code: '',
      name: '',
      accountType: 'ASSET',
      accountNature: 'DEBIT',
      allowDirectEntry: true,
      isActive: true,
      showInReports: true,
      description: '',
    },
  });

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

  const handleOpenCreate = () => {
    setEditingAccount(null);
    form.reset({
      code: '',
      name: '',
      accountType: 'ASSET',
      accountNature: 'DEBIT',
      allowDirectEntry: true,
      isActive: true,
      showInReports: true,
      description: '',
    });
    setDialogOpen(true);
  };

  const handleOpenEdit = (node: AccountNode) => {
    setEditingAccount(node);
    form.reset({
      code: node.code,
      name: node.name,
      accountType: node.accountType,
      accountNature: node.accountNature,
      parentId: node.parentId ?? undefined,
      allowDirectEntry: node.allowDirectEntry,
      isActive: node.isActive,
      showInReports: node.showInReports,
      description: node.description ?? '',
    });
    setDialogOpen(true);
  };

  const handleSubmit = form.handleSubmit(async (data) => {
    setSubmitting(true);
    try {
      const url = editingAccount
        ? `/api/v1/accounting/accounts/${editingAccount.id}`
        : '/api/v1/accounting/accounts';
      const method = editingAccount ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      const body = (await res.json()) as { success: boolean; error?: string };
      if (!res.ok || !body.success) {
        toast.error(body.error ?? 'Error al guardar la cuenta');
        return;
      }
      setDialogOpen(false);
      toast.success(editingAccount ? 'Cuenta actualizada' : 'Cuenta creada correctamente');
      void fetchAccounts();
    } finally {
      setSubmitting(false);
    }
  });

  const handleConfirmDelete = async () => {
    if (!deletingAccount) return;
    const res = await fetch(`/api/v1/accounting/accounts/${deletingAccount.id}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    const body = (await res.json()) as { deleted: boolean; message: string };
    setDeleteDialogOpen(false);
    setDeletingAccount(null);
    void fetchAccounts();
    if (body.deleted) {
      toast.success(body.message);
    } else {
      toast.warning(body.message);
    }
  };

  const handleToggleReport = async (id: string, value: boolean) => {
    await fetch(`/api/v1/accounting/accounts/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ showInReports: value }),
    });
    void fetchAccounts();
  };

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
            <p className="text-2xl font-bold text-blue-600">{debitCount}</p>
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
            <p className="text-2xl font-bold text-emerald-600">{creditCount}</p>
            <p className="text-muted-foreground text-xs">Pasivos + Patrimonio + Ingresos</p>
          </CardContent>
        </Card>
      </div>
    );
  };

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

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Plan de Cuentas</h1>
          <p className="text-muted-foreground text-sm">
            Catálogo NIIF Honduras — vista jerárquica del plan contable
          </p>
        </div>
        {canWrite && (
          <Button onClick={handleOpenCreate} size="sm" className="shrink-0 cursor-pointer">
            <Plus className="mr-1.5 h-4 w-4" />
            Nueva Cuenta
          </Button>
        )}
      </div>

      {renderStats()}

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Catálogo de Cuentas</CardTitle>
          <CardDescription>
            Haz clic en el código de una cuenta padre para expandir o colapsar sus subcuentas.
          </CardDescription>
        </CardHeader>

        {/* Filters */}
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
              {ACCOUNT_TYPE_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={reportFilter}
            onValueChange={(v) => setReportFilter(v as typeof reportFilter)}
          >
            <SelectTrigger className="w-full sm:w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos — reportes</SelectItem>
              <SelectItem value="in_reports">En reportes</SelectItem>
              <SelectItem value="not_in_reports">Fuera de reportes</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <CardContent className="p-0">
          <AccountsTree
            roots={accounts}
            searchQuery={searchQuery.trim().toLowerCase()}
            typeFilter={typeFilter}
            reportFilter={reportFilter}
            companyId={companyId ?? ''}
            canWrite={canWrite}
            onEdit={handleOpenEdit}
            onDelete={(node) => {
              setDeletingAccount(node);
              setDeleteDialogOpen(true);
            }}
            onToggleReport={handleToggleReport}
          />
        </CardContent>
      </Card>

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingAccount ? 'Editar Cuenta' : 'Nueva Cuenta'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="code">Código *</Label>
                <Input id="code" {...form.register('code')} placeholder="ej: 1101-01" />
                {form.formState.errors.code && (
                  <p className="text-xs text-red-500">{form.formState.errors.code.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="name">Nombre *</Label>
                <Input id="name" {...form.register('name')} placeholder="Nombre de la cuenta" />
                {form.formState.errors.name && (
                  <p className="text-xs text-red-500">{form.formState.errors.name.message}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Tipo de cuenta *</Label>
                <Select
                  value={form.watch('accountType')}
                  onValueChange={(v) =>
                    form.setValue('accountType', v as CreateAccountInput['accountType'])
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ACCOUNT_TYPE_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Naturaleza *</Label>
                <Select
                  value={form.watch('accountNature')}
                  onValueChange={(v) =>
                    form.setValue('accountNature', v as CreateAccountInput['accountNature'])
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ACCOUNT_NATURE_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Cuenta padre</Label>
              <AccountCombobox
                accounts={parentOptions}
                value={form.watch('parentId') ?? ''}
                onChange={(v) =>
                  form.setValue('parentId', v || undefined, { shouldValidate: true })
                }
                placeholder="Sin cuenta padre (raíz)"
              />
              {form.formState.errors.parentId && (
                <p className="text-xs text-red-500">{form.formState.errors.parentId.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="description">Descripción</Label>
              <Input
                id="description"
                {...form.register('description')}
                placeholder="Descripción opcional"
              />
            </div>

            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Switch
                  id="allowDirectEntry"
                  checked={form.watch('allowDirectEntry')}
                  onCheckedChange={(v) => form.setValue('allowDirectEntry', v)}
                />
                <Label htmlFor="allowDirectEntry" className="text-sm">
                  Permite asientos
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="isActive"
                  checked={form.watch('isActive')}
                  onCheckedChange={(v) => form.setValue('isActive', v)}
                />
                <Label htmlFor="isActive" className="text-sm">
                  Activa
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="showInReports"
                  checked={form.watch('showInReports')}
                  onCheckedChange={(v) => form.setValue('showInReports', v)}
                />
                <Label htmlFor="showInReports" className="text-sm">
                  En reportes
                </Label>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
                disabled={submitting}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Guardando...' : editingAccount ? 'Guardar cambios' : 'Crear cuenta'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Eliminar cuenta</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground text-sm">
            ¿Eliminar la cuenta{' '}
            <strong>
              {deletingAccount?.code} — {deletingAccount?.name}
            </strong>
            ? Si tiene movimientos contables asociados, será desactivada en lugar de eliminada.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={() => void handleConfirmDelete()}>
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
