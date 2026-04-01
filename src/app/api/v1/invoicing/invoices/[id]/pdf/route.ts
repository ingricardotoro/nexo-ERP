// src/app/api/v1/invoicing/invoices/[id]/pdf/route.ts
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { getAuthContextFromHeaders } from '@/lib/auth/request-auth';
import { checkPermission } from '@/lib/permissions/check-permission';
import { invoiceService } from '@/lib/services/invoicing/invoice.service';
import { handleApiError } from '@/lib/api/handle-error';

/**
 * GET /api/v1/invoicing/invoices/:id/pdf
 *
 * Devuelve una pre-signed URL de S3 válida por 15 minutos para descargar
 * el PDF de la factura. El PDF es generado asíncronamente por el Lambda
 * generate-invoice-pdf tras la emisión (F3-09).
 *
 * Responses:
 *   200 { success: true, data: { url, expiresIn, invoiceNumber } }
 *   202 { success: false, code: 'PDF_NOT_READY', message: '...' }  — PDF aún no generado
 *   404 — Factura no encontrada o no pertenece al tenant
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = getAuthContextFromHeaders(request);
    await checkPermission(auth, 'invoicing.invoice.read');

    const { id } = await params;

    // Obtener la factura (valida ownership multi-tenant)
    const invoice = await invoiceService.getInvoice(auth.companyId, id);

    // Si el PDF aún no fue generado, responder 202 Accepted
    if (!invoice.pdfS3Key) {
      return NextResponse.json(
        {
          success: false,
          code: 'PDF_NOT_READY',
          message: 'El PDF de esta factura aún está siendo generado. Intente de nuevo en unos segundos.',
        },
        { status: 202 },
      );
    }

    const bucket = process.env.S3_BUCKET_DOCUMENTS;
    if (!bucket) {
      return NextResponse.json(
        { success: false, code: 'STORAGE_NOT_CONFIGURED', message: 'Almacenamiento S3 no configurado.' },
        { status: 503 },
      );
    }

    // Generar pre-signed URL válida 15 minutos
    const s3 = new S3Client({ region: process.env.AWS_REGION ?? 'us-east-1' });
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: invoice.pdfS3Key,
      ResponseContentDisposition: `inline; filename="${invoice.invoiceNumber ?? id}.pdf"`,
      ResponseContentType: 'application/pdf',
    });

    const EXPIRES_IN_SECONDS = 900; // 15 minutos
    const url = await getSignedUrl(s3, command, { expiresIn: EXPIRES_IN_SECONDS });

    return NextResponse.json({
      success: true,
      data: {
        url,
        expiresIn: EXPIRES_IN_SECONDS,
        invoiceNumber: invoice.invoiceNumber,
        pdfGeneratedAt: invoice.pdfGeneratedAt,
      },
    });
  } catch (error) {
    return handleApiError(error, 'GET /api/v1/invoicing/invoices/[id]/pdf');
  }
}
