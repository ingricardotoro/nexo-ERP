// src/components/layout/dashboard-header.tsx
'use client';

import { Bell, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useTenant } from '@/lib/context/tenant-context';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export function DashboardHeader() {
  const { tenant, session, isLoading, isSessionExpired, error } = useTenant();
  const tenantName = tenant?.tradeName || tenant?.legalName;
  const userDisplayName = session?.fullName || session?.email || 'Usuario';
  const roleDisplay = session?.role || 'Sin rol';
  const tenantInitials = tenantName
    ? tenantName
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() ?? '')
        .join('')
    : 'NE';

  return (
    <header className="bg-card border-border sticky top-0 z-30 flex h-16 items-center gap-4 border-b px-6">
      <div className="flex flex-1 items-center gap-4">
        <div className="min-w-[220px]">
          <p className="text-muted-foreground text-xs tracking-wide uppercase">Empresa</p>
          <p className="text-sm font-semibold">
            {isLoading ? 'Cargando empresa...' : (tenantName ?? 'Sin empresa activa')}
          </p>
          {!isLoading && (isSessionExpired || error) ? (
            <p className="text-destructive text-xs">Sesion no valida</p>
          ) : null}
        </div>
        <div className="relative max-w-md flex-1">
          <Search
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2"
            aria-hidden="true"
          />
          <input
            type="search"
            placeholder="Buscar... (Cmd+K)"
            className="border-input bg-background placeholder:text-muted-foreground focus-visible:ring-ring h-9 w-full rounded-md border px-9 text-sm focus-visible:ring-2 focus-visible:outline-none"
            aria-label="Busqueda global"
            disabled
          />
        </div>
      </div>

      <Button variant="ghost" size="icon" aria-label="Notificaciones">
        <Bell className="h-5 w-5" aria-hidden="true" />
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="rounded-full" aria-label="Menu de usuario">
            <Avatar className="h-8 w-8">
              <AvatarImage src="" alt="Usuario" />
              <AvatarFallback>{tenantInitials}</AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>
            <div className="flex flex-col space-y-1">
              <p className="text-sm font-medium">
                {isLoading ? 'Cargando empresa...' : (tenantName ?? 'Sin empresa activa')}
              </p>
              <p className="text-muted-foreground text-xs">{userDisplayName}</p>
              <p className="text-muted-foreground text-xs">{roleDisplay}</p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem>Mi perfil</DropdownMenuItem>
          <DropdownMenuItem>Configuracion</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="text-destructive">Cerrar sesion</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
