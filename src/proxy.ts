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

function buildLoginRedirect(request: NextRequest): NextResponse {
  const loginUrl = new URL('/login', request.url);
  loginUrl.searchParams.set('from', request.nextUrl.pathname);
  return NextResponse.redirect(loginUrl);
}

function buildAccountErrorRedirect(request: NextRequest): NextResponse {
  const loginUrl = new URL('/login', request.url);
  loginUrl.searchParams.set('error', 'account_not_configured');
  return NextResponse.redirect(loginUrl);
}

export async function proxy(request: NextRequest) {
  if (request.method === 'OPTIONS') {
    return NextResponse.next();
  }

  // Las rutas /dashboard/** redirigen al login cuando no hay token
  // Las rutas /api/v1/** devuelven 401 JSON (son llamadas desde código, no navegación del browser)
  const isDashboardRoute = request.nextUrl.pathname.startsWith('/dashboard');

  // Bypass de autenticación solo en desarrollo para pruebas de UI (nunca en producción)
  if (process.env.BYPASS_AUTH_DEV === 'true' && process.env.NODE_ENV === 'development') {
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-company-id', process.env.DEV_COMPANY_ID ?? '');
    requestHeaders.set('x-user-id', process.env.DEV_USER_ID ?? 'dev-user');
    requestHeaders.set('x-user-role', process.env.DEV_USER_ROLE ?? 'ADMIN');
    requestHeaders.set('x-user-email', 'dev@nexoerp.com');
    requestHeaders.set('x-authenticated', 'true');
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  const token = extractTokenFromRequest(request);

  if (!token) {
    if (isDashboardRoute) return buildLoginRedirect(request);
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
    if (isDashboardRoute) {
      if (
        error instanceof AuthError &&
        (error.code === 'INVALID_TOKEN' || error.code === 'INVALID_TOKEN_USE')
      ) {
        return buildAccountErrorRedirect(request);
      }
      return buildLoginRedirect(request);
    }

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
  matcher: [
    // Proteger todas las rutas API v1 excepto el health check (endpoint público)
    '/api/v1/((?!health$).*)',
    '/dashboard/:path*',
  ],
};
