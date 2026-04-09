// src/app/api/v1/inventory/stock/route.ts
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getAuthContextFromHeaders } from '@/lib/auth/request-auth';
import { checkPermission } from '@/lib/permissions/check-permission';
import { stockMoveService } from '@/lib/services/inventory/stock-move.service';
import { handleApiError } from '@/lib/api/handle-error';
import basePrisma from '@/lib/db/prisma';
import { createTenantPrisma } from '@/lib/db/tenant-extension';

/**
 * GET /api/v1/inventory/stock
 *
 * Sin parámetros → resumen de stock on-hand para todos los productos activos.
 * Con ?productId=... → stock detallado por ubicación para un producto.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = getAuthContextFromHeaders(request);
    await checkPermission(auth, 'inventory.product.read');

    const productId = request.nextUrl.searchParams.get('productId');

    if (productId) {
      // Detalle por producto (comportamiento original)
      const stock = await stockMoveService.getStockOnHand(auth.companyId, productId);
      return NextResponse.json({ success: true, data: stock });
    }

    // Vista general: stock on-hand agrupado por producto
    const db = createTenantPrisma(basePrisma, auth.companyId);
    const search = request.nextUrl.searchParams.get('search') ?? undefined;

    const products = await db.product.findMany({
      where: {
        companyId: auth.companyId,
        isActive: true,
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: 'insensitive' } },
                { code: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        code: true,
        name: true,
        uom: { select: { name: true, symbol: true } },
        category: { select: { name: true } },
        costPrice: true,
        stockQuants: {
          where: { companyId: auth.companyId },
          select: { quantity: true, reservedQty: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    const overview = products.map((p) => {
      const totalQty = p.stockQuants.reduce((sum, q) => sum + parseFloat(q.quantity.toString()), 0);
      const reservedQty = p.stockQuants.reduce(
        (sum, q) => sum + parseFloat(q.reservedQty.toString()),
        0,
      );
      return {
        productId: p.id,
        productCode: p.code,
        productName: p.name,
        categoryName: p.category?.name ?? null,
        uomSymbol: p.uom?.symbol ?? '',
        uomName: p.uom?.name ?? '',
        qtyOnHand: totalQty.toFixed(4),
        qtyReserved: reservedQty.toFixed(4),
        qtyAvailable: (totalQty - reservedQty).toFixed(4),
        costPrice: p.costPrice?.toString() ?? '0',
        stockValue: (totalQty * parseFloat(p.costPrice?.toString() ?? '0')).toFixed(2),
      };
    });

    return NextResponse.json({ success: true, data: overview });
  } catch (error) {
    return handleApiError(error, 'GET /api/v1/inventory/stock');
  }
}
