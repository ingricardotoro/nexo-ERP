// src/app/api/v1/sales/orders/[id]/cancel/route.ts
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthContextFromHeaders } from '@/lib/auth/request-auth';
import { checkPermission } from '@/lib/permissions/check-permission';
import { salesOrderService } from '@/lib/services/sales/sales-order.service';
import { handleApiError } from '@/lib/api/handle-error';

const cancelSchema = z.object({
  cancelReason: z.string().min(1, 'El motivo de cancelación es requerido').max(300),
});

/** POST /api/v1/sales/orders/[id]/cancel */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = getAuthContextFromHeaders(request);
    await checkPermission(auth, 'sales.order.update');
    const { id } = await params;
    const body = await request.json();
    const { cancelReason } = cancelSchema.parse(body);
    await salesOrderService.cancelOrder(auth.companyId, id, auth.userId, cancelReason);
    return NextResponse.json({ success: true, message: 'Pedido de venta cancelado' });
  } catch (error) {
    return handleApiError(error, 'POST /api/v1/sales/orders/[id]/cancel');
  }
}
