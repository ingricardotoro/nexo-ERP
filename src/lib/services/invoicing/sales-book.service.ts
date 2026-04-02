// src/lib/services/invoicing/sales-book.service.ts
//
// F3-10: Libro de Ventas — reporte de facturas emitidas por período fiscal.
// F3-11: Export DET CSV — formato SAR Honduras para declaración mensual.
//
// El Libro de Ventas lista todas las facturas PUBLISHED y CANCELLED
// (las anuladas siguen reportándose con montos en cero) de un período fiscal,
// agrupando ventas exentas, gravadas 15%, gravadas 18%, y sus ISV respectivos.
//
// Formato DET CSV (Declaración Electrónica de Tributos):
// RTN|Período|TipoDoc|NumFactura|FechaEmisión|RTNCliente|NombreCliente|
// VentaExenta|VentaGravada15|VentaGravada18|ISV15|ISV18|Total

import { Decimal } from '@prisma/client/runtime/library';
import basePrisma from '@/lib/db/prisma';
import { createTenantPrisma } from '@/lib/db/tenant-extension';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SalesBookLine {
  /** Número de fila en el libro */
  rowNumber: number;
  /** Tipo de documento: 01=Factura, 03=NC, 04=ND */
  documentType: string;
  /** Número SAR del documento */
  invoiceNumber: string;
  /** Fecha de emisión */
  issueDate: Date;
  /** RTN del cliente (null si extranjero) */
  clientRtn: string | null;
  /** Razón social del cliente */
  clientName: string;
  /** Venta exenta (ISV 0%) */
  exemptSales: string;
  /** Venta gravada al 15% */
  taxedSales15: string;
  /** Venta gravada al 18% */
  taxedSales18: string;
  /** ISV 15% */
  isv15: string;
  /** ISV 18% */
  isv18: string;
  /** Total del documento */
  total: string;
  /** Estado (PUBLISHED o CANCELLED) */
  status: string;
  /** true si la factura fue anulada */
  isCancelled: boolean;
}

export interface SalesBookSummary {
  /** Total de ventas exentas */
  totalExemptSales: string;
  /** Total de ventas gravadas 15% */
  totalTaxedSales15: string;
  /** Total de ventas gravadas 18% */
  totalTaxedSales18: string;
  /** Total ISV 15% */
  totalIsv15: string;
  /** Total ISV 18% */
  totalIsv18: string;
  /** Gran total */
  grandTotal: string;
  /** Número de documentos */
  documentCount: number;
  /** Número de documentos anulados */
  cancelledCount: number;
}

export interface SalesBookResult {
  /** Período fiscal */
  period: {
    id: string;
    name: string;
    startDate: Date;
    endDate: Date;
  };
  /** Líneas del libro */
  lines: SalesBookLine[];
  /** Resumen de totales */
  summary: SalesBookSummary;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function invoiceTypeToDocType(invoiceType: string): string {
  const map: Record<string, string> = {
    FACTURA: '01',
    NOTA_CREDITO: '03',
    NOTA_DEBITO: '04',
  };
  return map[invoiceType] ?? '01';
}

/** Clasifica el subtotal de una línea según la tasa de impuesto. */
function classifyTaxBucket(rate: Decimal): 'exempt' | 'taxed15' | 'taxed18' {
  const r = Number(rate);
  if (r === 0) return 'exempt';
  if (r <= 0.15) return 'taxed15';
  return 'taxed18';
}

const ZERO = new Decimal(0);

function formatDecimal2(d: Decimal): string {
  return d.toDecimalPlaces(2).toFixed(2);
}

function formatDateDDMMYYYY(date: Date): string {
  const d = date.getUTCDate().toString().padStart(2, '0');
  const m = (date.getUTCMonth() + 1).toString().padStart(2, '0');
  const y = date.getUTCFullYear();
  return `${d}/${m}/${y}`;
}

function formatPeriodYYYYMM(startDate: Date): string {
  const y = startDate.getUTCFullYear();
  const m = (startDate.getUTCMonth() + 1).toString().padStart(2, '0');
  return `${y}${m}`;
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const salesBookService = {
  /**
   * Genera el Libro de Ventas para un período fiscal.
   *
   * Incluye todas las facturas PUBLISHED y CANCELLED del período.
   * Las facturas anuladas aparecen con montos en cero (requisito SAR).
   */
  async getSalesBook(companyId: string, fiscalPeriodId: string): Promise<SalesBookResult> {
    const db = createTenantPrisma(basePrisma, companyId);

    // 1. Verify fiscal period exists and belongs to company
    const period = await db.fiscalPeriod.findFirst({
      where: { id: fiscalPeriodId, companyId },
      select: { id: true, name: true, startDate: true, endDate: true },
    });
    if (!period) {
      throw new Error('Período fiscal no encontrado');
    }

    // 2. Fetch all published/cancelled invoices in the period's date range
    const invoices = await db.invoice.findMany({
      where: {
        companyId,
        status: { in: ['PUBLISHED', 'CANCELLED'] },
        issueDate: { gte: period.startDate, lte: period.endDate },
      },
      include: {
        contact: { select: { legalName: true, rtn: true } },
        lines: {
          include: { taxRate: { select: { rate: true } } },
          orderBy: { lineNumber: 'asc' },
        },
      },
      orderBy: [{ sequenceNumber: 'asc' }, { issueDate: 'asc' }],
    });

    // 3. Build sales book lines
    let totalExempt = ZERO;
    let totalTaxed15 = ZERO;
    let totalTaxed18 = ZERO;
    let totalIsv15 = ZERO;
    let totalIsv18 = ZERO;
    let grandTotal = ZERO;
    let cancelledCount = 0;

    const lines: SalesBookLine[] = invoices.map((inv, idx) => {
      const isCancelled = inv.status === 'CANCELLED';
      if (isCancelled) cancelledCount++;

      // Classify each line's subtotal and tax by rate bucket
      let exempt = ZERO;
      let taxed15 = ZERO;
      let taxed18 = ZERO;
      let isv15 = ZERO;
      let isv18 = ZERO;

      if (!isCancelled) {
        for (const line of inv.lines) {
          const bucket = classifyTaxBucket(line.taxRate.rate);
          switch (bucket) {
            case 'exempt':
              exempt = exempt.plus(line.subtotal);
              break;
            case 'taxed15':
              taxed15 = taxed15.plus(line.subtotal);
              isv15 = isv15.plus(line.taxAmount);
              break;
            case 'taxed18':
              taxed18 = taxed18.plus(line.subtotal);
              isv18 = isv18.plus(line.taxAmount);
              break;
          }
        }
      }

      const lineTotal = isCancelled ? ZERO : new Decimal(inv.total);

      // Accumulate totals
      totalExempt = totalExempt.plus(exempt);
      totalTaxed15 = totalTaxed15.plus(taxed15);
      totalTaxed18 = totalTaxed18.plus(taxed18);
      totalIsv15 = totalIsv15.plus(isv15);
      totalIsv18 = totalIsv18.plus(isv18);
      grandTotal = grandTotal.plus(lineTotal);

      return {
        rowNumber: idx + 1,
        documentType: invoiceTypeToDocType(inv.invoiceType),
        invoiceNumber: inv.invoiceNumber ?? '',
        issueDate: inv.issueDate,
        clientRtn: inv.contact.rtn,
        clientName: inv.contact.legalName,
        exemptSales: formatDecimal2(exempt),
        taxedSales15: formatDecimal2(taxed15),
        taxedSales18: formatDecimal2(taxed18),
        isv15: formatDecimal2(isv15),
        isv18: formatDecimal2(isv18),
        total: formatDecimal2(lineTotal),
        status: inv.status,
        isCancelled,
      };
    });

    return {
      period: {
        id: period.id,
        name: period.name,
        startDate: period.startDate,
        endDate: period.endDate,
      },
      lines,
      summary: {
        totalExemptSales: formatDecimal2(totalExempt),
        totalTaxedSales15: formatDecimal2(totalTaxed15),
        totalTaxedSales18: formatDecimal2(totalTaxed18),
        totalIsv15: formatDecimal2(totalIsv15),
        totalIsv18: formatDecimal2(totalIsv18),
        grandTotal: formatDecimal2(grandTotal),
        documentCount: lines.length,
        cancelledCount,
      },
    };
  },

  /**
   * F3-11: Genera el CSV en formato DET (Declaración Electrónica de Tributos)
   * para la declaración mensual del ISV ante el SAR Honduras.
   *
   * Formato: pipe-delimited (|), una fila por documento.
   * Columnas:
   *   RTN_Emisor|Período|TipoDoc|NumFactura|FechaEmisión|RTN_Cliente|
   *   NombreCliente|VtaExenta|VtaGravada15|VtaGravada18|ISV15|ISV18|Total
   */
  async generateDetCsv(companyId: string, fiscalPeriodId: string): Promise<string> {
    const db = createTenantPrisma(basePrisma, companyId);

    // Get company RTN
    const company = await db.company.findFirst({
      where: { id: companyId },
      select: { rtn: true },
    });
    if (!company) throw new Error('Empresa no encontrada');

    const salesBook = await this.getSalesBook(companyId, fiscalPeriodId);
    const period = formatPeriodYYYYMM(salesBook.period.startDate);

    // Build CSV lines (pipe-delimited, no header per SAR spec)
    const csvLines: string[] = [];

    for (const line of salesBook.lines) {
      const fields = [
        company.rtn, // RTN del emisor
        period, // Período (YYYYMM)
        line.documentType, // Tipo de documento
        line.invoiceNumber, // Número SAR
        formatDateDDMMYYYY(line.issueDate), // Fecha emisión
        line.clientRtn ?? '', // RTN del cliente
        line.clientName, // Nombre del cliente
        line.exemptSales, // Ventas exentas
        line.taxedSales15, // Ventas gravadas 15%
        line.taxedSales18, // Ventas gravadas 18%
        line.isv15, // ISV 15%
        line.isv18, // ISV 18%
        line.total, // Total
      ];
      csvLines.push(fields.join('|'));
    }

    return csvLines.join('\n');
  },
};
