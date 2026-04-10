// src/components/layout/dashboard-sidebar.tsx
'use client';

import { useState, useCallback } from 'react';
import {
  Users,
  BarChart3,
  FileText,
  Users2,
  Package,
  Warehouse,
  PackageCheck,
  Layers,
  ShoppingCart,
  ClipboardList,
  ReceiptText,
  Settings,
  Shield,
  Percent,
  Building2,
  GitMerge,
  SlidersHorizontal,
  BookOpen,
  CalendarDays,
  BookMarked,
  ArrowLeftRight,
  PieChart,
  Banknote,
  TrendingUp,
  ChevronDown,
  LayoutDashboard,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import type { Route } from 'next';
import { usePathname } from 'next/navigation';
import { useTenant } from '@/lib/context/tenant-context';

interface NavigationItem {
  name: string;
  href: string;
  icon: LucideIcon;
}

interface NavigationGroup {
  name: string;
  groupIcon: LucideIcon; // ícono representativo de la categoría (visible al colapsar)
  defaultHref: string; // enlace cuando se hace click en ícono colapsado
  items: NavigationItem[];
}

const navigation: NavigationGroup[] = [
  {
    name: 'Core',
    groupIcon: LayoutDashboard,
    defaultHref: '/dashboard',
    items: [
      { name: 'Dashboard', href: '/dashboard', icon: PieChart },
      { name: 'Usuarios', href: '/dashboard/users', icon: Users },
      { name: 'Configuración', href: '/dashboard/settings', icon: Settings },
    ],
  },
  {
    name: 'Contabilidad',
    groupIcon: BookOpen,
    defaultHref: '/dashboard/accounting/accounts',
    items: [
      { name: 'Plan de Cuentas', href: '/dashboard/accounting/accounts', icon: BookOpen },
      { name: 'Años Fiscales', href: '/dashboard/accounting/fiscal-years', icon: CalendarDays },
      { name: 'Diarios', href: '/dashboard/accounting/journals', icon: BookMarked },
      { name: 'Asientos', href: '/dashboard/accounting/entries', icon: FileText },
      {
        name: 'Tipos de Cambio',
        href: '/dashboard/accounting/exchange-rates',
        icon: ArrowLeftRight,
      },
      { name: 'Reportes', href: '/dashboard/accounting/reports', icon: BarChart3 },
      { name: 'Cuentas Bancarias', href: '/dashboard/accounting/bank-accounts', icon: Building2 },
      {
        name: 'Conciliación Bancaria',
        href: '/dashboard/accounting/bank-reconciliation',
        icon: GitMerge,
      },
    ],
  },
  {
    name: 'Facturación',
    groupIcon: ReceiptText,
    defaultHref: '/dashboard/invoicing/invoices',
    items: [
      { name: 'Facturas', href: '/dashboard/invoicing/invoices', icon: ReceiptText },
      {
        name: 'Facturas Proveedor',
        href: '/dashboard/invoicing/supplier-invoices',
        icon: ShoppingCart,
      },
      { name: 'CAI', href: '/dashboard/invoicing/cais', icon: Shield },
      { name: 'Tasas de Impuesto', href: '/dashboard/invoicing/tax-rates', icon: Percent },
    ],
  },
  {
    name: 'Contactos',
    groupIcon: Users2,
    defaultHref: '/dashboard/contacts',
    items: [{ name: 'Directorio', href: '/dashboard/contacts', icon: Users2 }],
  },
  {
    name: 'Inventarios',
    groupIcon: Package,
    defaultHref: '/dashboard/inventory/products',
    items: [
      { name: 'Productos', href: '/dashboard/inventory/products', icon: Package },
      { name: 'Stock On-Hand', href: '/dashboard/inventory/stock', icon: BarChart3 },
      { name: 'Ajustes', href: '/dashboard/inventory/adjustments', icon: SlidersHorizontal },
      { name: 'Valorización', href: '/dashboard/inventory/reports', icon: TrendingUp },
      { name: 'Almacenes', href: '/dashboard/inventory/warehouses', icon: Warehouse },
      { name: 'Lotes y Series', href: '/dashboard/inventory/lots', icon: Layers },
      { name: 'Recepciones', href: '/dashboard/inventory/receptions', icon: PackageCheck },
      { name: 'Movimientos', href: '/dashboard/inventory/moves', icon: GitMerge },
    ],
  },
  {
    name: 'Compras',
    groupIcon: ClipboardList,
    defaultHref: '/dashboard/purchasing/purchase-orders',
    items: [
      {
        name: 'Órdenes de Compra',
        href: '/dashboard/purchasing/purchase-orders',
        icon: ClipboardList,
      },
    ],
  },
  {
    name: 'Ventas',
    groupIcon: TrendingUp,
    defaultHref: '/dashboard/sales/orders',
    items: [
      { name: 'Oportunidades', href: '/dashboard/sales/opportunities', icon: TrendingUp },
      { name: 'Pedidos', href: '/dashboard/sales/orders', icon: Banknote },
    ],
  },
];

// Color de acento único por categoría (para resaltar el ícono activo en modo colapsado)
const groupAccentColor: Record<string, string> = {
  Core: '#3b82f6',
  Contabilidad: '#10b981',
  Facturación: '#f59e0b',
  Contactos: '#8b5cf6',
  Inventarios: '#06b6d4',
  Compras: '#f97316',
  Ventas: '#6366f1',
};

export function DashboardSidebar() {
  const pathname = usePathname();
  const { tenant, isLoading, isSessionExpired } = useTenant();

  const [isExpanded, setIsExpanded] = useState(false);
  // Todos los grupos cerrados por defecto
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(navigation.map((g) => [g.name, false])),
  );

  const toggleGroup = useCallback((name: string) => {
    setOpenGroups((prev) => ({ ...prev, [name]: !prev[name] }));
  }, []);

  const tenantName = tenant?.tradeName || tenant?.legalName;
  const tenantInitials = tenantName
    ? tenantName
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((p) => p[0]?.toUpperCase() ?? '')
        .join('')
    : 'NE';

  // Determina qué grupo está activo según la ruta actual
  const activeGroup = navigation.find((g) =>
    g.items.some((item) =>
      item.href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(item.href),
    ),
  );

  return (
    <aside
      className="fixed top-0 left-0 z-40 flex h-screen flex-col overflow-hidden"
      style={{
        backgroundColor: '#0b1120',
        width: isExpanded ? '15rem' : '3.5rem',
        transition: 'width 280ms cubic-bezier(0.4, 0, 0.2, 1), box-shadow 280ms ease',
        boxShadow: isExpanded ? '4px 0 24px rgb(0 0 0 / 0.4)' : 'none',
      }}
      onMouseEnter={() => setIsExpanded(true)}
      onMouseLeave={() => setIsExpanded(false)}
      aria-label="Navegación principal"
    >
      {/* ── Logo ─────────────────────────────────────────────────── */}
      <div
        className="flex shrink-0 items-center"
        style={{
          background: 'linear-gradient(180deg, #0f1e38 0%, #0b1120 100%)',
          borderBottom: '1px solid #1a2744',
          padding: '0.875rem',
          minHeight: '3.5rem',
        }}
      >
        <div
          className="flex shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white"
          style={{
            background: 'linear-gradient(135deg, #2563eb 0%, #1e40af 100%)',
            boxShadow: '0 2px 8px rgb(37 99 235 / 0.45)',
            width: '1.875rem',
            height: '1.875rem',
            minWidth: '1.875rem',
            fontSize: '11px',
          }}
          aria-hidden="true"
        >
          {tenantInitials}
        </div>

        <div
          className="ml-2.5 min-w-0 flex-1"
          style={{
            opacity: isExpanded ? 1 : 0,
            transition: 'opacity 180ms ease',
            pointerEvents: isExpanded ? 'auto' : 'none',
          }}
        >
          <p className="truncate text-sm leading-tight font-semibold tracking-tight whitespace-nowrap text-white">
            NexoERP
          </p>
          <p className="mt-0.5 truncate text-xs whitespace-nowrap" style={{ color: '#4d7ab8' }}>
            {isLoading ? 'Cargando...' : (tenantName ?? 'Sin empresa')}
          </p>
        </div>
      </div>

      {/* ── Navegación ─────────────────────────────────────────────── */}
      <nav
        className="flex-1 overflow-x-hidden overflow-y-auto"
        style={{
          scrollbarWidth: 'thin',
          scrollbarColor: '#1e293b transparent',
          padding: isExpanded ? '0.5rem 0.5rem' : '0.5rem 0.375rem',
          transition: 'padding 280ms ease',
        }}
        aria-label="Menú de módulos"
      >
        {navigation.map((group) => {
          const isGroupOpen = openGroups[group.name] ?? false;
          const accentColor = groupAccentColor[group.name] ?? '#3b82f6';

          // ¿Algún item de este grupo está activo?
          const isGroupActive = activeGroup?.name === group.name;

          return (
            <div key={group.name} className="mb-0.5">
              {/* ── Cabecera de grupo ──────────────────────────────────
                  Colapsado: solo el ícono de categoría (clickable)
                  Expandido: ícono + nombre + chevron               */}
              {isExpanded ? (
                /* MODO EXPANDIDO — botón con nombre y chevron */
                <button
                  type="button"
                  onClick={() => toggleGroup(group.name)}
                  className="flex w-full cursor-pointer items-center gap-2.5 rounded-md px-2 py-2 transition-colors duration-150"
                  style={{
                    backgroundColor: isGroupOpen ? 'rgba(255,255,255,0.05)' : 'transparent',
                  }}
                  onMouseEnter={(e) => {
                    if (!isGroupOpen) {
                      (e.currentTarget as HTMLButtonElement).style.backgroundColor =
                        'rgba(255,255,255,0.04)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isGroupOpen) {
                      (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent';
                    }
                  }}
                  aria-expanded={isGroupOpen}
                >
                  <group.groupIcon
                    className="h-4 w-4 shrink-0"
                    style={{ color: isGroupActive ? accentColor : '#4b6080' }}
                    aria-hidden="true"
                  />
                  <span
                    className="flex-1 truncate text-left text-xs font-semibold whitespace-nowrap uppercase"
                    style={{
                      color: isGroupActive ? '#e2e8f0' : '#5d7a96',
                      letterSpacing: '0.07em',
                    }}
                  >
                    {group.name}
                  </span>
                  <ChevronDown
                    className="h-3 w-3 shrink-0"
                    style={{
                      color: '#3d5a80',
                      transform: isGroupOpen ? 'rotate(0deg)' : 'rotate(-90deg)',
                      transition: 'transform 200ms ease',
                    }}
                    aria-hidden="true"
                  />
                </button>
              ) : (
                /* MODO COLAPSADO — solo el ícono de categoría */
                <Link
                  href={group.defaultHref as unknown as Route}
                  title={group.name}
                  className="flex cursor-pointer items-center justify-center rounded-md transition-colors duration-150"
                  style={{
                    width: '2.75rem',
                    height: '2.5rem',
                    margin: '0 auto',
                    backgroundColor: isGroupActive ? `${accentColor}22` : 'transparent',
                  }}
                  onMouseEnter={(e) => {
                    if (!isGroupActive) {
                      (e.currentTarget as HTMLAnchorElement).style.backgroundColor =
                        'rgba(255,255,255,0.07)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isGroupActive) {
                      (e.currentTarget as HTMLAnchorElement).style.backgroundColor = 'transparent';
                    }
                  }}
                  aria-label={group.name}
                >
                  <group.groupIcon
                    className="h-5 w-5"
                    style={{ color: isGroupActive ? accentColor : '#4b6080' }}
                    aria-hidden="true"
                  />
                </Link>
              )}

              {/* ── Items del grupo (solo visibles en modo expandido) ── */}
              <div
                style={{
                  overflow: 'hidden',
                  maxHeight: isExpanded && isGroupOpen ? '600px' : '0px',
                  transition: 'max-height 250ms cubic-bezier(0.4, 0, 0.2, 1)',
                }}
              >
                <ul className="mt-0.5 mb-1 space-y-0.5 pl-1" role="list">
                  {group.items.map((item) => {
                    const isActive =
                      item.href === '/dashboard'
                        ? pathname === '/dashboard'
                        : pathname.startsWith(item.href);

                    return (
                      <li key={item.href} className="relative">
                        {/* Left accent bar */}
                        {isActive && (
                          <div
                            className="absolute top-1 bottom-1 left-0 w-0.5 rounded-full"
                            style={{
                              background: `linear-gradient(180deg, ${accentColor}, ${accentColor}bb)`,
                              boxShadow: `0 0 6px ${accentColor}99`,
                            }}
                            aria-hidden="true"
                          />
                        )}

                        <Link
                          href={item.href as unknown as Route}
                          aria-current={isActive ? 'page' : undefined}
                          className="ml-1 flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 transition-colors duration-150"
                          style={{
                            backgroundColor: isActive ? `${accentColor}20` : 'transparent',
                          }}
                          onMouseEnter={(e) => {
                            if (!isActive) {
                              (e.currentTarget as HTMLAnchorElement).style.backgroundColor =
                                'rgba(255,255,255,0.04)';
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (!isActive) {
                              (e.currentTarget as HTMLAnchorElement).style.backgroundColor =
                                'transparent';
                            }
                          }}
                        >
                          <item.icon
                            className="h-3.5 w-3.5 shrink-0"
                            style={{ color: isActive ? accentColor : '#3d5a7a' }}
                            aria-hidden="true"
                          />
                          <span
                            className="truncate text-sm whitespace-nowrap"
                            style={{
                              color: isActive ? '#ffffff' : '#5d7a96',
                              fontWeight: isActive ? 500 : 400,
                            }}
                          >
                            {item.name}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          );
        })}
      </nav>

      {/* ── Footer ─────────────────────────────────────────────────── */}
      <div
        className="flex shrink-0 items-center justify-center"
        style={{ borderTop: '1px solid #1a2744', padding: '0.625rem' }}
      >
        <div
          className="h-1.5 w-1.5 shrink-0 rounded-full"
          style={{
            backgroundColor: isSessionExpired ? '#ef4444' : '#22c55e',
            boxShadow: isSessionExpired
              ? '0 0 4px rgb(239 68 68 / 0.5)'
              : '0 0 4px rgb(34 197 94 / 0.5)',
          }}
        />
        <div
          className="ml-2 flex flex-1 items-center justify-between"
          style={{
            opacity: isExpanded ? 1 : 0,
            transition: 'opacity 180ms ease',
            pointerEvents: isExpanded ? 'auto' : 'none',
          }}
        >
          <p className="text-xs whitespace-nowrap" style={{ color: '#2d3f5e' }}>
            NexoERP v0.6
          </p>
          <p className="text-xs whitespace-nowrap" style={{ color: '#2d3f5e' }}>
            Honduras
          </p>
        </div>
      </div>
    </aside>
  );
}
