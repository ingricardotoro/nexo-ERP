// src/app/api/v1/accounting/fiscal-years/[id]/route.ts
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getAuthContextFromHeaders } from '@/lib/auth/request-auth';
import { fiscalYearService } from '@/lib/services/accounting/fiscal-year.service';
import { handleApiError } from '@/lib/api/handle-error';

/** GET /api/v1/accounting/fiscal-years/:id — obtiene año con sus 12 períodos */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = getAuthContextFromHeaders(request);
    const { id } = await params;
    const year = await fiscalYearService.getFiscalYear(auth.companyId, id);
    return NextResponse.json({ success: true, data: year });
  } catch (error) {
    return handleApiError(error, 'GET /api/v1/accounting/fiscal-years/[id]');
  }
}
