// src/app/api/v1/inventory/warehouses/route.ts
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getAuthContextFromHeaders } from '@/lib/auth/request-auth';
import { checkPermission } from '@/lib/permissions/check-permission';
import { warehouseService } from '@/lib/services/inventory/warehouse.service';
import { createWarehouseSchema } from '@/lib/validations/inventory.schema';
import { handleApiError } from '@/lib/api/handle-error';

/** GET /api/v1/inventory/warehouses */
export async function GET(request: NextRequest) {
  try {
    const auth = getAuthContextFromHeaders(request);
    await checkPermission(auth, 'inventory.warehouse.read');
    const activeOnly = request.nextUrl.searchParams.get('activeOnly') !== 'false';
    const warehouses = await warehouseService.listWarehouses(auth.companyId, { activeOnly });
    return NextResponse.json({ success: true, data: warehouses });
  } catch (error) {
    return handleApiError(error, 'GET /api/v1/inventory/warehouses');
  }
}

/** POST /api/v1/inventory/warehouses */
export async function POST(request: NextRequest) {
  try {
    const auth = getAuthContextFromHeaders(request);
    await checkPermission(auth, 'inventory.warehouse.create');
    const body = await request.json();
    const input = createWarehouseSchema.parse(body);
    const warehouse = await warehouseService.createWarehouse(auth.companyId, input);
    return NextResponse.json(
      { success: true, data: warehouse, message: 'Almacén creado exitosamente' },
      { status: 201 },
    );
  } catch (error) {
    return handleApiError(error, 'POST /api/v1/inventory/warehouses');
  }
}
