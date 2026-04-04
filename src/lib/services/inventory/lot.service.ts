// src/lib/services/inventory/lot.service.ts
import basePrisma from '@/lib/db/prisma';
import { createTenantPrisma } from '@/lib/db/tenant-extension';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LotRow {
  id: string;
  productId: string;
  productCode: string;
  productName: string;
  lotNumber: string;
  manufacturingDate: Date | null;
  expirationDate: Date | null;
  supplierId: string | null;
  supplierName: string | null;
  notes: string | null;
  isActive: boolean;
  totalStock: string; // suma de stock_quants
  daysUntilExpiry: number | null;
  alertLevel: 'ok' | 'warning' | 'critical' | 'expired';
  createdAt: Date;
}

export interface LotWithStock extends LotRow {
  stockByLocation: { locationId: string; locationName: string; quantity: string }[];
}

// Days thresholds for expiry alerts
const CRITICAL_DAYS = 15;
const WARNING_DAYS = 30;

function calcAlertLevel(expirationDate: Date | null): {
  daysUntilExpiry: number | null;
  alertLevel: 'ok' | 'warning' | 'critical' | 'expired';
} {
  if (!expirationDate) return { daysUntilExpiry: null, alertLevel: 'ok' };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const exp = new Date(expirationDate);
  exp.setHours(0, 0, 0, 0);
  const days = Math.ceil((exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (days < 0) return { daysUntilExpiry: days, alertLevel: 'expired' };
  if (days <= CRITICAL_DAYS) return { daysUntilExpiry: days, alertLevel: 'critical' };
  if (days <= WARNING_DAYS) return { daysUntilExpiry: days, alertLevel: 'warning' };
  return { daysUntilExpiry: days, alertLevel: 'ok' };
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const lotService = {
  /** Lista lotes con stock agregado, ordenados FEFO (expirationDate ASC nulls last). */
  async listLots(
    companyId: string,
    opts: {
      productId?: string;
      activeOnly?: boolean;
      withStockOnly?: boolean;
      search?: string;
    } = {},
  ): Promise<LotRow[]> {
    const db = createTenantPrisma(basePrisma, companyId);

    const where: Record<string, unknown> = { companyId };
    if (opts.activeOnly !== false) where.isActive = true;
    if (opts.productId) where.productId = opts.productId;
    if (opts.search) {
      where.OR = [
        { lotNumber: { contains: opts.search, mode: 'insensitive' } },
        { product: { name: { contains: opts.search, mode: 'insensitive' } } },
        { product: { code: { contains: opts.search, mode: 'insensitive' } } },
      ];
    }

    const lots = await db.lot.findMany({
      where,
      include: {
        product: { select: { code: true, name: true } },
        supplier: { select: { legalName: true } },
        stockQuants: { select: { quantity: true } },
      },
      orderBy: [
        // FEFO: null expiry last, earliest expiry first
        { expirationDate: { sort: 'asc', nulls: 'last' } },
        { lotNumber: 'asc' },
      ],
    });

    const rows: LotRow[] = lots.map((lot) => {
      const totalStock = lot.stockQuants
        .reduce((sum, q) => sum + parseFloat(q.quantity.toString()), 0)
        .toFixed(4);

      const { daysUntilExpiry, alertLevel } = calcAlertLevel(lot.expirationDate);

      return {
        id: lot.id,
        productId: lot.productId,
        productCode: lot.product.code,
        productName: lot.product.name,
        lotNumber: lot.lotNumber,
        manufacturingDate: lot.manufacturingDate,
        expirationDate: lot.expirationDate,
        supplierId: lot.supplierId,
        supplierName: lot.supplier?.legalName ?? null,
        notes: lot.notes,
        isActive: lot.isActive,
        totalStock,
        daysUntilExpiry,
        alertLevel,
        createdAt: lot.createdAt,
      };
    });

    if (opts.withStockOnly) {
      return rows.filter((r) => parseFloat(r.totalStock) > 0);
    }

    return rows;
  },

  /**
   * Lista lotes disponibles para un producto en una ubicación específica,
   * ordenados FEFO para selección en formularios de entrega.
   */
  async listAvailableLotsForDelivery(
    companyId: string,
    productId: string,
    fromLocationId: string,
  ): Promise<
    { lotId: string; lotNumber: string; expirationDate: Date | null; available: string }[]
  > {
    const db = createTenantPrisma(basePrisma, companyId);

    const quants = await db.stockQuant.findMany({
      where: {
        companyId,
        productId,
        locationId: fromLocationId,
        lotId: { not: null },
        quantity: { gt: 0 },
      },
      include: {
        lot: { select: { lotNumber: true, expirationDate: true, isActive: true } },
      },
      orderBy: [
        // FEFO: lots with earliest expiry first, nulls last
        { lot: { expirationDate: { sort: 'asc', nulls: 'last' } } },
      ],
    });

    return quants
      .filter((q) => q.lot?.isActive)
      .map((q) => ({
        lotId: q.lotId!,
        lotNumber: q.lot!.lotNumber,
        expirationDate: q.lot!.expirationDate,
        available: q.quantity.toString(),
      }));
  },

  async createLot(
    companyId: string,
    data: {
      productId: string;
      lotNumber: string;
      manufacturingDate?: Date;
      expirationDate?: Date;
      supplierId?: string;
      notes?: string;
    },
  ): Promise<LotRow> {
    const db = createTenantPrisma(basePrisma, companyId);

    const lot = await db.lot.create({
      data: {
        companyId,
        productId: data.productId,
        lotNumber: data.lotNumber,
        manufacturingDate: data.manufacturingDate,
        expirationDate: data.expirationDate,
        supplierId: data.supplierId,
        notes: data.notes,
      },
      include: {
        product: { select: { code: true, name: true } },
        supplier: { select: { legalName: true } },
        stockQuants: { select: { quantity: true } },
      },
    });

    const { daysUntilExpiry, alertLevel } = calcAlertLevel(lot.expirationDate);

    return {
      id: lot.id,
      productId: lot.productId,
      productCode: lot.product.code,
      productName: lot.product.name,
      lotNumber: lot.lotNumber,
      manufacturingDate: lot.manufacturingDate,
      expirationDate: lot.expirationDate,
      supplierId: lot.supplierId,
      supplierName: lot.supplier?.legalName ?? null,
      notes: lot.notes,
      isActive: lot.isActive,
      totalStock: '0.0000',
      daysUntilExpiry,
      alertLevel,
      createdAt: lot.createdAt,
    };
  },

  /** Devuelve lotes con alertas activas (expired, critical, warning). */
  async getExpiryAlerts(
    companyId: string,
  ): Promise<{ alertLevel: 'expired' | 'critical' | 'warning'; count: number }[]> {
    const lots = await this.listLots(companyId, { withStockOnly: true });
    const counts = { expired: 0, critical: 0, warning: 0 };
    for (const lot of lots) {
      if (lot.alertLevel === 'expired') counts.expired++;
      else if (lot.alertLevel === 'critical') counts.critical++;
      else if (lot.alertLevel === 'warning') counts.warning++;
    }
    return (
      [
        { alertLevel: 'expired' as const, count: counts.expired },
        { alertLevel: 'critical' as const, count: counts.critical },
        { alertLevel: 'warning' as const, count: counts.warning },
      ] satisfies { alertLevel: 'expired' | 'critical' | 'warning'; count: number }[]
    ).filter((a) => a.count > 0);
  },
};
