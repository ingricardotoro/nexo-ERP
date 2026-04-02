// src/app/api/v1/invoicing/sales-book/det-csv/route.ts
import type { NextRequest } from 'next/server';
import { getAuthContextFromHeaders } from '@/lib/auth/request-auth';
import { checkPermission } from '@/lib/permissions/check-permission';
import { salesBookService } from '@/lib/services/invoicing/sales-book.service';
import { salesBookQuerySchema } from '@/lib/validations/sales-book.schema';
import { handleApiError } from '@/lib/api/handle-error';

/** GET /api/v1/invoicing/sales-book/det-csv?fiscalPeriodId=xxx — DET CSV download */
export async function GET(request: NextRequest) {
  try {
    const auth = getAuthContextFromHeaders(request);
    await checkPermission(auth, 'invoicing.invoice.read');
    const { searchParams } = new URL(request.url);
    const query = salesBookQuerySchema.parse(Object.fromEntries(searchParams));
    const csv = await salesBookService.generateDetCsv(auth.companyId, query.fiscalPeriodId);

    return new Response(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="DET_LibroVentas_${query.fiscalPeriodId}.csv"`,
      },
    });
  } catch (error) {
    return handleApiError(error, 'GET /api/v1/invoicing/sales-book/det-csv');
  }
}
