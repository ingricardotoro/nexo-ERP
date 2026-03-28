// src/app/api/v1/accounting/currencies/route.ts
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getAuthContextFromHeaders } from '@/lib/auth/request-auth';
import { exchangeRateService } from '@/lib/services/accounting/exchange-rate.service';
import { handleApiError } from '@/lib/api/handle-error';

/** GET /api/v1/accounting/currencies — lista monedas activas */
export async function GET(request: NextRequest) {
  try {
    getAuthContextFromHeaders(request); // verifica auth
    const currencies = await exchangeRateService.listCurrencies();
    return NextResponse.json({ success: true, data: currencies });
  } catch (error) {
    return handleApiError(error, 'GET /api/v1/accounting/currencies');
  }
}
