// src/app/api/v1/accounting/exchange-rates/route.ts
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getAuthContextFromHeaders } from '@/lib/auth/request-auth';
import { checkPermission } from '@/lib/permissions/check-permission';
import { exchangeRateService } from '@/lib/services/accounting/exchange-rate.service';
import {
  exchangeRateFiltersSchema,
  upsertExchangeRateSchema,
} from '@/lib/validations/exchange-rate.schema';
import { handleApiError } from '@/lib/api/handle-error';

/** GET /api/v1/accounting/exchange-rates — lista tasas de cambio con filtros */
export async function GET(request: NextRequest) {
  try {
    const auth = getAuthContextFromHeaders(request);
    await checkPermission(auth, 'accounting.exchange_rate.read');
    const p = request.nextUrl.searchParams;

    const filters = exchangeRateFiltersSchema.parse({
      currencyCode: p.get('currencyCode') ?? undefined,
      dateFrom: p.get('dateFrom') ?? undefined,
      dateTo: p.get('dateTo') ?? undefined,
      page: p.get('page') ?? '1',
      limit: p.get('limit') ?? '20',
    });

    const result = await exchangeRateService.listRates(auth.companyId, filters);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return handleApiError(error, 'GET /api/v1/accounting/exchange-rates');
  }
}

/** POST /api/v1/accounting/exchange-rates — crea o actualiza una tasa */
export async function POST(request: NextRequest) {
  try {
    const auth = getAuthContextFromHeaders(request);
    await checkPermission(auth, 'accounting.exchange_rate.write');
    const body = await request.json();
    const input = upsertExchangeRateSchema.parse(body);
    const rate = await exchangeRateService.upsertRate(auth.companyId, input);
    return NextResponse.json(
      { success: true, data: rate, message: 'Tipo de cambio registrado' },
      { status: 201 },
    );
  } catch (error) {
    return handleApiError(error, 'POST /api/v1/accounting/exchange-rates');
  }
}
