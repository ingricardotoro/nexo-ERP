import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getAuthContextFromHeaders } from '@/lib/auth/request-auth';
import { contactService } from '@/lib/services/contacts/contact.service';
import { handleApiError } from '@/lib/api/handle-error';

type Params = { params: Promise<{ id: string }> };

/** GET /api/v1/contacts/:id — detalle con addresses y persons */
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const auth = getAuthContextFromHeaders(request);

    const contact = await contactService.getContactById(id, auth.companyId);

    return NextResponse.json({ success: true, data: contact });
  } catch (error) {
    return handleApiError(error, 'GET /api/v1/contacts/:id');
  }
}

/** PUT /api/v1/contacts/:id — actualizar contacto */
export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const auth = getAuthContextFromHeaders(request);
    const body = await request.json();

    const contact = await contactService.updateContact(id, auth.companyId, body);

    return NextResponse.json({
      success: true,
      data: contact,
      message: 'Contacto actualizado exitosamente',
    });
  } catch (error) {
    return handleApiError(error, 'PUT /api/v1/contacts/:id');
  }
}

/** DELETE /api/v1/contacts/:id — soft delete */
export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const auth = getAuthContextFromHeaders(request);

    await contactService.deleteContact(id, auth.companyId);

    return NextResponse.json({ success: true, message: 'Contacto eliminado exitosamente' });
  } catch (error) {
    return handleApiError(error, 'DELETE /api/v1/contacts/:id');
  }
}
