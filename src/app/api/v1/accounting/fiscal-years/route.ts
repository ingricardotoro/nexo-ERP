// src/app/api/v1/accounting/fiscal-years/route.ts
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getAuthContextFromHeaders } from '@/lib/auth/request-auth';
import { fiscalYearService } from '@/lib/services/accounting/fiscal-year.service';
import { createFiscalYearSchema } from '@/lib/validations/fiscal-year.schema';
import { handleApiError } from '@/lib/api/handle-error';

/** GET /api/v1/accounting/fiscal-years — lista años fiscales con conteos de períodos */
export async function GET(request: NextRequest) {
  try {
    const auth = getAuthContextFromHeaders(request);
    const years = await fiscalYearService.listFiscalYears(auth.companyId);
    return NextResponse.json({ success: true, data: years });
  } catch (error) {
    return handleApiError(error, 'GET /api/v1/accounting/fiscal-years');
  }
}

/** POST /api/v1/accounting/fiscal-years — crea año fiscal + 12 períodos mensuales */
export async function POST(request: NextRequest) {
  try {
    const auth = getAuthContextFromHeaders(request);
    const body = await request.json();
    const input = createFiscalYearSchema.parse(body);
    const year = await fiscalYearService.createFiscalYear(auth.companyId, input);
    return NextResponse.json(
      { success: true, data: year, message: 'Año fiscal creado exitosamente' },
      { status: 201 },
    );
  } catch (error) {
    return handleApiError(error, 'POST /api/v1/accounting/fiscal-years');
  }
}
