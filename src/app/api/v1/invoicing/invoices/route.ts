// src/app/api/v1/invoicing/invoices/route.ts
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getAuthContextFromHeaders } from '@/lib/auth/request-auth';
import { checkPermission } from '@/lib/permissions/check-permission';
import { invoiceService } from '@/lib/services/invoicing/invoice.service';
import { createInvoiceSchema, listInvoicesSchema } from '@/lib/validations/invoice.schema';
import { handleApiError } from '@/lib/api/handle-error';

/** GET /api/v1/invoicing/invoices — lista facturas con filtros */
export async function GET(request: NextRequest) {
  try {
    const auth = getAuthContextFromHeaders(request);
    await checkPermission(auth, 'invoicing.invoice.read');
    const { searchParams } = new URL(request.url);
    const query = listInvoicesSchema.parse(Object.fromEntries(searchParams));
    const result = await invoiceService.listInvoices(auth.companyId, query);
    return NextResponse.json({
      success: true,
      data: result.invoices,
      pagination: result.pagination,
    });
  } catch (error) {
    return handleApiError(error, 'GET /api/v1/invoicing/invoices');
  }
}

/** POST /api/v1/invoicing/invoices — crea una factura en borrador */
export async function POST(request: NextRequest) {
  try {
    const auth = getAuthContextFromHeaders(request);
    await checkPermission(auth, 'invoicing.invoice.create');
    const body = await request.json();
    const input = createInvoiceSchema.parse(body);
    const invoice = await invoiceService.createInvoice(auth.companyId, auth.userId, input);
    return NextResponse.json(
      { success: true, data: invoice, message: 'Factura creada exitosamente' },
      { status: 201 },
    );
  } catch (error) {
    return handleApiError(error, 'POST /api/v1/invoicing/invoices');
  }
}
