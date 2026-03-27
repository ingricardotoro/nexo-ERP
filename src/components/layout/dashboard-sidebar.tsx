// src/components/layout/dashboard-sidebar.tsx
'use client';

import {
  Users,
  BarChart3,
  FileText,
  Users2,
  Package,
  ShoppingCart,
  ReceiptText,
  Settings,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import type { Route } from 'next';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { useTenant } from '@/lib/context/tenant-context';

interface NavigationItem {
  name: string;
  href: string;
  icon: LucideIcon;
}

interface NavigationGroup {
  name: string;
  items: NavigationItem[];
  badge?: string;
}

// Configuración de navegación por módulo
const navigation: NavigationGroup[] = [
  {
    name: 'Core',
    items: [
      { name: 'Dashboard', href: '/dashboard', icon: BarChart3 },
      { name: 'Usuarios', href: '/dashboard/users', icon: Users },
      { name: 'Configuración', href: '/dashboard/settings', icon: Settings },
    ],
  },
  {
    name: 'Contabilidad',
    items: [
      { name: 'Plan de Cuentas', href: '/dashboard/accounting/accounts', icon: FileText },
      { name: 'Años Fiscales', href: '/dashboard/accounting/fiscal-years', icon: FileText },
      { name: 'Diarios', href: '/dashboard/accounting/journals', icon: FileText },
      { name: 'Asientos', href: '/dashboard/accounting/entries', icon: FileText },
    ],
    badge: 'Fase 2',
  },
  {
    name: 'Facturación',
    items: [
      { name: 'Facturas', href: '/dashboard/invoicing/invoices', icon: ReceiptText },
      { name: 'CAI', href: '/dashboard/invoicing/cai', icon: FileText },
    ],
    badge: 'Fase 3',
  },
  {
    name: 'Contactos',
    items: [{ name: 'Directorio', href: '/dashboard/contacts', icon: Users2 }],
    badge: 'Fase 2',
  },
  {
    name: 'Inventarios',
    items: [
      { name: 'Productos', href: '/dashboard/inventory/products', icon: Package },
      { name: 'Almacenes', href: '/dashboard/inventory/warehouses', icon: Package },
    ],
    badge: 'Fase 4',
  },
  {
    name: 'Ventas',
    items: [
      { name: 'Oportunidades', href: '/dashboard/sales/opportunities', icon: ShoppingCart },
      { name: 'Pedidos', href: '/dashboard/sales/orders', icon: ShoppingCart },
    ],
    badge: 'Fase 4',
  },
];

export function DashboardSidebar() {
  const pathname = usePathname();
  const { tenant, isLoading, isSessionExpired } = useTenant();
  const tenantName = tenant?.tradeName || tenant?.legalName;
  const tenantInitials = tenantName
    ? tenantName
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() ?? '')
        .join('')
    : 'NE';

  return (
    <aside className="bg-card border-border fixed top-0 left-0 z-40 h-screen w-64 border-r">
      <div className="flex h-full flex-col">
        {/* Logo y nombre de la empresa */}
        <div className="border-border flex items-center gap-3 border-b px-6 py-4">
          <div className="bg-primary flex h-10 w-10 items-center justify-center rounded-lg text-white">
            <span className="text-sm font-bold tracking-wide">{tenantInitials}</span>
          </div>
          <div className="flex-1">
            <h2 className="text-foreground text-sm font-semibold">NexoERP</h2>
            <p className="text-muted-foreground text-xs">
              {isLoading ? 'Cargando empresa...' : (tenantName ?? 'Sin empresa')}
            </p>
            {!isLoading && isSessionExpired ? (
              <p className="text-destructive text-xs">Sesion no valida</p>
            ) : null}
          </div>
        </div>

        {/* Navegación */}
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {navigation.map((group) => (
            <div key={group.name} className="mb-6">
              <div className="mb-2 flex items-center gap-2 px-3">
                <h3 className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
                  {group.name}
                </h3>
                {group.badge && (
                  <Badge variant="outline" className="text-xs">
                    {group.badge}
                  </Badge>
                )}
              </div>
              <ul className="space-y-1">
                {group.items.map((item) => {
                  const isActive = pathname === item.href;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href as unknown as Route}
                        className={cn(
                          'hover:bg-accent hover:text-accent-foreground flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                          isActive ? 'bg-accent text-accent-foreground' : 'text-muted-foreground',
                        )}
                      >
                        <item.icon className="h-4 w-4" aria-hidden="true" />
                        <span>{item.name}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
      </div>
    </aside>
  );
}
