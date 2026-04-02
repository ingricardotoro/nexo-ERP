'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export interface TenantInfo {
  id: string;
  legalName: string;
  tradeName?: string | null;
  rtn: string;
  maxUsers: number;
  isActive: boolean;
}

export interface SessionInfo {
  userId: string;
  email?: string | null;
  fullName?: string | null;
  role?: string | null;
}

interface TenantContextValue {
  tenant: TenantInfo | null;
  session: SessionInfo | null;
  companyId: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;
  isSessionExpired: boolean;
  refreshTenant: () => Promise<void>;
  setTenant: (tenant: TenantInfo | null) => void;
}

const TenantContext = createContext<TenantContextValue | null>(null);

// Cache key para sessionStorage — persiste entre HMR reloads (misma pestaña)
// localStorage persiste entre reloads de HMR (Turbopack/OneDrive) y entre sesiones.
// Solo se limpia en logout explícito o expiración de sesión.
const TENANT_CACHE_KEY = 'nexoerp:tenant_cache';

interface TenantCache {
  tenant: TenantInfo;
  session: SessionInfo;
}

function readTenantCache(): TenantCache | null {
  try {
    const raw = localStorage.getItem(TENANT_CACHE_KEY);
    return raw ? (JSON.parse(raw) as TenantCache) : null;
  } catch {
    return null;
  }
}

function writeTenantCache(data: TenantCache): void {
  try {
    localStorage.setItem(TENANT_CACHE_KEY, JSON.stringify(data));
  } catch {
    // localStorage no disponible (SSR, modo privado sin storage, etc.)
  }
}

function clearTenantCache(): void {
  try {
    localStorage.removeItem(TENANT_CACHE_KEY);
  } catch {
    // ignore
  }
}

interface TenantApiResponse {
  success: boolean;
  data?: {
    tenant: TenantInfo;
    session: SessionInfo;
  };
  error?: string;
  code?: string;
}

async function fetchTenantInfo(): Promise<NonNullable<TenantApiResponse['data']>> {
  const response = await fetch('/api/v1/core/tenant', {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
    cache: 'no-store',
    credentials: 'include',
  });

  const payload = (await response.json()) as TenantApiResponse;

  if (response.status === 401) {
    const unauthorizedError = new Error(payload.error ?? 'Sesion expirada o no autenticada');
    unauthorizedError.name = 'UNAUTHORIZED';
    throw unauthorizedError;
  }

  if (!response.ok || !payload.success || !payload.data?.tenant || !payload.data?.session) {
    throw new Error(payload.error ?? 'No se pudo cargar la empresa activa');
  }

  return payload.data;
}

interface TenantProviderProps {
  children: ReactNode;
  /** Datos pre-cargados desde el server component del layout (SSR). Evita loading flash. */
  initialData?: TenantCache | null;
}

export function TenantProvider({ children, initialData }: TenantProviderProps) {
  // Prioridad: 1) initialData (SSR, disponible de inmediato sin fetch),
  //            2) caché localStorage (sobrevive HMR reloads si ya se guardó),
  //            3) null → isLoading=true hasta que el fetch complete
  const cached = initialData ?? readTenantCache();

  const [tenant, setTenantState] = useState<TenantInfo | null>(cached?.tenant ?? null);
  const [session, setSession] = useState<SessionInfo | null>(cached?.session ?? null);
  const [isLoading, setIsLoading] = useState(!cached);
  const [error, setError] = useState<string | null>(null);
  const [isSessionExpired, setIsSessionExpired] = useState(false);

  const setTenant = useCallback((t: TenantInfo | null) => {
    setTenantState(t);
    if (!t) clearTenantCache();
  }, []);

  const refreshTenant = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setIsSessionExpired(false);

    try {
      const data = await fetchTenantInfo();
      setTenantState(data.tenant);
      setSession(data.session);
      writeTenantCache(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error cargando empresa';
      setError(message);
      setTenantState(null);
      setSession(null);
      clearTenantCache();
      if (err instanceof Error && err.name === 'UNAUTHORIZED') {
        setIsSessionExpired(true);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      // Si ya hay datos del caché, no mostrar loading — solo refrescar en background
      if (!cancelled) {
        setError(null);
        setIsSessionExpired(false);
        if (!readTenantCache()) setIsLoading(true);
      }

      try {
        const data = await fetchTenantInfo();
        if (!cancelled) {
          setTenantState(data.tenant);
          setSession(data.session);
          writeTenantCache(data);
        }
      } catch (err) {
        if (cancelled) return;
        clearTenantCache();
        const message = err instanceof Error ? err.message : 'Error cargando empresa';
        setError(message);
        setTenantState(null);
        setSession(null);
        if (err instanceof Error && err.name === 'UNAUTHORIZED') {
          setIsSessionExpired(true);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo<TenantContextValue>(
    () => ({
      tenant,
      session,
      companyId: tenant?.id ?? null,
      isLoading,
      isAuthenticated: Boolean(session?.userId && tenant?.id),
      error,
      isSessionExpired,
      refreshTenant,
      setTenant,
    }),
    [tenant, session, isLoading, error, isSessionExpired, refreshTenant, setTenant],
  );

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
}

export function useTenant() {
  const context = useContext(TenantContext);
  if (!context) {
    throw new Error('useTenant debe usarse dentro de TenantProvider');
  }
  return context;
}
