import type { NextRequest } from 'next/server';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { z } from 'zod';
import { env } from '@/lib/env';
import type { AuthContext, UserRole } from '@/types/auth';
import { AuthError } from '@/types/auth';

const cognitoConfig = {
  region: env.AWS_REGION,
  userPoolId: env.COGNITO_USER_POOL_ID,
  clientId: env.COGNITO_USER_POOL_CLIENT_ID,
};

const issuer = `https://cognito-idp.${cognitoConfig.region}.amazonaws.com/${cognitoConfig.userPoolId}`;
const jwks = createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`));

const cognitoClaimsSchema = z
  .object({
    sub: z.string().min(1),
    iss: z.string().min(1),
    token_use: z.enum(['id', 'access']),
    email: z.string().email().optional(),
    aud: z.union([z.string(), z.array(z.string())]).optional(),
    client_id: z.string().optional(),
    'custom:company_id': z.string().uuid(),
    'custom:role': z.string().optional(),
    'custom:fullname': z.string().optional(),
  })
  .passthrough();

function normalizeRole(value?: string): UserRole | undefined {
  if (!value) return undefined;

  const role = value.trim();
  if (!role) return undefined;

  return role as UserRole;
}

export function extractTokenFromRequest(request: NextRequest): string | null {
  const authorization = request.headers.get('authorization');
  if (authorization?.startsWith('Bearer ')) {
    return authorization.slice('Bearer '.length).trim();
  }

  const candidateCookieNames = [
    'token',
    'idToken',
    'accessToken',
    'amplify-id-token',
    'amplify-access-token',
  ];

  for (const cookieName of candidateCookieNames) {
    const cookieValue = request.cookies.get(cookieName)?.value;
    if (cookieValue) return cookieValue;
  }

  const allCookies = request.cookies.getAll();
  const cognitoIdToken = allCookies.find((cookie) => /idtoken/i.test(cookie.name));
  return cognitoIdToken?.value ?? null;
}

export async function verifyCognitoJwt(token: string): Promise<AuthContext> {
  try {
    const { payload } = await jwtVerify(token, jwks, {
      issuer,
      audience: cognitoConfig.clientId,
    });

    const parsed = cognitoClaimsSchema.safeParse(payload);
    if (!parsed.success) {
      throw new AuthError('Token inválido: claims incompletos o malformados', 401, 'INVALID_TOKEN');
    }

    const claims = parsed.data;

    if (claims.token_use !== 'id') {
      throw new AuthError(
        'Token inválido: se requiere ID token de Cognito',
        401,
        'INVALID_TOKEN_USE',
      );
    }

    return {
      userId: claims.sub,
      email: claims.email,
      companyId: claims['custom:company_id'],
      role: normalizeRole(claims['custom:role']),
      fullName: claims['custom:fullname'],
      tokenUse: claims.token_use,
      claims,
    };
  } catch (error) {
    if (error instanceof AuthError) {
      throw error;
    }

    throw new AuthError(
      'No se pudo verificar el token JWT de Cognito',
      401,
      'TOKEN_VERIFICATION_FAILED',
    );
  }
}
