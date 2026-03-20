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

interface TenantContextValue {
  tenant: TenantInfo | null;
  companyId: string | null;
  isLoading: boolean;
  error: string | null;
  refreshTenant: () => Promise<void>;
  setTenant: (tenant: TenantInfo | null) => void;
}

const TenantContext = createContext<TenantContextValue | null>(null);

async function fetchTenantInfo(): Promise<TenantInfo> {
  const response = await fetch('/api/v1/core/tenant', {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
    cache: 'no-store',
  });

  const payload = (await response.json()) as { success: boolean; data?: TenantInfo; error?: string };

  if (!response.ok || !payload.success || !payload.data) {
    throw new Error(payload.error ?? 'No se pudo cargar la empresa activa');
  }

  return payload.data;
}

export function TenantProvider({ children }: { children: ReactNode }) {
  const [tenant, setTenant] = useState<TenantInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshTenant = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await fetchTenantInfo();
      setTenant(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error cargando empresa';
      setError(message);
      setTenant(null);
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
      companyId: tenant?.id ?? null,
      isLoading,
      error,
      refreshTenant,
      setTenant,
    }),
    [tenant, isLoading, error, refreshTenant],
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
