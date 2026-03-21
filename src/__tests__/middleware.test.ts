import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthError } from '@/types/auth';

const { extractTokenFromRequestMock, verifyCognitoJwtMock } = vi.hoisted(() => ({
  extractTokenFromRequestMock: vi.fn(),
  verifyCognitoJwtMock: vi.fn(),
}));

vi.mock('@/lib/auth/cognito-jwt', () => ({
  extractTokenFromRequest: extractTokenFromRequestMock,
  verifyCognitoJwt: verifyCognitoJwtMock,
}));

import { middleware } from '@/middleware';

function buildRequest(path = '/api/v1/core/users', method = 'GET') {
  return new NextRequest(`http://localhost:3000${path}`, { method });
}

describe('middleware auth', () => {
  beforeEach(() => {
    extractTokenFromRequestMock.mockReset();
    verifyCognitoJwtMock.mockReset();
  });

  it('omite autenticacion para requests OPTIONS', async () => {
    const response = await middleware(buildRequest('/api/v1/core/users', 'OPTIONS'));

    expect(response.status).toBe(200);
    expect(extractTokenFromRequestMock).not.toHaveBeenCalled();
    expect(verifyCognitoJwtMock).not.toHaveBeenCalled();
  });

  it('retorna 401 cuando falta token', async () => {
    extractTokenFromRequestMock.mockReturnValue(null);

    const response = await middleware(buildRequest());
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.code).toBe('MISSING_TOKEN');
  });

  it('propaga status y codigo cuando verifyCognitoJwt lanza AuthError', async () => {
    extractTokenFromRequestMock.mockReturnValue('bad.jwt.token');
    verifyCognitoJwtMock.mockRejectedValue(
      new AuthError('Token expirado o invalido', 401, 'TOKEN_EXPIRED'),
    );

    const response = await middleware(buildRequest());
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.code).toBe('TOKEN_EXPIRED');
  });

  it('inyecta contexto de tenant y usuario en headers de request', async () => {
    extractTokenFromRequestMock.mockReturnValue('valid.jwt.token');
    verifyCognitoJwtMock.mockResolvedValue({
      userId: 'user-sub-123',
      email: 'admin@nexoerp.com',
      companyId: '00000000-0000-0000-0000-000000000001',
      role: 'ADMIN',
      fullName: 'Admin NexoERP',
      tokenUse: 'id',
      claims: {},
    });

    const response = await middleware(buildRequest());
    const overriddenHeaders = response.headers.get('x-middleware-override-headers') ?? '';

    expect(response.status).toBe(200);
    expect(response.headers.get('x-middleware-request-x-company-id')).toBe(
      '00000000-0000-0000-0000-000000000001',
    );
    expect(response.headers.get('x-middleware-request-x-user-id')).toBe('user-sub-123');
    expect(response.headers.get('x-middleware-request-x-user-role')).toBe('ADMIN');
    expect(response.headers.get('x-middleware-request-x-authenticated')).toBe('true');
    expect(overriddenHeaders).toContain('x-company-id');
    expect(overriddenHeaders).toContain('x-user-id');
    expect(overriddenHeaders).toContain('x-authenticated');
  });
});
