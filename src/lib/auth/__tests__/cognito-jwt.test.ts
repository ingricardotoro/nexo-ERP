import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { extractTokenFromRequest } from '@/lib/auth/cognito-jwt';

describe('cognito-jwt helpers', () => {
  it('deberia extraer token desde Authorization Bearer', () => {
    const request = new NextRequest('http://localhost:3000/api/v1/core/users', {
      headers: {
        authorization: 'Bearer fake.jwt.token',
      },
    });

    const token = extractTokenFromRequest(request);
    expect(token).toBe('fake.jwt.token');
  });

  it('deberia extraer token desde cookie token', () => {
    const request = new NextRequest('http://localhost:3000/api/v1/core/users', {
      headers: {
        cookie: 'token=fake.cookie.token',
      },
    });

    const token = extractTokenFromRequest(request);
    expect(token).toBe('fake.cookie.token');
  });

  it('deberia retornar null cuando no hay token', () => {
    const request = new NextRequest('http://localhost:3000/api/v1/core/users');

    const token = extractTokenFromRequest(request);
    expect(token).toBeNull();
  });
});
