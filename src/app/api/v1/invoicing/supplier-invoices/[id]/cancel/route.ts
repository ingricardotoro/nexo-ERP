// src/app/api/v1/invoicing/supplier-invoices/[id]/cancel/route.ts
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthContextFromHeaders } from '@/lib/auth/request-auth';
import { checkPermission } from '@/lib/permissions/check-permission';
import { supplierInvoiceService } from '@/lib/services/invoicing/supplier-invoice.service';
import { handleApiError } from '@/lib/api/handle-error';

type Params = { params: Promise<{ id: string }> };

const cancelSchema = z.object({
  cancelReason: z.string().min(1, 'El motivo de anulación es requerido').max(500),
});

/** POST /api/v1/invoicing/supplier-invoices/[id]/cancel — anula factura de compra POSTED */
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const auth = getAuthContextFromHeaders(request);
    await checkPermission(auth, 'invoicing.invoice.cancel');
    const { id } = await params;
    const body = await request.json();
    const { cancelReason } = cancelSchema.parse(body);
    const invoice = await supplierInvoiceService.cancelSupplierInvoice(
      auth.companyId,
      id,
      auth.userId,
      cancelReason,
    );
    return NextResponse.json({
      success: true,
      data: invoice,
      message: 'Factura de compra anulada exitosamente',
    });
  } catch (error) {
    return handleApiError(error, 'POST /api/v1/invoicing/supplier-invoices/[id]/cancel');
  }
}
