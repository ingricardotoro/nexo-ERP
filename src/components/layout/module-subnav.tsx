'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { Route } from 'next';
import { navigation } from '@/constants/navigation';

/**
 * Barra de subnavegación horizontal por módulo.
 *
 * Detecta el grupo activo según la ruta actual y renderiza sus items
 * como tabs horizontales debajo del header. Solo se muestra cuando
 * el grupo activo tiene más de un item.
 */
export function ModuleSubnav() {
  const pathname = usePathname();

  const activeGroup = navigation.find((group) =>
    group.items.some((item) =>
      item.href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(item.href),
    ),
  );

  // No mostrar para Core (Dashboard/Usuarios/Configuración) ni grupos con 1 solo item
  if (!activeGroup || activeGroup.name === 'Core' || activeGroup.items.length <= 1) {
    return null;
  }

  const { accentColor, items } = activeGroup;

  return (
    <div
      className="sticky top-14 z-30 border-b bg-white"
      style={{ borderColor: '#e5e7eb' }}
      role="navigation"
      aria-label={`Subnavegación de ${activeGroup.name}`}
    >
      <div className="pr-4 pl-6">
        <ul
          className="flex items-center gap-1 overflow-x-auto"
          role="list"
          style={{ scrollbarWidth: 'none' }}
        >
          {items.map((item) => {
            const isActive =
              item.href === '/dashboard'
                ? pathname === '/dashboard'
                : pathname.startsWith(item.href);

            return (
              <li key={item.href} className="shrink-0">
                <Link
                  href={item.href as unknown as Route}
                  aria-current={isActive ? 'page' : undefined}
                  className="relative flex items-center gap-1.5 px-3 py-3 text-sm transition-colors duration-150"
                  style={{
                    color: isActive ? accentColor : '#6b7280',
                    fontWeight: isActive ? 600 : 400,
                    whiteSpace: 'nowrap',
                  }}
                >
                  <item.icon
                    className="h-3.5 w-3.5 shrink-0"
                    aria-hidden="true"
                    style={{ color: isActive ? accentColor : '#9ca3af' }}
                  />
                  {item.name}

                  {/* Línea activa en la parte inferior */}
                  {isActive && (
                    <span
                      className="absolute right-0 bottom-0 left-0 h-0.5 rounded-t-full"
                      style={{ backgroundColor: accentColor }}
                      aria-hidden="true"
                    />
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
