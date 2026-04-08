/**
 * Lambda — Alertas de Vencimiento de CAI (F5-E)
 *
 * Triggered diariamente por EventBridge Scheduler (08:00 UTC).
 * Consulta todos los CAI activos y:
 *   1. Loga una alerta si vence en ≤30 días (visible en CloudWatch / SNS futuro)
 *   2. Auto-desactiva (isActive=false) los CAI vencidos hoy
 *
 * Actualmente las alertas se escriben en CloudWatch Logs con structured logging.
 * En una fase futura se puede conectar SNS o SES para envío de emails.
 *
 * SAR Honduras: el CAI es el único documento que autoriza la emisión de facturas.
 * Vencer sin renovar significa incapacidad de facturar → impacto fiscal crítico.
 */

import type { ScheduledHandler } from 'aws-lambda';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({ datasourceUrl: process.env.DATABASE_URL });

const ALERT_THRESHOLDS_DAYS = [30, 14, 7] as const;

export const handler: ScheduledHandler = async () => {
  const now = new Date();
  const todayMs = now.getTime();

  console.info('[CAI-ALERTS] Starting daily CAI expiry check', {
    timestamp: now.toISOString(),
  });

  // Fetch all active CAIs across all companies (no RLS — Lambda runs as admin)
  const activeCais = await prisma.cAI.findMany({
    where: { isActive: true },
    include: {
      company: { select: { legalName: true, rtn: true, id: true } },
    },
    orderBy: { expiresAt: 'asc' },
  });

  console.info(`[CAI-ALERTS] Found ${activeCais.length} active CAIs to check`);

  let alertCount = 0;
  let expiredCount = 0;

  for (const cai of activeCais) {
    const expiresMs = new Date(cai.expiresAt).getTime();
    const daysUntilExpiry = Math.ceil((expiresMs - todayMs) / (1000 * 60 * 60 * 24));

    if (daysUntilExpiry <= 0) {
      // CAI expired — auto-deactivate
      await prisma.cAI.update({
        where: { id: cai.id },
        data: { isActive: false },
      });

      console.warn('[CAI-ALERTS] CAI EXPIRED — auto-deactivated', {
        level: 'CRITICAL',
        companyId: cai.companyId,
        companyName: cai.company.legalName,
        companyRtn: cai.company.rtn,
        caiId: cai.id,
        caiCode: cai.caiCode,
        documentType: cai.documentType,
        expiresAt: cai.expiresAt.toISOString(),
        daysUntilExpiry,
      });
      expiredCount++;
      continue;
    }

    // Check alert thresholds
    for (const threshold of ALERT_THRESHOLDS_DAYS) {
      if (daysUntilExpiry <= threshold) {
        const alertLevel = threshold <= 7 ? 'CRITICAL' : threshold <= 14 ? 'WARNING' : 'INFO';

        console.warn(`[CAI-ALERTS] CAI expiry alert — ${daysUntilExpiry} days remaining`, {
          level: alertLevel,
          companyId: cai.companyId,
          companyName: cai.company.legalName,
          companyRtn: cai.company.rtn,
          caiId: cai.id,
          caiCode: cai.caiCode,
          documentType: cai.documentType,
          expiresAt: cai.expiresAt.toISOString(),
          daysUntilExpiry,
          threshold,
        });
        alertCount++;
        break; // Only log the most urgent threshold
      }
    }
  }

  console.info('[CAI-ALERTS] Check complete', {
    totalChecked: activeCais.length,
    alertsEmitted: alertCount,
    expiredDeactivated: expiredCount,
    timestamp: new Date().toISOString(),
  });

  await prisma.$disconnect();
};
