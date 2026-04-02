import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getAuthContextFromHeaders } from '@/lib/auth/request-auth';
import { contactService } from '@/lib/services/contacts/contact.service';
import { handleApiError } from '@/lib/api/handle-error';

type Params = { params: Promise<{ id: string }> };

/** GET /api/v1/contacts/:id/addresses */
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const auth = getAuthContextFromHeaders(request);

    const addresses = await contactService.listAddresses(id, auth.companyId);

    return NextResponse.json({ success: true, data: addresses });
  } catch (error) {
    return handleApiError(error, 'GET /api/v1/contacts/:id/addresses');
  }
}

/** POST /api/v1/contacts/:id/addresses */
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const auth = getAuthContextFromHeaders(request);
    const body = await request.json();

    const address = await contactService.createAddress(id, auth.companyId, body);

    return NextResponse.json(
      { success: true, data: address, message: 'Dirección agregada exitosamente' },
      { status: 201 },
    );
  } catch (error) {
    return handleApiError(error, 'POST /api/v1/contacts/:id/addresses');
  }
}
