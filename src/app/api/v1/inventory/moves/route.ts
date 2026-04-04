// src/app/api/v1/inventory/moves/route.ts
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getAuthContextFromHeaders } from '@/lib/auth/request-auth';
import { checkPermission } from '@/lib/permissions/check-permission';
import { stockMoveService } from '@/lib/services/inventory/stock-move.service';
import { handleApiError } from '@/lib/api/handle-error';

/** GET /api/v1/inventory/moves */
export async function GET(request: NextRequest) {
  try {
    const auth = getAuthContextFromHeaders(request);
    await checkPermission(auth, 'inventory.product.read');

    const { searchParams } = request.nextUrl;
    const moves = await stockMoveService.listMoves(auth.companyId, {
      productId: searchParams.get('productId') ?? undefined,
      state: searchParams.get('state') ?? undefined,
      limit: Number(searchParams.get('limit') ?? '50'),
    });

    return NextResponse.json({ success: true, data: moves });
  } catch (error) {
    return handleApiError(error, 'GET /api/v1/inventory/moves');
  }
}
