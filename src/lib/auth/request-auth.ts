import type { NextRequest } from 'next/server';
import type { AuthContext } from '@/types/auth';
import { AuthError } from '@/types/auth';

export function getAuthContextFromHeaders(request: NextRequest): AuthContext {
  const companyId = request.headers.get('x-company-id');
  const userId = request.headers.get('x-user-id');
  const role = request.headers.get('x-user-role') ?? undefined;
  const email = request.headers.get('x-user-email') ?? undefined;
  const fullName = request.headers.get('x-user-fullname') ?? undefined;

  if (!companyId || !userId) {
    throw new AuthError(
      'Contexto de autenticación ausente. Verifica middleware y token JWT.',
      401,
      'AUTH_CONTEXT_MISSING',
    );
  }

  return {
    userId,
    email,
    companyId,
    role: role as AuthContext['role'],
    fullName,
    tokenUse: 'id',
    claims: {},
  };
}
