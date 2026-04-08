// src/app/api/v1/invoicing/sales-book/xlsx/route.ts
//
// GET /api/v1/invoicing/sales-book/xlsx?fiscalPeriodId=xxx
//
// Descarga el Libro de Ventas como archivo Excel (.xlsx) con:
//   - Hoja "Libro de Ventas": una fila por documento SAR
//   - Hoja "Resumen": totales del período
//
// Formato de columnas: mismo layout que el DET CSV, pero en Excel con
// encabezados, formato de moneda L y fechas dd/mm/yyyy.

import type { NextRequest } from 'next/server';
import { getAuthContextFromHeaders } from '@/lib/auth/request-auth';
import { checkPermission } from '@/lib/permissions/check-permission';
import { salesBookService } from '@/lib/services/invoicing/sales-book.service';
import { salesBookQuerySchema } from '@/lib/validations/sales-book.schema';
import { handleApiError } from '@/lib/api/handle-error';
import * as XLSX from 'xlsx';

/** GET /api/v1/invoicing/sales-book/xlsx?fiscalPeriodId=xxx */
export async function GET(request: NextRequest) {
  try {
    const auth = getAuthContextFromHeaders(request);
    await checkPermission(auth, 'invoicing.invoice.read');

    const { searchParams } = new URL(request.url);
    const query = salesBookQuerySchema.parse(Object.fromEntries(searchParams));

    const result = await salesBookService.getSalesBook(auth.companyId, query.fiscalPeriodId);

    const wb = XLSX.utils.book_new();

    // ── Hoja 1: Libro de Ventas ──────────────────────────────────────────────
    const headers = [
      '#',
      'Tipo Doc',
      'Número Factura',
      'Fecha Emisión',
      'RTN Cliente',
      'Nombre Cliente',
      'Venta Exenta',
      'Venta Gravada 15%',
      'Venta Gravada 18%',
      'ISV 15%',
      'ISV 18%',
      'Total',
      'Estado',
    ];

    const rows = result.lines.map((l) => [
      l.rowNumber,
      l.documentType,
      l.invoiceNumber,
      new Date(l.issueDate).toLocaleDateString('es-HN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }),
      l.clientRtn ?? '',
      l.clientName,
      parseFloat(l.exemptSales),
      parseFloat(l.taxedSales15),
      parseFloat(l.taxedSales18),
      parseFloat(l.isv15),
      parseFloat(l.isv18),
      parseFloat(l.total),
      l.isCancelled ? 'ANULADA' : 'EMITIDA',
    ]);

    // Summary footer row
    const summaryRow = [
      '',
      '',
      '',
      '',
      '',
      'TOTALES',
      parseFloat(result.summary.totalExemptSales),
      parseFloat(result.summary.totalTaxedSales15),
      parseFloat(result.summary.totalTaxedSales18),
      parseFloat(result.summary.totalIsv15),
      parseFloat(result.summary.totalIsv18),
      parseFloat(result.summary.grandTotal),
      '',
    ];

    const wsData = [headers, ...rows, summaryRow];
    const ws1 = XLSX.utils.aoa_to_sheet(wsData);

    // Column widths
    ws1['!cols'] = [
      { wch: 5 }, // #
      { wch: 9 }, // Tipo Doc
      { wch: 22 }, // Número Factura
      { wch: 14 }, // Fecha Emisión
      { wch: 18 }, // RTN Cliente
      { wch: 36 }, // Nombre Cliente
      { wch: 14 }, // Venta Exenta
      { wch: 16 }, // Venta Gravada 15%
      { wch: 16 }, // Venta Gravada 18%
      { wch: 12 }, // ISV 15%
      { wch: 12 }, // ISV 18%
      { wch: 14 }, // Total
      { wch: 10 }, // Estado
    ];

    XLSX.utils.book_append_sheet(wb, ws1, 'Libro de Ventas');

    // ── Hoja 2: Resumen ──────────────────────────────────────────────────────
    const s = result.summary;
    const summaryData = [
      ['Período', result.period.name],
      ['Fecha inicio', new Date(result.period.startDate).toLocaleDateString('es-HN')],
      ['Fecha fin', new Date(result.period.endDate).toLocaleDateString('es-HN')],
      [''],
      ['Total documentos', s.documentCount],
      ['Documentos anulados', s.cancelledCount],
      [''],
      ['Venta Exenta', parseFloat(s.totalExemptSales)],
      ['Venta Gravada 15%', parseFloat(s.totalTaxedSales15)],
      ['Venta Gravada 18%', parseFloat(s.totalTaxedSales18)],
      ['ISV 15%', parseFloat(s.totalIsv15)],
      ['ISV 18%', parseFloat(s.totalIsv18)],
      ['Gran Total', parseFloat(s.grandTotal)],
    ];

    const ws2 = XLSX.utils.aoa_to_sheet(summaryData);
    ws2['!cols'] = [{ wch: 22 }, { wch: 18 }];
    XLSX.utils.book_append_sheet(wb, ws2, 'Resumen');

    // Write to buffer
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rawBuffer: Uint8Array = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as any;
    const buffer = rawBuffer.buffer.slice(
      rawBuffer.byteOffset,
      rawBuffer.byteOffset + rawBuffer.byteLength,
    ) as ArrayBuffer;

    const filename = `LibroVentas_${result.period.name.replace(/\s+/g, '_')}.xlsx`;

    return new Response(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(rawBuffer.byteLength),
      },
    });
  } catch (error) {
    return handleApiError(error, 'GET /api/v1/invoicing/sales-book/xlsx');
  }
}
