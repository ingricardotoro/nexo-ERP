// src/app/api/v1/inventory/locations/route.ts
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getAuthContextFromHeaders } from '@/lib/auth/request-auth';
import { checkPermission } from '@/lib/permissions/check-permission';
import basePrisma from '@/lib/db/prisma';
import { createTenantPrisma } from '@/lib/db/tenant-extension';
import { handleApiError } from '@/lib/api/handle-error';

/** GET /api/v1/inventory/locations */
export async function GET(request: NextRequest) {
  try {
    const auth = getAuthContextFromHeaders(request);
    await checkPermission(auth, 'inventory.product.read');

    const { searchParams } = request.nextUrl;
    const db = createTenantPrisma(basePrisma, auth.companyId);

    const where: Record<string, unknown> = { companyId: auth.companyId, isActive: true };
    const locationType = searchParams.get('locationType');
    const warehouseId = searchParams.get('warehouseId');
    if (locationType) where.locationType = locationType;
    if (warehouseId) where.warehouseId = warehouseId;

    const locations = await db.location.findMany({
      where,
      orderBy: [{ locationType: 'asc' }, { name: 'asc' }],
    });

    return NextResponse.json({ success: true, data: locations });
  } catch (error) {
    return handleApiError(error, 'GET /api/v1/inventory/locations');
  }
}
