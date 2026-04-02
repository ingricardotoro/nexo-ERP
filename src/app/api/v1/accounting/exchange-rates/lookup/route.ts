// src/app/api/v1/accounting/exchange-rates/lookup/route.ts
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getAuthContextFromHeaders } from '@/lib/auth/request-auth';
import { checkPermission } from '@/lib/permissions/check-permission';
import { exchangeRateService } from '@/lib/services/accounting/exchange-rate.service';
import { handleApiError } from '@/lib/api/handle-error';

/**
 * GET /api/v1/accounting/exchange-rates/lookup
 * Query params: currencyCode, date (YYYY-MM-DD)
 * Returns the applicable rate (company-specific > global) or 404.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = getAuthContextFromHeaders(request);
    await checkPermission(auth, 'accounting.exchange_rate.read');
    const currencyCode = request.nextUrl.searchParams.get('currencyCode');
    const date = request.nextUrl.searchParams.get('date');

    if (!currencyCode || !date) {
      return NextResponse.json(
        { success: false, error: 'Se requieren currencyCode y date' },
        { status: 422 },
      );
    }

    const result = await exchangeRateService.lookupRate(
      auth.companyId,
      currencyCode.toUpperCase(),
      date,
    );
    if (!result) {
      return NextResponse.json(
        { success: false, error: 'No hay tipo de cambio registrado para esta moneda y fecha' },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return handleApiError(error, 'GET /api/v1/accounting/exchange-rates/lookup');
  }
}
