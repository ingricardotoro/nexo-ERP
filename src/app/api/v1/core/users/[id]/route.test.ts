import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { DELETE, GET, PUT } from './route';
import { getAuthContextFromHeaders } from '@/lib/auth/request-auth';
import { userService } from '@/lib/services/core/user.service';

vi.mock('@/lib/auth/request-auth', () => ({
  getAuthContextFromHeaders: vi.fn(),
}));

vi.mock('@/lib/services/core/user.service', () => ({
  userService: {
    getUserById: vi.fn(),
    updateUser: vi.fn(),
    deleteUser: vi.fn(),
  },
}));

const mockedAuth = vi.mocked(getAuthContextFromHeaders);
const mockedUserService = vi.mocked(userService);

const params = Promise.resolve({ id: 'user-1' });

describe('GET /api/v1/core/users/:id', () => {
  beforeEach(() => {
    mockedAuth.mockReturnValue({
      userId: 'user-1',
      companyId: 'company-1',
      tokenUse: 'id',
      claims: {},
    });
  });

  it('retorna un usuario', async () => {
    mockedUserService.getUserById.mockResolvedValue({
      id: 'user-1',
      fullName: 'Admin',
      email: 'admin@nexoerp.com',
      role: 'ADMIN',
      isActive: true,
      cognitoSub: 'user-1',
      lastLoginAt: null,
      createdAt: new Date('2026-03-01T10:00:00Z'),
      updatedAt: new Date('2026-03-01T10:00:00Z'),
    });

    const request = new NextRequest('http://localhost/api/v1/core/users/user-1');
    const response = await GET(request, { params });

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.success).toBe(true);
    expect(payload.data.id).toBe('user-1');
  });
});

describe('PUT /api/v1/core/users/:id', () => {
  beforeEach(() => {
    mockedAuth.mockReturnValue({
      userId: 'user-1',
      companyId: 'company-1',
      tokenUse: 'id',
      claims: {},
    });
  });

  it('actualiza un usuario', async () => {
    mockedUserService.updateUser.mockResolvedValue({
      id: 'user-1',
      fullName: 'Admin Nuevo',
      email: 'admin@nexoerp.com',
      role: 'ADMIN',
      isActive: true,
      updatedAt: new Date('2026-03-01T12:00:00Z'),
    });

    const request = new NextRequest('http://localhost/api/v1/core/users/user-1', {
      method: 'PUT',
      body: JSON.stringify({ fullName: 'Admin Nuevo' }),
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const response = await PUT(request, { params });
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.success).toBe(true);
    expect(payload.data.fullName).toBe('Admin Nuevo');
  });
});

describe('DELETE /api/v1/core/users/:id', () => {
  beforeEach(() => {
    mockedAuth.mockReturnValue({
      userId: 'user-1',
      companyId: 'company-1',
      tokenUse: 'id',
      claims: {},
    });
  });

  it('soft delete devuelve success', async () => {
    mockedUserService.deleteUser.mockResolvedValue({ success: true });

    const request = new NextRequest('http://localhost/api/v1/core/users/user-1', {
      method: 'DELETE',
    });

    const response = await DELETE(request, { params });
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.success).toBe(true);
  });
});
