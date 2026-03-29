// src/app/api/v1/accounting/reports/cxc-aging/route.ts
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getAuthContextFromHeaders } from '@/lib/auth/request-auth';
import { checkPermission } from '@/lib/permissions/check-permission';
import { agingReportService } from '@/lib/services/accounting/aging-report.service';
import { balanceSheetQuerySchema } from '@/lib/validations/financial-report.schema';
import { handleApiError } from '@/lib/api/handle-error';

/** GET /api/v1/accounting/reports/cxc-aging?asOfDate=YYYY-MM-DD */
export async function GET(request: NextRequest) {
  try {
    const auth = getAuthContextFromHeaders(request);
    await checkPermission(auth, 'accounting.report.read');
    const { asOfDate } = balanceSheetQuerySchema.parse({
      asOfDate: request.nextUrl.searchParams.get('asOfDate') ?? undefined,
    });
    const report = await agingReportService.getCxcAging(auth.companyId, asOfDate);
    return NextResponse.json({ success: true, data: report });
  } catch (error) {
    return handleApiError(error, 'GET /api/v1/accounting/reports/cxc-aging');
  }
}
