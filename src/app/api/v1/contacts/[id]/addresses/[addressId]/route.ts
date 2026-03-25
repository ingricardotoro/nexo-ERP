import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getAuthContextFromHeaders } from '@/lib/auth/request-auth';
import { contactService } from '@/lib/services/contacts/contact.service';
import { handleApiError } from '@/lib/api/handle-error';

type Params = { params: Promise<{ id: string; addressId: string }> };

/** PUT /api/v1/contacts/:id/addresses/:addressId */
export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const { id, addressId } = await params;
    const auth = getAuthContextFromHeaders(request);
    const body = await request.json();

    const address = await contactService.updateAddress(addressId, id, auth.companyId, body);

    return NextResponse.json({
      success: true,
      data: address,
      message: 'Dirección actualizada exitosamente',
    });
  } catch (error) {
    return handleApiError(error, 'PUT /api/v1/contacts/:id/addresses/:addressId');
  }
}

/** DELETE /api/v1/contacts/:id/addresses/:addressId */
export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const { id, addressId } = await params;
    const auth = getAuthContextFromHeaders(request);

    await contactService.deleteAddress(addressId, id, auth.companyId);

    return NextResponse.json({ success: true, message: 'Dirección eliminada exitosamente' });
  } catch (error) {
    return handleApiError(error, 'DELETE /api/v1/contacts/:id/addresses/:addressId');
  }
}
