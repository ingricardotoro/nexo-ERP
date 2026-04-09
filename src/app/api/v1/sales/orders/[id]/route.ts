// src/app/api/v1/sales/orders/[id]/route.ts
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthContextFromHeaders } from '@/lib/auth/request-auth';
import { checkPermission } from '@/lib/permissions/check-permission';
import { salesOrderService } from '@/lib/services/sales/sales-order.service';
import { handleApiError } from '@/lib/api/handle-error';

const soLineSchema = z.object({
  productId: z.string().uuid('Producto requerido'),
  description: z.string().max(300).optional(),
  qtyOrdered: z.number().positive('La cantidad debe ser mayor a 0'),
  unitPrice: z.number().min(0),
  discountPct: z.number().min(0).max(100).default(0),
  taxRateId: z.string().uuid('Tasa de impuesto requerida'),
  accountId: z.string().uuid().optional(),
});

const updateSalesOrderSchema = z.object({
  customerId: z.string().uuid('Cliente requerido'),
  deliveryDate: z.string().datetime({ offset: true }),
  warehouseId: z.string().uuid().optional(),
  currencyCode: z.string().length(3).default('HNL'),
  exchangeRate: z.number().positive().default(1),
  paymentTermsId: z.string().uuid().optional(),
  notes: z.string().max(500).optional(),
  lines: z.array(soLineSchema).min(1, 'Se requiere al menos una línea'),
});

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

/** PUT /api/v1/sales/orders/[id] — editar pedido en DRAFT */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = getAuthContextFromHeaders(request);
    await checkPermission(auth, 'sales.order.update');
    const { id } = await params;
    const body = updateSalesOrderSchema.parse(await request.json());
    const order = await salesOrderService.updateOrder(auth.companyId, id, {
      ...body,
      deliveryDate: new Date(body.deliveryDate),
      updatedBy: auth.userId,
    });
    return NextResponse.json({ success: true, data: order });
  } catch (error) {
    return handleApiError(error, 'PUT /api/v1/sales/orders/[id]');
  }
}
