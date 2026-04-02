// src/app/api/v1/invoicing/invoices/[id]/route.ts
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getAuthContextFromHeaders } from '@/lib/auth/request-auth';
import { checkPermission } from '@/lib/permissions/check-permission';
import { invoiceService } from '@/lib/services/invoicing/invoice.service';
import { updateInvoiceSchema } from '@/lib/validations/invoice.schema';
import { handleApiError } from '@/lib/api/handle-error';

/** GET /api/v1/invoicing/invoices/:id — detalle de una factura */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = getAuthContextFromHeaders(request);
    await checkPermission(auth, 'invoicing.invoice.read');
    const { id } = await params;
    const invoice = await invoiceService.getInvoice(auth.companyId, id);
    return NextResponse.json({ success: true, data: invoice });
  } catch (error) {
    return handleApiError(error, 'GET /api/v1/invoicing/invoices/[id]');
  }
}

/** PATCH /api/v1/invoicing/invoices/:id — actualiza una factura en borrador */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = getAuthContextFromHeaders(request);
    await checkPermission(auth, 'invoicing.invoice.update');
    const { id } = await params;
    const body = await request.json();
    const input = updateInvoiceSchema.parse(body);
    const invoice = await invoiceService.updateInvoice(auth.companyId, id, input);
    return NextResponse.json({
      success: true,
      data: invoice,
      message: 'Factura actualizada exitosamente',
    });
  } catch (error) {
    return handleApiError(error, 'PATCH /api/v1/invoicing/invoices/[id]');
  }
}

/** DELETE /api/v1/invoicing/invoices/:id — elimina una factura en borrador */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = getAuthContextFromHeaders(request);
    await checkPermission(auth, 'invoicing.invoice.update');
    const { id } = await params;
    await invoiceService.deleteDraftInvoice(auth.companyId, id);
    return NextResponse.json({ success: true, message: 'Factura eliminada exitosamente' });
  } catch (error) {
    return handleApiError(error, 'DELETE /api/v1/invoicing/invoices/[id]');
  }
}
