// src/lib/services/accounting/journal.service.ts
import type { JournalType } from '@prisma/client';
import basePrisma from '@/lib/db/prisma';
import { createTenantPrisma } from '@/lib/db/tenant-extension';
import {
  createJournalSchema,
  updateJournalSchema,
  type CreateJournalInput,
  type UpdateJournalInput,
} from '@/lib/validations/journal.schema';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface JournalRow {
  id: string;
  name: string;
  code: string;
  journalType: JournalType;
  isActive: boolean;
  entriesCount: number;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const journalService = {
  /** Lista todos los diarios de la empresa con conteo de asientos. */
  async listJournals(companyId: string): Promise<JournalRow[]> {
    const db = createTenantPrisma(basePrisma, companyId);
    const journals = await db.journal.findMany({
      where: { companyId },
      include: { _count: { select: { journalEntries: true } } },
      orderBy: [{ journalType: 'asc' }, { code: 'asc' }],
    });

    return journals.map((j) => ({
      id: j.id,
      name: j.name,
      code: j.code,
      journalType: j.journalType,
      isActive: j.isActive,
      entriesCount: j._count.journalEntries,
      createdAt: j.createdAt,
      updatedAt: j.updatedAt,
    }));
  },

  /** Crea un nuevo diario. El código debe ser único por empresa. */
  async createJournal(companyId: string, input: CreateJournalInput): Promise<JournalRow> {
    const data = createJournalSchema.parse(input);
    const db = createTenantPrisma(basePrisma, companyId);

    const existing = await db.journal.findUnique({
      where: { companyId_code: { companyId, code: data.code } },
    });
    if (existing) {
      throw new Error(`Ya existe un diario con el código "${data.code}" en esta empresa`);
    }

    const journal = await db.journal.create({
      data: { companyId, ...data },
      include: { _count: { select: { journalEntries: true } } },
    });

    return {
      id: journal.id,
      name: journal.name,
      code: journal.code,
      journalType: journal.journalType,
      isActive: journal.isActive,
      entriesCount: journal._count.journalEntries,
      createdAt: journal.createdAt,
      updatedAt: journal.updatedAt,
    };
  },

  /** Actualiza nombre y/o estado activo de un diario. */
  async updateJournal(
    companyId: string,
    id: string,
    input: UpdateJournalInput,
  ): Promise<JournalRow> {
    const data = updateJournalSchema.parse(input);
    const db = createTenantPrisma(basePrisma, companyId);

    const journal = await db.journal.findFirst({ where: { id, companyId } });
    if (!journal) throw new Error('Diario no encontrado');

    const updated = await db.journal.update({
      where: { id },
      data,
      include: { _count: { select: { journalEntries: true } } },
    });

    return {
      id: updated.id,
      name: updated.name,
      code: updated.code,
      journalType: updated.journalType,
      isActive: updated.isActive,
      entriesCount: updated._count.journalEntries,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    };
  },

  /**
   * Elimina un diario. Solo se permite si no tiene asientos registrados.
   */
  async deleteJournal(companyId: string, id: string): Promise<void> {
    const db = createTenantPrisma(basePrisma, companyId);
    const journal = await db.journal.findFirst({
      where: { id, companyId },
      include: { _count: { select: { journalEntries: true } } },
    });
    if (!journal) throw new Error('Diario no encontrado');
    if (journal._count.journalEntries > 0) {
      throw new Error(
        `No se puede eliminar el diario "${journal.name}": tiene ${journal._count.journalEntries} asiento(s) registrado(s). Desactívelo en su lugar.`,
      );
    }

    await db.journal.delete({ where: { id } });
  },
};
