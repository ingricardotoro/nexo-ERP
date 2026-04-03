// src/lib/services/inventory/uom.service.ts
import basePrisma from '@/lib/db/prisma';
import { createTenantPrisma } from '@/lib/db/tenant-extension';
import type {
  CreateUnitOfMeasureInput,
  UpdateUnitOfMeasureInput,
} from '@/lib/validations/inventory.schema';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UomRow {
  id: string;
  name: string;
  symbol: string;
  isActive: boolean;
  productCount: number;
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const uomService = {
  async listUoms(companyId: string, opts: { activeOnly?: boolean } = {}): Promise<UomRow[]> {
    const db = createTenantPrisma(basePrisma, companyId);
    const where: Record<string, unknown> = { companyId };
    if (opts.activeOnly !== false) where.isActive = true;

    const uoms = await db.unitOfMeasure.findMany({
      where,
      include: { _count: { select: { products: true } } },
      orderBy: [{ isActive: 'desc' }, { symbol: 'asc' }],
    });

    return uoms.map((u) => ({
      id: u.id,
      name: u.name,
      symbol: u.symbol,
      isActive: u.isActive,
      productCount: u._count.products,
    }));
  },

  async createUom(companyId: string, input: CreateUnitOfMeasureInput): Promise<UomRow> {
    const db = createTenantPrisma(basePrisma, companyId);
    const u = await db.unitOfMeasure.create({
      data: { companyId, name: input.name, symbol: input.symbol },
      include: { _count: { select: { products: true } } },
    });
    return { id: u.id, name: u.name, symbol: u.symbol, isActive: u.isActive, productCount: 0 };
  },

  async updateUom(companyId: string, id: string, input: UpdateUnitOfMeasureInput): Promise<UomRow> {
    const db = createTenantPrisma(basePrisma, companyId);
    const existing = await db.unitOfMeasure.findFirst({ where: { id, companyId } });
    if (!existing) throw new Error('Unidad de medida no encontrada');

    const u = await db.unitOfMeasure.update({
      where: { id },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.isActive !== undefined && { isActive: input.isActive }),
      },
      include: { _count: { select: { products: true } } },
    });
    return {
      id: u.id,
      name: u.name,
      symbol: u.symbol,
      isActive: u.isActive,
      productCount: u._count.products,
    };
  },
};
