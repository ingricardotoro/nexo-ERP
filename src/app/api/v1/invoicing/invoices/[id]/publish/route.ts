// src/app/api/v1/invoicing/invoices/[id]/publish/route.ts
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getAuthContextFromHeaders } from '@/lib/auth/request-auth';
import { checkPermission } from '@/lib/permissions/check-permission';
import { invoiceService } from '@/lib/services/invoicing/invoice.service';
import { handleApiError } from '@/lib/api/handle-error';
import { enqueueInvoicePdf } from '@/lib/aws/sqs';

/**
 * POST /api/v1/invoicing/invoices/:id/publish
 * Emite la factura: asigna número SAR y genera asiento contable.
 * DRAFT → PUBLISHED (irreversible — use /cancel to void).
 *
 * Tras publicar, encola la generación del PDF en SQS (F3-09).
 * El PDF se genera de forma asíncrona — la respuesta no espera por él.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = getAuthContextFromHeaders(request);
    await checkPermission(auth, 'invoicing.invoice.publish');
    const { id } = await params;
    const invoice = await invoiceService.publishInvoice(auth.companyId, id, auth.userId);

    // Encolar generación de PDF de forma asíncrona (F3-09)
    // No bloqueamos la respuesta — si SQS falla se loguea pero la factura ya está emitida
    enqueueInvoicePdf({
      invoiceId: invoice.id,
      companyId: auth.companyId,
      invoiceNumber: invoice.invoiceNumber ?? invoice.id,
    }).catch((err: unknown) => {
      console.error('[publish] Failed to enqueue PDF job — invoice is published but no PDF', {
        invoiceId: invoice.id,
        error: err instanceof Error ? err.message : String(err),
      });
    });

    return NextResponse.json({
      success: true,
      data: invoice,
      message: `Factura ${invoice.invoiceNumber} emitida exitosamente`,
    });
  } catch (error) {
    return handleApiError(error, 'POST /api/v1/invoicing/invoices/[id]/publish');
  }
}
