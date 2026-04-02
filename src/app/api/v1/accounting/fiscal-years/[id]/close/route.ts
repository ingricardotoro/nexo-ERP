// src/app/api/v1/accounting/fiscal-years/[id]/close/route.ts
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getAuthContextFromHeaders } from '@/lib/auth/request-auth';
import { checkPermission } from '@/lib/permissions/check-permission';
import { fiscalYearService } from '@/lib/services/accounting/fiscal-year.service';
import { handleApiError } from '@/lib/api/handle-error';

/** POST /api/v1/accounting/fiscal-years/:id/close — cierra el año y todos sus períodos OPEN */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = getAuthContextFromHeaders(request);
    await checkPermission(auth, 'accounting.fiscal_year.close');
    const { id } = await params;
    await fiscalYearService.closeYear(auth.companyId, id);
    return NextResponse.json({ success: true, message: 'Año fiscal cerrado exitosamente' });
  } catch (error) {
    return handleApiError(error, 'POST /api/v1/accounting/fiscal-years/[id]/close');
  }
}
