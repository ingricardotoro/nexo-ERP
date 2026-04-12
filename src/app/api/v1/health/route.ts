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

    // Mask DATABASE_URL for safe logging: show only host portion
    const rawUrl = process.env.DATABASE_URL ?? process.env.DATABASE_URL_APP ?? '';
    const dbUrlHint = rawUrl ? rawUrl.replace(/:\/\/[^@]+@/, '://***@').slice(0, 80) : '(not set)';

    console.error('[health] DB connectivity check failed', {
      durationMs,
      error: message,
      dbUrlHint,
    });

    return NextResponse.json(
      {
        status: 'error',
        db: 'disconnected',
        durationMs,
        timestamp: new Date().toISOString(),
        // Temporal para debugging en staging — remover antes de ir a producción real
        debug: message,
        dbUrlHint,
        // Listar qué env vars relacionadas con DB/URL existen (solo keys, no valores)
        envKeysPresent: Object.keys(process.env).filter((k) =>
          /DATABASE|DIRECT_URL|POSTGRES|PG_/.test(k),
        ),
      },
      { status: 503 },
    );
  }
}
