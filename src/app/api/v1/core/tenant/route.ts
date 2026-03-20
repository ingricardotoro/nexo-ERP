// src/app/api/v1/core/tenant/route.ts
// API Route: GET /api/v1/core/tenant (empresa activa)

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { getAuthContextFromHeaders } from '@/lib/auth/request-auth';

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
      data: company,
    });
  } catch (error) {
    console.error('Error al obtener tenant:', error);

    if (error instanceof Error) {
      return NextResponse.json(
        {
          success: false,
          error: error.message,
        },
        { status: 400 },
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Error interno del servidor',
      },
      { status: 500 },
    );
  }
}
