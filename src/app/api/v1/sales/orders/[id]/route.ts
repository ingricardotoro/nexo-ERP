// src/app/api/v1/sales/orders/[id]/route.ts
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getAuthContextFromHeaders } from '@/lib/auth/request-auth';
import { checkPermission } from '@/lib/permissions/check-permission';
import { salesOrderService } from '@/lib/services/sales/sales-order.service';
import { handleApiError } from '@/lib/api/handle-error';

/** GET /api/v1/sales/orders/[id] */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = getAuthContextFromHeaders(request);
    await checkPermission(auth, 'sales.order.read');
    const { id } = await params;
    const order = await salesOrderService.getOrder(auth.companyId, id);
    return NextResponse.json({ success: true, data: order });
  } catch (error) {
    return handleApiError(error, 'GET /api/v1/sales/orders/[id]');
  }
}
