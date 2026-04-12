/**
 * GET /api/v1/health — Health Check Endpoint (F6-01)
 *
 * Verifica la conectividad con la base de datos vía RDS Proxy.
 * Usado por:
 * - CloudWatch Synthetics / Route 53 health checks
 * - Load balancers para determinar si la instancia está lista
 * - Alertas de disponibilidad en el dashboard de operaciones
 *
 * Respuesta 200: sistema operativo
 * Respuesta 503: base de datos no disponible
 *
 * NO requiere autenticación — este endpoint es público intencionalmente.
 * No expone datos de negocio ni información sensible del sistema.
 */

import { NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';

export async function GET() {
  const start = Date.now();

  try {
    // Verificar conectividad con la BD — query mínima sin tocar datos de negocio
    await prisma.$queryRaw`SELECT 1`;

    const durationMs = Date.now() - start;

    return NextResponse.json(
      {
        status: 'ok',
        db: 'connected',
        durationMs,
        timestamp: new Date().toISOString(),
      },
      { status: 200 },
    );
  } catch (error) {
    const durationMs = Date.now() - start;
    const message = error instanceof Error ? error.message : 'Unknown error';

    console.error('[health] DB connectivity check failed', { durationMs, error: message });

    return NextResponse.json(
      {
        status: 'error',
        db: 'disconnected',
        durationMs,
        timestamp: new Date().toISOString(),
        // Temporal para debugging en staging — remover antes de producción
        debug: process.env.NEXT_PUBLIC_APP_ENV === 'staging' ? message : undefined,
      },
      { status: 503 },
    );
  }
}
