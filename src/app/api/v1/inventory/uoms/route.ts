// src/app/api/v1/inventory/uoms/route.ts
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getAuthContextFromHeaders } from '@/lib/auth/request-auth';
import { checkPermission } from '@/lib/permissions/check-permission';
import { uomService } from '@/lib/services/inventory/uom.service';
import { createUnitOfMeasureSchema } from '@/lib/validations/inventory.schema';
import { handleApiError } from '@/lib/api/handle-error';

/** GET /api/v1/inventory/uoms */
export async function GET(request: NextRequest) {
  try {
    const auth = getAuthContextFromHeaders(request);
    await checkPermission(auth, 'inventory.product.read');
    const activeOnly = request.nextUrl.searchParams.get('activeOnly') !== 'false';
    const uoms = await uomService.listUoms(auth.companyId, { activeOnly });
    return NextResponse.json({ success: true, data: uoms });
  } catch (error) {
    return handleApiError(error, 'GET /api/v1/inventory/uoms');
  }
}

/** POST /api/v1/inventory/uoms */
export async function POST(request: NextRequest) {
  try {
    const auth = getAuthContextFromHeaders(request);
    await checkPermission(auth, 'inventory.product.create');
    const body = await request.json();
    const input = createUnitOfMeasureSchema.parse(body);
    const uom = await uomService.createUom(auth.companyId, input);
    return NextResponse.json(
      { success: true, data: uom, message: 'Unidad de medida creada exitosamente' },
      { status: 201 },
    );
  } catch (error) {
    return handleApiError(error, 'POST /api/v1/inventory/uoms');
  }
}
