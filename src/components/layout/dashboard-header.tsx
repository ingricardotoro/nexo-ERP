// src/components/layout/dashboard-header.tsx
'use client';

import { Bell, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export function DashboardHeader() {
  return (
    <header className="bg-card border-border sticky top-0 z-30 flex h-16 items-center gap-4 border-b px-6">
      {/* Búsqueda global (placeholder para ⌘K command palette) */}
      <div className="flex flex-1 items-center gap-4">
        <div className="relative max-w-md flex-1">
          <Search
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2"
            aria-hidden="true"
          />
          <input
            type="search"
            placeholder="Buscar... (⌘K)"
            className="border-input bg-background placeholder:text-muted-foreground focus-visible:ring-ring h-9 w-full rounded-md border px-9 text-sm focus-visible:ring-2 focus-visible:outline-none"
            aria-label="Búsqueda global"
            disabled
          />
        </div>
      </div>

      {/* Notificaciones */}
      <Button variant="ghost" size="icon" aria-label="Notificaciones">
        <Bell className="h-5 w-5" aria-hidden="true" />
      </Button>

      {/* Usuario */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="rounded-full" aria-label="Menú de usuario">
            <Avatar className="h-8 w-8">
              <AvatarImage src="" alt="Usuario" />
              <AvatarFallback>AD</AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>
            <div className="flex flex-col space-y-1">
              <p className="text-sm font-medium">Admin Usuario</p>
              <p className="text-muted-foreground text-xs">admin@empresademo.hn</p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem>Mi Perfil</DropdownMenuItem>
          <DropdownMenuItem>Configuración</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="text-destructive">Cerrar Sesión</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
