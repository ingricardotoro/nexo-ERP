// src/lib/services/inventory/warehouse.service.ts
import basePrisma from '@/lib/db/prisma';
import { createTenantPrisma } from '@/lib/db/tenant-extension';
import type {
  CreateWarehouseInput,
  UpdateWarehouseInput,
} from '@/lib/validations/inventory.schema';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WarehouseRow {
  id: string;
  code: string;
  name: string;
  address: string | null;
  city: string | null;
  isActive: boolean;
  locationCount: number;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const warehouseService = {
  async listWarehouses(
    companyId: string,
    opts: { activeOnly?: boolean } = {},
  ): Promise<WarehouseRow[]> {
    const db = createTenantPrisma(basePrisma, companyId);
    const where: Record<string, unknown> = { companyId };
    if (opts.activeOnly !== false) where.isActive = true;

    const warehouses = await db.warehouse.findMany({
      where,
      include: {
        _count: { select: { locations: true } },
      },
      orderBy: [{ isActive: 'desc' }, { code: 'asc' }],
    });

    return warehouses.map((w) => ({
      id: w.id,
      code: w.code,
      name: w.name,
      address: w.address,
      city: w.city,
      isActive: w.isActive,
      locationCount: w._count.locations,
      createdAt: w.createdAt,
      updatedAt: w.updatedAt,
    }));
  },

  async getWarehouse(companyId: string, id: string): Promise<WarehouseRow> {
    const db = createTenantPrisma(basePrisma, companyId);
    const w = await db.warehouse.findFirst({
      where: { id, companyId },
      include: { _count: { select: { locations: true } } },
    });
    if (!w) throw new Error('Almacén no encontrado');
    return {
      id: w.id,
      code: w.code,
      name: w.name,
      address: w.address,
      city: w.city,
      isActive: w.isActive,
      locationCount: w._count.locations,
      createdAt: w.createdAt,
      updatedAt: w.updatedAt,
    };
  },

  async createWarehouse(companyId: string, input: CreateWarehouseInput): Promise<WarehouseRow> {
    const db = createTenantPrisma(basePrisma, companyId);

    const w = await db.warehouse.create({
      data: {
        companyId,
        code: input.code,
        name: input.name,
        address: input.address,
        city: input.city,
      },
      include: { _count: { select: { locations: true } } },
    });

    // Seed virtual locations for this warehouse
    await db.location.createMany({
      data: [
        {
          companyId,
          warehouseId: w.id,
          locationType: 'INTERNAL',
          name: w.name,
          fullPath: `${w.code}`,
        },
      ],
    });

    return {
      id: w.id,
      code: w.code,
      name: w.name,
      address: w.address,
      city: w.city,
      isActive: w.isActive,
      locationCount: w._count.locations,
      createdAt: w.createdAt,
      updatedAt: w.updatedAt,
    };
  },

  async updateWarehouse(
    companyId: string,
    id: string,
    input: UpdateWarehouseInput,
  ): Promise<WarehouseRow> {
    const db = createTenantPrisma(basePrisma, companyId);
    const existing = await db.warehouse.findFirst({ where: { id, companyId } });
    if (!existing) throw new Error('Almacén no encontrado');

    const w = await db.warehouse.update({
      where: { id },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.address !== undefined && { address: input.address }),
        ...(input.city !== undefined && { city: input.city }),
        ...(input.isActive !== undefined && { isActive: input.isActive }),
      },
      include: { _count: { select: { locations: true } } },
    });

    return {
      id: w.id,
      code: w.code,
      name: w.name,
      address: w.address,
      city: w.city,
      isActive: w.isActive,
      locationCount: w._count.locations,
      createdAt: w.createdAt,
      updatedAt: w.updatedAt,
    };
  },
};
