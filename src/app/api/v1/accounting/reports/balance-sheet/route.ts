// src/app/api/v1/accounting/reports/balance-sheet/route.ts
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getAuthContextFromHeaders } from '@/lib/auth/request-auth';
import { financialReportService } from '@/lib/services/accounting/financial-report.service';
import { balanceSheetQuerySchema } from '@/lib/validations/financial-report.schema';
import { handleApiError } from '@/lib/api/handle-error';

/** GET /api/v1/accounting/reports/balance-sheet?asOfDate=YYYY-MM-DD */
export async function GET(request: NextRequest) {
  try {
    const auth = getAuthContextFromHeaders(request);
    const p = request.nextUrl.searchParams;

    const query = balanceSheetQuerySchema.parse({
      asOfDate: p.get('asOfDate') ?? undefined,
      fiscalYearId: p.get('fiscalYearId') ?? undefined,
    });

    const report = await financialReportService.getBalanceSheet(auth.companyId, query);
    return NextResponse.json({ success: true, data: report });
  } catch (error) {
    return handleApiError(error, 'GET /api/v1/accounting/reports/balance-sheet');
  }
}
