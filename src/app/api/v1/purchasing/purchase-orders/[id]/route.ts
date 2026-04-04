// src/app/api/v1/purchasing/purchase-orders/[id]/route.ts
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getAuthContextFromHeaders } from '@/lib/auth/request-auth';
import { checkPermission } from '@/lib/permissions/check-permission';
import { purchaseOrderService } from '@/lib/services/purchasing/purchase-order.service';
import { handleApiError } from '@/lib/api/handle-error';

/** GET /api/v1/purchasing/purchase-orders/[id] */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = getAuthContextFromHeaders(request);
    await checkPermission(auth, 'purchasing.purchase_order.read');
    const { id } = await params;
    const order = await purchaseOrderService.getOrder(auth.companyId, id);
    return NextResponse.json({ success: true, data: order });
  } catch (error) {
    return handleApiError(error, 'GET /api/v1/purchasing/purchase-orders/[id]');
  }
}
