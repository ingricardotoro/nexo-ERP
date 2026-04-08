// src/app/api/v1/purchasing/purchase-orders/[id]/create-supplier-invoice/route.ts
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getAuthContextFromHeaders } from '@/lib/auth/request-auth';
import { checkPermission } from '@/lib/permissions/check-permission';
import { supplierInvoiceService } from '@/lib/services/invoicing/supplier-invoice.service';
import { handleApiError } from '@/lib/api/handle-error';

/** POST /api/v1/purchasing/purchase-orders/[id]/create-supplier-invoice
 *
 * Converts a RECEIVED PurchaseOrder into a DRAFT SupplierInvoice.
 * Requires: purchasing.purchase_order.update + invoicing.invoice.create permissions.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = getAuthContextFromHeaders(request);
    await checkPermission(auth, 'purchasing.purchase_order.update');
    await checkPermission(auth, 'invoicing.invoice.create');
    const { id } = await params;
    const invoice = await supplierInvoiceService.createFromPurchaseOrder(
      auth.companyId,
      id,
      auth.userId,
    );
    return NextResponse.json(
      {
        success: true,
        data: invoice,
        message: 'Factura de compra creada en borrador desde la orden',
      },
      { status: 201 },
    );
  } catch (error) {
    return handleApiError(
      error,
      'POST /api/v1/purchasing/purchase-orders/[id]/create-supplier-invoice',
    );
  }
}
