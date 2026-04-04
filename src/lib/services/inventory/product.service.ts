// src/lib/services/inventory/product.service.ts
import basePrisma from '@/lib/db/prisma';
import { createTenantPrisma } from '@/lib/db/tenant-extension';
import type { CreateProductInput, UpdateProductInput } from '@/lib/validations/inventory.schema';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ProductRow {
  id: string;
  code: string;
  name: string;
  description: string | null;
  barcode: string | null;
  trackingType: 'NONE' | 'LOT' | 'SERIAL';
  costPrice: string;
  salePrice: string;
  isActive: boolean;
  unitOfMeasureId: string;
  unitOfMeasureSymbol: string;
  categoryId: string | null;
  categoryName: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProductListResult {
  success: boolean;
  products: ProductRow[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const productService = {
  async listProducts(
    companyId: string,
    opts: {
      page?: number;
      limit?: number;
      search?: string;
      categoryId?: string;
      trackingType?: 'NONE' | 'LOT' | 'SERIAL';
      activeOnly?: boolean;
    } = {},
  ): Promise<ProductListResult> {
    const db = createTenantPrisma(basePrisma, companyId);
    const page = Math.max(1, opts.page ?? 1);
    const limit = Math.min(100, opts.limit ?? 20);
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { companyId };
    if (opts.activeOnly !== false) where.isActive = true;
    if (opts.trackingType) where.trackingType = opts.trackingType;
    if (opts.categoryId) where.categoryId = opts.categoryId;
    if (opts.search) {
      where.OR = [
        { name: { contains: opts.search, mode: 'insensitive' } },
        { code: { contains: opts.search, mode: 'insensitive' } },
        { barcode: { contains: opts.search, mode: 'insensitive' } },
      ];
    }

    const [products, total] = await Promise.all([
      db.product.findMany({
        where,
        include: {
          unitOfMeasure: { select: { symbol: true } },
          category: { select: { name: true } },
        },
        orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
        skip,
        take: limit,
      }),
      db.product.count({ where }),
    ]);

    return {
      success: true,
      products: products.map((p) => ({
        id: p.id,
        code: p.code,
        name: p.name,
        description: p.description,
        barcode: p.barcode,
        trackingType: p.trackingType,
        costPrice: p.costPrice.toString(),
        salePrice: p.salePrice.toString(),
        isActive: p.isActive,
        unitOfMeasureId: p.unitOfMeasureId,
        unitOfMeasureSymbol: p.unitOfMeasure.symbol,
        categoryId: p.categoryId,
        categoryName: p.category?.name ?? null,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  async getProduct(companyId: string, id: string): Promise<ProductRow> {
    const db = createTenantPrisma(basePrisma, companyId);
    const p = await db.product.findFirst({
      where: { id, companyId },
      include: {
        unitOfMeasure: { select: { symbol: true } },
        category: { select: { name: true } },
      },
    });
    if (!p) throw new Error('Producto no encontrado');
    return {
      id: p.id,
      code: p.code,
      name: p.name,
      description: p.description,
      barcode: p.barcode,
      trackingType: p.trackingType,
      costPrice: p.costPrice.toString(),
      salePrice: p.salePrice.toString(),
      isActive: p.isActive,
      unitOfMeasureId: p.unitOfMeasureId,
      unitOfMeasureSymbol: p.unitOfMeasure.symbol,
      categoryId: p.categoryId,
      categoryName: p.category?.name ?? null,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    };
  },

  async createProduct(companyId: string, input: CreateProductInput): Promise<ProductRow> {
    const db = createTenantPrisma(basePrisma, companyId);

    // Verify UoM belongs to company
    const uom = await db.unitOfMeasure.findFirst({
      where: { id: input.unitOfMeasureId, companyId },
    });
    if (!uom) throw new Error('Unidad de medida no encontrada');

    const p = await db.product.create({
      data: {
        companyId,
        code: input.code,
        name: input.name,
        description: input.description,
        barcode: input.barcode,
        unitOfMeasureId: input.unitOfMeasureId,
        categoryId: input.categoryId,
        trackingType: input.trackingType ?? 'NONE',
        costPrice: input.costPrice ?? 0,
        salePrice: input.salePrice ?? 0,
        inventoryAccountId: input.inventoryAccountId,
        cogsAccountId: input.cogsAccountId,
      },
      include: {
        unitOfMeasure: { select: { symbol: true } },
        category: { select: { name: true } },
      },
    });

    return {
      id: p.id,
      code: p.code,
      name: p.name,
      description: p.description,
      barcode: p.barcode,
      trackingType: p.trackingType,
      costPrice: p.costPrice.toString(),
      salePrice: p.salePrice.toString(),
      isActive: p.isActive,
      unitOfMeasureId: p.unitOfMeasureId,
      unitOfMeasureSymbol: p.unitOfMeasure.symbol,
      categoryId: p.categoryId,
      categoryName: p.category?.name ?? null,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    };
  },

  async updateProduct(
    companyId: string,
    id: string,
    input: UpdateProductInput,
  ): Promise<ProductRow> {
    const db = createTenantPrisma(basePrisma, companyId);

    const existing = await db.product.findFirst({ where: { id, companyId } });
    if (!existing) throw new Error('Producto no encontrado');

    const p = await db.product.update({
      where: { id },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.description !== undefined && { description: input.description }),
        ...(input.barcode !== undefined && { barcode: input.barcode }),
        ...(input.categoryId !== undefined && { categoryId: input.categoryId }),
        ...(input.trackingType !== undefined && { trackingType: input.trackingType }),
        ...(input.costPrice !== undefined && { costPrice: input.costPrice }),
        ...(input.salePrice !== undefined && { salePrice: input.salePrice }),
        ...(input.inventoryAccountId !== undefined && {
          inventoryAccountId: input.inventoryAccountId,
        }),
        ...(input.cogsAccountId !== undefined && { cogsAccountId: input.cogsAccountId }),
        ...(input.isActive !== undefined && { isActive: input.isActive }),
      },
      include: {
        unitOfMeasure: { select: { symbol: true } },
        category: { select: { name: true } },
      },
    });

    return {
      id: p.id,
      code: p.code,
      name: p.name,
      description: p.description,
      barcode: p.barcode,
      trackingType: p.trackingType,
      costPrice: p.costPrice.toString(),
      salePrice: p.salePrice.toString(),
      isActive: p.isActive,
      unitOfMeasureId: p.unitOfMeasureId,
      unitOfMeasureSymbol: p.unitOfMeasure.symbol,
      categoryId: p.categoryId,
      categoryName: p.category?.name ?? null,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    };
  },
};
