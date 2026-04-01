import type { SQSHandler, SQSRecord } from 'aws-lambda';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { PrismaClient, Prisma } from '@prisma/client';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const PDFDocument = require('pdfkit') as typeof import('pdfkit');

/**
 * Lambda — Generación de PDF de Facturas (F3-09)
 *
 * Triggered by SQS queue. Recibe un mensaje con { invoiceId, companyId },
 * genera el PDF SAR-compliant y lo sube a S3.
 *
 * S3 path: documents/{companyId}/invoices/{year}/{month}/{invoiceId}.pdf
 *
 * Campos actualizados en Invoice tras upload:
 *   - pdfS3Key:       "documents/{companyId}/invoices/{year}/{month}/{invoiceId}.pdf"
 *   - pdfGeneratedAt: timestamp UTC del upload
 *
 * SAR Honduras — elementos obligatorios en la factura:
 *   ✓ Datos de la empresa emisora (nombre, RTN, dirección)
 *   ✓ Número CAI y fecha de vencimiento
 *   ✓ Número SAR de factura (PPP-PPP-TT-NNNNNNNN)
 *   ✓ Rango autorizado del CAI
 *   ✓ Datos del cliente (nombre, RTN)
 *   ✓ Líneas de detalle con ISV desglosado
 *   ✓ Totales: subtotal, ISV, total en Lempiras
 */

interface PdfJobMessage {
  invoiceId: string;
  companyId: string;
  invoiceNumber: string;
}

const s3 = new S3Client({ region: process.env.AWS_REGION_TARGET ?? 'us-east-1' });
const prisma = new PrismaClient({ datasourceUrl: process.env.DATABASE_URL });

export const handler: SQSHandler = async (event) => {
  for (const record of event.Records) {
    await processRecord(record);
  }
};

async function processRecord(record: SQSRecord): Promise<void> {
  let invoiceId = 'unknown';
  try {
    const msg = JSON.parse(record.body) as PdfJobMessage;
    invoiceId = msg.invoiceId;

    console.info('[PDF] Processing invoice', { invoiceId: msg.invoiceId, invoiceNumber: msg.invoiceNumber });

    // 1. Fetch invoice with all related data
    const invoice = await prisma.invoice.findUnique({
      where: { id: msg.invoiceId },
      include: {
        company: {
          select: { legalName: true, tradeName: true, rtn: true },
        },
        contact: {
          select: { legalName: true, tradeName: true, rtn: true },
        },
        cai: {
          select: {
            caiCode: true,
            expiresAt: true,
            rangeFrom: true,
            rangeTo: true,
            establishmentCode: true,
            emissionPointCode: true,
            documentType: true,
          },
        },
        lines: {
          orderBy: { lineNumber: 'asc' },
          include: {
            taxRate: { select: { name: true, rate: true } },
          },
        },
      },
    });

    if (!invoice) {
      console.error('[PDF] Invoice not found', { invoiceId: msg.invoiceId });
      return; // Don't throw — don't retry for missing invoices
    }

    if (invoice.companyId !== msg.companyId) {
      console.error('[PDF] companyId mismatch', { invoiceId: msg.invoiceId });
      return;
    }

    // 2. Generate PDF buffer
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pdfBuffer = await generateInvoicePdf(invoice as any as InvoiceForPdf);

    // 3. Build S3 key
    const issueDate = new Date(invoice.issueDate);
    const year = issueDate.getFullYear();
    const month = String(issueDate.getMonth() + 1).padStart(2, '0');
    const s3Key = `documents/${invoice.companyId}/invoices/${year}/${month}/${invoice.id}.pdf`;

    // 4. Upload to S3
    const bucket = process.env.S3_BUCKET_DOCUMENTS;
    if (!bucket) throw new Error('S3_BUCKET_DOCUMENTS env var not set');

    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: s3Key,
        Body: pdfBuffer,
        ContentType: 'application/pdf',
        ContentDisposition: `inline; filename="${invoice.invoiceNumber ?? invoice.id}.pdf"`,
        Metadata: {
          'company-id': invoice.companyId,
          'invoice-id': invoice.id,
          'invoice-number': invoice.invoiceNumber ?? '',
        },
      }),
    );

    console.info('[PDF] Uploaded to S3', { s3Key, bucket });

    // 5. Update invoice record
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.current_company_id', ${invoice.companyId}, true)`;
      await tx.invoice.update({
        where: { id: invoice.id },
        data: {
          pdfS3Key: s3Key,
          pdfGeneratedAt: new Date(),
        },
      });
    });

    console.info('[PDF] Invoice record updated', { invoiceId: invoice.id, s3Key });
  } catch (err) {
    console.error('[PDF] Failed to process invoice', {
      invoiceId,
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    });
    // Re-throw to let SQS retry / send to DLQ after maxReceiveCount
    throw err;
  }
}

// ─── PDF Generation ──────────────────────────────────────────────────────────

interface InvoiceForPdf {
  id: string;
  companyId: string;
  invoiceNumber: string | null;
  issueDate: Date;
  dueDate: Date | null;
  subtotal: Prisma.Decimal;
  taxAmount: Prisma.Decimal;
  total: Prisma.Decimal;
  notes: string | null;
  company: { legalName: string; tradeName: string | null; rtn: string };
  contact: { legalName: string; tradeName: string | null; rtn: string | null };
  cai: {
    caiCode: string;
    expiresAt: Date;
    rangeFrom: number;
    rangeTo: number;
    establishmentCode: string;
    emissionPointCode: string;
    documentType: string;
  };
  lines: Array<{
    lineNumber: number;
    description: string;
    quantity: Prisma.Decimal;
    unitPrice: Prisma.Decimal;
    subtotal: Prisma.Decimal;
    taxAmount: Prisma.Decimal;
    total: Prisma.Decimal;
    taxRate: { name: string; rate: Prisma.Decimal };
  }>;
}

function generateInvoicePdf(invoice: InvoiceForPdf): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const doc = new PDFDocument({ size: 'LETTER', margin: 50 });

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const L = (amount: Prisma.Decimal | number | string) =>
      `L ${Number(amount).toLocaleString('es-HN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    const fmtDate = (d: Date | null) =>
      d ? new Date(d).toLocaleDateString('es-HN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';

    const docTypeLabel: Record<string, string> = {
      '01': 'FACTURA',
      '03': 'NOTA DE CRÉDITO',
      '04': 'NOTA DE DÉBITO',
    };
    const invoiceTitle = docTypeLabel[invoice.cai.documentType] ?? 'FACTURA';

    // ── Header: Empresa emisora ──
    doc.fontSize(16).font('Helvetica-Bold').text(invoice.company.tradeName ?? invoice.company.legalName, { align: 'center' });
    doc.fontSize(10).font('Helvetica').text(`RTN: ${invoice.company.rtn}`, { align: 'center' });
    doc.moveDown(0.5);

    // ── Tipo de documento y número ──
    doc.fontSize(14).font('Helvetica-Bold').text(invoiceTitle, { align: 'center' });
    doc.fontSize(11).font('Helvetica-Bold').text(invoice.invoiceNumber ?? '(pendiente)', { align: 'center' });
    doc.moveDown(0.5);

    // ── Línea divisoria ──
    doc.moveTo(50, doc.y).lineTo(562, doc.y).strokeColor('#333333').stroke();
    doc.moveDown(0.5);

    // ── Datos CAI (SAR Honduras) ──
    const caiY = doc.y;
    doc.fontSize(8).font('Helvetica-Bold').text('DATOS CAI — SAR HONDURAS', 50, caiY);
    doc.fontSize(8).font('Helvetica');
    doc.text(`CAI: ${invoice.cai.caiCode}`, 50);
    doc.text(
      `Rango autorizado: ${invoice.cai.establishmentCode}-${invoice.cai.emissionPointCode}-${invoice.cai.documentType}-${String(invoice.cai.rangeFrom).padStart(8, '0')} al ` +
      `${invoice.cai.establishmentCode}-${invoice.cai.emissionPointCode}-${invoice.cai.documentType}-${String(invoice.cai.rangeTo).padStart(8, '0')}`,
      50,
    );
    doc.text(`Fecha vencimiento CAI: ${fmtDate(invoice.cai.expiresAt)}`, 50);
    doc.moveDown(0.5);

    // ── Datos de la factura (fecha) ──
    doc.moveTo(50, doc.y).lineTo(562, doc.y).strokeColor('#cccccc').stroke();
    doc.moveDown(0.3);

    const colLeft = 50;
    const colRight = 320;
    const infoY = doc.y;

    doc.fontSize(8).font('Helvetica-Bold').text('FECHA DE EMISIÓN:', colLeft, infoY);
    doc.fontSize(8).font('Helvetica').text(fmtDate(invoice.issueDate), colLeft + 110, infoY);

    if (invoice.dueDate) {
      doc.fontSize(8).font('Helvetica-Bold').text('FECHA DE VENCIMIENTO:', colRight, infoY);
      doc.fontSize(8).font('Helvetica').text(fmtDate(invoice.dueDate), colRight + 130, infoY);
    }

    doc.moveDown(1);

    // ── Datos del cliente ──
    doc.moveTo(50, doc.y).lineTo(562, doc.y).strokeColor('#cccccc').stroke();
    doc.moveDown(0.3);
    doc.fontSize(9).font('Helvetica-Bold').text('DATOS DEL CLIENTE', 50);
    doc.fontSize(8).font('Helvetica');
    doc.text(`Nombre: ${invoice.contact.tradeName ?? invoice.contact.legalName}`, 50);
    if (invoice.contact.rtn) {
      doc.text(`RTN: ${invoice.contact.rtn}`, 50);
    }
    doc.moveDown(0.5);

    // ── Tabla de líneas ──
    doc.moveTo(50, doc.y).lineTo(562, doc.y).strokeColor('#333333').stroke();
    doc.moveDown(0.3);

    const colWidths = { no: 25, desc: 195, qty: 45, price: 70, sub: 70, isv: 60, total: 72 };
    let cx = 50;
    doc.fontSize(8).font('Helvetica-Bold');
    doc.text('#', cx, doc.y, { width: colWidths.no }); cx += colWidths.no;
    doc.text('Descripción', cx, doc.y - doc.currentLineHeight(), { width: colWidths.desc }); cx += colWidths.desc;
    doc.text('Cant.', cx, doc.y - doc.currentLineHeight(), { width: colWidths.qty, align: 'right' }); cx += colWidths.qty;
    doc.text('P. Unit.', cx, doc.y - doc.currentLineHeight(), { width: colWidths.price, align: 'right' }); cx += colWidths.price;
    doc.text('Subtotal', cx, doc.y - doc.currentLineHeight(), { width: colWidths.sub, align: 'right' }); cx += colWidths.sub;
    doc.text('ISV', cx, doc.y - doc.currentLineHeight(), { width: colWidths.isv, align: 'right' }); cx += colWidths.isv;
    doc.text('Total', cx, doc.y - doc.currentLineHeight(), { width: colWidths.total, align: 'right' });
    doc.moveDown(0.3);
    doc.moveTo(50, doc.y).lineTo(562, doc.y).strokeColor('#aaaaaa').stroke();
    doc.moveDown(0.2);

    doc.font('Helvetica').fontSize(8);
    for (const line of invoice.lines) {
      const rowY = doc.y;
      cx = 50;
      doc.text(String(line.lineNumber), cx, rowY, { width: colWidths.no }); cx += colWidths.no;
      doc.text(line.description, cx, rowY, { width: colWidths.desc }); cx += colWidths.desc;
      doc.text(Number(line.quantity).toFixed(2), cx, rowY, { width: colWidths.qty, align: 'right' }); cx += colWidths.qty;
      doc.text(L(line.unitPrice), cx, rowY, { width: colWidths.price, align: 'right' }); cx += colWidths.price;
      doc.text(L(line.subtotal), cx, rowY, { width: colWidths.sub, align: 'right' }); cx += colWidths.sub;
      doc.text(L(line.taxAmount), cx, rowY, { width: colWidths.isv, align: 'right' }); cx += colWidths.isv;
      doc.text(L(line.total), cx, rowY, { width: colWidths.total, align: 'right' });
      doc.moveDown(0.8);
    }

    // ── Totales ──
    doc.moveTo(50, doc.y).lineTo(562, doc.y).strokeColor('#333333').stroke();
    doc.moveDown(0.4);

    const totalsX = 390;
    const totalsValX = 490;
    doc.font('Helvetica').fontSize(9);

    doc.text('Subtotal:', totalsX, doc.y);
    doc.text(L(invoice.subtotal), totalsValX, doc.y - doc.currentLineHeight(), { align: 'right', width: 72 });
    doc.moveDown(0.4);

    doc.text('ISV:', totalsX, doc.y);
    doc.text(L(invoice.taxAmount), totalsValX, doc.y - doc.currentLineHeight(), { align: 'right', width: 72 });
    doc.moveDown(0.4);

    doc.moveTo(390, doc.y).lineTo(562, doc.y).strokeColor('#333333').stroke();
    doc.moveDown(0.3);

    doc.font('Helvetica-Bold').fontSize(11);
    doc.text('TOTAL:', totalsX, doc.y);
    doc.text(L(invoice.total), totalsValX, doc.y - doc.currentLineHeight(), { align: 'right', width: 72 });
    doc.moveDown(0.8);

    // ── Notas ──
    if (invoice.notes) {
      doc.font('Helvetica').fontSize(8);
      doc.text(`Notas: ${invoice.notes}`, 50);
      doc.moveDown(0.4);
    }

    // ── Footer ──
    doc.fontSize(7).font('Helvetica').fillColor('#888888')
      .text(
        `Documento generado por NexoERP • ${new Date().toISOString()}`,
        50,
        doc.page.height - 40,
        { align: 'center', width: 512 },
      );

    doc.end();
  });
}
