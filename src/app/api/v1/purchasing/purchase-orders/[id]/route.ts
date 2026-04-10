// src/app/api/v1/purchasing/purchase-orders/[id]/route.ts
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthContextFromHeaders } from '@/lib/auth/request-auth';
import { checkPermission } from '@/lib/permissions/check-permission';
import { purchaseOrderService } from '@/lib/services/purchasing/purchase-order.service';
import { handleApiError } from '@/lib/api/handle-error';

const poLineSchema = z.object({
  productId: z.string().uuid('Producto requerido'),
  description: z.string().max(300).optional(),
  qtyOrdered: z.number().positive('La cantidad debe ser mayor a 0'),
  unitPrice: z.number().min(0),
  discountPct: z.number().min(0).max(100).default(0),
  taxRateId: z.string().uuid('Tasa de impuesto requerida'),
  accountId: z.string().uuid().optional(),
});

const updatePurchaseOrderSchema = z.object({
  supplierId: z.string().uuid('Proveedor requerido'),
  expectedDate: z.string().datetime({ offset: true }),
  warehouseId: z.string().uuid().optional(),
  currencyCode: z.string().length(3).default('HNL'),
  exchangeRate: z.number().positive().default(1),
  paymentTermsId: z.string().uuid().optional(),
  notes: z.string().max(500).optional(),
  lines: z.array(poLineSchema).min(1, 'Se requiere al menos una línea'),
});

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

/** PUT /api/v1/purchasing/purchase-orders/[id] — editar orden en DRAFT */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = getAuthContextFromHeaders(request);
    await checkPermission(auth, 'purchasing.purchase_order.update');
    const { id } = await params;
    const body = updatePurchaseOrderSchema.parse(await request.json());
    const order = await purchaseOrderService.updateOrder(auth.companyId, id, {
      ...body,
      expectedDate: new Date(body.expectedDate),
      updatedBy: auth.userId,
    });
    return NextResponse.json({ success: true, data: order });
  } catch (error) {
    return handleApiError(error, 'PUT /api/v1/purchasing/purchase-orders/[id]');
  }
}
