// src/lib/services/accounting/exchange-rate.service.ts
import type {
  ExchangeRateFilters,
  UpsertExchangeRateInput,
} from '@/lib/validations/exchange-rate.schema';
import basePrisma from '@/lib/db/prisma';

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface ExchangeRateRow {
  id: string;
  currencyCode: string;
  currencyName: string;
  currencySymbol: string;
  date: string; // ISO date string YYYY-MM-DD
  rate: string; // Decimal → string para serialización segura
  source: string | null;
  isGlobal: boolean;
}

export interface ExchangeRateListResult {
  data: ExchangeRateRow[];
  total: number;
  page: number;
  totalPages: number;
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const exchangeRateService = {
  /**
   * Lista tasas visibles para la empresa: tasas propias + tasas globales (companyId IS NULL).
   * ExchangeRate no está en BUSINESS_MODELS (companyId nullable), se filtra manualmente.
   */
  async listRates(
    companyId: string,
    filters: ExchangeRateFilters,
  ): Promise<ExchangeRateListResult> {
    const { currencyCode, dateFrom, dateTo, page, limit } = filters;

    const where = {
      AND: [
        // Solo tasas de la empresa O tasas globales (companyId IS NULL)
        {
          OR: [{ companyId }, { companyId: null }],
        },
        currencyCode ? { currencyCode } : {},
        dateFrom ? { date: { gte: new Date(dateFrom) } } : {},
        dateTo ? { date: { lte: new Date(dateTo) } } : {},
      ],
    };

    const [rows, total] = await Promise.all([
      basePrisma.exchangeRate.findMany({
        where,
        include: {
          currency: { select: { name: true, symbol: true } },
        },
        orderBy: [{ date: 'desc' }, { currencyCode: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      basePrisma.exchangeRate.count({ where }),
    ]);

    return {
      data: rows.map((r) => ({
        id: r.id,
        currencyCode: r.currencyCode,
        currencyName: r.currency.name,
        currencySymbol: r.currency.symbol,
        date: r.date.toISOString().split('T')[0]!,
        rate: r.rate.toString(),
        source: r.source,
        isGlobal: r.companyId === null,
      })),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  },

  /**
   * Crea o actualiza una tasa de cambio para la empresa.
   * Upsert por (currencyCode, date, companyId).
   */
  async upsertRate(companyId: string, input: UpsertExchangeRateInput): Promise<ExchangeRateRow> {
    const { currencyCode, date, rate, source } = input;

    // Verificar que la moneda existe y no es la moneda base (HNL)
    const currency = await basePrisma.currency.findUnique({ where: { code: currencyCode } });
    if (!currency) throw new Error('Moneda no encontrada');
    if (currency.isBase) {
      throw new Error('No se puede registrar tipo de cambio para la moneda base (HNL)');
    }

    const dateObj = new Date(date);

    const row = await basePrisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.current_company_id', ${companyId}, true)`;
      return tx.exchangeRate.upsert({
        where: {
          currencyCode_date_companyId: { currencyCode, date: dateObj, companyId },
        },
        create: {
          currencyCode,
          date: dateObj,
          rate,
          source: source ?? 'manual',
          companyId,
        },
        update: {
          rate,
          source: source ?? 'manual',
        },
        include: {
          currency: { select: { name: true, symbol: true } },
        },
      });
    });

    return {
      id: row.id,
      currencyCode: row.currencyCode,
      currencyName: row.currency.name,
      currencySymbol: row.currency.symbol,
      date: row.date.toISOString().split('T')[0]!,
      rate: row.rate.toString(),
      source: row.source,
      isGlobal: false,
    };
  },

  /**
   * Elimina una tasa de cambio. Solo se puede borrar tasas propias de la empresa (no globales).
   */
  async deleteRate(companyId: string, id: string): Promise<void> {
    const existing = await basePrisma.exchangeRate.findUnique({ where: { id } });
    if (!existing) throw new Error('Tipo de cambio no encontrado');
    if (existing.companyId !== companyId) {
      throw new Error('No se puede eliminar una tasa global de plataforma');
    }
    await basePrisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.current_company_id', ${companyId}, true)`;
      await tx.exchangeRate.delete({ where: { id } });
    });
  },

  /**
   * Busca la tasa vigente para una moneda en una fecha dada.
   * Prioridad: tasa de la empresa > tasa global.
   * Si no hay tasa exacta para la fecha, busca la más reciente anterior.
   */
  async lookupRate(
    companyId: string,
    currencyCode: string,
    date: string,
  ): Promise<{ rate: string; source: string | null; isGlobal: boolean } | null> {
    const dateObj = new Date(date);

    // 1. Tasa específica de la empresa (más reciente ≤ date)
    const companyRate = await basePrisma.exchangeRate.findFirst({
      where: { currencyCode, companyId, date: { lte: dateObj } },
      orderBy: { date: 'desc' },
    });
    if (companyRate) {
      return {
        rate: companyRate.rate.toString(),
        source: companyRate.source,
        isGlobal: false,
      };
    }

    // 2. Tasa global (companyId IS NULL), más reciente ≤ date
    const globalRate = await basePrisma.exchangeRate.findFirst({
      where: { currencyCode, companyId: null, date: { lte: dateObj } },
      orderBy: { date: 'desc' },
    });
    if (globalRate) {
      return {
        rate: globalRate.rate.toString(),
        source: globalRate.source,
        isGlobal: true,
      };
    }

    return null;
  },

  /** Lista todas las monedas activas (para selectores en formularios). */
  async listCurrencies() {
    return basePrisma.currency.findMany({
      where: { isActive: true },
      orderBy: { code: 'asc' },
      select: { code: true, name: true, symbol: true, isBase: true },
    });
  },
};
