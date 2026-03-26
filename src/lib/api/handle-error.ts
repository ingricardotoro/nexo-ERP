import { NextResponse } from 'next/server';
import { ZodError } from 'zod';

const NOT_FOUND_MESSAGES = [
  'Contacto no encontrado',
  'Dirección no encontrada',
  'Persona de contacto no encontrada',
  'Términos de pago no encontrados',
  'Usuario no encontrado',
  'Empresa no encontrada',
];

export function handleApiError(error: unknown, context: string) {
  console.error(`Error en ${context}:`, error);

  if (error instanceof ZodError) {
    return NextResponse.json(
      { success: false, error: 'Datos inválidos', details: error.flatten().fieldErrors },
      { status: 422 },
    );
  }

  if (error instanceof Error) {
    const status = NOT_FOUND_MESSAGES.includes(error.message) ? 404 : 400;
    return NextResponse.json({ success: false, error: error.message }, { status });
  }

  return NextResponse.json(
    { success: false, error: 'Error interno del servidor' },
    { status: 500 },
  );
}
