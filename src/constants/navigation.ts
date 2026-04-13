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
  LayoutDashboard,
  type LucideIcon,
} from 'lucide-react';

export interface NavigationItem {
  name: string;
  href: string;
  icon: LucideIcon;
}

export interface NavigationGroup {
  name: string;
  groupIcon: LucideIcon;
  defaultHref: string;
  accentColor: string;
  items: NavigationItem[];
}

export const navigation: NavigationGroup[] = [
  {
    name: 'Core',
    groupIcon: LayoutDashboard,
    defaultHref: '/dashboard',
    accentColor: '#3b82f6',
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
    accentColor: '#10b981',
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
    accentColor: '#f59e0b',
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
    accentColor: '#8b5cf6',
    items: [{ name: 'Directorio', href: '/dashboard/contacts', icon: Users2 }],
  },
  {
    name: 'Inventarios',
    groupIcon: Package,
    defaultHref: '/dashboard/inventory/products',
    accentColor: '#06b6d4',
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
    accentColor: '#f97316',
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
    accentColor: '#6366f1',
    items: [
      { name: 'Oportunidades', href: '/dashboard/sales/opportunities', icon: TrendingUp },
      { name: 'Pedidos', href: '/dashboard/sales/orders', icon: Banknote },
    ],
  },
];
