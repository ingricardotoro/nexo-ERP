import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/context/tenant-context', () => ({
  useTenant: () => ({
    tenant: {
      id: 'company-1',
      legalName: 'NexoERP S.A.',
      tradeName: 'NexoERP',
      rtn: '08011999123456',
      maxUsers: 5,
      isActive: true,
    },
  }),
}));

vi.mock('@/components/users/user-form-modal', () => ({
  UserFormModal: () => <button type="button">Crear Usuario</button>,
}));

vi.mock('@/app/(dashboard)/dashboard/users/UserEditModal', () => ({
  UserEditModal: () => null,
}));

vi.mock('@/components/users/users-table', () => ({
  UsersTable: ({ totalCount }: { totalCount: number }) => (
    <div data-testid="users-table">Total: {totalCount}</div>
  ),
}));

import UsersPage from '@/app/(dashboard)/dashboard/users/page';

function jsonResponse(payload: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
  } as Response;
}

describe('UsersPage API integration', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('carga usuarios desde API y muestra metricas reales', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({
        success: true,
        data: [
          {
            id: 'user-1',
            fullName: 'Ana Admin',
            email: 'ana@nexoerp.com',
            role: 'ADMIN',
            isActive: true,
            lastLoginAt: null,
            createdAt: '2026-03-20T00:00:00.000Z',
          },
          {
            id: 'user-2',
            fullName: 'Mario Manager',
            email: 'mario@nexoerp.com',
            role: 'MANAGER',
            isActive: false,
            lastLoginAt: null,
            createdAt: '2026-03-19T00:00:00.000Z',
          },
        ],
        pagination: {
          total: 2,
          page: 1,
          limit: 10,
          totalPages: 1,
        },
      }),
    );

    render(<UsersPage />);

    await waitFor(() => {
      expect(screen.getByText(/2 usuarios encontrados/i)).toBeInTheDocument();
    });

    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByTestId('users-table')).toHaveTextContent('Total: 2');

    expect(fetchSpy).toHaveBeenCalled();
    const [url, options] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/api/v1/core/users?');
    expect(url).toContain('page=1');
    expect(url).toContain('limit=10');
    expect(url).toContain('orderBy=createdAt');
    expect(url).toContain('orderDir=desc');
    expect(options.credentials).toBe('include');
  });

  it('refetch con search query envia parametro search al backend', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    fetchSpy
      .mockResolvedValueOnce(
        jsonResponse({
          success: true,
          data: [],
          pagination: { total: 0, page: 1, limit: 10, totalPages: 0 },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          success: true,
          data: [
            {
              id: 'user-1',
              fullName: 'Ana Admin',
              email: 'ana@nexoerp.com',
              role: 'ADMIN',
              isActive: true,
              lastLoginAt: null,
              createdAt: '2026-03-20T00:00:00.000Z',
            },
          ],
          pagination: { total: 1, page: 1, limit: 10, totalPages: 1 },
        }),
      );

    render(<UsersPage />);

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    fireEvent.change(screen.getByLabelText('Buscar usuarios'), {
      target: { value: 'ana' },
    });

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    const [searchUrl] = fetchSpy.mock.calls[1] as [string, RequestInit];
    expect(searchUrl).toContain('search=ana');
    expect(searchUrl).toContain('page=1');
  });
});
