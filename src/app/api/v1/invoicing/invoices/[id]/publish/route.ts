// src/app/api/v1/invoicing/invoices/[id]/publish/route.ts
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getAuthContextFromHeaders } from '@/lib/auth/request-auth';
import { checkPermission } from '@/lib/permissions/check-permission';
import { invoiceService } from '@/lib/services/invoicing/invoice.service';
import { handleApiError } from '@/lib/api/handle-error';

/**
 * POST /api/v1/invoicing/invoices/:id/publish
 * Emite la factura: asigna número SAR y genera asiento contable.
 * DRAFT → PUBLISHED (irreversible — use /cancel to void).
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = getAuthContextFromHeaders(request);
    await checkPermission(auth, 'invoicing.invoice.publish');
    const { id } = await params;
    const invoice = await invoiceService.publishInvoice(auth.companyId, id, auth.userId);
    return NextResponse.json({
      success: true,
      data: invoice,
      message: `Factura ${invoice.invoiceNumber} emitida exitosamente`,
    });
  } catch (error) {
    return handleApiError(error, 'POST /api/v1/invoicing/invoices/[id]/publish');
  }
}
