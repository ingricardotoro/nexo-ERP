import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getAuthContextFromHeaders } from '@/lib/auth/request-auth';
import { paymentTermsService } from '@/lib/services/contacts/payment-terms.service';
import { paymentTermsFiltersSchema } from '@/lib/validations/payment-terms.schema';
import { handleApiError } from '@/lib/api/handle-error';

/** GET /api/v1/contacts/payment-terms */
export async function GET(request: NextRequest) {
  try {
    const auth = getAuthContextFromHeaders(request);
    const p = request.nextUrl.searchParams;

    const filters = paymentTermsFiltersSchema.parse({
      isActive: p.get('isActive') ?? undefined,
    });

    const terms = await paymentTermsService.listPaymentTerms(auth.companyId, filters);

    return NextResponse.json({ success: true, data: terms });
  } catch (error) {
    return handleApiError(error, 'GET /api/v1/contacts/payment-terms');
  }
}

/** POST /api/v1/contacts/payment-terms */
export async function POST(request: NextRequest) {
  try {
    const auth = getAuthContextFromHeaders(request);
    const body = await request.json();

    const terms = await paymentTermsService.createPaymentTerms(auth.companyId, body);

    return NextResponse.json(
      { success: true, data: terms, message: 'Término de pago creado exitosamente' },
      { status: 201 },
    );
  } catch (error) {
    return handleApiError(error, 'POST /api/v1/contacts/payment-terms');
  }
}
