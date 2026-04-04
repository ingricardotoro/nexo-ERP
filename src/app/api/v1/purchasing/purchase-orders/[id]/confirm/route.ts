// src/app/api/v1/purchasing/purchase-orders/[id]/confirm/route.ts
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getAuthContextFromHeaders } from '@/lib/auth/request-auth';
import { checkPermission } from '@/lib/permissions/check-permission';
import { purchaseOrderService } from '@/lib/services/purchasing/purchase-order.service';
import { handleApiError } from '@/lib/api/handle-error';

/** POST /api/v1/purchasing/purchase-orders/[id]/confirm */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = getAuthContextFromHeaders(request);
    await checkPermission(auth, 'purchasing.purchase_order.update');
    const { id } = await params;
    const order = await purchaseOrderService.confirmOrder(auth.companyId, id, auth.userId);
    return NextResponse.json({
      success: true,
      data: order,
      message: `Orden ${order.orderNumber} confirmada`,
    });
  } catch (error) {
    return handleApiError(error, 'POST /api/v1/purchasing/purchase-orders/[id]/confirm');
  }
}
