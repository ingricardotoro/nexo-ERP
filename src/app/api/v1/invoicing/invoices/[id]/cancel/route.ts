// src/app/api/v1/invoicing/invoices/[id]/cancel/route.ts
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthContextFromHeaders } from '@/lib/auth/request-auth';
import { checkPermission } from '@/lib/permissions/check-permission';
import { invoiceService } from '@/lib/services/invoicing/invoice.service';
import { handleApiError } from '@/lib/api/handle-error';

const cancelSchema = z.object({
  cancelReason: z
    .string()
    .min(5, 'El motivo de anulación debe tener al menos 5 caracteres')
    .max(500),
});

/**
 * POST /api/v1/invoicing/invoices/:id/cancel
 * Anula una factura emitida (PUBLISHED → CANCELLED).
 * Genera asiento contable de reversión automáticamente.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = getAuthContextFromHeaders(request);
    await checkPermission(auth, 'invoicing.invoice.cancel');
    const { id } = await params;
    const body = await request.json();
    const { cancelReason } = cancelSchema.parse(body);
    const invoice = await invoiceService.cancelInvoice(
      auth.companyId,
      id,
      auth.userId,
      cancelReason,
    );
    return NextResponse.json({
      success: true,
      data: invoice,
      message: `Factura ${invoice.invoiceNumber ?? id} anulada exitosamente`,
    });
  } catch (error) {
    return handleApiError(error, 'POST /api/v1/invoicing/invoices/[id]/cancel');
  }
}
