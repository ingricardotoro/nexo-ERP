// src/app/api/v1/invoicing/sales-book/route.ts
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getAuthContextFromHeaders } from '@/lib/auth/request-auth';
import { checkPermission } from '@/lib/permissions/check-permission';
import { salesBookService } from '@/lib/services/invoicing/sales-book.service';
import { salesBookQuerySchema } from '@/lib/validations/sales-book.schema';
import { handleApiError } from '@/lib/api/handle-error';

/** GET /api/v1/invoicing/sales-book?fiscalPeriodId=xxx — Libro de Ventas */
export async function GET(request: NextRequest) {
  try {
    const auth = getAuthContextFromHeaders(request);
    await checkPermission(auth, 'invoicing.invoice.read');
    const { searchParams } = new URL(request.url);
    const query = salesBookQuerySchema.parse(Object.fromEntries(searchParams));
    const result = await salesBookService.getSalesBook(auth.companyId, query.fiscalPeriodId);
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return handleApiError(error, 'GET /api/v1/invoicing/sales-book');
  }
}
