// src/app/api/v1/purchasing/purchase-orders/[id]/cancel/route.ts
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthContextFromHeaders } from '@/lib/auth/request-auth';
import { checkPermission } from '@/lib/permissions/check-permission';
import { purchaseOrderService } from '@/lib/services/purchasing/purchase-order.service';
import { handleApiError } from '@/lib/api/handle-error';

const cancelSchema = z.object({
  cancelReason: z.string().min(1, 'El motivo de cancelación es requerido').max(300),
});

/** POST /api/v1/purchasing/purchase-orders/[id]/cancel */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = getAuthContextFromHeaders(request);
    await checkPermission(auth, 'purchasing.purchase_order.update');
    const { id } = await params;
    const body = await request.json();
    const { cancelReason } = cancelSchema.parse(body);
    await purchaseOrderService.cancelOrder(auth.companyId, id, auth.userId, cancelReason);
    return NextResponse.json({ success: true, message: 'Orden de compra cancelada' });
  } catch (error) {
    return handleApiError(error, 'POST /api/v1/purchasing/purchase-orders/[id]/cancel');
  }
}
