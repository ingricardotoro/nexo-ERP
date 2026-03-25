import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getAuthContextFromHeaders } from '@/lib/auth/request-auth';
import { paymentTermsService } from '@/lib/services/contacts/payment-terms.service';
import { handleApiError } from '@/lib/api/handle-error';

type Params = { params: Promise<{ id: string }> };

/** PUT /api/v1/contacts/payment-terms/:id */
export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const auth = getAuthContextFromHeaders(request);
    const body = await request.json();

    const terms = await paymentTermsService.updatePaymentTerms(id, auth.companyId, body);

    return NextResponse.json({
      success: true,
      data: terms,
      message: 'Término de pago actualizado exitosamente',
    });
  } catch (error) {
    return handleApiError(error, 'PUT /api/v1/contacts/payment-terms/:id');
  }
}

/** DELETE /api/v1/contacts/payment-terms/:id */
export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const auth = getAuthContextFromHeaders(request);

    await paymentTermsService.deletePaymentTerms(id, auth.companyId);

    return NextResponse.json({ success: true, message: 'Término de pago eliminado exitosamente' });
  } catch (error) {
    return handleApiError(error, 'DELETE /api/v1/contacts/payment-terms/:id');
  }
}
