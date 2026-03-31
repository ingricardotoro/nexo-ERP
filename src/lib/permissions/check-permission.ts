// src/lib/permissions/check-permission.ts
//
// RBAC — Verificación de permisos granulares contra la BD.
//
// Uso en route handlers:
//   await checkPermission(auth, 'accounting.journal_entry.post');
//
// La consulta busca en role_permissions un registro (role, permissionId).
// Índice UNIQUE garantiza O(1) por (role, permissionId).
//
import type { NextRequest } from 'next/server';
import type { NextResponse } from 'next/server';
import type { SystemRole } from '@prisma/client';
import type { AuthContext } from '@/types/auth';
import basePrisma from '@/lib/db/prisma';
import { getAuthContextFromHeaders } from '@/lib/auth/request-auth';
import { handleApiError } from '@/lib/api/handle-error';

// ─── Error ────────────────────────────────────────────────────────────────────

export class ForbiddenError extends Error {
  readonly statusCode = 403;
  readonly code = 'FORBIDDEN';

  constructor(permission: string) {
    super(`Permiso requerido: ${permission}`);
    this.name = 'ForbiddenError';
  }
}

// ─── Core check ──────────────────────────────────────────────────────────────

/**
 * Verifica que el rol del usuario tenga el permiso solicitado.
 * Lanza ForbiddenError (403) si no está autorizado.
 * Si auth.role es undefined lanza ForbiddenError también.
 */
export async function checkPermission(auth: AuthContext, permissionId: string): Promise<void> {
  if (!auth.role) {
    throw new ForbiddenError(permissionId);
  }

  const granted = await basePrisma.rolePermission.findFirst({
    where: {
      role: auth.role as SystemRole,
      permissionId,
    },
    select: { role: true },
  });

  if (!granted) {
    throw new ForbiddenError(permissionId);
  }
}

// ─── Route wrapper ────────────────────────────────────────────────────────────

type RouteHandler<TParams = Record<string, string>> = (
  request: NextRequest,
  context: { params: Promise<TParams> },
  auth: AuthContext,
) => Promise<NextResponse>;

type SimpleRouteHandler = (request: NextRequest, auth: AuthContext) => Promise<NextResponse>;

/**
 * Wrapper para route handlers sin params dinámicos.
 * Extrae auth, verifica permiso y llama al handler.
 *
 * Uso:
 *   export const GET = requirePermission('accounting.journal.read',
 *     async (req, auth) => { ... }
 *   );
 */
export function requirePermission(permissionId: string, handler: SimpleRouteHandler) {
  return async (request: NextRequest): Promise<NextResponse> => {
    try {
      const auth = getAuthContextFromHeaders(request);
      await checkPermission(auth, permissionId);
      return await handler(request, auth);
    } catch (error) {
      return handleApiError(error, `requirePermission(${permissionId})`);
    }
  };
}

/**
 * Wrapper para route handlers con params dinámicos (e.g. [id]).
 *
 * Uso:
 *   export const POST = requirePermissionWithParams<{ id: string }>(
 *     'accounting.journal_entry.post',
 *     async (req, { params }, auth) => { ... }
 *   );
 */
export function requirePermissionWithParams<TParams = Record<string, string>>(
  permissionId: string,
  handler: RouteHandler<TParams>,
) {
  return async (
    request: NextRequest,
    context: { params: Promise<TParams> },
  ): Promise<NextResponse> => {
    try {
      const auth = getAuthContextFromHeaders(request);
      await checkPermission(auth, permissionId);
      return await handler(request, context, auth);
    } catch (error) {
      return handleApiError(error, `requirePermission(${permissionId})`);
    }
  };
}
