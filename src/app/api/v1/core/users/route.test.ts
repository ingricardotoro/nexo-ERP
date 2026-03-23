import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, POST } from './route';
import { getAuthContextFromHeaders } from '@/lib/auth/request-auth';
import { userService } from '@/lib/services/core/user.service';

vi.mock('@/lib/auth/request-auth', () => ({
  getAuthContextFromHeaders: vi.fn(),
}));

vi.mock('@/lib/services/core/user.service', () => ({
  userService: {
    listUsers: vi.fn(),
    createUser: vi.fn(),
  },
}));

const mockedAuth = vi.mocked(getAuthContextFromHeaders);
const mockedUserService = vi.mocked(userService);

describe('GET /api/v1/core/users', () => {
  beforeEach(() => {
    mockedAuth.mockReturnValue({
      userId: 'user-1',
      companyId: 'company-1',
      tokenUse: 'id',
      claims: {},
    });
  });

  it('retorna lista de usuarios con paginaciÃ³n', async () => {
    mockedUserService.listUsers.mockResolvedValue({
      users: [
        {
          id: 'user-1',
          fullName: 'Admin',
          email: 'admin@nexoerp.com',
          role: 'ADMIN',
          isActive: true,
          cognitoSub: 'user-1',
          lastLoginAt: null,
          createdAt: new Date('2026-03-01T10:00:00Z'),
          updatedAt: new Date('2026-03-01T10:00:00Z'),
        },
      ],
      pagination: {
        total: 1,
        page: 1,
        limit: 10,
        totalPages: 1,
      },
    });

    const request = new NextRequest('http://localhost/api/v1/core/users');
    const response = await GET(request);

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.success).toBe(true);
    expect(payload.data).toHaveLength(1);
    expect(payload.pagination.total).toBe(1);
  });

  it('retorna error si falla el servicio', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockedUserService.listUsers.mockRejectedValue(new Error('boom'));

    const request = new NextRequest('http://localhost/api/v1/core/users');
    const response = await GET(request);

    expect(response.status).toBe(400);
    const payload = await response.json();
    expect(payload.success).toBe(false);
    expect(payload.error).toBe('boom');

    consoleSpy.mockRestore();
  });
});

describe('POST /api/v1/core/users', () => {
  beforeEach(() => {
    mockedAuth.mockReturnValue({
      userId: 'user-1',
      companyId: 'company-1',
      tokenUse: 'id',
      claims: {},
    });
  });

  it('crea un usuario y retorna 201', async () => {
    mockedUserService.createUser.mockResolvedValue({
      id: 'user-2',
      fullName: 'Nuevo',
      email: 'nuevo@nexoerp.com',
      role: 'MANAGER',
      isActive: true,
      createdAt: new Date('2026-03-01T10:00:00Z'),
    });

    const request = new NextRequest('http://localhost/api/v1/core/users', {
      method: 'POST',
      body: JSON.stringify({
        fullName: 'Nuevo',
        email: 'nuevo@nexoerp.com',
        role: 'MANAGER',
        isActive: true,
      }),
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const response = await POST(request);
    expect(response.status).toBe(201);
    const payload = await response.json();
    expect(payload.success).toBe(true);
    expect(payload.data.email).toBe('nuevo@nexoerp.com');
  });
});
