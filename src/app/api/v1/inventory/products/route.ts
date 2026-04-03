// src/app/api/v1/inventory/products/route.ts
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getAuthContextFromHeaders } from '@/lib/auth/request-auth';
import { checkPermission } from '@/lib/permissions/check-permission';
import { productService } from '@/lib/services/inventory/product.service';
import { createProductSchema } from '@/lib/validations/inventory.schema';
import { handleApiError } from '@/lib/api/handle-error';

/** GET /api/v1/inventory/products */
export async function GET(request: NextRequest) {
  try {
    const auth = getAuthContextFromHeaders(request);
    await checkPermission(auth, 'inventory.product.read');

    const { searchParams } = request.nextUrl;
    const result = await productService.listProducts(auth.companyId, {
      page: Number(searchParams.get('page') ?? '1'),
      limit: Number(searchParams.get('limit') ?? '20'),
      search: searchParams.get('search') ?? undefined,
      categoryId: searchParams.get('categoryId') ?? undefined,
      trackingType:
        (searchParams.get('trackingType') as 'NONE' | 'LOT' | 'SERIAL' | null) ?? undefined,
      activeOnly: searchParams.get('activeOnly') !== 'false',
    });

    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error, 'GET /api/v1/inventory/products');
  }
}

/** POST /api/v1/inventory/products */
export async function POST(request: NextRequest) {
  try {
    const auth = getAuthContextFromHeaders(request);
    await checkPermission(auth, 'inventory.product.create');

    const body = await request.json();
    const input = createProductSchema.parse(body);
    const product = await productService.createProduct(auth.companyId, input);

    return NextResponse.json(
      { success: true, data: product, message: 'Producto creado exitosamente' },
      { status: 201 },
    );
  } catch (error) {
    return handleApiError(error, 'POST /api/v1/inventory/products');
  }
}
