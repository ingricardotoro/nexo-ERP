// src/app/api/v1/invoicing/tax-rates/route.ts
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getAuthContextFromHeaders } from '@/lib/auth/request-auth';
import { checkPermission } from '@/lib/permissions/check-permission';
import { taxRateService } from '@/lib/services/invoicing/tax-rate.service';
import { createTaxRateSchema } from '@/lib/validations/tax-rate.schema';
import { handleApiError } from '@/lib/api/handle-error';

/** GET /api/v1/invoicing/tax-rates — lista tasas de impuesto */
export async function GET(request: NextRequest) {
  try {
    const auth = getAuthContextFromHeaders(request);
    await checkPermission(auth, 'invoicing.tax_rate.read');
    const rates = await taxRateService.listTaxRates(auth.companyId);
    return NextResponse.json({ success: true, data: rates });
  } catch (error) {
    return handleApiError(error, 'GET /api/v1/invoicing/tax-rates');
  }
}

/** POST /api/v1/invoicing/tax-rates — crea una nueva tasa de impuesto */
export async function POST(request: NextRequest) {
  try {
    const auth = getAuthContextFromHeaders(request);
    await checkPermission(auth, 'invoicing.tax_rate.create');
    const body = await request.json();
    const input = createTaxRateSchema.parse(body);
    const rate = await taxRateService.createTaxRate(auth.companyId, input);
    return NextResponse.json(
      { success: true, data: rate, message: 'Tasa de impuesto creada exitosamente' },
      { status: 201 },
    );
  } catch (error) {
    return handleApiError(error, 'POST /api/v1/invoicing/tax-rates');
  }
}
