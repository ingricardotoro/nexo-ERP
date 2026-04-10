// src/app/api/v1/core/tenant/route.ts
// API Route: GET /api/v1/core/tenant (empresa activa)
//            PATCH /api/v1/core/tenant (actualizar datos de la empresa — solo ADMIN)

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/db/prisma';
import { getAuthContextFromHeaders } from '@/lib/auth/request-auth';
import { checkPermission } from '@/lib/permissions/check-permission';
import { handleApiError } from '@/lib/api/handle-error';

const updateTenantSchema = z.object({
  tradeName: z.string().max(200).optional(),
  email: z.string().email().max(254).optional().nullable(),
  phone: z.string().max(30).optional().nullable(),
  website: z.string().max(300).optional().nullable(),
  address: z.string().max(300).optional().nullable(),
  city: z.string().max(100).optional().nullable(),
  department: z.string().max(100).optional().nullable(),
});

/**
 * GET /api/v1/core/tenant
 * Obtener informaciÃ³n bÃ¡sica del tenant (empresa activa).
 */
export async function GET(request: NextRequest) {
  try {
    const auth = getAuthContextFromHeaders(request);

    const company = await prisma.company.findUnique({
      where: { id: auth.companyId },
      select: {
        id: true,
        legalName: true,
        tradeName: true,
        rtn: true,
        maxUsers: true,
        isActive: true,
      },
    });

    if (!company || !company.isActive) {
      return NextResponse.json(
        {
          success: false,
          error: 'Empresa no encontrada o inactiva',
        },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        tenant: company,
        session: {
          userId: auth.userId,
          email: auth.email ?? null,
          fullName: auth.fullName ?? null,
          role: auth.role ?? null,
        },
      },
    });
  } catch (error) {
    return handleApiError(error, 'GET /api/v1/core/tenant');
  }
}

/**
 * PATCH /api/v1/core/tenant
 * Actualiza datos de contacto y comerciales de la empresa.
 * Campos fiscales (legalName, RTN) son inmutables desde aquí.
 * Requiere permiso core.user.update (ADMIN únicamente).
 */
export async function PATCH(request: NextRequest) {
  try {
    const auth = getAuthContextFromHeaders(request);
    await checkPermission(auth, 'core.user.update');

    const body = await request.json();
    const input = updateTenantSchema.parse(body);

    const updated = await prisma.company.update({
      where: { id: auth.companyId },
      data: input,
      select: {
        id: true,
        legalName: true,
        tradeName: true,
        rtn: true,
        email: true,
        phone: true,
        website: true,
        address: true,
        city: true,
        department: true,
        baseCurrency: true,
        maxUsers: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: updated,
      message: 'Empresa actualizada',
    });
  } catch (error) {
    return handleApiError(error, 'PATCH /api/v1/core/tenant');
  }
}
