import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getAuthContextFromHeaders } from '@/lib/auth/request-auth';
import { contactService } from '@/lib/services/contacts/contact.service';
import { contactFiltersSchema } from '@/lib/validations/contact.schema';
import { handleApiError } from '@/lib/api/handle-error';

/** GET /api/v1/contacts — listar contactos con filtros y paginación */
export async function GET(request: NextRequest) {
  try {
    const auth = getAuthContextFromHeaders(request);
    const p = request.nextUrl.searchParams;

    const filters = contactFiltersSchema.parse({
      search: p.get('search') ?? undefined,
      type: p.get('type') ?? undefined,
      role: p.get('role') ?? undefined,
      isActive: p.get('isActive') ?? undefined,
      paymentTermsId: p.get('paymentTermsId') ?? undefined,
      page: p.get('page') ?? '1',
      limit: p.get('limit') ?? '20',
      orderBy: p.get('orderBy') ?? 'legalName',
      orderDir: p.get('orderDir') ?? 'asc',
    });

    const result = await contactService.listContacts(auth.companyId, filters);

    return NextResponse.json({
      success: true,
      data: result.contacts,
      pagination: result.pagination,
    });
  } catch (error) {
    return handleApiError(error, 'GET /api/v1/contacts');
  }
}

/** POST /api/v1/contacts — crear contacto */
export async function POST(request: NextRequest) {
  try {
    const auth = getAuthContextFromHeaders(request);
    const body = await request.json();

    const contact = await contactService.createContact(auth.companyId, body);

    return NextResponse.json(
      { success: true, data: contact, message: 'Contacto creado exitosamente' },
      { status: 201 },
    );
  } catch (error) {
    return handleApiError(error, 'POST /api/v1/contacts');
  }
}
