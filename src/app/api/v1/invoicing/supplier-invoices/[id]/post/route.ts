// src/app/api/v1/invoicing/supplier-invoices/[id]/post/route.ts
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getAuthContextFromHeaders } from '@/lib/auth/request-auth';
import { checkPermission } from '@/lib/permissions/check-permission';
import { supplierInvoiceService } from '@/lib/services/invoicing/supplier-invoice.service';
import { handleApiError } from '@/lib/api/handle-error';

type Params = { params: Promise<{ id: string }> };

/** POST /api/v1/invoicing/supplier-invoices/[id]/post — registra factura DRAFT → POSTED */
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const auth = getAuthContextFromHeaders(request);
    await checkPermission(auth, 'invoicing.invoice.publish');
    const { id } = await params;
    const invoice = await supplierInvoiceService.postSupplierInvoice(
      auth.companyId,
      id,
      auth.userId,
    );
    return NextResponse.json({
      success: true,
      data: invoice,
      message: 'Factura de compra registrada exitosamente',
    });
  } catch (error) {
    return handleApiError(error, 'POST /api/v1/invoicing/supplier-invoices/[id]/post');
  }
}
