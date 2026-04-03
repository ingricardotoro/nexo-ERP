// src/app/api/v1/invoicing/cais/alerts/route.ts
// RF-INV-05: CAI alert endpoint.
// Returns active CAIs in critical state:
//   - expiring in <= 30 days (or already expired)
//   - range usage >= 90%  (lastSequenceNumber / (rangeTo - rangeFrom + 1))
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getAuthContextFromHeaders } from '@/lib/auth/request-auth';
import { checkPermission } from '@/lib/permissions/check-permission';
import { caiService } from '@/lib/services/invoicing/cai.service';
import { handleApiError } from '@/lib/api/handle-error';

export interface CaiAlert {
  caiId: string;
  caiCode: string;
  documentType: string;
  alertType: 'EXPIRY' | 'RANGE';
  /** daysUntilExpiry: negative means already expired */
  daysUntilExpiry?: number;
  /** rangeUsedPercent: 0-100 */
  rangeUsedPercent?: number;
  expiresAt: string;
}

const EXPIRY_THRESHOLD_DAYS = 30;
const RANGE_THRESHOLD_PERCENT = 90;

export async function GET(request: NextRequest) {
  try {
    const auth = getAuthContextFromHeaders(request);
    await checkPermission(auth, 'invoicing.cai.read');

    const cais = await caiService.listCais(auth.companyId);
    const now = new Date();
    const alerts: CaiAlert[] = [];

    for (const cai of cais) {
      if (!cai.isActive) continue;

      const expiresAt = new Date(cai.expiresAt);
      const msPerDay = 1000 * 60 * 60 * 24;
      const daysUntilExpiry = Math.floor((expiresAt.getTime() - now.getTime()) / msPerDay);

      // Expiry alert: <= 30 days remaining (includes already expired)
      if (daysUntilExpiry <= EXPIRY_THRESHOLD_DAYS) {
        alerts.push({
          caiId: cai.id,
          caiCode: cai.caiCode,
          documentType: cai.documentType,
          alertType: 'EXPIRY',
          daysUntilExpiry,
          expiresAt: cai.expiresAt.toISOString(),
        });
      }

      // Range usage alert: >= 90%
      const totalRange = cai.rangeTo - cai.rangeFrom + 1;
      if (totalRange > 0) {
        const used = cai.lastSequenceNumber - cai.rangeFrom + 1;
        const rangeUsedPercent = Math.round((used / totalRange) * 100);
        if (rangeUsedPercent >= RANGE_THRESHOLD_PERCENT) {
          alerts.push({
            caiId: cai.id,
            caiCode: cai.caiCode,
            documentType: cai.documentType,
            alertType: 'RANGE',
            rangeUsedPercent,
            expiresAt: cai.expiresAt.toISOString(),
          });
        }
      }
    }

    return NextResponse.json({ success: true, data: alerts, count: alerts.length });
  } catch (error) {
    return handleApiError(error, 'GET /api/v1/invoicing/cais/alerts');
  }
}
