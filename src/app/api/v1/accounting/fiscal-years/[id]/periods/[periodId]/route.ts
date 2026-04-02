// src/app/api/v1/accounting/fiscal-years/[id]/periods/[periodId]/route.ts
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthContextFromHeaders } from '@/lib/auth/request-auth';
import { checkPermission } from '@/lib/permissions/check-permission';
import { fiscalYearService } from '@/lib/services/accounting/fiscal-year.service';
import { handleApiError } from '@/lib/api/handle-error';

const periodActionSchema = z.object({
  action: z.enum(['close', 'lock']),
});

/**
 * PATCH /api/v1/accounting/fiscal-years/:id/periods/:periodId
 * body: { action: 'close' | 'lock' }
 * close → OPEN→CLOSED (requiere fiscal_year.close)
 * lock  → CLOSED→LOCKED — irreversible (requiere fiscal_period.lock)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; periodId: string }> },
) {
  try {
    const auth = getAuthContextFromHeaders(request);
    const { periodId } = await params;
    const body = await request.json();
    const { action } = periodActionSchema.parse(body);

    if (action === 'close') {
      await checkPermission(auth, 'accounting.fiscal_year.close');
      await fiscalYearService.closePeriod(auth.companyId, periodId);
      return NextResponse.json({ success: true, message: 'Período cerrado exitosamente' });
    } else {
      await checkPermission(auth, 'accounting.fiscal_period.lock');
      await fiscalYearService.lockPeriod(auth.companyId, periodId);
      return NextResponse.json({ success: true, message: 'Período bloqueado exitosamente' });
    }
  } catch (error) {
    return handleApiError(error, 'PATCH /api/v1/accounting/fiscal-years/[id]/periods/[periodId]');
  }
}
