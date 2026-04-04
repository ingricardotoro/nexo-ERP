// src/app/api/v1/inventory/products/[id]/route.ts
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getAuthContextFromHeaders } from '@/lib/auth/request-auth';
import { checkPermission } from '@/lib/permissions/check-permission';
import { productService } from '@/lib/services/inventory/product.service';
import { updateProductSchema } from '@/lib/validations/inventory.schema';
import { handleApiError } from '@/lib/api/handle-error';

/** GET /api/v1/inventory/products/[id] */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = getAuthContextFromHeaders(request);
    await checkPermission(auth, 'inventory.product.read');
    const { id } = await params;
    const product = await productService.getProduct(auth.companyId, id);
    return NextResponse.json({ success: true, data: product });
  } catch (error) {
    return handleApiError(error, 'GET /api/v1/inventory/products/[id]');
  }
}

/** PATCH /api/v1/inventory/products/[id] */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = getAuthContextFromHeaders(request);
    await checkPermission(auth, 'inventory.product.update');
    const { id } = await params;
    const body = await request.json();
    const input = updateProductSchema.parse(body);
    const product = await productService.updateProduct(auth.companyId, id, input);
    return NextResponse.json({ success: true, data: product, message: 'Producto actualizado' });
  } catch (error) {
    return handleApiError(error, 'PATCH /api/v1/inventory/products/[id]');
  }
}
