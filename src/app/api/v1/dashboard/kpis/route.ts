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
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const [
      monthlySalesResult,
      pendingInvoicesResult,
      overdueInvoicesResult,
      confirmedSalesOrders,
      draftSalesOrders,
      confirmedPurchaseOrders,
      expiringLots,
      expiringCais,
    ] = await Promise.all([
      // Ventas del mes: facturas PUBLISHED emitidas este mes
      db.invoice.aggregate({
        where: {
          companyId: auth.companyId,
          status: 'PUBLISHED',
          issueDate: { gte: monthStart, lte: monthEnd },
        },
        _sum: { total: true },
        _count: true,
      }),

      // CxC pendiente: facturas PUBLISHED (por cobrar)
      db.invoice.aggregate({
        where: { companyId: auth.companyId, status: 'PUBLISHED' },
        _sum: { total: true },
        _count: true,
      }),

      // CxC vencida: facturas PUBLISHED con dueDate < hoy
      db.invoice.aggregate({
        where: {
          companyId: auth.companyId,
          status: 'PUBLISHED',
          dueDate: { lt: now },
        },
        _sum: { total: true },
        _count: true,
      }),

      // Pedidos de venta activos (CONFIRMED)
      db.salesOrder.count({
        where: { companyId: auth.companyId, status: 'CONFIRMED' },
      }),

      // Pedidos de venta en borrador
      db.salesOrder.count({
        where: { companyId: auth.companyId, status: 'DRAFT' },
      }),

      // Órdenes de compra activas (CONFIRMED — pendientes de recibir)
      db.purchaseOrder.count({
        where: { companyId: auth.companyId, status: 'CONFIRMED' },
      }),

      // Lotes venciendo en ≤30 días con stock > 0
      db.lot.count({
        where: {
          companyId: auth.companyId,
          expirationDate: {
            not: null as unknown as Date,
            lte: thirtyDaysFromNow,
            gte: now,
          },
          stockQuants: { some: { quantity: { gt: 0 } } },
        },
      }),

      // CAIs venciendo en ≤30 días
      db.cAI.findMany({
        where: {
          companyId: auth.companyId,
          isActive: true,
          expiresAt: { lte: thirtyDaysFromNow, gte: now },
        },
        select: { caiCode: true, documentType: true, expiresAt: true },
        orderBy: { expiresAt: 'asc' },
        take: 3,
      }),
    ]);

    // Días hasta el CAI más próximo a vencer
    const nearestCai = expiringCais[0];
    const caiDaysLeft = nearestCai
      ? Math.ceil(
          (new Date(nearestCai.expiresAt).getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
        )
      : null;

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
        overdueReceivables: {
          amount: overdueInvoicesResult._sum?.total?.toString() ?? '0',
          count: overdueInvoicesResult._count ?? 0,
        },
        activeSalesOrders: confirmedSalesOrders,
        draftSalesOrders,
        activePurchaseOrders: confirmedPurchaseOrders,
        expiringLotsCount: expiringLots,
        caiAlert: nearestCai
          ? {
              daysLeft: caiDaysLeft,
              documentType: nearestCai.documentType,
              count: expiringCais.length,
            }
          : null,
      },
    });
  } catch (error) {
    return handleApiError(error, 'GET /api/v1/dashboard/kpis');
  }
}
