// src/app/api/v1/sales/orders/[id]/create-invoice/route.ts
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getAuthContextFromHeaders } from '@/lib/auth/request-auth';
import { checkPermission } from '@/lib/permissions/check-permission';
import { invoiceService } from '@/lib/services/invoicing/invoice.service';
import { handleApiError } from '@/lib/api/handle-error';

/** POST /api/v1/sales/orders/[id]/create-invoice
 *
 * Converts a CONFIRMED or DELIVERED SalesOrder into a DRAFT Invoice.
 * Requires: sales.order.update + invoicing.invoice.create permissions.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = getAuthContextFromHeaders(request);
    await checkPermission(auth, 'sales.order.update');
    await checkPermission(auth, 'invoicing.invoice.create');
    const { id } = await params;
    const invoice = await invoiceService.createFromSalesOrder(auth.companyId, id, auth.userId);
    return NextResponse.json(
      { success: true, data: invoice, message: 'Factura creada en borrador desde el pedido' },
      { status: 201 },
    );
  } catch (error) {
    return handleApiError(error, 'POST /api/v1/sales/orders/[id]/create-invoice');
  }
}
