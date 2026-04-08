// src/app/api/v1/purchasing/purchase-orders/[id]/receive/route.ts
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthContextFromHeaders } from '@/lib/auth/request-auth';
import { checkPermission } from '@/lib/permissions/check-permission';
import { purchaseOrderService } from '@/lib/services/purchasing/purchase-order.service';
import { handleApiError } from '@/lib/api/handle-error';

const receiveSchema = z.object({
  lines: z
    .array(
      z.object({
        lineId: z.string().uuid(),
        qtyReceived: z.number().positive(),
      }),
    )
    .min(1),
});

/** POST /api/v1/purchasing/purchase-orders/[id]/receive */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = getAuthContextFromHeaders(request);
    await checkPermission(auth, 'purchasing.purchase_order.update');
    const { id } = await params;
    const body = receiveSchema.parse(await request.json());
    const order = await purchaseOrderService.receive(auth.companyId, id, auth.userId, body.lines);
    return NextResponse.json({
      success: true,
      data: order,
      message: `Orden ${order.orderNumber ?? id} marcada como recibida`,
    });
  } catch (error) {
    return handleApiError(error, 'POST /api/v1/purchasing/purchase-orders/[id]/receive');
  }
}
