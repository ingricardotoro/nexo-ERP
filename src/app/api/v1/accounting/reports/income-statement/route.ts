// src/app/api/v1/accounting/reports/income-statement/route.ts
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getAuthContextFromHeaders } from '@/lib/auth/request-auth';
import { checkPermission } from '@/lib/permissions/check-permission';
import { financialReportService } from '@/lib/services/accounting/financial-report.service';
import { incomeStatementQuerySchema } from '@/lib/validations/financial-report.schema';
import { handleApiError } from '@/lib/api/handle-error';

/** GET /api/v1/accounting/reports/income-statement?dateFrom=YYYY-MM-DD&dateTo=YYYY-MM-DD */
export async function GET(request: NextRequest) {
  try {
    const auth = getAuthContextFromHeaders(request);
    await checkPermission(auth, 'accounting.report.read');
    const p = request.nextUrl.searchParams;

    const query = incomeStatementQuerySchema.parse({
      dateFrom: p.get('dateFrom') ?? undefined,
      dateTo: p.get('dateTo') ?? undefined,
      fiscalYearId: p.get('fiscalYearId') ?? undefined,
    });

    const report = await financialReportService.getIncomeStatement(auth.companyId, query);
    return NextResponse.json({ success: true, data: report });
  } catch (error) {
    return handleApiError(error, 'GET /api/v1/accounting/reports/income-statement');
  }
}
