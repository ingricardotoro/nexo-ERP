// src/app/api/v1/invoicing/supplier-invoices/[id]/route.ts
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getAuthContextFromHeaders } from '@/lib/auth/request-auth';
import { checkPermission } from '@/lib/permissions/check-permission';
import { supplierInvoiceService } from '@/lib/services/invoicing/supplier-invoice.service';
import { updateSupplierInvoiceSchema } from '@/lib/validations/supplier-invoice.schema';
import { handleApiError } from '@/lib/api/handle-error';

type Params = { params: Promise<{ id: string }> };

/** GET /api/v1/invoicing/supplier-invoices/[id] */
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const auth = getAuthContextFromHeaders(request);
    await checkPermission(auth, 'invoicing.invoice.read');
    const { id } = await params;
    const invoice = await supplierInvoiceService.getSupplierInvoice(auth.companyId, id);
    return NextResponse.json({ success: true, data: invoice });
  } catch (error) {
    return handleApiError(error, 'GET /api/v1/invoicing/supplier-invoices/[id]');
  }
}

/** PUT /api/v1/invoicing/supplier-invoices/[id] */
export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const auth = getAuthContextFromHeaders(request);
    await checkPermission(auth, 'invoicing.invoice.create');
    const { id } = await params;
    const body = await request.json();
    const input = updateSupplierInvoiceSchema.parse(body);
    const invoice = await supplierInvoiceService.updateSupplierInvoice(auth.companyId, id, input);
    return NextResponse.json({ success: true, data: invoice });
  } catch (error) {
    return handleApiError(error, 'PUT /api/v1/invoicing/supplier-invoices/[id]');
  }
}

/** DELETE /api/v1/invoicing/supplier-invoices/[id] */
export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const auth = getAuthContextFromHeaders(request);
    await checkPermission(auth, 'invoicing.invoice.delete');
    const { id } = await params;
    await supplierInvoiceService.deleteDraftSupplierInvoice(auth.companyId, id);
    return NextResponse.json({ success: true, message: 'Factura de compra eliminada' });
  } catch (error) {
    return handleApiError(error, 'DELETE /api/v1/invoicing/supplier-invoices/[id]');
  }
}
