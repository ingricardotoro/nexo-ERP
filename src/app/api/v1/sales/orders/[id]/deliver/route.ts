// src/app/api/v1/sales/orders/[id]/deliver/route.ts
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthContextFromHeaders } from '@/lib/auth/request-auth';
import { checkPermission } from '@/lib/permissions/check-permission';
import { salesOrderService } from '@/lib/services/sales/sales-order.service';
import { handleApiError } from '@/lib/api/handle-error';

const deliverSchema = z.object({
  lines: z
    .array(
      z.object({
        lineId: z.string().uuid(),
        qtyDelivered: z.number().positive(),
      }),
    )
    .min(1),
});

/** POST /api/v1/sales/orders/[id]/deliver */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = getAuthContextFromHeaders(request);
    await checkPermission(auth, 'sales.order.update');
    const { id } = await params;
    const body = deliverSchema.parse(await request.json());
    const order = await salesOrderService.deliverOrder(auth.companyId, id, auth.userId, body.lines);
    return NextResponse.json({
      success: true,
      data: order,
      message: `Pedido ${order.orderNumber ?? id} marcado como entregado`,
    });
  } catch (error) {
    return handleApiError(error, 'POST /api/v1/sales/orders/[id]/deliver');
  }
}
