// src/app/api/v1/dashboard/kpis/route.ts
//
// Returns real-time KPIs for the main dashboard:
// - Monthly sales (ISSUED invoices this calendar month)
// - Pending invoices (ISSUED, not fully collected)
// - Accounts Receivable balance (invoices not PAID)
// - Accounts Payable balance (supplier invoices not PAID)
// - Active sales orders (CONFIRMED)
// - Active purchase orders (CONFIRMED)
// - Stock expiry alerts count (lots expiring in ≤30 days with stock > 0)

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getAuthContextFromHeaders } from '@/lib/auth/request-auth';
import { checkPermission } from '@/lib/permissions/check-permission';
import { handleApiError } from '@/lib/api/handle-error';
import basePrisma from '@/lib/db/prisma';
import { createTenantPrisma } from '@/lib/db/tenant-extension';

/** GET /api/v1/dashboard/kpis */
export async function GET(request: NextRequest) {
  try {
    const auth = getAuthContextFromHeaders(request);
    await checkPermission(auth, 'core.dashboard.read');
    const db = createTenantPrisma(basePrisma, auth.companyId);

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    // Run all KPI queries in parallel
    const [
      monthlySalesResult,
      pendingInvoicesResult,
      confirmedSalesOrders,
      confirmedPurchaseOrders,
      expiringLots,
    ] = await Promise.all([
      // Monthly sales: sum of PUBLISHED invoices this month
      db.invoice.aggregate({
        where: {
          companyId: auth.companyId,
          status: 'PUBLISHED',
          issueDate: { gte: monthStart, lte: monthEnd },
        },
        _sum: { total: true },
        _count: true,
      }),

      // Pending invoices: PUBLISHED invoices (not yet PAID)
      db.invoice.aggregate({
        where: {
          companyId: auth.companyId,
          status: 'PUBLISHED',
        },
        _sum: { total: true },
        _count: true,
      }),

      // Active sales orders
      db.salesOrder.count({
        where: { companyId: auth.companyId, status: 'CONFIRMED' },
      }),

      // Active purchase orders
      db.purchaseOrder.count({
        where: { companyId: auth.companyId, status: 'CONFIRMED' },
      }),

      // Lots expiring in ≤30 days with stock > 0
      db.lot.count({
        where: {
          companyId: auth.companyId,
          expirationDate: {
            not: null as unknown as Date,
            lte: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
            gte: now,
          },
          stockQuants: { some: { quantity: { gt: 0 } } },
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        monthlySales: {
          amount: monthlySalesResult._sum?.total?.toString() ?? '0',
          count: monthlySalesResult._count ?? 0,
          month: now.toLocaleDateString('es-HN', { month: 'long', year: 'numeric' }),
        },
        pendingInvoices: {
          amount: pendingInvoicesResult._sum?.total?.toString() ?? '0',
          count: pendingInvoicesResult._count ?? 0,
        },
        activeSalesOrders: confirmedSalesOrders,
        activePurchaseOrders: confirmedPurchaseOrders,
        expiringLotsCount: expiringLots,
      },
    });
  } catch (error) {
    return handleApiError(error, 'GET /api/v1/dashboard/kpis');
  }
}
