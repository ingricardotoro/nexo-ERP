import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { extractTokenFromRequest, verifyCognitoJwt } from '@/lib/auth/cognito-jwt';
import { AuthError } from '@/types/auth';

function buildUnauthorizedResponse(message: string, code: string) {
  return NextResponse.json(
    {
      success: false,
      error: message,
      code,
    },
    { status: 401 },
  );
}

export async function middleware(request: NextRequest) {
  if (request.method === 'OPTIONS') {
    return NextResponse.next();
  }

  const token = extractTokenFromRequest(request);

  if (!token) {
    return buildUnauthorizedResponse('Token JWT no proporcionado', 'MISSING_TOKEN');
  }

  try {
    const auth = await verifyCognitoJwt(token);

    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-company-id', auth.companyId);
    requestHeaders.set('x-user-id', auth.userId);

    if (auth.role) requestHeaders.set('x-user-role', auth.role);
    if (auth.email) requestHeaders.set('x-user-email', auth.email);
    if (auth.fullName) requestHeaders.set('x-user-fullname', auth.fullName);
    requestHeaders.set('x-authenticated', 'true');

    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        {
          success: false,
          error: error.message,
          code: error.code,
        },
        { status: error.status },
      );
    }

    return buildUnauthorizedResponse('Error inesperado validando autenticacion', 'AUTH_UNEXPECTED');
  }
}

export const config = {
  matcher: ['/api/v1/:path*', '/dashboard/:path*'],
};
