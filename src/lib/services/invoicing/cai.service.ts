// src/lib/services/invoicing/cai.service.ts
import basePrisma from '@/lib/db/prisma';
import { createTenantPrisma } from '@/lib/db/tenant-extension';
import {
  createCaiSchema,
  updateCaiSchema,
  type CreateCaiInput,
  type UpdateCaiInput,
} from '@/lib/validations/cai.schema';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CaiRow {
  id: string;
  caiCode: string;
  establishmentCode: string;
  emissionPointCode: string;
  documentType: string;
  rangeFrom: number;
  rangeTo: number;
  issuedAt: Date;
  expiresAt: Date;
  isActive: boolean;
  isExpired: boolean;
  invoicesCount: number;
  lastSequenceNumber: number;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toRow(cai: {
  id: string;
  caiCode: string;
  establishmentCode: string;
  emissionPointCode: string;
  documentType: string;
  rangeFrom: number;
  rangeTo: number;
  issuedAt: Date;
  expiresAt: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  _count: { invoices: number };
  invoiceSequence: { lastNumber: number } | null;
}): CaiRow {
  return {
    id: cai.id,
    caiCode: cai.caiCode,
    establishmentCode: cai.establishmentCode,
    emissionPointCode: cai.emissionPointCode,
    documentType: cai.documentType,
    rangeFrom: cai.rangeFrom,
    rangeTo: cai.rangeTo,
    issuedAt: cai.issuedAt,
    expiresAt: cai.expiresAt,
    isActive: cai.isActive,
    isExpired: cai.expiresAt < new Date(),
    invoicesCount: cai._count.invoices,
    lastSequenceNumber: cai.invoiceSequence?.lastNumber ?? 0,
    createdAt: cai.createdAt,
    updatedAt: cai.updatedAt,
  };
}

const CAI_INCLUDE = {
  _count: { select: { invoices: true } },
  invoiceSequence: { select: { lastNumber: true } },
} as const;

// ─── Service ──────────────────────────────────────────────────────────────────

export const caiService = {
  /** Lista todos los CAIs de la empresa, los activos primero. */
  async listCais(companyId: string): Promise<CaiRow[]> {
    const db = createTenantPrisma(basePrisma, companyId);
    const cais = await db.cAI.findMany({
      where: { companyId },
      include: CAI_INCLUDE,
      orderBy: [{ isActive: 'desc' }, { expiresAt: 'desc' }],
    });
    return cais.map(toRow);
  },

  /** Obtiene un CAI por ID. Lanza error si no pertenece a la empresa. */
  async getCai(companyId: string, id: string): Promise<CaiRow> {
    const db = createTenantPrisma(basePrisma, companyId);
    const cai = await db.cAI.findFirst({
      where: { id, companyId },
      include: CAI_INCLUDE,
    });
    if (!cai) throw new Error('CAI no encontrado');
    return toRow(cai);
  },

  /**
   * Registra un nuevo CAI emitido por el SAR.
   * Reglas:
   *  - El código CAI debe ser único por empresa.
   *  - Si ya existe un CAI activo para el mismo tipo de documento, se desactiva automáticamente.
   */
  async createCai(companyId: string, input: CreateCaiInput): Promise<CaiRow> {
    const data = createCaiSchema.parse(input);
    const db = createTenantPrisma(basePrisma, companyId);

    // Check uniqueness of CAI code within the company
    const existing = await db.cAI.findUnique({
      where: { companyId_caiCode: { companyId, caiCode: data.caiCode } },
    });
    if (existing) {
      throw new Error(`El código CAI "${data.caiCode}" ya está registrado en esta empresa`);
    }

    // Deactivate any currently active CAI for the same document type
    await db.cAI.updateMany({
      where: { companyId, documentType: data.documentType, isActive: true },
      data: { isActive: false },
    });

    const cai = await db.cAI.create({
      data: {
        companyId,
        caiCode: data.caiCode,
        establishmentCode: data.establishmentCode,
        emissionPointCode: data.emissionPointCode,
        documentType: data.documentType,
        rangeFrom: data.rangeFrom,
        rangeTo: data.rangeTo,
        issuedAt: new Date(data.issuedAt),
        expiresAt: new Date(data.expiresAt),
        isActive: true,
      },
      include: CAI_INCLUDE,
    });

    return toRow(cai);
  },

  /**
   * Activa o desactiva un CAI.
   * Al activar un CAI, desactiva los demás del mismo tipo de documento.
   */
  async updateCai(companyId: string, id: string, input: UpdateCaiInput): Promise<CaiRow> {
    const data = updateCaiSchema.parse(input);
    const db = createTenantPrisma(basePrisma, companyId);

    const cai = await db.cAI.findFirst({ where: { id, companyId } });
    if (!cai) throw new Error('CAI no encontrado');

    if (data.isActive) {
      // Deactivate sibling CAIs of same document type before activating this one
      await db.cAI.updateMany({
        where: { companyId, documentType: cai.documentType, isActive: true, id: { not: id } },
        data: { isActive: false },
      });
    }

    const updated = await db.cAI.update({
      where: { id },
      data: { isActive: data.isActive },
      include: CAI_INCLUDE,
    });

    return toRow(updated);
  },

  /**
   * Retorna el CAI activo para un tipo de documento dado.
   * Valida que no esté vencido y que queden números disponibles.
   * Usado por el servicio de numeración SAR al emitir facturas.
   */
  async getActiveCai(companyId: string, documentType: string): Promise<CaiRow> {
    const db = createTenantPrisma(basePrisma, companyId);
    const cai = await db.cAI.findFirst({
      where: { companyId, documentType, isActive: true },
      include: CAI_INCLUDE,
    });

    if (!cai) {
      throw new Error(
        `No hay un CAI activo para el tipo de documento "${documentType}". Registre y active un CAI antes de emitir facturas.`,
      );
    }

    if (cai.expiresAt < new Date()) {
      throw new Error(
        `El CAI activo para el tipo de documento "${documentType}" está vencido (venció el ${cai.expiresAt.toLocaleDateString('es-HN')}). Registre un nuevo CAI.`,
      );
    }

    const lastNumber = cai.invoiceSequence?.lastNumber ?? 0;
    if (lastNumber >= cai.rangeTo) {
      throw new Error(
        `El CAI activo para el tipo de documento "${documentType}" ha agotado su rango de numeración (${cai.rangeFrom}–${cai.rangeTo}). Registre un nuevo CAI.`,
      );
    }

    return toRow(cai);
  },
};
