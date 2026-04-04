// src/app/api/v1/sales/orders/[id]/confirm/route.ts
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getAuthContextFromHeaders } from '@/lib/auth/request-auth';
import { checkPermission } from '@/lib/permissions/check-permission';
import { salesOrderService } from '@/lib/services/sales/sales-order.service';
import { handleApiError } from '@/lib/api/handle-error';

/** POST /api/v1/sales/orders/[id]/confirm */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = getAuthContextFromHeaders(request);
    await checkPermission(auth, 'sales.order.update');
    const { id } = await params;
    const order = await salesOrderService.confirmOrder(auth.companyId, id, auth.userId);
    return NextResponse.json({
      success: true,
      data: order,
      message: `Pedido ${order.orderNumber} confirmado`,
    });
  } catch (error) {
    return handleApiError(error, 'POST /api/v1/sales/orders/[id]/confirm');
  }
}
