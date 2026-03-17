// src/app/api/v1/core/users/[id]/route.ts
// API Route: GET/PUT/DELETE /api/v1/core/users/:id

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { userService } from '@/lib/services/core/user.service';

/**
 * GET /api/v1/core/users/:id
 * Obtener detalles de un usuario específico.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const companyId = request.headers.get('x-company-id') || 'mock-company-id';

    const user = await userService.getUserById(id, companyId);

    return NextResponse.json({
      success: true,
      data: user,
    });
  } catch (error) {
    console.error('Error al obtener usuario:', error);

    if (error instanceof Error) {
      return NextResponse.json(
        {
          success: false,
          error: error.message,
        },
        { status: error.message === 'Usuario no encontrado' ? 404 : 400 },
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
 * PUT /api/v1/core/users/:id
 * Actualizar un usuario existente.
 */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const companyId = request.headers.get('x-company-id') || 'mock-company-id';

    const body = await request.json();

    const user = await userService.updateUser(id, companyId, body);

    return NextResponse.json({
      success: true,
      data: user,
      message: 'Usuario actualizado exitosamente',
    });
  } catch (error) {
    console.error('Error al actualizar usuario:', error);

    if (error instanceof Error) {
      return NextResponse.json(
        {
          success: false,
          error: error.message,
        },
        { status: error.message === 'Usuario no encontrado' ? 404 : 400 },
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
 * DELETE /api/v1/core/users/:id
 * Eliminar un usuario (soft delete).
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const companyId = request.headers.get('x-company-id') || 'mock-company-id';

    await userService.deleteUser(id, companyId);

    return NextResponse.json({
      success: true,
      message: 'Usuario eliminado exitosamente',
    });
  } catch (error) {
    console.error('Error al eliminar usuario:', error);

    if (error instanceof Error) {
      return NextResponse.json(
        {
          success: false,
          error: error.message,
        },
        { status: error.message === 'Usuario no encontrado' ? 404 : 400 },
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
