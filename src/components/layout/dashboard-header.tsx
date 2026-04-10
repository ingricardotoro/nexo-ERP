// src/components/layout/dashboard-header.tsx
'use client';

import { Bell, Search, ChevronDown, LogOut, User, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useTenant } from '@/lib/context/tenant-context';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

// Mapa de roles a etiquetas legibles en español
const roleLabels: Record<string, string> = {
  ADMIN: 'Administrador',
  MANAGER: 'Gerente',
  ACCOUNTANT: 'Contador',
  SELLER: 'Vendedor',
  AUDITOR: 'Auditor',
};

// Color de badge por rol
const roleBadgeStyle: Record<string, { bg: string; text: string; border: string }> = {
  ADMIN: { bg: '#fef3c7', text: '#92400e', border: '#fde68a' },
  MANAGER: { bg: '#eff6ff', text: '#1e40af', border: '#bfdbfe' },
  ACCOUNTANT: { bg: '#f0fdf4', text: '#166534', border: '#bbf7d0' },
  SELLER: { bg: '#faf5ff', text: '#6b21a8', border: '#e9d5ff' },
  AUDITOR: { bg: '#fff7ed', text: '#9a3412', border: '#fed7aa' },
};

function getUserInitials(
  name: string | null | undefined,
  email: string | null | undefined,
): string {
  if (name) {
    return name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? '')
      .join('');
  }
  if (email) return email[0]?.toUpperCase() ?? 'U';
  return 'U';
}

export function DashboardHeader() {
  const { tenant, session, isLoading, isSessionExpired, error } = useTenant();
  const tenantName = tenant?.tradeName || tenant?.legalName;
  const userDisplayName = session?.fullName || session?.email || 'Usuario';
  const roleLabel = session?.role ? (roleLabels[session.role] ?? session.role) : null;
  const roleStyle = session?.role ? (roleBadgeStyle[session.role] ?? null) : null;
  const userInitials = getUserInitials(session?.fullName, session?.email);

  return (
    <header
      className="sticky top-0 z-30 flex h-14 items-center gap-3 px-5"
      style={{
        background: 'linear-gradient(180deg, #ffffff 0%, #fafbfd 100%)',
        borderBottom: '1px solid hsl(214 32% 87%)',
        boxShadow: '0 1px 4px 0 rgb(0 0 0 / 0.06), 0 2px 8px -2px rgb(0 0 0 / 0.04)',
      }}
    >
      {/* ── Empresa activa ──────────────────────────────────────────── */}
      <div className="flex shrink-0 items-center gap-2">
        {isLoading ? (
          <div className="h-5 w-36 animate-pulse rounded-md bg-slate-100" />
        ) : isSessionExpired || error ? (
          <Badge variant="destructive" className="text-xs">
            Sesión no válida
          </Badge>
        ) : (
          <div className="flex items-center gap-2">
            <div
              className="h-2 w-2 rounded-full"
              style={{
                backgroundColor: '#22c55e',
                boxShadow: '0 0 6px rgb(34 197 94 / 0.5)',
              }}
              aria-label="Empresa activa"
            />
            <span className="max-w-[200px] truncate text-sm font-semibold text-slate-800">
              {tenantName ?? 'Sin empresa activa'}
            </span>
          </div>
        )}
      </div>

      <Separator orientation="vertical" className="h-5 bg-slate-200" />

      {/* ── Buscador global ─────────────────────────────────────────── */}
      <div className="max-w-sm flex-1">
        <label htmlFor="busqueda-global" className="sr-only">
          Búsqueda global
        </label>
        <div className="relative">
          <Search
            className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
            aria-hidden="true"
          />
          <input
            id="busqueda-global"
            type="search"
            placeholder="Buscar... (⌘K)"
            disabled
            className="h-8 w-full rounded-lg border border-slate-200 bg-slate-50 pr-3 pl-8 text-sm text-slate-600 transition-all placeholder:text-slate-400 focus-visible:ring-2 focus-visible:ring-blue-700/40 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60"
            aria-label="Búsqueda global — próximamente disponible"
          />
        </div>
      </div>

      {/* ── Acciones del lado derecho ───────────────────────────────── */}
      <div className="ml-auto flex items-center gap-1">
        {/* Notificaciones */}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 cursor-pointer rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
          aria-label="Notificaciones"
        >
          <Bell className="h-4 w-4" aria-hidden="true" />
        </Button>

        <Separator orientation="vertical" className="mx-1 h-5 bg-slate-200" />

        {/* Menú de usuario */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="flex h-8 cursor-pointer items-center gap-2 rounded-lg px-2 text-slate-700 transition-colors hover:bg-slate-100"
              aria-label="Menú de usuario"
            >
              <Avatar className="h-7 w-7">
                <AvatarImage src="" alt={userDisplayName} />
                <AvatarFallback
                  className="text-xs font-semibold text-white"
                  style={{
                    background: 'linear-gradient(135deg, #2563eb 0%, #1e40af 100%)',
                  }}
                >
                  {userInitials}
                </AvatarFallback>
              </Avatar>

              {/* Nombre en desktop */}
              <div className="hidden flex-col items-start leading-none md:flex">
                <span className="max-w-[120px] truncate text-sm font-medium text-slate-800">
                  {isLoading ? '...' : (session?.fullName?.split(' ')[0] ?? 'Usuario')}
                </span>
                {roleLabel && roleStyle && (
                  <span
                    className="mt-0.5 rounded-full px-1.5 py-0.5 text-xs font-medium"
                    style={{
                      backgroundColor: roleStyle.bg,
                      color: roleStyle.text,
                      border: `1px solid ${roleStyle.border}`,
                      fontSize: '10px',
                      lineHeight: '1',
                    }}
                  >
                    {roleLabel}
                  </span>
                )}
              </div>

              <ChevronDown className="ml-0.5 h-3 w-3 shrink-0 text-slate-400" aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-60">
            <DropdownMenuLabel className="font-normal">
              <div className="flex items-center gap-3">
                <Avatar className="h-9 w-9">
                  <AvatarFallback
                    className="text-sm font-semibold text-white"
                    style={{
                      background: 'linear-gradient(135deg, #2563eb 0%, #1e40af 100%)',
                    }}
                  >
                    {userInitials}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col space-y-0.5 overflow-hidden">
                  <p className="truncate text-sm leading-tight font-semibold">
                    {isLoading ? 'Cargando...' : (session?.fullName ?? 'Usuario')}
                  </p>
                  <p className="text-muted-foreground truncate text-xs leading-tight">
                    {session?.email}
                  </p>
                  {roleLabel && roleStyle && (
                    <span
                      className="mt-0.5 inline-flex w-fit rounded-full px-1.5 py-0.5 text-xs font-medium"
                      style={{
                        backgroundColor: roleStyle.bg,
                        color: roleStyle.text,
                        border: `1px solid ${roleStyle.border}`,
                        fontSize: '10px',
                      }}
                    >
                      {roleLabel}
                    </span>
                  )}
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="cursor-pointer gap-2">
              <User className="h-4 w-4" aria-hidden="true" />
              Mi perfil
            </DropdownMenuItem>
            <DropdownMenuItem className="cursor-pointer gap-2">
              <Settings className="h-4 w-4" aria-hidden="true" />
              Configuración
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive focus:text-destructive cursor-pointer gap-2">
              <LogOut className="h-4 w-4" aria-hidden="true" />
              Cerrar sesión
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
