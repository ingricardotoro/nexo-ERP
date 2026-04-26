// src/lib/services/accounting/fiscal-year.service.ts
import type { FiscalPeriodStatus } from '@prisma/client';
import basePrisma from '@/lib/db/prisma';
import { createTenantPrisma } from '@/lib/db/tenant-extension';
import {
  createFiscalYearSchema,
  type CreateFiscalYearInput,
} from '@/lib/validations/fiscal-year.schema';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FiscalYearSummary {
  id: string;
  year: number;
  startDate: Date;
  endDate: Date;
  status: FiscalPeriodStatus;
  isActive: boolean;
  createdAt: Date;
  periodsTotal: number;
  periodsOpen: number;
  periodsClosed: number;
  periodsLocked: number;
}

export interface FiscalPeriodRow {
  id: string;
  periodNumber: number;
  name: string;
  startDate: Date;
  endDate: Date;
  status: FiscalPeriodStatus;
  journalEntriesCount: number;
}

export interface FiscalYearDetail extends FiscalYearSummary {
  periods: FiscalPeriodRow[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MONTH_NAMES_ES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

/**
 * Genera los 12 períodos mensuales para un rango de fechas dado.
 * Soporta años fiscales que no coincidan con el año calendario.
 */
function generateMonthlyPeriods(
  companyId: string,
  fiscalYearId: string,
  startDate: Date,
  endDate: Date,
): Array<{
  companyId: string;
  fiscalYearId: string;
  periodNumber: number;
  name: string;
  startDate: Date;
  endDate: Date;
  status: FiscalPeriodStatus;
}> {
  const periods = [];
  let current = new Date(startDate);
  current.setUTCDate(1); // normalize to 1st of month

  for (let i = 1; i <= 12; i++) {
    const year = current.getUTCFullYear();
    const month = current.getUTCMonth(); // 0-indexed
    const monthStart = new Date(Date.UTC(year, month, 1));
    const monthEnd = new Date(Date.UTC(year, month + 1, 0)); // last day of month

    // Cap last period end to fiscal year end
    const periodEnd = i === 12 ? endDate : monthEnd;

    periods.push({
      companyId,
      fiscalYearId,
      periodNumber: i,
      name: `${MONTH_NAMES_ES[month]} ${year}`,
      startDate: monthStart,
      endDate: periodEnd,
      status: 'OPEN' as FiscalPeriodStatus,
    });

    // Move to next month
    current = new Date(Date.UTC(year, month + 1, 1));
  }

  return periods;
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const fiscalYearService = {
  /** Lista todos los años fiscales de la empresa con conteos y períodos. */
  async listFiscalYears(companyId: string): Promise<FiscalYearDetail[]> {
    const db = createTenantPrisma(basePrisma, companyId);
    const years = await db.fiscalYear.findMany({
      where: { companyId },
      include: {
        _count: { select: { fiscalPeriods: true } },
        fiscalPeriods: {
          select: {
            id: true,
            periodNumber: true,
            name: true,
            startDate: true,
            endDate: true,
            status: true,
          },
          orderBy: { periodNumber: 'asc' },
        },
      },
      orderBy: { year: 'desc' },
    });

    return years.map((y) => ({
      id: y.id,
      year: y.year,
      startDate: y.startDate,
      endDate: y.endDate,
      status: y.status,
      isActive: y.isActive,
      createdAt: y.createdAt,
      periodsTotal: y._count.fiscalPeriods,
      periodsOpen: y.fiscalPeriods.filter((p) => p.status === 'OPEN').length,
      periodsClosed: y.fiscalPeriods.filter((p) => p.status === 'CLOSED').length,
      periodsLocked: y.fiscalPeriods.filter((p) => p.status === 'LOCKED').length,
      periods: y.fiscalPeriods.map((p) => ({
        id: p.id,
        periodNumber: p.periodNumber,
        name: p.name,
        startDate: p.startDate,
        endDate: p.endDate,
        status: p.status,
        journalEntriesCount: 0,
      })),
    }));
  },

  /** Obtiene un año fiscal con sus 12 períodos y conteo de asientos por período. */
  async getFiscalYear(companyId: string, id: string): Promise<FiscalYearDetail> {
    const db = createTenantPrisma(basePrisma, companyId);
    const year = await db.fiscalYear.findFirst({
      where: { id, companyId },
      include: {
        _count: { select: { fiscalPeriods: true } },
        fiscalPeriods: {
          include: { _count: { select: { journalEntries: true } } },
          orderBy: { periodNumber: 'asc' },
        },
      },
    });

    if (!year) throw new Error('Año fiscal no encontrado');

    const periods: FiscalPeriodRow[] = year.fiscalPeriods.map((p) => ({
      id: p.id,
      periodNumber: p.periodNumber,
      name: p.name,
      startDate: p.startDate,
      endDate: p.endDate,
      status: p.status,
      journalEntriesCount: p._count.journalEntries,
    }));

    return {
      id: year.id,
      year: year.year,
      startDate: year.startDate,
      endDate: year.endDate,
      status: year.status,
      isActive: year.isActive,
      createdAt: year.createdAt,
      periodsTotal: year._count.fiscalPeriods,
      periodsOpen: periods.filter((p) => p.status === 'OPEN').length,
      periodsClosed: periods.filter((p) => p.status === 'CLOSED').length,
      periodsLocked: periods.filter((p) => p.status === 'LOCKED').length,
      periods,
    };
  },

  /**
   * Crea un año fiscal y genera automáticamente sus 12 períodos mensuales.
   * Solo puede haber un año activo (isActive=true) por empresa a la vez.
   */
  async createFiscalYear(
    companyId: string,
    input: CreateFiscalYearInput,
  ): Promise<FiscalYearDetail> {
    const data = createFiscalYearSchema.parse(input);
    const db = createTenantPrisma(basePrisma, companyId);

    // Verificar que no exista ya un año con el mismo número para esta empresa
    const existing = await db.fiscalYear.findFirst({
      where: { companyId, year: data.year },
    });
    if (existing) {
      throw new Error(`Ya existe un año fiscal ${data.year} para esta empresa`);
    }

    const startDate = new Date(data.startDate);
    const endDate = new Date(data.endDate);

    // Si no hay ningún año aún, el primero queda como activo
    const hasAnyYear = await db.fiscalYear.count({ where: { companyId } });
    const isFirstYear = hasAnyYear === 0;

    const fiscalYear = await db.$transaction(async (tx) => {
      const created = await tx.fiscalYear.create({
        data: {
          companyId,
          year: data.year,
          startDate,
          endDate,
          status: 'OPEN',
          isActive: isFirstYear,
        },
      });

      const periodData = generateMonthlyPeriods(companyId, created.id, startDate, endDate);
      await tx.fiscalPeriod.createMany({ data: periodData });

      return created;
    });

    return this.getFiscalYear(companyId, fiscalYear.id);
  },

  /**
   * Activa un año fiscal (solo uno puede estar activo a la vez).
   * Solo años en estado OPEN pueden activarse.
   */
  async activateYear(companyId: string, id: string): Promise<void> {
    const db = createTenantPrisma(basePrisma, companyId);
    const year = await db.fiscalYear.findFirst({ where: { id, companyId } });
    if (!year) throw new Error('Año fiscal no encontrado');
    if (year.status !== 'OPEN') throw new Error('Solo los años en estado ABIERTO pueden activarse');
    if (year.isActive) throw new Error('El año fiscal ya está activo');

    await db.$transaction([
      // Desactivar el año activo actual
      db.fiscalYear.updateMany({
        where: { companyId, isActive: true },
        data: { isActive: false },
      }),
      // Activar el nuevo
      db.fiscalYear.update({ where: { id }, data: { isActive: true } }),
    ]);
  },

  /**
   * Cierra un año fiscal: cierra todos sus períodos OPEN y marca el año CLOSED.
   * Los períodos LOCKED no se tocan.
   */
  async closeYear(companyId: string, id: string): Promise<void> {
    const db = createTenantPrisma(basePrisma, companyId);
    const year = await db.fiscalYear.findFirst({ where: { id, companyId } });
    if (!year) throw new Error('Año fiscal no encontrado');
    if (year.status === 'CLOSED') throw new Error('El año fiscal ya está cerrado');
    if (year.status === 'LOCKED')
      throw new Error('El año fiscal está bloqueado y no puede modificarse');

    await db.$transaction([
      // Cerrar todos los períodos OPEN de este año
      db.fiscalPeriod.updateMany({
        where: { fiscalYearId: id, companyId, status: 'OPEN' },
        data: { status: 'CLOSED' },
      }),
      // Cerrar el año y desactivarlo
      db.fiscalYear.update({
        where: { id },
        data: { status: 'CLOSED', isActive: false },
      }),
    ]);
  },

  /**
   * Cierra un período fiscal individual (OPEN → CLOSED).
   * No afecta períodos LOCKED.
   */
  async closePeriod(companyId: string, periodId: string): Promise<void> {
    const db = createTenantPrisma(basePrisma, companyId);
    const period = await db.fiscalPeriod.findFirst({
      where: { id: periodId, companyId },
    });
    if (!period) throw new Error('Período fiscal no encontrado');
    if (period.status === 'CLOSED') throw new Error('El período ya está cerrado');
    if (period.status === 'LOCKED')
      throw new Error('El período está bloqueado y no puede modificarse');

    await db.fiscalPeriod.update({ where: { id: periodId }, data: { status: 'CLOSED' } });
  },

  /**
   * Bloquea un período fiscal (CLOSED → LOCKED).
   * Operación irreversible — para cierre definitivo de auditoría.
   */
  async lockPeriod(companyId: string, periodId: string): Promise<void> {
    const db = createTenantPrisma(basePrisma, companyId);
    const period = await db.fiscalPeriod.findFirst({
      where: { id: periodId, companyId },
    });
    if (!period) throw new Error('Período fiscal no encontrado');
    if (period.status === 'OPEN')
      throw new Error('El período debe estar CERRADO antes de bloquearse');
    if (period.status === 'LOCKED') throw new Error('El período ya está bloqueado');

    await db.fiscalPeriod.update({ where: { id: periodId }, data: { status: 'LOCKED' } });
  },
};
