// src/lib/services/invoicing/tax-rate.service.ts
import basePrisma from '@/lib/db/prisma';
import { createTenantPrisma } from '@/lib/db/tenant-extension';
import {
  createTaxRateSchema,
  updateTaxRateSchema,
  type CreateTaxRateInput,
  type UpdateTaxRateInput,
} from '@/lib/validations/tax-rate.schema';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TaxRateRow {
  id: string;
  code: string;
  name: string;
  rate: string; // decimal string for precision (e.g. "0.1500")
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const taxRateService = {
  /** Lista todas las tasas de impuesto de la empresa. */
  async listTaxRates(companyId: string): Promise<TaxRateRow[]> {
    const db = createTenantPrisma(basePrisma, companyId);
    const rates = await db.taxRate.findMany({
      where: { companyId },
      orderBy: [{ isActive: 'desc' }, { code: 'asc' }],
    });
    return rates.map((r) => ({
      id: r.id,
      code: r.code,
      name: r.name,
      rate: r.rate.toString(),
      isActive: r.isActive,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));
  },

  /** Obtiene una tasa por ID. Lanza error si no pertenece a la empresa. */
  async getTaxRate(companyId: string, id: string): Promise<TaxRateRow> {
    const db = createTenantPrisma(basePrisma, companyId);
    const rate = await db.taxRate.findFirst({ where: { id, companyId } });
    if (!rate) throw new Error('Tasa de impuesto no encontrada');
    return {
      id: rate.id,
      code: rate.code,
      name: rate.name,
      rate: rate.rate.toString(),
      isActive: rate.isActive,
      createdAt: rate.createdAt,
      updatedAt: rate.updatedAt,
    };
  },

  /** Crea una nueva tasa de impuesto. El código debe ser único por empresa. */
  async createTaxRate(companyId: string, input: CreateTaxRateInput): Promise<TaxRateRow> {
    const data = createTaxRateSchema.parse(input);
    const db = createTenantPrisma(basePrisma, companyId);

    const existing = await db.taxRate.findUnique({
      where: { companyId_code: { companyId, code: data.code } },
    });
    if (existing) {
      throw new Error(`Ya existe una tasa con el código "${data.code}" en esta empresa`);
    }

    const rate = await db.taxRate.create({
      data: { companyId, ...data },
    });

    return {
      id: rate.id,
      code: rate.code,
      name: rate.name,
      rate: rate.rate.toString(),
      isActive: rate.isActive,
      createdAt: rate.createdAt,
      updatedAt: rate.updatedAt,
    };
  },

  /** Actualiza nombre, tasa y/o estado activo. */
  async updateTaxRate(
    companyId: string,
    id: string,
    input: UpdateTaxRateInput,
  ): Promise<TaxRateRow> {
    const data = updateTaxRateSchema.parse(input);
    const db = createTenantPrisma(basePrisma, companyId);

    const existing = await db.taxRate.findFirst({ where: { id, companyId } });
    if (!existing) throw new Error('Tasa de impuesto no encontrada');

    const rate = await db.taxRate.update({
      where: { id },
      data,
    });

    return {
      id: rate.id,
      code: rate.code,
      name: rate.name,
      rate: rate.rate.toString(),
      isActive: rate.isActive,
      createdAt: rate.createdAt,
      updatedAt: rate.updatedAt,
    };
  },
};
