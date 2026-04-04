// src/app/api/v1/sales/orders/route.ts
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

const createSalesOrderSchema = z.object({
  customerId: z.string().uuid('Cliente requerido'),
  deliveryDate: z.string().datetime({ offset: true }),
  warehouseId: z.string().uuid().optional(),
  currencyCode: z.string().length(3).default('HNL'),
  exchangeRate: z.number().positive().default(1),
  paymentTermsId: z.string().uuid().optional(),
  notes: z.string().max(500).optional(),
  lines: z.array(soLineSchema).min(1, 'Se requiere al menos una línea'),
});

/** GET /api/v1/sales/orders */
export async function GET(request: NextRequest) {
  try {
    const auth = getAuthContextFromHeaders(request);
    await checkPermission(auth, 'sales.order.read');
    const { searchParams } = request.nextUrl;
    const result = await salesOrderService.listOrders(auth.companyId, {
      page: Number(searchParams.get('page') ?? '1'),
      limit: Number(searchParams.get('limit') ?? '20'),
      search: searchParams.get('search') ?? undefined,
      status: searchParams.get('status') ?? undefined,
    });
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error, 'GET /api/v1/sales/orders');
  }
}

/** POST /api/v1/sales/orders */
export async function POST(request: NextRequest) {
  try {
    const auth = getAuthContextFromHeaders(request);
    await checkPermission(auth, 'sales.order.create');
    const body = await request.json();
    const input = createSalesOrderSchema.parse(body);
    const order = await salesOrderService.createOrder(auth.companyId, {
      ...input,
      deliveryDate: new Date(input.deliveryDate),
      createdBy: auth.userId,
    });
    return NextResponse.json(
      { success: true, data: order, message: 'Pedido de venta creado' },
      { status: 201 },
    );
  } catch (error) {
    return handleApiError(error, 'POST /api/v1/sales/orders');
  }
}
