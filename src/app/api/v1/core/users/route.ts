// src/app/api/v1/core/users/route.ts
// API Route: GET /api/v1/core/users (listar) y POST /api/v1/core/users (crear)

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getAuthContextFromHeaders } from '@/lib/auth/request-auth';
import { userService } from '@/lib/services/core/user.service';
import { userFiltersSchema } from '@/lib/validations/user.schema';

/**
 * GET /api/v1/core/users
 * Listar usuarios de la empresa con filtros y paginación.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = getAuthContextFromHeaders(request);

    // Parsear query params
    const searchParams = request.nextUrl.searchParams;
    const rawFilters = {
      search: searchParams.get('search') || undefined,
      role: searchParams.get('role') || undefined,
      isActive: searchParams.get('isActive') || undefined,
      page: searchParams.get('page') || '1',
      limit: searchParams.get('limit') || '10',
      orderBy: searchParams.get('orderBy') || 'createdAt',
      orderDir: searchParams.get('orderDir') || 'desc',
    };

    // Validar filtros con Zod
    const filters = userFiltersSchema.parse(rawFilters);

    // Ejecutar consulta
    const result = await userService.listUsers(auth.companyId, filters);

    return NextResponse.json({
      success: true,
      data: result.users,
      pagination: result.pagination,
    });
  } catch (error) {
    console.error('Error al listar usuarios:', error);

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

/**
 * POST /api/v1/core/users
 * Crear un nuevo usuario.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = getAuthContextFromHeaders(request);

    // Parsear body
    const body = await request.json();

    // Crear usuario
    const user = await userService.createUser(auth.companyId, body);

    return NextResponse.json(
      {
        success: true,
        data: user,
        message: 'Usuario creado exitosamente',
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('Error al crear usuario:', error);

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
