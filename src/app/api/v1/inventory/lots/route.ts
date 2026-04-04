// src/app/api/v1/inventory/lots/route.ts
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getAuthContextFromHeaders } from '@/lib/auth/request-auth';
import { checkPermission } from '@/lib/permissions/check-permission';
import { lotService } from '@/lib/services/inventory/lot.service';
import { handleApiError } from '@/lib/api/handle-error';

/** GET /api/v1/inventory/lots */
export async function GET(request: NextRequest) {
  try {
    const auth = getAuthContextFromHeaders(request);
    await checkPermission(auth, 'inventory.product.read');

    const { searchParams } = request.nextUrl;
    const lots = await lotService.listLots(auth.companyId, {
      productId: searchParams.get('productId') ?? undefined,
      activeOnly: searchParams.get('activeOnly') !== 'false',
      withStockOnly: searchParams.get('withStockOnly') === 'true',
      search: searchParams.get('search') ?? undefined,
    });

    return NextResponse.json({ success: true, data: lots });
  } catch (error) {
    return handleApiError(error, 'GET /api/v1/inventory/lots');
  }
}
