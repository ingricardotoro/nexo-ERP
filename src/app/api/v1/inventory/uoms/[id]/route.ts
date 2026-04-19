// src/app/api/v1/inventory/uoms/[id]/route.ts
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getAuthContextFromHeaders } from '@/lib/auth/request-auth';
import { checkPermission } from '@/lib/permissions/check-permission';
import { uomService } from '@/lib/services/inventory/uom.service';
import { updateUnitOfMeasureSchema } from '@/lib/validations/inventory.schema';
import { handleApiError } from '@/lib/api/handle-error';

/** PATCH /api/v1/inventory/uoms/[id] */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = getAuthContextFromHeaders(request);
    await checkPermission(auth, 'inventory.product.create');
    const { id } = await params;
    const body = await request.json();
    const input = updateUnitOfMeasureSchema.parse(body);
    const uom = await uomService.updateUom(auth.companyId, id, input);
    return NextResponse.json({ success: true, data: uom, message: 'Unidad actualizada' });
  } catch (error) {
    return handleApiError(error, 'PATCH /api/v1/inventory/uoms/[id]');
  }
}
