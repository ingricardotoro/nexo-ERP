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

export function TenantProvider({ children }: { children: ReactNode }) {
  const [tenant, setTenant] = useState<TenantInfo | null>(null);
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSessionExpired, setIsSessionExpired] = useState(false);

  const refreshTenant = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setIsSessionExpired(false);

    try {
      const data = await fetchTenantInfo();
      setTenant(data.tenant);
      setSession(data.session);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error cargando empresa';
      setError(message);
      setTenant(null);
      setSession(null);
      if (err instanceof Error && err.name === 'UNAUTHORIZED') {
        setIsSessionExpired(true);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshTenant();
  }, [refreshTenant]);

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
    [tenant, session, isLoading, error, isSessionExpired, refreshTenant],
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
