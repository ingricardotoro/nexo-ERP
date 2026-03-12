/**
 * Health Check Endpoint para NexoERP
 * @route GET /api/health
 *
 * Verifica el estado de funcionamiento de la aplicación y sus dependencias.
 * Usado por:
 * - AWS Amplify health checks
 * - Monitoreo (Sentry, CloudWatch, etc.)
 * - Scripts de verificación internos
 *
 * Respuesta:
 * - 200 OK: Aplicación y DB funcionando correctamente
 * - 503 Service Unavailable: DB no disponible o error crítico
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

/**
 * Forzar dynamic rendering (no cachear el health check)
 */
export const dynamic = 'force-dynamic';

/**
 * Endpoint GET /api/health
 * Verifica la conexión a PostgreSQL y retorna el estado del sistema
 */
export async function GET() {
  const startTime = Date.now();

  try {
    // Verificar conexión a PostgreSQL con un query simple
    await prisma.$queryRaw`SELECT 1 AS health_check`;
    const dbLatency = Date.now() - startTime;

    return NextResponse.json(
      {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        environment: process.env.NEXT_PUBLIC_APP_ENV || 'unknown',
        version: process.env.npm_package_version || '0.0.0',
        uptime: process.uptime(),
        checks: {
          database: {
            status: 'connected',
            latency: `${dbLatency}ms`,
          },
        },
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      },
    );
  } catch (error) {
    const dbLatency = Date.now() - startTime;

    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        environment: process.env.NEXT_PUBLIC_APP_ENV || 'unknown',
        checks: {
          database: {
            status: 'disconnected',
            latency: `${dbLatency}ms`,
            error: error instanceof Error ? error.message : 'Unknown database error',
          },
        },
      },
      {
        status: 503,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      },
    );
  }
}
