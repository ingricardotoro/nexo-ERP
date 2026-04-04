// src/app/api/v1/inventory/stock/route.ts
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getAuthContextFromHeaders } from '@/lib/auth/request-auth';
import { checkPermission } from '@/lib/permissions/check-permission';
import { stockMoveService } from '@/lib/services/inventory/stock-move.service';
import { handleApiError } from '@/lib/api/handle-error';

/** GET /api/v1/inventory/stock?productId=... — stock on hand por producto */
export async function GET(request: NextRequest) {
  try {
    const auth = getAuthContextFromHeaders(request);
    await checkPermission(auth, 'inventory.product.read');

    const productId = request.nextUrl.searchParams.get('productId');
    if (!productId) {
      return NextResponse.json(
        { success: false, error: 'productId es requerido' },
        { status: 400 },
      );
    }

    const stock = await stockMoveService.getStockOnHand(auth.companyId, productId);
    return NextResponse.json({ success: true, data: stock });
  } catch (error) {
    return handleApiError(error, 'GET /api/v1/inventory/stock');
  }
}
