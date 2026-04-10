'use client';

// src/app/(dashboard)/dashboard/page.tsx
import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { Route } from 'next';
import {
  BookOpen,
  ReceiptText,
  Users2,
  Package,
  ClipboardList,
  TrendingUp,
  LayoutDashboard,
  DollarSign,
  FileText,
  AlertCircle,
  RefreshCw,
  type LucideIcon,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';

// ─── Módulos del sistema ─────────────────────────────────────────────────────

interface AppModule {
  name: string;
  description: string;
  href: string;
  icon: LucideIcon;
  gradient: string;
  glow: string;
}

const appModules: AppModule[] = [
  {
    name: 'Contabilidad',
    description: 'Cuentas, asientos y reportes',
    href: '/dashboard/accounting/accounts',
    icon: BookOpen,
    gradient: 'linear-gradient(135deg, #064e3b 0%, #059669 100%)',
    glow: 'rgb(5 150 105 / 0.25)',
  },
  {
    name: 'Facturación',
    description: 'Facturas, CAI y tributación',
    href: '/dashboard/invoicing/invoices',
    icon: ReceiptText,
    gradient: 'linear-gradient(135deg, #92400e 0%, #d97706 100%)',
    glow: 'rgb(217 119 6 / 0.25)',
  },
  {
    name: 'Contactos',
    description: 'Clientes y proveedores',
    href: '/dashboard/contacts',
    icon: Users2,
    gradient: 'linear-gradient(135deg, #4c1d95 0%, #7c3aed 100%)',
    glow: 'rgb(124 58 237 / 0.25)',
  },
  {
    name: 'Inventarios',
    description: 'Productos, stock y almacenes',
    href: '/dashboard/inventory/products',
    icon: Package,
    gradient: 'linear-gradient(135deg, #155e75 0%, #0891b2 100%)',
    glow: 'rgb(8 145 178 / 0.25)',
  },
  {
    name: 'Compras',
    description: 'Órdenes de compra',
    href: '/dashboard/purchasing/purchase-orders',
    icon: ClipboardList,
    gradient: 'linear-gradient(135deg, #7c2d12 0%, #ea580c 100%)',
    glow: 'rgb(234 88 12 / 0.25)',
  },
  {
    name: 'Ventas',
    description: 'Pedidos y oportunidades',
    href: '/dashboard/sales/orders',
    icon: TrendingUp,
    gradient: 'linear-gradient(135deg, #312e81 0%, #4f46e5 100%)',
    glow: 'rgb(79 70 229 / 0.25)',
  },
  {
    name: 'Administración',
    description: 'Usuarios y configuración',
    href: '/dashboard/users',
    icon: LayoutDashboard,
    gradient: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)',
    glow: 'rgb(37 99 235 / 0.25)',
  },
];

// ─── KPI rápidos ──────────────────────────────────────────────────────────────

interface KpiData {
  monthlySales: { amount: string; count: number; month: string };
  pendingInvoices: { amount: string; count: number };
  overdueReceivables: { amount: string; count: number };
  activeSalesOrders: number;
  draftSalesOrders: number;
  activePurchaseOrders: number;
  expiringLotsCount: number;
  caiAlert: { daysLeft: number | null; documentType: string; count: number } | null;
}

const fmtL = (v: string | number) =>
  'L ' +
  parseFloat(String(v)).toLocaleString('es-HN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

// ─── App Launcher Card ────────────────────────────────────────────────────────

function ModuleCard({ module }: { module: AppModule }) {
  const [hovered, setHovered] = useState(false);

  return (
    <Link
      href={module.href as unknown as Route}
      className="group flex cursor-pointer flex-col items-center gap-4 rounded-2xl border border-slate-200 bg-white p-6"
      style={{
        boxShadow: hovered
          ? `0 12px 32px 0 ${module.glow}, 0 4px 12px 0 rgb(0 0 0 / 0.08)`
          : '0 1px 3px 0 rgb(0 0 0 / 0.06)',
        transform: hovered ? 'translateY(-3px)' : 'translateY(0)',
        transition: 'box-shadow 220ms ease, transform 220ms ease',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Ícono con gradiente */}
      <div
        className="flex items-center justify-center rounded-2xl"
        style={{
          width: '4rem',
          height: '4rem',
          background: module.gradient,
          boxShadow: hovered ? `0 6px 20px 0 ${module.glow}` : 'none',
          transition: 'box-shadow 220ms ease',
        }}
        aria-hidden="true"
      >
        <module.icon className="h-7 w-7 text-white" />
      </div>

      {/* Nombre y descripción */}
      <div className="text-center">
        <p className="text-sm leading-tight font-semibold text-slate-800">{module.name}</p>
        <p className="mt-1 text-xs leading-snug text-slate-400">{module.description}</p>
      </div>
    </Link>
  );
}

// ─── KPI Strip ────────────────────────────────────────────────────────────────

interface KpiStripProps {
  kpis: KpiData | null;
  loading: boolean;
}

function KpiStrip({ kpis, loading }: KpiStripProps) {
  const hasOverdue = (kpis?.overdueReceivables.count ?? 0) > 0;

  const items = [
    {
      label: 'Ventas del mes',
      value: fmtL(kpis?.monthlySales.amount ?? '0'),
      sub: `${kpis?.monthlySales.count ?? 0} facturas`,
      icon: DollarSign,
      color: '#10b981',
      bg: '#f0fdf4',
    },
    {
      label: 'CxC pendiente',
      value: fmtL(kpis?.pendingInvoices.amount ?? '0'),
      sub: `${kpis?.pendingInvoices.count ?? 0} facturas`,
      icon: FileText,
      color: '#f59e0b',
      bg: '#fffbeb',
    },
    {
      label: 'CxC vencida',
      value: fmtL(kpis?.overdueReceivables.amount ?? '0'),
      sub: `${kpis?.overdueReceivables.count ?? 0} vencidas`,
      icon: AlertCircle,
      color: hasOverdue ? '#ef4444' : '#10b981',
      bg: hasOverdue ? '#fef2f2' : '#f0fdf4',
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {items.map((item) => (
        <div
          key={item.label}
          className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3"
          style={{ boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.04)' }}
        >
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
            style={{ backgroundColor: item.bg }}
          >
            <item.icon className="h-4 w-4" style={{ color: item.color }} aria-hidden="true" />
          </div>
          <div className="min-w-0">
            {loading ? (
              <>
                <Skeleton className="mb-1 h-5 w-24" />
                <Skeleton className="h-3 w-16" />
              </>
            ) : (
              <>
                <p className="text-base leading-tight font-bold text-slate-900 tabular-nums">
                  {item.value}
                </p>
                <p className="mt-0.5 text-xs leading-tight text-slate-400">{item.label}</p>
              </>
            )}
          </div>
        </div>
      ))}
    </div>
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
      if (!res.ok) throw new Error('Error al cargar los indicadores');
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
    <div className="mx-auto max-w-5xl space-y-8">
      {/* ── KPI compacto ─────────────────────────────────────────── */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <p className="section-label">Resumen financiero</p>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void fetchKpis()}
            disabled={loading}
            className="h-7 cursor-pointer text-xs text-slate-400 hover:text-slate-700"
          >
            <RefreshCw className={`mr-1 h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
        </div>

        {error ? (
          <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
            <button
              onClick={() => void fetchKpis()}
              className="ml-auto cursor-pointer text-xs underline"
            >
              Reintentar
            </button>
          </div>
        ) : (
          <KpiStrip kpis={kpis} loading={loading} />
        )}
      </div>

      {/* ── App Launcher (estilo Odoo) ────────────────────────────── */}
      <div>
        <p className="section-label">Módulos</p>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {appModules.map((module) => (
            <ModuleCard key={module.name} module={module} />
          ))}
        </div>
      </div>
    </div>
  );
}
