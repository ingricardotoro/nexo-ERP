'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus, Building2, Pencil, PowerOff } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import type { BankAccountRow } from '@/lib/services/accounting/bank-account.service';

// ─── Types ────────────────────────────────────────────────────────────────────

interface LedgerAccountOption {
  id: string;
  code: string;
  name: string;
}

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  CHECKING: 'Cuenta Corriente',
  SAVINGS: 'Cuenta de Ahorros',
  CREDIT: 'Tarjeta de Crédito',
  OTHER: 'Otra',
};

// ─── Form Dialog ──────────────────────────────────────────────────────────────

interface FormState {
  name: string;
  bankName: string;
  accountNumber: string;
  accountType: string;
  ledgerAccountId: string;
  currencyCode: string;
  currentBalance: string;
}

const EMPTY_FORM: FormState = {
  name: '',
  bankName: '',
  accountNumber: '',
  accountType: 'CHECKING',
  ledgerAccountId: '',
  currencyCode: 'HNL',
  currentBalance: '0',
};

function BankAccountFormDialog({
  open,
  onOpenChange,
  editRow,
  ledgerAccounts,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editRow: BankAccountRow | null;
  ledgerAccounts: LedgerAccountOption[];
  onSaved: () => void;
}) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editRow) {
      setForm({
        name: editRow.name,
        bankName: editRow.bankName,
        accountNumber: editRow.accountNumber,
        accountType: editRow.accountType,
        ledgerAccountId: editRow.ledgerAccountId,
        currencyCode: editRow.currencyCode,
        currentBalance: editRow.currentBalance,
      });
    } else {
      setForm(EMPTY_FORM);
    }
  }, [editRow, open]);

  const set = (field: keyof FormState, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async () => {
    setSaving(true);
    try {
      const payload = editRow
        ? {
            name: form.name,
            bankName: form.bankName,
            accountNumber: form.accountNumber,
            accountType: form.accountType,
            currentBalance: parseFloat(form.currentBalance) || 0,
          }
        : {
            name: form.name,
            bankName: form.bankName,
            accountNumber: form.accountNumber,
            accountType: form.accountType,
            ledgerAccountId: form.ledgerAccountId,
            currencyCode: form.currencyCode,
            currentBalance: parseFloat(form.currentBalance) || 0,
          };

      const url = editRow
        ? `/api/v1/accounting/bank-accounts/${editRow.id}`
        : '/api/v1/accounting/bank-accounts';
      const method = editRow ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as { success: boolean; error?: string; message?: string };
      if (!res.ok || !data.success) {
        toast.error('Error', { description: data.error });
        return;
      }
      toast.success(data.message ?? (editRow ? 'Cuenta actualizada' : 'Cuenta creada'));
      onSaved();
      onOpenChange(false);
    } catch {
      toast.error('Error de conexión');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editRow ? 'Editar Cuenta Bancaria' : 'Nueva Cuenta Bancaria'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-1">
              <Label>Nombre interno *</Label>
              <Input
                placeholder="Ej: BAC Corriente Principal"
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>Banco *</Label>
              <Input
                placeholder="Ej: BAC Honduras"
                value={form.bankName}
                onChange={(e) => set('bankName', e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>Número de cuenta *</Label>
              <Input
                placeholder="Ej: 1234567890"
                value={form.accountNumber}
                onChange={(e) => set('accountNumber', e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>Tipo de cuenta</Label>
              <Select value={form.accountType} onValueChange={(v) => set('accountType', v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ACCOUNT_TYPE_LABELS).map(([k, label]) => (
                    <SelectItem key={k} value={k}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Saldo inicial (L)</Label>
              <Input
                type="number"
                step="0.01"
                value={form.currentBalance}
                onChange={(e) => set('currentBalance', e.target.value)}
              />
            </div>
            {!editRow && (
              <>
                <div className="col-span-2 space-y-1">
                  <Label>Cuenta contable (ASSET) *</Label>
                  <Select
                    value={form.ledgerAccountId}
                    onValueChange={(v) => set('ledgerAccountId', v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona cuenta..." />
                    </SelectTrigger>
                    <SelectContent>
                      {ledgerAccounts.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.code} — {a.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Moneda</Label>
                  <Input
                    maxLength={3}
                    className="uppercase"
                    value={form.currencyCode}
                    onChange={(e) => set('currencyCode', e.target.value.toUpperCase())}
                  />
                </div>
              </>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={saving || !form.name || !form.bankName || !form.accountNumber}
          >
            {saving ? 'Guardando...' : editRow ? 'Guardar cambios' : 'Crear cuenta'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BankAccountsPage() {
  const [accounts, setAccounts] = useState<BankAccountRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInactive, setShowInactive] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editRow, setEditRow] = useState<BankAccountRow | null>(null);
  const [deactivateId, setDeactivateId] = useState<string | null>(null);
  const [ledgerAccounts, setLedgerAccounts] = useState<LedgerAccountOption[]>([]);

  const fetchAccounts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/accounting/bank-accounts?activeOnly=${!showInactive}`, {
        credentials: 'include',
      });
      const payload = (await res.json()) as {
        success: boolean;
        data?: BankAccountRow[];
        error?: string;
      };
      if (payload.success) setAccounts(payload.data ?? []);
      else toast.error(payload.error ?? 'Error al cargar cuentas');
    } catch {
      toast.error('Error de conexión');
    } finally {
      setLoading(false);
    }
  }, [showInactive]);

  const fetchLedgerAccounts = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/accounting/accounts?accountType=ASSET&limit=200', {
        credentials: 'include',
      });
      const payload = (await res.json()) as {
        success: boolean;
        data?: { accounts: LedgerAccountOption[] };
      };
      if (payload.success) setLedgerAccounts(payload.data?.accounts ?? []);
    } catch {
      // non-critical
    }
  }, []);

  useEffect(() => {
    void fetchAccounts();
  }, [fetchAccounts]);

  useEffect(() => {
    void fetchLedgerAccounts();
  }, [fetchLedgerAccounts]);

  const handleDeactivate = async () => {
    if (!deactivateId) return;
    try {
      const res = await fetch(`/api/v1/accounting/bank-accounts/${deactivateId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const payload = (await res.json()) as { success: boolean; error?: string };
      if (!res.ok || !payload.success) {
        toast.error('Error', { description: payload.error });
        return;
      }
      toast.success('Cuenta desactivada');
      void fetchAccounts();
    } catch {
      toast.error('Error de conexión');
    } finally {
      setDeactivateId(null);
    }
  };

  const fmtBalance = (val: string) =>
    `L ${parseFloat(val).toLocaleString('es-HN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Cuentas Bancarias</h1>
          <p className="text-muted-foreground text-sm">
            Gestión de cuentas bancarias vinculadas al plan de cuentas
          </p>
        </div>
        <Button
          onClick={() => {
            setEditRow(null);
            setFormOpen(true);
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          Nueva cuenta
        </Button>
      </div>

      {/* Toggle inactive */}
      <div className="flex items-center gap-2">
        <Button
          variant={showInactive ? 'default' : 'outline'}
          size="sm"
          onClick={() => setShowInactive((v) => !v)}
        >
          {showInactive ? 'Mostrar solo activas' : 'Mostrar todas'}
        </Button>
      </div>

      {/* Table */}
      {loading ? (
        <div className="bg-muted h-48 animate-pulse rounded-lg" />
      ) : accounts.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Building2 className="text-muted-foreground mb-3 h-10 w-10" />
            <p className="font-medium">No hay cuentas bancarias</p>
            <p className="text-muted-foreground mt-1 text-sm">
              Crea la primera cuenta bancaria para iniciar la conciliación.
            </p>
            <Button
              className="mt-4"
              onClick={() => {
                setEditRow(null);
                setFormOpen(true);
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              Crear primera cuenta
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  {[
                    'Cuenta',
                    'Banco',
                    'N° Cuenta',
                    'Tipo',
                    'Moneda',
                    'Saldo Actual',
                    'Estado',
                    '',
                  ].map((h) => (
                    <th
                      key={h}
                      className="text-muted-foreground px-4 py-3 text-left text-xs font-medium uppercase"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {accounts.map((acc) => (
                  <tr
                    key={acc.id}
                    className="hover:bg-muted/30 border-b transition-colors last:border-0"
                  >
                    <td className="px-4 py-3 font-medium">{acc.name}</td>
                    <td className="px-4 py-3">{acc.bankName}</td>
                    <td className="px-4 py-3 font-mono text-xs">{acc.accountNumber}</td>
                    <td className="px-4 py-3">
                      {ACCOUNT_TYPE_LABELS[acc.accountType] ?? acc.accountType}
                    </td>
                    <td className="px-4 py-3">{acc.currencyCode}</td>
                    <td className="px-4 py-3 tabular-nums">{fmtBalance(acc.currentBalance)}</td>
                    <td className="px-4 py-3">
                      <Badge variant={acc.isActive ? 'default' : 'secondary'} className="text-xs">
                        {acc.isActive ? 'Activa' : 'Inactiva'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0"
                          onClick={() => {
                            setEditRow(acc);
                            setFormOpen(true);
                          }}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        {acc.isActive && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive hover:text-destructive h-7 w-7 p-0"
                            onClick={() => setDeactivateId(acc.id)}
                          >
                            <PowerOff className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <BankAccountFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        editRow={editRow}
        ledgerAccounts={ledgerAccounts}
        onSaved={fetchAccounts}
      />

      <AlertDialog open={!!deactivateId} onOpenChange={(o) => !o && setDeactivateId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desactivar cuenta bancaria</AlertDialogTitle>
            <AlertDialogDescription>
              La cuenta quedará inactiva y no podrá usarse en nuevas conciliaciones. Los registros
              históricos se conservan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDeactivate}
            >
              Desactivar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
