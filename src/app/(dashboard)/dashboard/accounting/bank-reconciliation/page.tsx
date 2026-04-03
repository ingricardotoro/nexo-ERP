'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  CheckCircle2,
  AlertCircle,
  Link2,
  Link2Off,
  EyeOff,
  Loader2,
  ChevronRight,
} from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import type {
  ReconciliationSummary,
  BankReconciliationRow,
} from '@/lib/services/accounting/bank-reconciliation.service';
import type {
  BankStatementRow,
  BankTransactionRow,
  MatchSuggestion,
} from '@/lib/services/accounting/bank-statement.service';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtL = (val: string | number) =>
  `L ${parseFloat(String(val)).toLocaleString('es-HN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const fmtDate = (d: Date | string) =>
  new Date(d).toLocaleDateString('es-HN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  PENDING: { label: 'Pendiente', className: 'border-yellow-300 text-yellow-700' },
  MATCHED: { label: 'Conciliado', className: 'border-green-300 text-green-700' },
  RECONCILED: { label: 'Finalizado', className: 'border-blue-300 text-blue-700' },
  IGNORED: { label: 'Ignorado', className: 'border-gray-300 text-gray-500' },
};

// ─── Transaction Row ──────────────────────────────────────────────────────────

function TransactionRow({
  tx,
  suggestions,
  onAction,
}: {
  tx: BankTransactionRow;
  suggestions: MatchSuggestion[];
  onAction: (
    action: 'match' | 'unmatch' | 'ignore',
    bankTxId: string,
    journalEntryLineId?: string,
  ) => Promise<void>;
}) {
  const [acting, setActing] = useState(false);
  const badge = STATUS_BADGE[tx.status] ?? STATUS_BADGE['PENDING']!;
  const amount = parseFloat(tx.amount);
  const isDebit = amount < 0;

  const doAction = async (action: 'match' | 'unmatch' | 'ignore', journalEntryLineId?: string) => {
    setActing(true);
    try {
      await onAction(action, tx.id, journalEntryLineId);
    } finally {
      setActing(false);
    }
  };

  const topSuggestion = suggestions.find((s) => s.bankTransactionId === tx.id);

  return (
    <tr className="hover:bg-muted/30 border-b transition-colors last:border-0">
      <td className="px-4 py-3 text-sm tabular-nums">{fmtDate(tx.transactionDate)}</td>
      <td className="max-w-[200px] px-4 py-3">
        <p className="truncate text-sm">{tx.description}</p>
        {tx.reference && <p className="text-muted-foreground truncate text-xs">{tx.reference}</p>}
      </td>
      <td
        className={`px-4 py-3 text-right text-sm font-medium tabular-nums ${isDebit ? 'text-destructive' : 'text-green-700'}`}
      >
        {fmtL(tx.amount)}
      </td>
      <td className="px-4 py-3">
        <Badge variant="outline" className={`text-xs ${badge.className}`}>
          {badge.label}
        </Badge>
      </td>
      <td className="px-4 py-3 text-sm">
        {tx.status === 'MATCHED' || tx.status === 'RECONCILED' ? (
          <span className="text-muted-foreground text-xs">{tx.journalEntryDescription ?? '—'}</span>
        ) : topSuggestion ? (
          <span className="text-xs text-blue-600">
            Sugerencia: {topSuggestion.accountCode} — {topSuggestion.matchReason}
          </span>
        ) : null}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-1">
          {tx.status === 'PENDING' && topSuggestion && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 gap-1 text-xs text-green-700"
              disabled={acting}
              onClick={() => void doAction('match', topSuggestion.journalEntryLineId)}
            >
              <Link2 className="h-3 w-3" />
              Asociar
            </Button>
          )}
          {tx.status === 'MATCHED' && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 gap-1 text-xs"
              disabled={acting}
              onClick={() => void doAction('unmatch')}
            >
              <Link2Off className="h-3 w-3" />
              Desasociar
            </Button>
          )}
          {tx.status === 'PENDING' && (
            <Button
              size="sm"
              variant="ghost"
              className="text-muted-foreground h-7 gap-1 text-xs"
              disabled={acting}
              onClick={() => void doAction('ignore')}
            >
              <EyeOff className="h-3 w-3" />
              Ignorar
            </Button>
          )}
          {acting && <Loader2 className="text-muted-foreground h-3 w-3 animate-spin" />}
        </div>
      </td>
    </tr>
  );
}

// ─── Summary Card ─────────────────────────────────────────────────────────────

function SummaryCard({ summary }: { summary: ReconciliationSummary }) {
  const diff = parseFloat(summary.difference);
  const balanced = Math.abs(diff) < 0.01;

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      <Card>
        <CardHeader className="pt-4 pb-1">
          <CardTitle className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            Saldo Banco
          </CardTitle>
        </CardHeader>
        <CardContent className="pb-4">
          <p className="text-xl font-bold tabular-nums">{fmtL(summary.statementEndingBalance)}</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pt-4 pb-1">
          <CardTitle className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            Saldo Contable
          </CardTitle>
        </CardHeader>
        <CardContent className="pb-4">
          <p className="text-xl font-bold tabular-nums">{fmtL(summary.ledgerBalance)}</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pt-4 pb-1">
          <CardTitle className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            Diferencia
          </CardTitle>
        </CardHeader>
        <CardContent className="pb-4">
          <p
            className={`text-xl font-bold tabular-nums ${balanced ? 'text-green-600' : 'text-destructive'}`}
          >
            {fmtL(summary.difference)}
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pt-4 pb-1">
          <CardTitle className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            Progreso
          </CardTitle>
        </CardHeader>
        <CardContent className="pb-4">
          <p className="text-xl font-bold">
            {summary.matchedCount + summary.ignoredCount}/
            {summary.matchedCount + summary.ignoredCount + summary.pendingCount}
          </p>
          <p className="text-muted-foreground text-xs">{summary.pendingCount} pendientes</p>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── History Table ────────────────────────────────────────────────────────────

function HistoryTable({ rows }: { rows: BankReconciliationRow[] }) {
  if (rows.length === 0)
    return (
      <p className="text-muted-foreground py-6 text-center text-sm">
        No hay conciliaciones finalizadas para esta cuenta.
      </p>
    );

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-muted/50 border-b">
            {['Cuenta', 'Estado', 'Saldo banco', 'Saldo contable', 'Diferencia', 'Fecha'].map(
              (h) => (
                <th
                  key={h}
                  className="text-muted-foreground px-4 py-2.5 text-left text-xs font-medium"
                >
                  {h}
                </th>
              ),
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="hover:bg-muted/30 border-b transition-colors last:border-0">
              <td className="px-4 py-2.5">{r.bankAccountName}</td>
              <td className="px-4 py-2.5">
                <Badge variant="outline" className="border-blue-300 text-xs text-blue-700">
                  {r.status}
                </Badge>
              </td>
              <td className="px-4 py-2.5 tabular-nums">{fmtL(r.statementEndingBalance)}</td>
              <td className="px-4 py-2.5 tabular-nums">{fmtL(r.ledgerBalance)}</td>
              <td
                className={`px-4 py-2.5 tabular-nums ${Math.abs(parseFloat(r.difference)) < 0.01 ? 'text-green-600' : 'text-destructive'}`}
              >
                {fmtL(r.difference)}
              </td>
              <td className="px-4 py-2.5 tabular-nums">
                {r.reconciledAt ? fmtDate(r.reconciledAt) : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type PageView = 'select' | 'working' | 'history';

export default function BankReconciliationPage() {
  const [view, setView] = useState<PageView>('select');

  // Selectors
  const [accounts, setAccounts] = useState<BankAccountRow[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [statements, setStatements] = useState<BankStatementRow[]>([]);
  const [selectedStatementId, setSelectedStatementId] = useState('');

  // Working state
  const [statement, setStatement] = useState<BankStatementRow | null>(null);
  const [summary, setSummary] = useState<ReconciliationSummary | null>(null);
  const [suggestions, setSuggestions] = useState<MatchSuggestion[]>([]);
  const [loadingWorking, setLoadingWorking] = useState(false);
  const [finalizeOpen, setFinalizeOpen] = useState(false);
  const [finalizing, setFinalizing] = useState(false);

  // History
  const [history, setHistory] = useState<BankReconciliationRow[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // ── Fetch accounts ──────────────────────────────────────────────────────────
  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch('/api/v1/accounting/bank-accounts?activeOnly=true', {
          credentials: 'include',
        });
        const payload = (await res.json()) as { success: boolean; data?: BankAccountRow[] };
        if (payload.success) setAccounts(payload.data ?? []);
      } catch {
        toast.error('Error al cargar cuentas bancarias');
      }
    })();
  }, []);

  // ── Fetch statements when account changes ───────────────────────────────────
  useEffect(() => {
    if (!selectedAccountId) return;
    void (async () => {
      try {
        const res = await fetch(
          `/api/v1/accounting/bank-accounts/${selectedAccountId}/statements`,
          { credentials: 'include' },
        );
        const payload = (await res.json()) as { success: boolean; data?: BankStatementRow[] };
        if (payload.success) setStatements(payload.data ?? []);
      } catch {
        // non-critical
      }
    })();
  }, [selectedAccountId]);

  // ── Load working reconciliation ─────────────────────────────────────────────
  const loadWorkingReconciliation = useCallback(async () => {
    if (!selectedAccountId || !selectedStatementId) return;
    setLoadingWorking(true);
    try {
      const [stmtRes, summaryRes, sugRes] = await Promise.all([
        fetch(
          `/api/v1/accounting/bank-accounts/${selectedAccountId}/statements?id=${selectedStatementId}`,
          { credentials: 'include' },
        ),
        fetch(
          `/api/v1/accounting/bank-reconciliation?bankAccountId=${selectedAccountId}&statementId=${selectedStatementId}`,
          { credentials: 'include' },
        ),
        fetch('/api/v1/accounting/bank-reconciliation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ action: 'suggestions', statementId: selectedStatementId }),
        }),
      ]);

      const stmtPayload = (await stmtRes.json()) as { success: boolean; data?: BankStatementRow[] };
      const summaryPayload = (await summaryRes.json()) as {
        success: boolean;
        data?: ReconciliationSummary;
      };
      const sugPayload = (await sugRes.json()) as { success: boolean; data?: MatchSuggestion[] };

      const foundStatement = stmtPayload.data?.find((s) => s.id === selectedStatementId) ?? null;
      setStatement(foundStatement);
      setSummary(summaryPayload.data ?? null);
      setSuggestions(sugPayload.data ?? []);
      setView('working');
    } catch {
      toast.error('Error al cargar la conciliación');
    } finally {
      setLoadingWorking(false);
    }
  }, [selectedAccountId, selectedStatementId]);

  // ── Load history ────────────────────────────────────────────────────────────
  const loadHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const params = new URLSearchParams();
      if (selectedAccountId) params.set('bankAccountId', selectedAccountId);
      const res = await fetch(
        `/api/v1/accounting/bank-reconciliation/history?${params.toString()}`,
        {
          credentials: 'include',
        },
      );
      const payload = (await res.json()) as {
        success: boolean;
        data?: BankReconciliationRow[];
      };
      if (payload.success) setHistory(payload.data ?? []);
      setView('history');
    } catch {
      toast.error('Error al cargar historial');
    } finally {
      setLoadingHistory(false);
    }
  }, [selectedAccountId]);

  // ── Transaction actions ─────────────────────────────────────────────────────
  const handleTransactionAction = async (
    action: 'match' | 'unmatch' | 'ignore',
    bankTransactionId: string,
    journalEntryLineId?: string,
  ) => {
    try {
      const body: Record<string, string> = { action, bankTransactionId };
      if (journalEntryLineId) body.journalEntryLineId = journalEntryLineId;

      const res = await fetch('/api/v1/accounting/bank-reconciliation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      const payload = (await res.json()) as { success: boolean; error?: string };
      if (!res.ok || !payload.success) {
        toast.error('Error', { description: payload.error });
        return;
      }
      // Refresh summary and statement
      await loadWorkingReconciliation();
    } catch {
      toast.error('Error de conexión');
    }
  };

  // ── Finalize ────────────────────────────────────────────────────────────────
  const handleFinalize = async () => {
    setFinalizing(true);
    try {
      const res = await fetch('/api/v1/accounting/bank-reconciliation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          action: 'finalize',
          bankAccountId: selectedAccountId,
          bankStatementId: selectedStatementId,
        }),
      });
      const payload = (await res.json()) as { success: boolean; error?: string; message?: string };
      if (!res.ok || !payload.success) {
        toast.error('Error al finalizar', { description: payload.error });
        return;
      }
      toast.success(payload.message ?? 'Conciliación finalizada exitosamente');
      setFinalizeOpen(false);
      await loadWorkingReconciliation();
    } catch {
      toast.error('Error de conexión');
    } finally {
      setFinalizing(false);
    }
  };

  // ── Render: Select view ─────────────────────────────────────────────────────
  if (view === 'select' || view === 'history') {
    return (
      <div className="space-y-6 p-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Conciliación Bancaria</h1>
            <p className="text-muted-foreground text-sm">
              Asocia movimientos bancarios con asientos contables
            </p>
          </div>
        </div>

        {/* Selector */}
        <Card>
          <CardContent className="space-y-4 pt-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-sm font-medium">Cuenta bancaria</label>
                <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona una cuenta..." />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name} — {a.bankName} ({a.currencyCode})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Estado de cuenta</label>
                <Select
                  value={selectedStatementId}
                  onValueChange={setSelectedStatementId}
                  disabled={!selectedAccountId}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        selectedAccountId
                          ? statements.length === 0
                            ? 'Sin estados de cuenta importados'
                            : 'Selecciona período...'
                          : 'Selecciona cuenta primero'
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {statements.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {fmtDate(s.periodFrom)} — {fmtDate(s.periodTo)}
                        {s.importedFileName ? ` (${s.importedFileName})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                disabled={!selectedAccountId || !selectedStatementId || loadingWorking}
                onClick={loadWorkingReconciliation}
              >
                {loadingWorking ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <ChevronRight className="mr-2 h-4 w-4" />
                )}
                Iniciar conciliación
              </Button>
              <Button variant="outline" disabled={loadingHistory} onClick={loadHistory}>
                {loadingHistory ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Ver historial
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* History */}
        {view === 'history' && (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold">Historial de Conciliaciones</h2>
            <HistoryTable rows={history} />
          </div>
        )}
      </div>
    );
  }

  // ── Render: Working view ────────────────────────────────────────────────────
  const transactions = statement?.transactions ?? [];
  const pending = transactions.filter((t) => t.status === 'PENDING');
  const matched = transactions.filter((t) => t.status === 'MATCHED');
  const ignored = transactions.filter((t) => t.status === 'IGNORED');

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Conciliación Bancaria</h1>
          {statement && (
            <p className="text-muted-foreground text-sm">
              {accounts.find((a) => a.id === selectedAccountId)?.name} ·{' '}
              {fmtDate(statement.periodFrom)} — {fmtDate(statement.periodTo)}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setView('select')}>
            Cambiar período
          </Button>
          {summary?.canFinalize && (
            <Button
              className="bg-green-600 hover:bg-green-700"
              onClick={() => setFinalizeOpen(true)}
            >
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Finalizar conciliación
            </Button>
          )}
        </div>
      </div>

      {/* Summary */}
      {summary && <SummaryCard summary={summary} />}

      {/* Balance alert */}
      {summary && !summary.isBalanced && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>
            Hay una diferencia de <strong>{fmtL(summary.difference)}</strong> entre el saldo
            bancario y el saldo contable. Asocia o ignora los movimientos pendientes para cuadrar.
          </span>
        </div>
      )}
      {summary?.isBalanced && summary.pendingCount === 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-green-300 bg-green-50 px-4 py-3 text-sm text-green-700">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>Todos los movimientos están conciliados y el saldo cuadra. Puedes finalizar.</span>
        </div>
      )}

      {/* Transactions table */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Movimientos del Estado de Cuenta</CardTitle>
            <div className="text-muted-foreground flex gap-3 text-xs">
              <span className="text-yellow-600">{pending.length} pendientes</span>
              <span className="text-green-600">{matched.length} conciliados</span>
              <span>{ignored.length} ignorados</span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  {['Fecha', 'Descripción', 'Monto', 'Estado', 'Asiento', ''].map((h) => (
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
                {transactions.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-muted-foreground px-4 py-8 text-center text-sm">
                      No hay transacciones en este estado de cuenta
                    </td>
                  </tr>
                )}
                {transactions.map((tx) => (
                  <TransactionRow
                    key={tx.id}
                    tx={tx}
                    suggestions={suggestions}
                    onAction={handleTransactionAction}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Finalize dialog */}
      <AlertDialog open={finalizeOpen} onOpenChange={setFinalizeOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Finalizar conciliación</AlertDialogTitle>
            <AlertDialogDescription>
              Al finalizar, todos los movimientos conciliados pasarán a estado{' '}
              <strong>RECONCILED</strong> y se actualizará el saldo de la cuenta bancaria. Esta
              acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-green-600 text-white hover:bg-green-700"
              onClick={handleFinalize}
              disabled={finalizing}
            >
              {finalizing ? 'Finalizando...' : 'Finalizar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
