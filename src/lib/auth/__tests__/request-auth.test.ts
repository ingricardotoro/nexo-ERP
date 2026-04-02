import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { getAuthContextFromHeaders } from '@/lib/auth/request-auth';

function buildRequest(headers: Record<string, string>) {
  return new NextRequest('http://localhost:3000/api/v1/core/users', {
    headers,
  });
}

describe('request-auth', () => {
  it('deberia extraer contexto auth desde headers inyectados por middleware', () => {
    const request = buildRequest({
      'x-company-id': '00000000-0000-0000-0000-000000000001',
      'x-user-id': 'user-sub-123',
      'x-user-role': 'ADMIN',
      'x-user-email': 'admin@nexoerp.com',
      'x-user-fullname': 'Admin NexoERP',
    });

    const auth = getAuthContextFromHeaders(request);

    expect(auth.companyId).toBe('00000000-0000-0000-0000-000000000001');
    expect(auth.userId).toBe('user-sub-123');
    expect(auth.role).toBe('ADMIN');
    expect(auth.email).toBe('admin@nexoerp.com');
    expect(auth.fullName).toBe('Admin NexoERP');
  });

  it('deberia fallar si faltan headers criticos', () => {
    const request = buildRequest({
      'x-user-id': 'user-sub-123',
    });

    expect(() => getAuthContextFromHeaders(request)).toThrow(
      'Contexto de autenticación ausente. Verifica middleware y token JWT.',
    );
  });
});
