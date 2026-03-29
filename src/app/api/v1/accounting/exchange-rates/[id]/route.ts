// src/app/api/v1/accounting/exchange-rates/[id]/route.ts
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getAuthContextFromHeaders } from '@/lib/auth/request-auth';
import { checkPermission } from '@/lib/permissions/check-permission';
import { exchangeRateService } from '@/lib/services/accounting/exchange-rate.service';
import { handleApiError } from '@/lib/api/handle-error';

/** DELETE /api/v1/accounting/exchange-rates/:id — elimina una tasa de la empresa */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = getAuthContextFromHeaders(request);
    await checkPermission(auth, 'accounting.exchange_rate.write');
    const { id } = await params;
    await exchangeRateService.deleteRate(auth.companyId, id);
    return NextResponse.json({ success: true, message: 'Tipo de cambio eliminado' });
  } catch (error) {
    return handleApiError(error, 'DELETE /api/v1/accounting/exchange-rates/[id]');
  }
}
