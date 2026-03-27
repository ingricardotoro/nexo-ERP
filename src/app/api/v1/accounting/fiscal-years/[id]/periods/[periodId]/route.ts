// src/app/api/v1/accounting/fiscal-years/[id]/periods/[periodId]/route.ts
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthContextFromHeaders } from '@/lib/auth/request-auth';
import { fiscalYearService } from '@/lib/services/accounting/fiscal-year.service';
import { handleApiError } from '@/lib/api/handle-error';

const periodActionSchema = z.object({
  action: z.enum(['close', 'lock']),
});

/**
 * PATCH /api/v1/accounting/fiscal-years/:id/periods/:periodId
 * body: { action: 'close' | 'lock' }
 * close → OPEN→CLOSED
 * lock  → CLOSED→LOCKED (irreversible)
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
      await fiscalYearService.closePeriod(auth.companyId, periodId);
      return NextResponse.json({ success: true, message: 'Período cerrado exitosamente' });
    } else {
      await fiscalYearService.lockPeriod(auth.companyId, periodId);
      return NextResponse.json({ success: true, message: 'Período bloqueado exitosamente' });
    }
  } catch (error) {
    return handleApiError(error, 'PATCH /api/v1/accounting/fiscal-years/[id]/periods/[periodId]');
  }
}
