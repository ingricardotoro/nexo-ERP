import { defineFunction } from '@aws-amplify/backend';

/**
 * Lambda Function Resource — Alertas de Vencimiento de CAI (F5-E)
 *
 * Triggered by EventBridge Scheduler — se ejecuta diariamente a las 08:00 AM UTC.
 * Consulta todos los CAI activos de todas las empresas y envía alertas
 * cuando quedan ≤30 días para el vencimiento.
 *
 * Alertas:
 *   - 30 días: aviso temprano
 *   - 14 días: alerta urgente
 *   -  7 días: alerta crítica
 *   -  0 días: CAI vencido hoy — auto-desactivar
 *
 * Memory: 256 MB (Prisma Client + pg query)
 * Timeout: 60 seg
 */
export const checkCaiAlerts = defineFunction({
  name: 'check-cai-alerts',
  entry: './handler.ts',
  runtime: 20,
  timeoutSeconds: 60,
  memoryMB: 256,
  environment: {
    DATABASE_URL: process.env.DATABASE_URL ?? '',
    AWS_REGION_TARGET: process.env.AWS_REGION ?? 'us-east-1',
  },
});
