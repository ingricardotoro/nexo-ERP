// src/app/api/v1/inventory/reports/valuation/route.ts
//
// Inventory valuation report: for each product, returns
// total qty on hand and total value (qty × costPrice) across all INTERNAL locations.

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getAuthContextFromHeaders } from '@/lib/auth/request-auth';
import { checkPermission } from '@/lib/permissions/check-permission';
import { handleApiError } from '@/lib/api/handle-error';
import basePrisma from '@/lib/db/prisma';
import { createTenantPrisma } from '@/lib/db/tenant-extension';

/** GET /api/v1/inventory/reports/valuation */
export async function GET(request: NextRequest) {
  try {
    const auth = getAuthContextFromHeaders(request);
    await checkPermission(auth, 'inventory.stock.read');
    const db = createTenantPrisma(basePrisma, auth.companyId);

    const { searchParams } = request.nextUrl;
    const categoryId = searchParams.get('categoryId') ?? undefined;
    const activeOnly = searchParams.get('activeOnly') !== 'false';

    // Aggregate stock quants for INTERNAL locations, grouped by product
    const quants = await db.stockQuant.findMany({
      where: {
        companyId: auth.companyId,
        quantity: { gt: 0 },
        location: { locationType: 'INTERNAL' },
        product: {
          ...(activeOnly ? { isActive: true } : {}),
          ...(categoryId ? { categoryId } : {}),
        },
      },
      select: {
        quantity: true,
        product: {
          select: {
            id: true,
            code: true,
            name: true,
            costPrice: true,
            unitOfMeasure: { select: { name: true, symbol: true } },
            category: { select: { name: true } },
          },
        },
      },
    });

    // Group by product
    const productMap = new Map<
      string,
      {
        productId: string;
        productCode: string;
        productName: string;
        categoryName: string | null;
        uomName: string;
        uomSymbol: string | null;
        costPrice: string;
        totalQty: number;
        totalValue: number;
      }
    >();

    for (const q of quants) {
      const pid = q.product.id;
      const qty = parseFloat(q.quantity.toString());
      const cost = parseFloat(q.product.costPrice?.toString() ?? '0');

      if (!productMap.has(pid)) {
        productMap.set(pid, {
          productId: pid,
          productCode: q.product.code,
          productName: q.product.name,
          categoryName: q.product.category?.name ?? null,
          uomName: q.product.unitOfMeasure.name,
          uomSymbol: q.product.unitOfMeasure.symbol ?? null,
          costPrice: cost.toFixed(4),
          totalQty: 0,
          totalValue: 0,
        });
      }

      const entry = productMap.get(pid)!;
      entry.totalQty += qty;
      entry.totalValue += qty * cost;
    }

    const rows = [...productMap.values()].map((r) => ({
      ...r,
      totalQty: parseFloat(r.totalQty.toFixed(4)),
      totalValue: parseFloat(r.totalValue.toFixed(2)),
    }));

    // Sort by totalValue DESC
    rows.sort((a, b) => b.totalValue - a.totalValue);

    const grandTotal = rows.reduce((acc, r) => acc + r.totalValue, 0);

    return NextResponse.json({
      success: true,
      data: {
        rows,
        grandTotal: parseFloat(grandTotal.toFixed(2)),
        productCount: rows.length,
      },
    });
  } catch (error) {
    return handleApiError(error, 'GET /api/v1/inventory/reports/valuation');
  }
}
