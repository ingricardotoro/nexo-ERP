import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getAuthContextFromHeaders } from '@/lib/auth/request-auth';
import { contactService } from '@/lib/services/contacts/contact.service';
import { handleApiError } from '@/lib/api/handle-error';

type Params = { params: Promise<{ id: string; personId: string }> };

/** PUT /api/v1/contacts/:id/persons/:personId */
export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const { id, personId } = await params;
    const auth = getAuthContextFromHeaders(request);
    const body = await request.json();

    const person = await contactService.updatePerson(personId, id, auth.companyId, body);

    return NextResponse.json({
      success: true,
      data: person,
      message: 'Persona de contacto actualizada exitosamente',
    });
  } catch (error) {
    return handleApiError(error, 'PUT /api/v1/contacts/:id/persons/:personId');
  }
}

/** DELETE /api/v1/contacts/:id/persons/:personId — soft delete */
export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const { id, personId } = await params;
    const auth = getAuthContextFromHeaders(request);

    await contactService.deletePerson(personId, id, auth.companyId);

    return NextResponse.json({
      success: true,
      message: 'Persona de contacto eliminada exitosamente',
    });
  } catch (error) {
    return handleApiError(error, 'DELETE /api/v1/contacts/:id/persons/:personId');
  }
}
