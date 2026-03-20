import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from './route';
import { getAuthContextFromHeaders } from '@/lib/auth/request-auth';
import prisma from '@/lib/db/prisma';

vi.mock('@/lib/auth/request-auth', () => ({
  getAuthContextFromHeaders: vi.fn(),
}));

vi.mock('@/lib/db/prisma', () => ({
  default: {
    company: {
      findUnique: vi.fn(),
    },
  },
}));

const mockedAuth = vi.mocked(getAuthContextFromHeaders);
const mockedPrisma = vi.mocked(prisma);

describe('GET /api/v1/core/tenant', () => {
  beforeEach(() => {
    mockedAuth.mockReturnValue({
      userId: 'user-1',
      companyId: 'company-1',
      tokenUse: 'id',
      claims: {},
    });
  });

  it('retorna informaciÃ³n del tenant', async () => {
    mockedPrisma.company.findUnique.mockResolvedValue({
      id: 'company-1',
      legalName: 'NexoERP S.A.',
      tradeName: 'NexoERP',
      rtn: '08011999123456',
      maxUsers: 5,
      isActive: true,
    });

    const request = new NextRequest('http://localhost/api/v1/core/tenant');
    const response = await GET(request);

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.success).toBe(true);
    expect(payload.data.id).toBe('company-1');
  });

  it('retorna 404 si la empresa estÃ¡ inactiva', async () => {
    mockedPrisma.company.findUnique.mockResolvedValue({
      id: 'company-1',
      legalName: 'NexoERP S.A.',
      tradeName: 'NexoERP',
      rtn: '08011999123456',
      maxUsers: 5,
      isActive: false,
    });

    const request = new NextRequest('http://localhost/api/v1/core/tenant');
    const response = await GET(request);

    expect(response.status).toBe(404);
    const payload = await response.json();
    expect(payload.success).toBe(false);
  });
});
