'use client';

// src/app/(dashboard)/accounting/reports/page.tsx
import { useCallback, useEffect, useState } from 'react';
import { FileText, TrendingUp, AlertCircle, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';

// ─── Types ────────────────────────────────────────────────────────────────────

interface AccountRow {
  id: string;
  code: string;
  name: string;
  parentId: string | null;
  accountType: string;
  balance: string;
  isParent: boolean;
  level: number;
}

interface ReportSection {
  accountType: string;
  label: string;
  accounts: AccountRow[];
  total: string;
}

interface BalanceSheetReport {
  asOfDate: string;
  sections: ReportSection[];
  totalAssets: string;
  totalLiabilities: string;
  totalEquity: string;
  totalLiabilitiesAndEquity: string;
  isBalanced: boolean;
}

interface IncomeStatementReport {
  dateFrom: string;
  dateTo: string;
  sections: ReportSection[];
  totalRevenue: string;
  totalCost: string;
  grossProfit: string;
  totalExpenses: string;
  netIncome: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmtAmount = (value: string) => {
  const n = parseFloat(value);
  return n.toLocaleString('es-HN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const isZero = (value: string) => Math.abs(parseFloat(value)) < 0.005;

// ─── Account tree row ─────────────────────────────────────────────────────────

function AccountTreeRow({ row }: { row: AccountRow }) {
  const indent = (row.level - 1) * 16;
  const isNegative = parseFloat(row.balance) < 0;

  return (
    <tr
      className={row.isParent ? 'bg-muted/30 font-medium' : 'hover:bg-muted/20 transition-colors'}
    >
      <td className="px-4 py-1.5 text-xs" style={{ paddingLeft: `${16 + indent}px` }}>
        <span className="text-muted-foreground mr-2 font-mono">{row.code}</span>
        {row.name}
      </td>
      <td
        className={`px-4 py-1.5 text-right text-sm tabular-nums ${
          isZero(row.balance) ? 'text-muted-foreground' : isNegative ? 'text-destructive' : ''
        } ${row.isParent ? 'font-semibold' : ''}`}
      >
        {isZero(row.balance) ? '—' : `L ${fmtAmount(row.balance)}`}
      </td>
    </tr>
  );
}

// ─── Section table ────────────────────────────────────────────────────────────

function SectionTable({ section }: { section: ReportSection }) {
  return (
    <div className="mb-6">
      <div className="bg-muted flex items-center justify-between rounded-t-md px-4 py-2">
        <span className="text-sm font-bold tracking-wide uppercase">{section.label}</span>
        <span className="font-bold tabular-nums">L {fmtAmount(section.total)}</span>
      </div>
      <div className="rounded-b-md border border-t-0">
        <table className="w-full">
          <tbody>
            {section.accounts.map((row) => (
              <AccountTreeRow key={row.id} row={row} />
            ))}
            {section.accounts.length === 0 && (
              <tr>
                <td colSpan={2} className="text-muted-foreground px-4 py-4 text-center text-xs">
                  Sin movimientos en el período
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Balance Sheet Tab ────────────────────────────────────────────────────────

function BalanceSheetTab() {
  const today = new Date().toISOString().split('T')[0]!;
  const [asOfDate, setAsOfDate] = useState(today);
  const [report, setReport] = useState<BalanceSheetReport | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchReport = useCallback(async () => {
    if (!asOfDate) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/v1/accounting/reports/balance-sheet?asOfDate=${asOfDate}`, {
        credentials: 'include',
      });
      const payload = (await res.json()) as {
        success: boolean;
        data?: BalanceSheetReport;
        error?: string;
      };
      if (!payload.success) {
        toast.error('Error al generar reporte', { description: payload.error });
        return;
      }
      setReport(payload.data ?? null);
    } catch {
      toast.error('Error de conexión');
    } finally {
      setIsLoading(false);
    }
  }, [asOfDate]);

  useEffect(() => {
    void fetchReport();
  }, [fetchReport]);

  return (
    <div className="space-y-5">
      {/* Parámetros */}
      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-1">
          <Label htmlFor="asOfDate">Fecha de corte</Label>
          <Input
            id="asOfDate"
            type="date"
            value={asOfDate}
            onChange={(e) => setAsOfDate(e.target.value)}
            className="w-44"
          />
        </div>
        <Button onClick={fetchReport} disabled={isLoading} size="sm">
          {isLoading ? 'Generando...' : 'Actualizar'}
        </Button>
      </div>

      {report && (
        <>
          {/* Header del reporte */}
          <div className="rounded-lg border p-4 text-center">
            <h2 className="text-lg font-bold">Balance General</h2>
            <p className="text-muted-foreground text-sm">
              Al{' '}
              {new Date(report.asOfDate + 'T00:00:00').toLocaleDateString('es-HN', {
                day: '2-digit',
                month: 'long',
                year: 'numeric',
              })}
            </p>
          </div>

          {/* Secciones */}
          {report.sections.map((s) => (
            <SectionTable key={s.accountType} section={s} />
          ))}

          {/* Resumen */}
          <div className="rounded-lg border bg-slate-50 p-4">
            <table className="w-full text-sm">
              <tbody>
                <tr className="border-b">
                  <td className="py-2 font-medium">Total Activos</td>
                  <td className="py-2 text-right font-semibold tabular-nums">
                    L {fmtAmount(report.totalAssets)}
                  </td>
                </tr>
                <tr className="border-b">
                  <td className="py-2 font-medium">Total Pasivos</td>
                  <td className="py-2 text-right tabular-nums">
                    L {fmtAmount(report.totalLiabilities)}
                  </td>
                </tr>
                <tr className="border-b">
                  <td className="py-2 font-medium">Total Patrimonio</td>
                  <td className="py-2 text-right tabular-nums">
                    L {fmtAmount(report.totalEquity)}
                  </td>
                </tr>
                <tr>
                  <td className="pt-2 font-bold">Total Pasivo + Patrimonio</td>
                  <td className="pt-2 text-right font-bold tabular-nums">
                    L {fmtAmount(report.totalLiabilitiesAndEquity)}
                  </td>
                </tr>
              </tbody>
            </table>
            <div className="mt-3 flex items-center gap-2 text-xs">
              {report.isBalanced ? (
                <>
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <span className="text-green-600">
                    Balance cuadrado — Activos = Pasivo + Patrimonio
                  </span>
                </>
              ) : (
                <>
                  <AlertCircle className="h-4 w-4 text-amber-500" />
                  <span className="text-amber-600">
                    Diferencia:{' '}
                    {fmtAmount(
                      String(
                        Math.abs(
                          parseFloat(report.totalAssets) -
                            parseFloat(report.totalLiabilitiesAndEquity),
                        ),
                      ),
                    )}{' '}
                    — verifique los asientos contables
                  </span>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Income Statement Tab ─────────────────────────────────────────────────────

function IncomeStatementTab() {
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]!;
  const today = now.toISOString().split('T')[0]!;

  const [dateFrom, setDateFrom] = useState(firstDay);
  const [dateTo, setDateTo] = useState(today);
  const [report, setReport] = useState<IncomeStatementReport | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchReport = useCallback(async () => {
    if (!dateFrom || !dateTo) return;
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ dateFrom, dateTo });
      const res = await fetch(`/api/v1/accounting/reports/income-statement?${params.toString()}`, {
        credentials: 'include',
      });
      const payload = (await res.json()) as {
        success: boolean;
        data?: IncomeStatementReport;
        error?: string;
      };
      if (!payload.success) {
        toast.error('Error al generar reporte', { description: payload.error });
        return;
      }
      setReport(payload.data ?? null);
    } catch {
      toast.error('Error de conexión');
    } finally {
      setIsLoading(false);
    }
  }, [dateFrom, dateTo]);

  useEffect(() => {
    void fetchReport();
  }, [fetchReport]);

  const netIncomeValue = report ? parseFloat(report.netIncome) : 0;
  const isProfit = netIncomeValue >= 0;

  return (
    <div className="space-y-5">
      {/* Parámetros */}
      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-1">
          <Label htmlFor="dateFrom">Desde</Label>
          <Input
            id="dateFrom"
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="w-44"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="dateTo">Hasta</Label>
          <Input
            id="dateTo"
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="w-44"
          />
        </div>
        <Button onClick={fetchReport} disabled={isLoading} size="sm">
          {isLoading ? 'Generando...' : 'Actualizar'}
        </Button>
      </div>

      {report && (
        <>
          {/* Header */}
          <div className="rounded-lg border p-4 text-center">
            <h2 className="text-lg font-bold">Estado de Resultados</h2>
            <p className="text-muted-foreground text-sm">
              Del{' '}
              {new Date(report.dateFrom + 'T00:00:00').toLocaleDateString('es-HN', {
                day: '2-digit',
                month: 'long',
                year: 'numeric',
              })}{' '}
              al{' '}
              {new Date(report.dateTo + 'T00:00:00').toLocaleDateString('es-HN', {
                day: '2-digit',
                month: 'long',
                year: 'numeric',
              })}
            </p>
          </div>

          {/* Ingresos */}
          {report.sections
            .filter((s) => s.accountType === 'INCOME')
            .map((s) => (
              <SectionTable key={s.accountType} section={s} />
            ))}

          {/* Costo de Ventas */}
          {report.sections
            .filter((s) => s.accountType === 'COST')
            .map((s) => (
              <SectionTable key={s.accountType} section={s} />
            ))}

          {/* Utilidad Bruta */}
          <div className="flex justify-between rounded-md border bg-blue-50 px-4 py-3 text-sm">
            <span className="font-bold">Utilidad Bruta</span>
            <span
              className={`font-bold tabular-nums ${parseFloat(report.grossProfit) < 0 ? 'text-destructive' : 'text-blue-700'}`}
            >
              L {fmtAmount(report.grossProfit)}
            </span>
          </div>

          {/* Gastos */}
          {report.sections
            .filter((s) => s.accountType === 'EXPENSE')
            .map((s) => (
              <SectionTable key={s.accountType} section={s} />
            ))}

          {/* Utilidad Neta */}
          <div
            className={`flex items-center justify-between rounded-lg border-2 px-4 py-4 ${
              isProfit ? 'border-green-500 bg-green-50' : 'border-destructive bg-red-50'
            }`}
          >
            <div className="flex items-center gap-2">
              <TrendingUp
                className={`h-5 w-5 ${isProfit ? 'text-green-600' : 'text-destructive'}`}
              />
              <span className="text-base font-bold">
                {isProfit ? 'Utilidad Neta' : 'Pérdida Neta'}
              </span>
            </div>
            <div className="text-right">
              <span
                className={`text-xl font-bold tabular-nums ${
                  isProfit ? 'text-green-700' : 'text-destructive'
                }`}
              >
                L {fmtAmount(report.netIncome)}
              </span>
              <Badge variant={isProfit ? 'default' : 'destructive'} className="ml-3 text-xs">
                {isProfit ? 'Ganancia' : 'Pérdida'}
              </Badge>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ReportsPage() {
  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <FileText className="text-muted-foreground h-6 w-6" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Reportes Financieros</h1>
          <p className="text-muted-foreground text-sm">
            Estados financieros NIIF — Balance General y Estado de Resultados
          </p>
        </div>
      </div>

      <Tabs defaultValue="balance-sheet">
        <TabsList>
          <TabsTrigger value="balance-sheet">Balance General</TabsTrigger>
          <TabsTrigger value="income-statement">Estado de Resultados</TabsTrigger>
        </TabsList>

        <TabsContent value="balance-sheet" className="mt-6">
          <BalanceSheetTab />
        </TabsContent>

        <TabsContent value="income-statement" className="mt-6">
          <IncomeStatementTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
