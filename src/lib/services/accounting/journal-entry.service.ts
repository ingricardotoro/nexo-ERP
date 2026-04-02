// src/lib/services/accounting/journal-entry.service.ts
import type { JournalEntryStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import basePrisma from '@/lib/db/prisma';
import { createTenantPrisma } from '@/lib/db/tenant-extension';
import {
  createJournalEntrySchema,
  updateJournalEntrySchema,
  journalEntryFiltersSchema,
  type CreateJournalEntryInput,
  type UpdateJournalEntryInput,
  type JournalEntryFilters,
} from '@/lib/validations/journal-entry.schema';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface JournalEntryLineSummary {
  id: string;
  lineNumber: number;
  accountId: string;
  accountCode: string;
  accountName: string;
  description: string | null;
  debit: string;
  credit: string;
}

export interface JournalEntrySummary {
  id: string;
  entryNumber: number;
  journalId: string;
  journalCode: string;
  journalName: string;
  fiscalPeriodId: string;
  fiscalPeriodName: string;
  entryDate: Date;
  description: string;
  reference: string | null;
  status: JournalEntryStatus;
  currencyCode: string;
  exchangeRate: string;
  totalDebit: string;
  totalCredit: string;
  createdBy: string;
  postedBy: string | null;
  postedAt: Date | null;
  cancelledById: string | null;
  createdAt: Date;
  linesCount: number;
}

export interface JournalEntryDetail extends JournalEntrySummary {
  lines: JournalEntryLineSummary[];
}

export interface JournalEntryListResult {
  entries: JournalEntrySummary[];
  pagination: { total: number; page: number; limit: number; totalPages: number };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Obtiene el siguiente número de asiento para (companyId, journalId) de forma
 * atómica usando INSERT ... ON CONFLICT DO UPDATE ... RETURNING.
 * Garantiza unicidad sin race conditions en entornos serverless.
 */
async function getNextEntryNumber(
  companyId: string,
  journalId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tx: any,
): Promise<number> {
  const result = await tx.$queryRaw<[{ last_number: number }]>`
    INSERT INTO journal_sequences (company_id, journal_id, last_number, updated_at)
    VALUES (${companyId}::uuid, ${journalId}::uuid, 1, NOW())
    ON CONFLICT (company_id, journal_id)
    DO UPDATE SET
      last_number = journal_sequences.last_number + 1,
      updated_at  = NOW()
    RETURNING last_number
  `;
  return Number(result[0].last_number);
}

function toDecimalString(val: Decimal | number | string): string {
  return new Decimal(val).toFixed(2);
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const journalEntryService = {
  /** Lista asientos contables con filtros y paginación. */
  async listJournalEntries(
    companyId: string,
    rawFilters: Partial<JournalEntryFilters>,
  ): Promise<JournalEntryListResult> {
    const filters = journalEntryFiltersSchema.parse(rawFilters);
    const db = createTenantPrisma(basePrisma, companyId);
    const skip = (filters.page - 1) * filters.limit;

    const where = {
      companyId,
      ...(filters.journalId && { journalId: filters.journalId }),
      ...(filters.fiscalPeriodId && { fiscalPeriodId: filters.fiscalPeriodId }),
      ...(filters.status && { status: filters.status }),
      ...(filters.dateFrom || filters.dateTo
        ? {
            entryDate: {
              ...(filters.dateFrom && { gte: new Date(filters.dateFrom) }),
              ...(filters.dateTo && { lte: new Date(filters.dateTo) }),
            },
          }
        : {}),
      ...(filters.search && {
        OR: [
          { description: { contains: filters.search, mode: 'insensitive' as const } },
          { reference: { contains: filters.search, mode: 'insensitive' as const } },
        ],
      }),
    };

    const [total, rows] = await Promise.all([
      db.journalEntry.count({ where }),
      db.journalEntry.findMany({
        where,
        include: {
          journal: { select: { code: true, name: true } },
          fiscalPeriod: { select: { name: true } },
          _count: { select: { lines: true } },
        },
        orderBy: [{ entryDate: 'desc' }, { entryNumber: 'desc' }],
        skip,
        take: filters.limit,
      }),
    ]);

    return {
      entries: rows.map((e) => ({
        id: e.id,
        entryNumber: e.entryNumber,
        journalId: e.journalId,
        journalCode: e.journal.code,
        journalName: e.journal.name,
        fiscalPeriodId: e.fiscalPeriodId,
        fiscalPeriodName: e.fiscalPeriod.name,
        entryDate: e.entryDate,
        description: e.description,
        reference: e.reference,
        status: e.status,
        currencyCode: e.currencyCode,
        exchangeRate: toDecimalString(e.exchangeRate),
        totalDebit: toDecimalString(e.totalDebit),
        totalCredit: toDecimalString(e.totalCredit),
        createdBy: e.createdBy,
        postedBy: e.postedBy,
        postedAt: e.postedAt,
        cancelledById: e.cancelledById,
        createdAt: e.createdAt,
        linesCount: e._count.lines,
      })),
      pagination: {
        total,
        page: filters.page,
        limit: filters.limit,
        totalPages: Math.ceil(total / filters.limit),
      },
    };
  },

  /** Obtiene un asiento con todas sus líneas. */
  async getJournalEntry(companyId: string, id: string): Promise<JournalEntryDetail> {
    const db = createTenantPrisma(basePrisma, companyId);
    const entry = await db.journalEntry.findFirst({
      where: { id, companyId },
      include: {
        journal: { select: { code: true, name: true } },
        fiscalPeriod: { select: { name: true } },
        lines: {
          include: { account: { select: { code: true, name: true } } },
          orderBy: { lineNumber: 'asc' },
        },
        _count: { select: { lines: true } },
      },
    });

    if (!entry) throw new Error('Asiento contable no encontrado');

    return {
      id: entry.id,
      entryNumber: entry.entryNumber,
      journalId: entry.journalId,
      journalCode: entry.journal.code,
      journalName: entry.journal.name,
      fiscalPeriodId: entry.fiscalPeriodId,
      fiscalPeriodName: entry.fiscalPeriod.name,
      entryDate: entry.entryDate,
      description: entry.description,
      reference: entry.reference,
      status: entry.status,
      currencyCode: entry.currencyCode,
      exchangeRate: toDecimalString(entry.exchangeRate),
      totalDebit: toDecimalString(entry.totalDebit),
      totalCredit: toDecimalString(entry.totalCredit),
      createdBy: entry.createdBy,
      postedBy: entry.postedBy,
      postedAt: entry.postedAt,
      cancelledById: entry.cancelledById,
      createdAt: entry.createdAt,
      linesCount: entry._count.lines,
      lines: entry.lines.map((l) => ({
        id: l.id,
        lineNumber: l.lineNumber,
        accountId: l.accountId,
        accountCode: l.account.code,
        accountName: l.account.name,
        description: l.description,
        debit: toDecimalString(l.debit),
        credit: toDecimalString(l.credit),
      })),
    };
  },

  /**
   * Crea un asiento en estado DRAFT.
   * Valida que las cuentas permitan asientos directos (allowDirectEntry).
   * No exige balance débito=crédito en borrador.
   */
  async createDraftEntry(
    companyId: string,
    userId: string,
    input: CreateJournalEntryInput,
  ): Promise<JournalEntryDetail> {
    const data = createJournalEntrySchema.parse(input);
    const db = createTenantPrisma(basePrisma, companyId);

    // Verificar que el diario existe y está activo
    const journal = await db.journal.findFirst({
      where: { id: data.journalId, companyId, isActive: true },
    });
    if (!journal) throw new Error('Diario no encontrado o inactivo');

    // Verificar que el período fiscal existe y está OPEN
    const period = await db.fiscalPeriod.findFirst({
      where: { id: data.fiscalPeriodId, companyId },
    });
    if (!period) throw new Error('Período fiscal no encontrado');
    if (period.status !== 'OPEN')
      throw new Error('El período fiscal está cerrado o bloqueado. No se pueden agregar asientos.');

    // Verificar que todas las cuentas admiten asientos directos
    const accountIds = [...new Set(data.lines.map((l) => l.accountId))];
    const accounts = await db.account.findMany({
      where: { companyId, id: { in: accountIds } },
      select: { id: true, code: true, name: true, allowDirectEntry: true, isActive: true },
    });

    if (accounts.length !== accountIds.length) {
      throw new Error('Una o más cuentas no fueron encontradas');
    }
    const invalidAccounts = accounts.filter((a) => !a.allowDirectEntry || !a.isActive);
    if (invalidAccounts.length > 0) {
      const names = invalidAccounts.map((a) => `${a.code} ${a.name}`).join(', ');
      throw new Error(`Las siguientes cuentas no admiten asientos directos: ${names}`);
    }

    // Calcular totales
    const totalDebit = data.lines.reduce((s, l) => s + l.debit, 0);
    const totalCredit = data.lines.reduce((s, l) => s + l.credit, 0);

    const entry = await basePrisma.$transaction(async (tx) => {
      const entryNumber = await getNextEntryNumber(companyId, data.journalId, tx);

      const created = await tx.journalEntry.create({
        data: {
          companyId,
          journalId: data.journalId,
          fiscalPeriodId: data.fiscalPeriodId,
          entryNumber,
          entryDate: new Date(data.entryDate),
          description: data.description,
          reference: data.reference ?? null,
          status: 'DRAFT',
          currencyCode: data.currencyCode,
          exchangeRate: data.exchangeRate,
          totalDebit,
          totalCredit,
          createdBy: userId,
        },
      });

      await tx.journalEntryLine.createMany({
        data: data.lines.map((line, i) => ({
          companyId,
          journalEntryId: created.id,
          accountId: line.accountId,
          lineNumber: i + 1,
          description: line.description ?? null,
          debit: line.debit,
          credit: line.credit,
          currencyDebit: line.debit,
          currencyCredit: line.credit,
        })),
      });

      return created;
    });

    return this.getJournalEntry(companyId, entry.id);
  },

  /**
   * Actualiza un asiento en estado DRAFT.
   * Solo se permite editar borradores.
   */
  async updateDraftEntry(
    companyId: string,
    id: string,
    input: UpdateJournalEntryInput,
  ): Promise<JournalEntryDetail> {
    const data = updateJournalEntrySchema.parse(input);
    const db = createTenantPrisma(basePrisma, companyId);

    const entry = await db.journalEntry.findFirst({ where: { id, companyId } });
    if (!entry) throw new Error('Asiento contable no encontrado');
    if (entry.status !== 'DRAFT') throw new Error('Solo los asientos en borrador pueden editarse');

    // Si se actualizan líneas, verificar cuentas
    if (data.lines) {
      const period = await db.fiscalPeriod.findFirst({
        where: { id: entry.fiscalPeriodId, companyId },
      });
      if (period?.status !== 'OPEN')
        throw new Error('El período fiscal está cerrado. No se puede modificar el asiento.');

      const accountIds = [...new Set(data.lines.map((l) => l.accountId))];
      const accounts = await db.account.findMany({
        where: { companyId, id: { in: accountIds } },
        select: { id: true, code: true, name: true, allowDirectEntry: true, isActive: true },
      });
      const invalid = accounts.filter((a) => !a.allowDirectEntry || !a.isActive);
      if (invalid.length > 0) {
        throw new Error(
          `Cuentas que no admiten asientos directos: ${invalid.map((a) => `${a.code} ${a.name}`).join(', ')}`,
        );
      }
    }

    await basePrisma.$transaction(async (tx) => {
      const updateData: Record<string, unknown> = {};
      if (data.entryDate !== undefined) updateData.entryDate = new Date(data.entryDate);
      if (data.description !== undefined) updateData.description = data.description;
      if (data.reference !== undefined) updateData.reference = data.reference;
      if (data.currencyCode !== undefined) updateData.currencyCode = data.currencyCode;
      if (data.exchangeRate !== undefined) updateData.exchangeRate = data.exchangeRate;

      if (data.lines) {
        const totalDebit = data.lines.reduce((s, l) => s + l.debit, 0);
        const totalCredit = data.lines.reduce((s, l) => s + l.credit, 0);
        updateData.totalDebit = totalDebit;
        updateData.totalCredit = totalCredit;

        // Reemplazar líneas: eliminar las actuales e insertar las nuevas
        await tx.journalEntryLine.deleteMany({ where: { journalEntryId: id } });
        await tx.journalEntryLine.createMany({
          data: data.lines.map((line, i) => ({
            companyId,
            journalEntryId: id,
            accountId: line.accountId,
            lineNumber: i + 1,
            description: line.description ?? null,
            debit: line.debit,
            credit: line.credit,
            currencyDebit: line.debit,
            currencyCredit: line.credit,
          })),
        });
      }

      if (Object.keys(updateData).length > 0) {
        await tx.journalEntry.update({ where: { id }, data: updateData });
      }
    });

    return this.getJournalEntry(companyId, id);
  },

  /**
   * Publica (contabiliza) un asiento: DRAFT → POSTED.
   * Valida que totalDebit === totalCredit (partida doble NIIF).
   * Valida que el período esté OPEN.
   * Registra en AuditLog.
   */
  async postEntry(companyId: string, id: string, userId: string): Promise<JournalEntryDetail> {
    const db = createTenantPrisma(basePrisma, companyId);
    const entry = await db.journalEntry.findFirst({
      where: { id, companyId },
      include: { fiscalPeriod: { select: { status: true, name: true } } },
    });

    if (!entry) throw new Error('Asiento contable no encontrado');
    if (entry.status !== 'DRAFT')
      throw new Error('Solo los asientos en borrador pueden publicarse');
    if (entry.fiscalPeriod.status !== 'OPEN') {
      throw new Error(
        `El período "${entry.fiscalPeriod.name}" está ${entry.fiscalPeriod.status === 'CLOSED' ? 'cerrado' : 'bloqueado'}. No se puede publicar el asiento.`,
      );
    }

    const debit = new Decimal(entry.totalDebit);
    const credit = new Decimal(entry.totalCredit);
    if (!debit.equals(credit)) {
      throw new Error(
        `El asiento no está balanceado: Débito ${debit.toFixed(2)} ≠ Crédito ${credit.toFixed(2)}. La partida doble requiere igualdad.`,
      );
    }
    if (debit.isZero()) {
      throw new Error('El asiento no puede tener totales en cero');
    }

    await basePrisma.$transaction([
      basePrisma.journalEntry.update({
        where: { id },
        data: { status: 'POSTED', postedBy: userId, postedAt: new Date() },
      }),
      basePrisma.auditLog.create({
        data: {
          companyId,
          userId,
          action: 'UPDATE',
          entity: 'JournalEntry',
          entityId: id,
          oldValues: { status: 'DRAFT' },
          newValues: { status: 'POSTED', postedBy: userId },
        },
      }),
    ]);

    return this.getJournalEntry(companyId, id);
  },

  /**
   * Anula un asiento publicado: crea un contraasiento y marca el original CANCELLED.
   * El contraasiento tiene las mismas líneas con débito y crédito invertidos.
   * Registra en AuditLog.
   */
  async cancelEntry(companyId: string, id: string, userId: string): Promise<JournalEntryDetail> {
    const db = createTenantPrisma(basePrisma, companyId);
    const entry = await db.journalEntry.findFirst({
      where: { id, companyId },
      include: {
        fiscalPeriod: { select: { status: true, name: true } },
        lines: { orderBy: { lineNumber: 'asc' } },
      },
    });

    if (!entry) throw new Error('Asiento contable no encontrado');
    if (entry.status !== 'POSTED') throw new Error('Solo los asientos publicados pueden anularse');
    if (entry.fiscalPeriod.status === 'LOCKED') {
      throw new Error(
        `El período "${entry.fiscalPeriod.name}" está bloqueado. No se puede anular el asiento.`,
      );
    }

    const reversalEntry = await basePrisma.$transaction(async (tx) => {
      // Número secuencial para el contraasiento
      const entryNumber = await getNextEntryNumber(companyId, entry.journalId, tx);

      // Crear el contraasiento (mismas líneas con D/C invertidos)
      const reversal = await tx.journalEntry.create({
        data: {
          companyId,
          journalId: entry.journalId,
          fiscalPeriodId: entry.fiscalPeriodId,
          entryNumber,
          entryDate: new Date(),
          description: `ANULACIÓN: ${entry.description}`,
          reference: entry.reference,
          status: 'POSTED',
          currencyCode: entry.currencyCode,
          exchangeRate: entry.exchangeRate,
          totalDebit: entry.totalCredit,
          totalCredit: entry.totalDebit,
          createdBy: userId,
          postedBy: userId,
          postedAt: new Date(),
          cancelledById: id,
        },
      });

      // Líneas invertidas
      await tx.journalEntryLine.createMany({
        data: entry.lines.map((l) => ({
          companyId,
          journalEntryId: reversal.id,
          accountId: l.accountId,
          lineNumber: l.lineNumber,
          description: l.description,
          debit: l.credit,
          credit: l.debit,
          currencyDebit: l.currencyCredit,
          currencyCredit: l.currencyDebit,
        })),
      });

      // Marcar el original como CANCELLED
      await tx.journalEntry.update({
        where: { id },
        data: { status: 'CANCELLED' },
      });

      // AuditLog
      await tx.auditLog.create({
        data: {
          companyId,
          userId,
          action: 'UPDATE',
          entity: 'JournalEntry',
          entityId: id,
          oldValues: { status: 'POSTED' },
          newValues: { status: 'CANCELLED', reversalEntryId: reversal.id },
        },
      });

      return reversal;
    });

    return this.getJournalEntry(companyId, reversalEntry.id);
  },

  /**
   * Elimina un asiento en estado DRAFT.
   * Los asientos publicados o anulados no pueden eliminarse.
   */
  async deleteDraftEntry(companyId: string, id: string): Promise<void> {
    const db = createTenantPrisma(basePrisma, companyId);
    const entry = await db.journalEntry.findFirst({ where: { id, companyId } });
    if (!entry) throw new Error('Asiento contable no encontrado');
    if (entry.status !== 'DRAFT')
      throw new Error(
        'Solo los asientos en borrador pueden eliminarse. Los asientos publicados deben anularse.',
      );

    // Las líneas se eliminan en cascada (JournalEntryLine → onDelete: Cascade)
    await db.journalEntry.delete({ where: { id } });
  },
};
