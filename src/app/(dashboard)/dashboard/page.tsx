'use client';

// src/app/(dashboard)/dashboard/page.tsx
import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  TrendingUp,
  FileText,
  DollarSign,
  ShoppingCart,
  ClipboardList,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface KpiData {
  monthlySales: { amount: string; count: number; month: string };
  pendingInvoices: { amount: string; count: number };
  activeSalesOrders: number;
  activePurchaseOrders: number;
  expiringLotsCount: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtL = (v: string | number) =>
  'L ' +
  parseFloat(String(v)).toLocaleString('es-HN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

// ─── KPI Card ──────────────────────────────────────────────────────────────────

function KpiCard({
  title,
  value,
  sub,
  icon: Icon,
  accent,
}: {
  title: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
  accent?: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="text-muted-foreground h-4 w-4" aria-hidden="true" />
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold ${accent ?? ''}`}>{value}</div>
        {sub && <p className="text-muted-foreground mt-1 text-xs">{sub}</p>}
      </CardContent>
    </Card>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [kpis, setKpis] = useState<KpiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchKpis = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/dashboard/kpis', { credentials: 'include' });
      if (!res.ok) throw new Error('Error al cargar KPIs');
      const data = (await res.json()) as { success: boolean; data: KpiData };
      if (data.success) setKpis(data.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchKpis();
  }, []);

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-foreground text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Bienvenido a NexoERP — Vista general de tu empresa
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void fetchKpis()} disabled={loading}>
          <RefreshCw className={`mr-1 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Actualizar
        </Button>
      </div>

      {error && (
        <div className="text-destructive bg-destructive/10 border-destructive/30 rounded-md border px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {/* KPI Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <KpiCard
          title="Ventas del Mes"
          value={loading ? '...' : fmtL(kpis?.monthlySales.amount ?? '0')}
          sub={
            loading
              ? undefined
              : `${kpis?.monthlySales.count ?? 0} facturas emitidas — ${kpis?.monthlySales.month ?? ''}`
          }
          icon={DollarSign}
          accent="text-green-600"
        />
        <KpiCard
          title="Facturas Pendientes"
          value={loading ? '...' : String(kpis?.pendingInvoices.count ?? 0)}
          sub={loading ? undefined : `${fmtL(kpis?.pendingInvoices.amount ?? '0')} por cobrar`}
          icon={FileText}
          accent={(kpis?.pendingInvoices.count ?? 0) > 0 ? 'text-amber-600' : undefined}
        />
        <KpiCard
          title="Pedidos de Venta Activos"
          value={loading ? '...' : String(kpis?.activeSalesOrders ?? 0)}
          sub="Pedidos confirmados pendientes de despacho"
          icon={TrendingUp}
        />
        <KpiCard
          title="Órdenes de Compra Activas"
          value={loading ? '...' : String(kpis?.activePurchaseOrders ?? 0)}
          sub="Órdenes confirmadas pendientes de recepción"
          icon={ClipboardList}
        />
        <KpiCard
          title="Pedidos de Venta (Borrador)"
          value={loading ? '...' : String(kpis?.activeSalesOrders ?? 0)}
          sub="Requieren confirmación"
          icon={ShoppingCart}
        />
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Alertas de Lotes</CardTitle>
            <AlertTriangle
              className={`h-4 w-4 ${(kpis?.expiringLotsCount ?? 0) > 0 ? 'text-amber-500' : 'text-muted-foreground'}`}
              aria-hidden="true"
            />
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold ${(kpis?.expiringLotsCount ?? 0) > 0 ? 'text-amber-600' : ''}`}
            >
              {loading ? '...' : (kpis?.expiringLotsCount ?? 0)}
            </div>
            <div className="mt-1 flex items-center gap-2">
              {(kpis?.expiringLotsCount ?? 0) > 0 ? (
                <Badge variant="outline" className="border-amber-300 text-xs text-amber-600">
                  Vencen en ≤30 días
                </Badge>
              ) : (
                <p className="text-muted-foreground text-xs">Sin alertas de vencimiento</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Getting started card — shown only when no data */}
      {!loading && !error && (
        <Card>
          <CardHeader>
            <CardTitle>Primeros Pasos</CardTitle>
            <CardDescription>Comienza configurando tu empresa y creando usuarios</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              {
                n: 1,
                title: 'Configura tu empresa',
                desc: 'Ingresa los datos fiscales, RTN, logo y moneda base',
              },
              {
                n: 2,
                title: 'Crea usuarios para tu equipo',
                desc: 'Asigna roles y permisos a tus colaboradores',
              },
              {
                n: 3,
                title: 'Activa los módulos necesarios',
                desc: 'Contabilidad, Facturación, Inventarios, Ventas, etc.',
              },
            ].map(({ n, title, desc }) => (
              <div key={n} className="flex items-start gap-3">
                <div className="bg-primary/10 text-primary flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-semibold">
                  {n}
                </div>
                <div>
                  <h3 className="font-medium">{title}</h3>
                  <p className="text-muted-foreground text-sm">{desc}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
