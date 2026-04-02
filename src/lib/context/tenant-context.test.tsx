import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TenantProvider, useTenant } from '@/lib/context/tenant-context';

function TenantSnapshot() {
  const { tenant, session, isLoading, isAuthenticated, isSessionExpired, error } = useTenant();

  return (
    <div>
      <p data-testid="loading">{String(isLoading)}</p>
      <p data-testid="tenant">{tenant?.legalName ?? 'none'}</p>
      <p data-testid="user">{session?.fullName ?? 'none'}</p>
      <p data-testid="auth">{String(isAuthenticated)}</p>
      <p data-testid="expired">{String(isSessionExpired)}</p>
      <p data-testid="error">{error ?? 'none'}</p>
    </div>
  );
}

describe('tenant-context', () => {
  afterEach(() => {
    cleanup();
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('carga tenant y sesion desde /api/v1/core/tenant', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        data: {
          tenant: {
            id: 'company-1',
            legalName: 'NexoERP S.A.',
            tradeName: 'NexoERP',
            rtn: '08011999123456',
            maxUsers: 10,
            isActive: true,
          },
          session: {
            userId: 'user-1',
            fullName: 'Admin Nexo',
            email: 'admin@nexoerp.com',
            role: 'ADMIN',
          },
        },
      }),
    } as Response);

    render(
      <TenantProvider>
        <TenantSnapshot />
      </TenantProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
    });

    expect(screen.getByTestId('tenant').textContent).toBe('NexoERP S.A.');
    expect(screen.getByTestId('user').textContent).toBe('Admin Nexo');
    expect(screen.getByTestId('auth').textContent).toBe('true');
    expect(screen.getByTestId('expired').textContent).toBe('false');
    expect(screen.getByTestId('error').textContent).toBe('none');
  });

  it('marca sesion expirada si /tenant responde 401', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({
        success: false,
        error: 'Token expirado',
        code: 'TOKEN_EXPIRED',
      }),
    } as Response);

    render(
      <TenantProvider>
        <TenantSnapshot />
      </TenantProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
    });

    expect(screen.getByTestId('tenant').textContent).toBe('none');
    expect(screen.getByTestId('auth').textContent).toBe('false');
    expect(screen.getByTestId('expired').textContent).toBe('true');
    expect(screen.getByTestId('error').textContent).toBe('Token expirado');
  });
});
