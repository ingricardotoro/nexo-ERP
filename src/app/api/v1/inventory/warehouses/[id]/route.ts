// src/app/api/v1/inventory/warehouses/[id]/route.ts
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getAuthContextFromHeaders } from '@/lib/auth/request-auth';
import { checkPermission } from '@/lib/permissions/check-permission';
import { warehouseService } from '@/lib/services/inventory/warehouse.service';
import { updateWarehouseSchema } from '@/lib/validations/inventory.schema';
import { handleApiError } from '@/lib/api/handle-error';

/** PATCH /api/v1/inventory/warehouses/[id] */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = getAuthContextFromHeaders(request);
    await checkPermission(auth, 'inventory.warehouse.update');
    const { id } = await params;
    const body = await request.json();
    const input = updateWarehouseSchema.parse(body);
    const warehouse = await warehouseService.updateWarehouse(auth.companyId, id, input);
    return NextResponse.json({ success: true, data: warehouse, message: 'Almacén actualizado' });
  } catch (error) {
    return handleApiError(error, 'PATCH /api/v1/inventory/warehouses/[id]');
  }
}
