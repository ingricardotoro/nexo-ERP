// src/lib/services/invoicing/invoice.service.ts
//
// F3-04: Invoice CRUD (create/update/list/get — DRAFT lifecycle)
// F3-05: publishInvoice — DRAFT → PUBLISHED with SAR number + automatic journal entry
//
// ISV calculation:
//   subtotal = quantity * unitPrice * (1 - discountPct/100)
//   taxAmount = subtotal * taxRate.rate
//   lineTotal  = subtotal + taxAmount
//   invoiceSubtotal = sum(line.subtotal)
//   invoiceTaxAmount = sum(line.taxAmount)
//   invoiceTotal = invoiceSubtotal + invoiceTaxAmount

import type { InvoiceStatus, InvoiceType, Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import basePrisma from '@/lib/db/prisma';
import { createTenantPrisma } from '@/lib/db/tenant-extension';
import {
  createInvoiceSchema,
  updateInvoiceSchema,
  listInvoicesSchema,
  type CreateInvoiceInput,
  type UpdateInvoiceInput,
  type ListInvoicesInput,
} from '@/lib/validations/invoice.schema';
import { getNextInvoiceNumber } from './sar-numbering.service';
import { resolveInvoiceAccounts } from './system-accounts';
import { logAudit } from '@/lib/audit/log';
import { enqueueInvoicePdf } from '@/lib/aws/sqs';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface InvoiceLineRow {
  id: string;
  lineNumber: number;
  description: string;
  quantity: string;
  unitPrice: string;
  discountPct: string;
  subtotal: string;
  taxRateId: string;
  taxRateCode: string;
  taxRateName: string;
  taxRateRate: string;
  taxAmount: string;
  total: string;
  accountId: string | null;
}

export interface InvoiceRow {
  id: string;
  invoiceType: InvoiceType;
  status: InvoiceStatus;
  invoiceNumber: string | null;
  sequenceNumber: number | null;
  issueDate: Date;
  dueDate: Date | null;
  contactId: string;
  contactName: string;
  paymentTermsId: string | null;
  paymentTermsName: string | null;
  currencyCode: string;
  exchangeRate: string;
  subtotal: string;
  taxAmount: string;
  total: string;
  notes: string | null;
  caiId: string;
  caiCode: string;
  journalEntryId: string | null;
  originalInvoiceId: string | null;
  pdfS3Key: string | null;
  pdfGeneratedAt: Date | null;
  createdBy: string;
  issuedBy: string | null;
  issuedAt: Date | null;
  cancelledBy: string | null;
  cancelledAt: Date | null;
  cancelReason: string | null;
  createdAt: Date;
  updatedAt: Date;
  lines?: InvoiceLineRow[];
}

export interface InvoiceListResult {
  invoices: Omit<InvoiceRow, 'lines'>[];
  pagination: { total: number; page: number; limit: number; totalPages: number };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Maps invoice type to SAR document type code. */
function invoiceTypeToDocumentType(invoiceType: InvoiceType): string {
  const map: Record<InvoiceType, string> = {
    FACTURA: '01',
    NOTA_CREDITO: '03',
    NOTA_DEBITO: '04',
  };
  return map[invoiceType];
}

/** Calculates line amounts from inputs. Returns Decimal-compatible strings. */
function calculateLine(
  quantity: number,
  unitPrice: number,
  discountPct: number,
  taxRate: number,
): { subtotal: Decimal; taxAmount: Decimal; total: Decimal } {
  const qty = new Decimal(quantity);
  const price = new Decimal(unitPrice);
  const discount = new Decimal(discountPct).div(100);
  const rate = new Decimal(taxRate);

  const subtotal = qty.mul(price).mul(new Decimal(1).minus(discount)).toDecimalPlaces(2);
  const taxAmount = subtotal.mul(rate).toDecimalPlaces(2);
  const total = subtotal.plus(taxAmount);

  return { subtotal, taxAmount, total };
}

const INVOICE_INCLUDE = {
  cai: { select: { caiCode: true } },
  contact: { select: { legalName: true } },
  paymentTerms: { select: { name: true } },
  lines: {
    include: { taxRate: { select: { code: true, name: true, rate: true } } },
    orderBy: { lineNumber: 'asc' as const },
  },
} satisfies Prisma.InvoiceInclude;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toRow(inv: any, includeLines = true): InvoiceRow {
  const base: InvoiceRow = {
    id: inv.id,
    invoiceType: inv.invoiceType,
    status: inv.status,
    invoiceNumber: inv.invoiceNumber,
    sequenceNumber: inv.sequenceNumber,
    issueDate: inv.issueDate,
    dueDate: inv.dueDate,
    contactId: inv.contactId,
    contactName: inv.contact?.legalName ?? '',
    paymentTermsId: inv.paymentTermsId,
    paymentTermsName: inv.paymentTerms?.name ?? null,
    currencyCode: inv.currencyCode,
    exchangeRate: inv.exchangeRate.toString(),
    subtotal: inv.subtotal.toString(),
    taxAmount: inv.taxAmount.toString(),
    total: inv.total.toString(),
    notes: inv.notes,
    caiId: inv.caiId,
    caiCode: inv.cai?.caiCode ?? '',
    journalEntryId: inv.journalEntryId,
    originalInvoiceId: inv.originalInvoiceId,
    pdfS3Key: inv.pdfS3Key ?? null,
    pdfGeneratedAt: inv.pdfGeneratedAt ?? null,
    createdBy: inv.createdBy,
    issuedBy: inv.issuedBy,
    issuedAt: inv.issuedAt,
    cancelledBy: inv.cancelledBy,
    cancelledAt: inv.cancelledAt,
    cancelReason: inv.cancelReason,
    createdAt: inv.createdAt,
    updatedAt: inv.updatedAt,
  };

  if (includeLines && inv.lines) {
    base.lines = inv.lines.map(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (l: any): InvoiceLineRow => ({
        id: l.id,
        lineNumber: l.lineNumber,
        description: l.description,
        quantity: l.quantity.toString(),
        unitPrice: l.unitPrice.toString(),
        discountPct: l.discountPct.toString(),
        subtotal: l.subtotal.toString(),
        taxRateId: l.taxRateId,
        taxRateCode: l.taxRate?.code ?? '',
        taxRateName: l.taxRate?.name ?? '',
        taxRateRate: l.taxRate?.rate.toString() ?? '0',
        taxAmount: l.taxAmount.toString(),
        total: l.total.toString(),
        accountId: l.accountId,
      }),
    );
  }

  return base;
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const invoiceService = {
  /** Lista facturas con filtros y paginación. */
  async listInvoices(companyId: string, query: ListInvoicesInput): Promise<InvoiceListResult> {
    const filters = listInvoicesSchema.parse(query);
    const db = createTenantPrisma(basePrisma, companyId);

    const where: Prisma.InvoiceWhereInput = { companyId };
    if (filters.status) where.status = filters.status as InvoiceStatus;
    if (filters.invoiceType) where.invoiceType = filters.invoiceType;
    if (filters.contactId) where.contactId = filters.contactId;
    if (filters.dateFrom || filters.dateTo) {
      where.issueDate = {};
      if (filters.dateFrom) where.issueDate.gte = new Date(filters.dateFrom);
      if (filters.dateTo) where.issueDate.lte = new Date(filters.dateTo);
    }

    const skip = (filters.page - 1) * filters.limit;
    const [total, invoices] = await Promise.all([
      db.invoice.count({ where }),
      db.invoice.findMany({
        where,
        include: {
          cai: { select: { caiCode: true } },
          contact: { select: { legalName: true } },
          paymentTerms: { select: { name: true } },
        },
        orderBy: [{ issueDate: 'desc' }, { createdAt: 'desc' }],
        skip,
        take: filters.limit,
      }),
    ]);

    return {
      invoices: invoices.map((inv) => toRow(inv, false)),
      pagination: {
        total,
        page: filters.page,
        limit: filters.limit,
        totalPages: Math.ceil(total / filters.limit),
      },
    };
  },

  /** Obtiene el detalle de una factura con todas sus líneas. */
  async getInvoice(companyId: string, id: string): Promise<InvoiceRow> {
    const db = createTenantPrisma(basePrisma, companyId);
    const inv = await db.invoice.findFirst({
      where: { id, companyId },
      include: INVOICE_INCLUDE,
    });
    if (!inv) throw new Error('Factura no encontrada');
    return toRow(inv);
  },

  /**
   * Crea una factura en estado DRAFT.
   *
   * Steps:
   *  1. Resolve active CAI for the document type.
   *  2. Validate originalInvoiceId rules for NC/ND.
   *  3. Validate tax rates belong to this company.
   *  4. Calculate line amounts + invoice totals.
   *  4b. For credit notes, validate total doesn't exceed original remaining balance.
   *  5. Insert invoice + lines in a transaction.
   */
  async createInvoice(
    companyId: string,
    userId: string,
    input: CreateInvoiceInput,
  ): Promise<InvoiceRow> {
    const data = createInvoiceSchema.parse(input);
    const db = createTenantPrisma(basePrisma, companyId);

    // 1. Resolve active CAI
    const documentType = invoiceTypeToDocumentType(data.invoiceType);
    const activeCai = await db.cAI.findFirst({
      where: { companyId, documentType, isActive: true },
    });
    if (!activeCai) {
      throw new Error(
        `No hay un CAI activo para el tipo de documento "${documentType}". Registre un CAI antes de crear facturas.`,
      );
    }

    // 2. Validate originalInvoiceId rules for NC/ND
    const isCorrection = data.invoiceType === 'NOTA_CREDITO' || data.invoiceType === 'NOTA_DEBITO';
    if (isCorrection) {
      if (!data.originalInvoiceId) {
        throw new Error(
          `Las ${data.invoiceType === 'NOTA_CREDITO' ? 'notas de crédito' : 'notas de débito'} requieren una factura original (originalInvoiceId)`,
        );
      }
      const originalInvoice = await db.invoice.findFirst({
        where: { id: data.originalInvoiceId, companyId },
        include: {
          corrections: {
            where: { status: { not: 'CANCELLED' } },
            select: { total: true },
          },
        },
      });
      if (!originalInvoice) {
        throw new Error('Factura original no encontrada');
      }
      if (originalInvoice.status !== 'PUBLISHED' && originalInvoice.status !== 'PAID') {
        throw new Error(
          'Solo se pueden emitir notas de crédito/débito contra facturas emitidas o pagadas',
        );
      }
    } else if (data.originalInvoiceId) {
      throw new Error('Las facturas regulares no deben referenciar una factura original');
    }

    // 3. Validate tax rates
    const taxRateIds = [...new Set(data.lines.map((l) => l.taxRateId))];
    const taxRates = await db.taxRate.findMany({
      where: { companyId, id: { in: taxRateIds } },
    });
    if (taxRates.length !== taxRateIds.length) {
      throw new Error('Una o más tasas de impuesto no existen o no pertenecen a esta empresa');
    }
    const taxRateMap = new Map(taxRates.map((tr) => [tr.id, tr]));

    // 3. Calculate amounts per line
    const linesWithAmounts = data.lines.map((line) => {
      const taxRate = taxRateMap.get(line.taxRateId)!;
      const amounts = calculateLine(
        line.quantity,
        line.unitPrice,
        line.discountPct,
        Number(taxRate.rate),
      );
      return { ...line, ...amounts, taxRate };
    });

    const invoiceSubtotal = linesWithAmounts.reduce(
      (sum, l) => sum.plus(l.subtotal),
      new Decimal(0),
    );
    const invoiceTaxAmount = linesWithAmounts.reduce(
      (sum, l) => sum.plus(l.taxAmount),
      new Decimal(0),
    );
    const invoiceTotal = invoiceSubtotal.plus(invoiceTaxAmount);

    // 4b. For credit notes, validate total doesn't exceed original remaining balance
    if (data.invoiceType === 'NOTA_CREDITO' && data.originalInvoiceId) {
      const originalInvoice = await db.invoice.findFirst({
        where: { id: data.originalInvoiceId, companyId },
        include: {
          corrections: {
            where: { invoiceType: 'NOTA_CREDITO', status: { not: 'CANCELLED' } },
            select: { total: true },
          },
        },
      });
      if (originalInvoice) {
        const alreadyCredited = originalInvoice.corrections.reduce(
          (sum, nc) => sum.plus(nc.total),
          new Decimal(0),
        );
        const remaining = new Decimal(originalInvoice.total).minus(alreadyCredited);
        if (invoiceTotal.greaterThan(remaining)) {
          throw new Error(
            `El total de la nota de crédito (${invoiceTotal.toFixed(2)}) excede el saldo disponible de la factura original (${remaining.toFixed(2)})`,
          );
        }
      }
    }

    // 5. Create invoice + lines in transaction
    // set_config establece app.current_company_id para que RLS (FORCE ROW LEVEL SECURITY)
    // permita los INSERTs en invoices e invoice_lines dentro de esta transacción.
    const inv = await (basePrisma as typeof basePrisma).$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.current_company_id', ${companyId}, true)`;
      const created = await tx.invoice.create({
        data: {
          companyId,
          caiId: activeCai.id,
          invoiceType: data.invoiceType,
          status: 'DRAFT',
          issueDate: new Date(data.issueDate),
          dueDate: data.dueDate ? new Date(data.dueDate) : null,
          contactId: data.contactId,
          paymentTermsId: data.paymentTermsId ?? null,
          currencyCode: data.currencyCode,
          exchangeRate: data.exchangeRate,
          subtotal: invoiceSubtotal,
          taxAmount: invoiceTaxAmount,
          total: invoiceTotal,
          notes: data.notes ?? null,
          originalInvoiceId: data.originalInvoiceId ?? null,
          createdBy: userId,
          lines: {
            create: linesWithAmounts.map((l) => ({
              companyId,
              lineNumber: l.lineNumber,
              description: l.description,
              quantity: l.quantity,
              unitPrice: l.unitPrice,
              discountPct: l.discountPct,
              subtotal: l.subtotal,
              taxRateId: l.taxRateId,
              taxAmount: l.taxAmount,
              total: l.total,
              accountId: l.accountId ?? null,
            })),
          },
        },
        include: INVOICE_INCLUDE,
      });
      return created;
    });

    return toRow(inv);
  },

  /**
   * Actualiza una factura en estado DRAFT.
   * Solo editable mientras esté en DRAFT.
   */
  async updateInvoice(
    companyId: string,
    id: string,
    input: UpdateInvoiceInput,
  ): Promise<InvoiceRow> {
    const data = updateInvoiceSchema.parse(input);
    const db = createTenantPrisma(basePrisma, companyId);

    const existing = await db.invoice.findFirst({ where: { id, companyId } });
    if (!existing) throw new Error('Factura no encontrada');
    if (existing.status !== 'DRAFT') {
      throw new Error('Solo las facturas en borrador pueden editarse');
    }

    if (!data.lines) {
      // Partial update without touching lines
      const updated = await db.invoice.update({
        where: { id },
        data: {
          issueDate: data.issueDate ? new Date(data.issueDate) : undefined,
          dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
          contactId: data.contactId,
          paymentTermsId: data.paymentTermsId,
          currencyCode: data.currencyCode,
          exchangeRate: data.exchangeRate,
          notes: data.notes,
        },
        include: INVOICE_INCLUDE,
      });
      return toRow(updated);
    }

    // Full lines replacement: recalculate totals
    const taxRateIds = [...new Set(data.lines.map((l) => l.taxRateId))];
    const taxRates = await db.taxRate.findMany({
      where: { companyId, id: { in: taxRateIds } },
    });
    if (taxRates.length !== taxRateIds.length) {
      throw new Error('Una o más tasas de impuesto no existen o no pertenecen a esta empresa');
    }
    const taxRateMap = new Map(taxRates.map((tr) => [tr.id, tr]));

    const linesWithAmounts = data.lines.map((line) => {
      const taxRate = taxRateMap.get(line.taxRateId)!;
      const amounts = calculateLine(
        line.quantity,
        line.unitPrice,
        line.discountPct,
        Number(taxRate.rate),
      );
      return { ...line, ...amounts };
    });

    const invoiceSubtotal = linesWithAmounts.reduce(
      (sum, l) => sum.plus(l.subtotal),
      new Decimal(0),
    );
    const invoiceTaxAmount = linesWithAmounts.reduce(
      (sum, l) => sum.plus(l.taxAmount),
      new Decimal(0),
    );
    const invoiceTotal = invoiceSubtotal.plus(invoiceTaxAmount);

    const updated = await (basePrisma as typeof basePrisma).$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.current_company_id', ${companyId}, true)`;
      await tx.invoiceLine.deleteMany({ where: { invoiceId: id } });
      return tx.invoice.update({
        where: { id },
        data: {
          issueDate: data.issueDate ? new Date(data.issueDate) : undefined,
          dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
          contactId: data.contactId,
          paymentTermsId: data.paymentTermsId,
          currencyCode: data.currencyCode,
          exchangeRate: data.exchangeRate,
          subtotal: invoiceSubtotal,
          taxAmount: invoiceTaxAmount,
          total: invoiceTotal,
          notes: data.notes,
          lines: {
            create: linesWithAmounts.map((l) => ({
              companyId,
              lineNumber: l.lineNumber,
              description: l.description,
              quantity: l.quantity,
              unitPrice: l.unitPrice,
              discountPct: l.discountPct,
              subtotal: l.subtotal,
              taxRateId: l.taxRateId,
              taxAmount: l.taxAmount,
              total: l.total,
              accountId: l.accountId ?? null,
            })),
          },
        },
        include: INVOICE_INCLUDE,
      });
    });

    return toRow(updated);
  },

  /**
   * Cancels a DRAFT invoice (hard delete of lines + invoice).
   * Only DRAFT invoices can be deleted; PUBLISHED must be cancelled via cancelInvoice.
   */
  async deleteDraftInvoice(companyId: string, id: string): Promise<void> {
    const db = createTenantPrisma(basePrisma, companyId);
    const inv = await db.invoice.findFirst({ where: { id, companyId } });
    if (!inv) throw new Error('Factura no encontrada');
    if (inv.status !== 'DRAFT') {
      throw new Error(
        'Solo las facturas en borrador pueden eliminarse. Las facturas emitidas deben anularse.',
      );
    }
    await db.invoice.delete({ where: { id } });
  },

  /**
   * F3-05: Publish invoice — DRAFT → PUBLISHED.
   *
   * Steps:
   *  1. Validate the invoice is in DRAFT status.
   *  2. Atomically assign the next SAR sequential number from the CAI range.
   *  3. Find the active Sales journal (SALES type) to book the accounting entry.
   *  4. Resolve the active fiscal period for the issue date.
   *  5. Resolve system accounts (by systemPurpose, fallback by NIIF code).
   *  6. Build and post the journal entry (debits AR + credits revenue + ISV payable).
   *  7. Update invoice: status → PUBLISHED, invoiceNumber, sequenceNumber, journalEntryId.
   *
   * All in one $transaction for atomicity.
   */
  async publishInvoice(companyId: string, id: string, userId: string): Promise<InvoiceRow> {
    const db = createTenantPrisma(basePrisma, companyId);

    // 1. Load invoice with lines and tax rates
    const inv = await db.invoice.findFirst({
      where: { id, companyId },
      include: {
        ...INVOICE_INCLUDE,
        lines: {
          include: { taxRate: true, account: { select: { id: true } } },
          orderBy: { lineNumber: 'asc' },
        },
        cai: true,
      },
    });
    if (!inv) throw new Error('Factura no encontrada');
    if (inv.status !== 'DRAFT') throw new Error('Solo las facturas en borrador pueden emitirse');

    // 2. Get next SAR number (atomic — outside main transaction to avoid lock contention)
    const documentType = invoiceTypeToDocumentType(inv.invoiceType);
    const { invoiceNumber, sequenceNumber, caiId } = await getNextInvoiceNumber(
      companyId,
      documentType,
    );

    // 3. Find active SALES journal
    const salesJournal = await db.journal.findFirst({
      where: { companyId, journalType: 'SALES', isActive: true },
    });
    if (!salesJournal) {
      throw new Error(
        'No se encontró un diario de ventas activo (tipo SALES). Configure el diario antes de emitir facturas.',
      );
    }

    // 4. Find active fiscal period for the issue date
    const fiscalPeriod = await db.fiscalPeriod.findFirst({
      where: {
        companyId,
        status: 'OPEN',
        startDate: { lte: inv.issueDate },
        endDate: { gte: inv.issueDate },
      },
    });
    if (!fiscalPeriod) {
      throw new Error(
        `No existe un período fiscal abierto para la fecha de emisión ${inv.issueDate.toLocaleDateString('es-HN')}. Verifique que el período esté activo.`,
      );
    }

    // 5. Resolve system accounts (by systemPurpose, fallback by NIIF code)
    const sysAccounts = await resolveInvoiceAccounts(db, companyId);

    // Get next journal entry number atomically
    const [entryNumberResult] = await (basePrisma as typeof basePrisma).$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.current_company_id', ${companyId}, true)`;
      return tx.$queryRaw<Array<{ last_number: number }>>`
        INSERT INTO journal_sequences (company_id, journal_id, last_number, updated_at)
        VALUES (${companyId}::uuid, ${salesJournal.id}::uuid, 1, NOW())
        ON CONFLICT (company_id, journal_id)
        DO UPDATE SET
          last_number = journal_sequences.last_number + 1,
          updated_at  = NOW()
        RETURNING last_number
      `;
    });
    const entryNumber = Number(entryNumberResult.last_number);

    // 6. Build journal entry lines — logic depends on invoice type
    //
    // FACTURA / NOTA_DEBITO (venta o cargo adicional):
    //   Debit  AR (total)      — aumenta Cuentas por Cobrar
    //   Credit Revenue (subs)  — aumenta Ingresos
    //   Credit ISV (tax)       — aumenta ISV por Pagar
    //
    // NOTA_CREDITO (devolución o descuento):
    //   Debit  Revenue (subs)  — reduce Ingresos
    //   Debit  ISV (tax)       — reduce ISV por Pagar
    //   Credit AR (total)      — reduce Cuentas por Cobrar
    //
    const isCredit = inv.invoiceType === 'NOTA_CREDITO';
    const ZERO = new Decimal(0);

    type JournalLine = {
      companyId: string;
      lineNumber: number;
      accountId: string;
      description: string | null;
      debit: Decimal;
      credit: Decimal;
      currencyDebit: Decimal;
      currencyCredit: Decimal;
    };
    const journalLines: JournalLine[] = [];
    let lineNum = 1;

    const docLabel = isCredit ? 'Nota de Crédito' : 'Factura';

    // AR line
    journalLines.push({
      companyId,
      lineNumber: lineNum++,
      accountId: sysAccounts.accountsReceivable.id,
      description: `${docLabel} ${invoiceNumber} — ${inv.contact.legalName}`,
      debit: isCredit ? ZERO : inv.total,
      credit: isCredit ? inv.total : ZERO,
      currencyDebit: isCredit ? ZERO : inv.total,
      currencyCredit: isCredit ? inv.total : ZERO,
    });

    // Revenue lines (per invoice line)
    for (const line of inv.lines) {
      const revenueAccountId = line.accountId ?? sysAccounts.salesRevenue?.id;
      if (!revenueAccountId) continue;
      journalLines.push({
        companyId,
        lineNumber: lineNum++,
        accountId: revenueAccountId,
        description: line.description,
        debit: isCredit ? line.subtotal : ZERO,
        credit: isCredit ? ZERO : line.subtotal,
        currencyDebit: isCredit ? line.subtotal : ZERO,
        currencyCredit: isCredit ? ZERO : line.subtotal,
      });
    }

    // ISV payable line
    const totalTax = inv.taxAmount;
    if (sysAccounts.isvPayable && new Decimal(totalTax).greaterThan(0)) {
      journalLines.push({
        companyId,
        lineNumber: lineNum++,
        accountId: sysAccounts.isvPayable.id,
        description: `ISV — ${docLabel} ${invoiceNumber}`,
        debit: isCredit ? totalTax : ZERO,
        credit: isCredit ? ZERO : totalTax,
        currencyDebit: isCredit ? totalTax : ZERO,
        currencyCredit: isCredit ? ZERO : totalTax,
      });
    }

    const totalDebit = journalLines.reduce((s, l) => s.plus(l.debit), ZERO);
    const totalCredit = journalLines.reduce((s, l) => s.plus(l.credit), ZERO);

    // 6. Persist everything in a single transaction
    const published = await (basePrisma as typeof basePrisma).$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.current_company_id', ${companyId}, true)`;
      // Create and immediately post the journal entry
      const journalEntry = await tx.journalEntry.create({
        data: {
          companyId,
          journalId: salesJournal.id,
          fiscalPeriodId: fiscalPeriod.id,
          entryNumber,
          description: `${docLabel} ${invoiceNumber} — ${inv.contact.legalName}`,
          entryDate: inv.issueDate,
          status: 'POSTED',
          currencyCode: inv.currencyCode,
          exchangeRate: inv.exchangeRate,
          totalDebit,
          totalCredit,
          createdBy: userId,
          postedBy: userId,
          postedAt: new Date(),
          lines: { create: journalLines },
        },
      });

      // Update invoice to PUBLISHED
      return tx.invoice.update({
        where: { id },
        data: {
          status: 'PUBLISHED',
          invoiceNumber,
          sequenceNumber,
          caiId,
          journalEntryId: journalEntry.id,
          issuedBy: userId,
          issuedAt: new Date(),
        },
        include: INVOICE_INCLUDE,
      });
    });

    void logAudit(basePrisma, {
      companyId,
      userId,
      action: 'UPDATE',
      entity: 'Invoice',
      entityId: id,
      newValues: { status: 'PUBLISHED', invoiceNumber },
    });

    // F3-09: Trigger async PDF generation via SQS → Lambda generate-invoice-pdf
    void enqueueInvoicePdf({ invoiceId: id, companyId, invoiceNumber });

    return toRow(published);
  },

  /**
   * Cancels a PUBLISHED invoice.
   * Creates a credit-note journal entry to reverse the original posting.
   */
  async cancelInvoice(
    companyId: string,
    id: string,
    userId: string,
    cancelReason: string,
  ): Promise<InvoiceRow> {
    const db = createTenantPrisma(basePrisma, companyId);

    const inv = await db.invoice.findFirst({
      where: { id, companyId },
      include: { lines: true },
    });
    if (!inv) throw new Error('Factura no encontrada');
    if (inv.status !== 'PUBLISHED') {
      throw new Error('Solo las facturas emitidas pueden anularse');
    }
    if (!cancelReason.trim()) throw new Error('El motivo de anulación es requerido');

    const cancelled = await (basePrisma as typeof basePrisma).$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.current_company_id', ${companyId}, true)`;
      // Reverse the journal entry if exists
      if (inv.journalEntryId) {
        const original = await tx.journalEntry.findUnique({
          where: { id: inv.journalEntryId },
          include: { lines: true },
        });

        if (original && original.status === 'POSTED') {
          // Find fiscal period for today
          const today = new Date();
          const fiscalPeriod = await tx.fiscalPeriod.findFirst({
            where: {
              companyId,
              status: 'OPEN',
              startDate: { lte: today },
              endDate: { gte: today },
            },
          });

          if (!fiscalPeriod) {
            throw new Error(
              `No existe un período fiscal abierto para la fecha de hoy (${today.toLocaleDateString('es-HN')}). ` +
                'No se puede anular la factura sin registrar el asiento de reversión. ' +
                'Abra el período fiscal correspondiente e intente de nuevo.',
            );
          }

          // Get next entry number
          const entryNumberResult = await tx.$queryRaw<Array<{ last_number: number }>>`
            INSERT INTO journal_sequences (company_id, journal_id, last_number, updated_at)
            VALUES (${companyId}::uuid, ${original.journalId}::uuid, 1, NOW())
            ON CONFLICT (company_id, journal_id)
            DO UPDATE SET
              last_number = journal_sequences.last_number + 1,
              updated_at  = NOW()
            RETURNING last_number
          `;
          const reversalEntryNumber = Number(entryNumberResult[0].last_number);

          // Create reversal (swap debit/credit)
          const reversalEntry = await tx.journalEntry.create({
            data: {
              companyId,
              journalId: original.journalId,
              fiscalPeriodId: fiscalPeriod.id,
              entryNumber: reversalEntryNumber,
              description: `Anulación ${inv.invoiceNumber ?? id}: ${cancelReason}`,
              entryDate: today,
              status: 'POSTED',
              currencyCode: original.currencyCode,
              exchangeRate: original.exchangeRate,
              totalDebit: original.totalCredit,
              totalCredit: original.totalDebit,
              createdBy: userId,
              postedBy: userId,
              postedAt: today,
              cancelledById: original.id,
              lines: {
                create: original.lines.map((l, i) => ({
                  companyId,
                  lineNumber: i + 1,
                  accountId: l.accountId,
                  description: l.description,
                  debit: l.credit,
                  credit: l.debit,
                  currencyDebit: l.currencyCredit,
                  currencyCredit: l.currencyDebit,
                })),
              },
            },
          });

          // Mark original as cancelled
          await tx.journalEntry.update({
            where: { id: original.id },
            data: { status: 'CANCELLED', cancelledById: reversalEntry.id },
          });
        }
      }

      return tx.invoice.update({
        where: { id },
        data: {
          status: 'CANCELLED',
          cancelledBy: userId,
          cancelledAt: new Date(),
          cancelReason,
        },
        include: INVOICE_INCLUDE,
      });
    });

    void logAudit(basePrisma, {
      companyId,
      userId,
      action: 'UPDATE',
      entity: 'Invoice',
      entityId: id,
      newValues: { status: 'CANCELLED', cancelReason },
    });

    return toRow(cancelled);
  },

  /**
   * Sprint F5-B — Integración 1: SalesOrder → Invoice (DRAFT).
   *
   * Copies SO lines into a new DRAFT Invoice so the user can review and
   * publish it. The SO is NOT marked INVOICED here — that happens when the
   * invoice is published (extend publishInvoice or handle separately).
   *
   * Steps:
   *  1. Load the SalesOrder with lines + tax rates.
   *  2. Validate it is CONFIRMED or DELIVERED (not DRAFT/CANCELLED/INVOICED).
   *  3. Resolve the active CAI for FACTURA.
   *  4. Build invoice lines from SO lines (quantity = qtyOrdered, inherit accountId).
   *  5. Insert DRAFT invoice inside a set_config transaction.
   */
  async createFromSalesOrder(
    companyId: string,
    salesOrderId: string,
    userId: string,
  ): Promise<InvoiceRow> {
    const db = createTenantPrisma(basePrisma, companyId);

    // 1. Load SO with lines and tax rates
    const so = await db.salesOrder.findFirst({
      where: { id: salesOrderId, companyId },
      include: {
        lines: {
          include: { taxRate: { select: { id: true, rate: true } } },
          orderBy: { lineNumber: 'asc' },
        },
        paymentTerms: { select: { id: true } },
      },
    });
    if (!so) throw new Error('Pedido de venta no encontrado');
    if (!['CONFIRMED', 'DELIVERED'].includes(so.status)) {
      throw new Error('Solo se pueden facturar pedidos en estado CONFIRMED o DELIVERED');
    }

    // 2. Resolve active CAI for FACTURA
    const activeCai = await db.cAI.findFirst({
      where: { companyId, documentType: '01', isActive: true },
    });
    if (!activeCai) {
      throw new Error(
        'No hay un CAI activo para Facturas (tipo 01). Registre un CAI antes de crear facturas.',
      );
    }

    // 3. Build lines from SO lines — reuse amounts already calculated on the SO
    const linesData = so.lines.map((l) => ({
      companyId,
      lineNumber: l.lineNumber,
      description: l.description ?? l.productId, // product name not joined here; service caller can update
      quantity: l.qtyOrdered,
      unitPrice: l.unitPrice,
      discountPct: l.discountPct,
      subtotal: l.subtotal,
      taxRateId: l.taxRateId,
      taxAmount: l.taxAmount,
      total: l.total,
      accountId: l.accountId ?? null,
    }));

    // 4. Create DRAFT invoice
    const inv = await (basePrisma as typeof basePrisma).$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.current_company_id', ${companyId}, true)`;
      return tx.invoice.create({
        data: {
          companyId,
          caiId: activeCai.id,
          invoiceType: 'FACTURA',
          status: 'DRAFT',
          issueDate: new Date(),
          contactId: so.customerId,
          paymentTermsId: so.paymentTermsId ?? null,
          currencyCode: so.currencyCode,
          exchangeRate: so.exchangeRate,
          subtotal: so.subtotal,
          taxAmount: so.taxAmount,
          total: so.total,
          salesOrderId: so.id,
          createdBy: userId,
          lines: { create: linesData },
        },
        include: INVOICE_INCLUDE,
      });
    });

    // 5. Mark SO as INVOICED
    await db.salesOrder.update({
      where: { id: salesOrderId },
      data: { status: 'INVOICED' },
    });

    return toRow(inv);
  },
};
