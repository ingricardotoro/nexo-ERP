// src/lib/services/invoicing/supplier-invoice.service.ts
//
// F3-07: Facturas de Compra — CRUD + registro contable.
//
// Ciclo de vida: DRAFT → POSTED → PAID | CANCELLED
//
// Al registrar (postSupplierInvoice):
//   1. Validar período fiscal OPEN para fecha de emisión.
//   2. Encontrar diario de Compras activo (journalType=PURCHASES).
//   3. Resolver cuentas del sistema:
//      - ACCOUNTS_PAYABLE  → crédito (deuda con proveedor)
//      - PURCHASE_EXPENSE  → débito por defecto (gasto)
//      - ISV_PAYABLE       → débito ISV acreditable (si aplica)
//   4. Crear asiento contable POSTED.
//   5. Actualizar factura a POSTED.

import type { InvoiceStatus, Prisma, SupplierInvoiceType } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import basePrisma from '@/lib/db/prisma';
import { createTenantPrisma } from '@/lib/db/tenant-extension';
import {
  createSupplierInvoiceSchema,
  updateSupplierInvoiceSchema,
  listSupplierInvoicesSchema,
  type CreateSupplierInvoiceInput,
  type UpdateSupplierInvoiceInput,
  type ListSupplierInvoicesInput,
} from '@/lib/validations/supplier-invoice.schema';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SupplierInvoiceLineRow {
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

export interface SupplierInvoiceRow {
  id: string;
  invoiceType: SupplierInvoiceType;
  status: InvoiceStatus;
  supplierInvoiceNumber: string | null;
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
  journalEntryId: string | null;
  originalInvoiceId: string | null;
  createdBy: string;
  postedBy: string | null;
  postedAt: Date | null;
  cancelledBy: string | null;
  cancelledAt: Date | null;
  cancelReason: string | null;
  createdAt: Date;
  updatedAt: Date;
  lines?: SupplierInvoiceLineRow[];
}

export interface SupplierInvoiceListResult {
  invoices: Omit<SupplierInvoiceRow, 'lines'>[];
  pagination: { total: number; page: number; limit: number; totalPages: number };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

const SUPPLIER_INVOICE_INCLUDE = {
  contact: { select: { legalName: true } },
  paymentTerms: { select: { name: true } },
  lines: {
    include: { taxRate: { select: { code: true, name: true, rate: true } } },
    orderBy: { lineNumber: 'asc' as const },
  },
} satisfies Prisma.SupplierInvoiceInclude;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toRow(inv: any, includeLines = true): SupplierInvoiceRow {
  const base: SupplierInvoiceRow = {
    id: inv.id,
    invoiceType: inv.invoiceType,
    status: inv.status,
    supplierInvoiceNumber: inv.supplierInvoiceNumber,
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
    journalEntryId: inv.journalEntryId,
    originalInvoiceId: inv.originalInvoiceId,
    createdBy: inv.createdBy,
    postedBy: inv.postedBy,
    postedAt: inv.postedAt,
    cancelledBy: inv.cancelledBy,
    cancelledAt: inv.cancelledAt,
    cancelReason: inv.cancelReason,
    createdAt: inv.createdAt,
    updatedAt: inv.updatedAt,
  };

  if (includeLines && inv.lines) {
    base.lines = inv.lines.map(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (l: any): SupplierInvoiceLineRow => ({
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

export const supplierInvoiceService = {
  /** Lista facturas de compra con filtros y paginación. */
  async listSupplierInvoices(
    companyId: string,
    query: ListSupplierInvoicesInput,
  ): Promise<SupplierInvoiceListResult> {
    const filters = listSupplierInvoicesSchema.parse(query);
    const db = createTenantPrisma(basePrisma, companyId);

    const where: Prisma.SupplierInvoiceWhereInput = { companyId };
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
      db.supplierInvoice.count({ where }),
      db.supplierInvoice.findMany({
        where,
        include: {
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

  /** Obtiene el detalle de una factura de compra con todas sus líneas. */
  async getSupplierInvoice(companyId: string, id: string): Promise<SupplierInvoiceRow> {
    const db = createTenantPrisma(basePrisma, companyId);
    const inv = await db.supplierInvoice.findFirst({
      where: { id, companyId },
      include: SUPPLIER_INVOICE_INCLUDE,
    });
    if (!inv) throw new Error('Factura de compra no encontrada');
    return toRow(inv);
  },

  /**
   * Crea una factura de compra en estado DRAFT.
   *
   * Steps:
   *  1. Validar que el contacto es proveedor de esta empresa.
   *  2. Validar tasas de impuesto.
   *  3. Calcular montos por línea.
   *  4. Insertar factura + líneas en transacción.
   */
  async createSupplierInvoice(
    companyId: string,
    userId: string,
    input: CreateSupplierInvoiceInput,
  ): Promise<SupplierInvoiceRow> {
    const data = createSupplierInvoiceSchema.parse(input);
    const db = createTenantPrisma(basePrisma, companyId);

    // 1. Validate supplier contact
    const contact = await db.contact.findFirst({
      where: { id: data.contactId, companyId, isSupplier: true },
    });
    if (!contact) {
      throw new Error(
        'Contacto no encontrado o no está marcado como proveedor. Verifique el contacto antes de crear la factura.',
      );
    }

    // 2. Validate originalInvoiceId for credit notes
    if (data.invoiceType === 'NOTA_CREDITO_COMPRA') {
      if (!data.originalInvoiceId) {
        throw new Error(
          'Las notas de crédito de compra requieren una factura original (originalInvoiceId)',
        );
      }
      const original = await db.supplierInvoice.findFirst({
        where: { id: data.originalInvoiceId, companyId },
      });
      if (!original) throw new Error('Factura de compra original no encontrada');
      if (original.status !== 'POSTED' && original.status !== 'PAID') {
        throw new Error(
          'Solo se pueden emitir notas de crédito contra facturas registradas o pagadas',
        );
      }
    } else if (data.originalInvoiceId) {
      throw new Error(
        'Solo las notas de crédito de compra pueden referenciar una factura original',
      );
    }

    // 3. Validate tax rates
    const taxRateIds = [...new Set(data.lines.map((l) => l.taxRateId))];
    const taxRates = await db.taxRate.findMany({ where: { companyId, id: { in: taxRateIds } } });
    if (taxRates.length !== taxRateIds.length) {
      throw new Error('Una o más tasas de impuesto no existen o no pertenecen a esta empresa');
    }
    const taxRateMap = new Map(taxRates.map((tr) => [tr.id, tr]));

    // 4. Calculate line amounts
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

    const invoiceSubtotal = linesWithAmounts.reduce((s, l) => s.plus(l.subtotal), new Decimal(0));
    const invoiceTaxAmount = linesWithAmounts.reduce((s, l) => s.plus(l.taxAmount), new Decimal(0));
    const invoiceTotal = invoiceSubtotal.plus(invoiceTaxAmount);

    // 5. Create in transaction (FORCE RLS)
    const inv = await (basePrisma as typeof basePrisma).$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.current_company_id', ${companyId}, true)`;
      return tx.supplierInvoice.create({
        data: {
          companyId,
          invoiceType: data.invoiceType,
          status: 'DRAFT',
          supplierInvoiceNumber: data.supplierInvoiceNumber ?? null,
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
        include: SUPPLIER_INVOICE_INCLUDE,
      });
    });

    return toRow(inv);
  },

  /** Actualiza una factura de compra en DRAFT. */
  async updateSupplierInvoice(
    companyId: string,
    id: string,
    input: UpdateSupplierInvoiceInput,
  ): Promise<SupplierInvoiceRow> {
    const data = updateSupplierInvoiceSchema.parse(input);
    const db = createTenantPrisma(basePrisma, companyId);

    const existing = await db.supplierInvoice.findFirst({ where: { id, companyId } });
    if (!existing) throw new Error('Factura de compra no encontrada');
    if (existing.status !== 'DRAFT') {
      throw new Error('Solo las facturas de compra en borrador pueden editarse');
    }

    if (!data.lines) {
      const updated = await db.supplierInvoice.update({
        where: { id },
        data: {
          supplierInvoiceNumber: data.supplierInvoiceNumber,
          issueDate: data.issueDate ? new Date(data.issueDate) : undefined,
          dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
          contactId: data.contactId,
          paymentTermsId: data.paymentTermsId,
          currencyCode: data.currencyCode,
          exchangeRate: data.exchangeRate,
          notes: data.notes,
        },
        include: SUPPLIER_INVOICE_INCLUDE,
      });
      return toRow(updated);
    }

    const taxRateIds = [...new Set(data.lines.map((l) => l.taxRateId))];
    const taxRates = await db.taxRate.findMany({ where: { companyId, id: { in: taxRateIds } } });
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

    const invoiceSubtotal = linesWithAmounts.reduce((s, l) => s.plus(l.subtotal), new Decimal(0));
    const invoiceTaxAmount = linesWithAmounts.reduce((s, l) => s.plus(l.taxAmount), new Decimal(0));
    const invoiceTotal = invoiceSubtotal.plus(invoiceTaxAmount);

    const updated = await (basePrisma as typeof basePrisma).$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.current_company_id', ${companyId}, true)`;
      await tx.supplierInvoiceLine.deleteMany({ where: { invoiceId: id } });
      return tx.supplierInvoice.update({
        where: { id },
        data: {
          supplierInvoiceNumber: data.supplierInvoiceNumber,
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
        include: SUPPLIER_INVOICE_INCLUDE,
      });
    });

    return toRow(updated);
  },

  /** Elimina una factura de compra en DRAFT. */
  async deleteDraftSupplierInvoice(companyId: string, id: string): Promise<void> {
    const db = createTenantPrisma(basePrisma, companyId);
    const inv = await db.supplierInvoice.findFirst({ where: { id, companyId } });
    if (!inv) throw new Error('Factura de compra no encontrada');
    if (inv.status !== 'DRAFT') {
      throw new Error(
        'Solo las facturas en borrador pueden eliminarse. Las facturas registradas deben anularse.',
      );
    }
    await db.supplierInvoice.delete({ where: { id } });
  },

  /**
   * F3-07: Registra una factura de compra — DRAFT → POSTED.
   *
   * Genera asiento contable en el diario de Compras:
   *   Débito  Gasto (por línea, cuenta específica o PURCHASE_EXPENSE)
   *   Débito  ISV Acreditable (si hay ISV)
   *   Crédito Cuentas por Pagar (total)
   */
  async postSupplierInvoice(
    companyId: string,
    id: string,
    userId: string,
  ): Promise<SupplierInvoiceRow> {
    const db = createTenantPrisma(basePrisma, companyId);

    const inv = await db.supplierInvoice.findFirst({
      where: { id, companyId },
      include: {
        ...SUPPLIER_INVOICE_INCLUDE,
        lines: {
          include: { taxRate: true, account: { select: { id: true } } },
          orderBy: { lineNumber: 'asc' },
        },
      },
    });
    if (!inv) throw new Error('Factura de compra no encontrada');
    if (inv.status !== 'DRAFT') {
      throw new Error('Solo las facturas en borrador pueden registrarse');
    }

    // 1. Find PURCHASES journal
    const purchasesJournal = await db.journal.findFirst({
      where: { companyId, journalType: 'PURCHASES', isActive: true },
    });
    if (!purchasesJournal) {
      throw new Error(
        'No se encontró un diario de compras activo (tipo PURCHASES). Configure el diario antes de registrar facturas de compra.',
      );
    }

    // 2. Find fiscal period for issue date
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
        `No existe un período fiscal abierto para la fecha de registro ${inv.issueDate.toLocaleDateString('es-HN')}. Verifique que el período esté activo.`,
      );
    }

    // 3. Resolve system accounts
    const [apAccount, expenseAccount, isvAccount] = await Promise.all([
      db.account.findFirst({
        where: {
          companyId,
          systemPurpose: 'ACCOUNTS_PAYABLE',
          isActive: true,
          allowDirectEntry: true,
        },
        select: { id: true, code: true },
      }) ??
        db.account.findFirst({
          where: { companyId, code: '2103', isActive: true, allowDirectEntry: true },
          select: { id: true, code: true },
        }),
      db.account.findFirst({
        where: {
          companyId,
          systemPurpose: 'PURCHASE_EXPENSE',
          isActive: true,
          allowDirectEntry: true,
        },
        select: { id: true, code: true },
      }) ??
        db.account.findFirst({
          where: { companyId, code: '5101', isActive: true, allowDirectEntry: true },
          select: { id: true, code: true },
        }),
      db.account.findFirst({
        where: { companyId, systemPurpose: 'ISV_PAYABLE', isActive: true, allowDirectEntry: true },
        select: { id: true, code: true },
      }),
    ]);

    if (!apAccount) {
      throw new Error(
        'Cuenta de Cuentas por Pagar no encontrada. Asigne systemPurpose=ACCOUNTS_PAYABLE a una cuenta, o cree la cuenta 2103.',
      );
    }

    // 4. Get next journal entry number
    const [entryNumberResult] = await (basePrisma as typeof basePrisma).$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.current_company_id', ${companyId}, true)`;
      return tx.$queryRaw<Array<{ last_number: number }>>`
        INSERT INTO journal_sequences (company_id, journal_id, last_number, updated_at)
        VALUES (${companyId}::uuid, ${purchasesJournal.id}::uuid, 1, NOW())
        ON CONFLICT (company_id, journal_id)
        DO UPDATE SET
          last_number = journal_sequences.last_number + 1,
          updated_at  = NOW()
        RETURNING last_number
      `;
    });
    const entryNumber = Number(entryNumberResult.last_number);

    // 5. Build journal entry lines
    // For NOTA_CREDITO_COMPRA: reverse the signs (Cuentas por Pagar is debited, expense credited)
    const isCredit = inv.invoiceType === 'NOTA_CREDITO_COMPRA';
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
    const docLabel = isCredit ? 'Nota de Crédito Compra' : 'Factura Compra';

    // Accounts Payable line (credit for regular, debit for NC)
    journalLines.push({
      companyId,
      lineNumber: lineNum++,
      accountId: apAccount.id,
      description: `${docLabel} ${inv.supplierInvoiceNumber ?? id} — ${inv.contact.legalName}`,
      debit: isCredit ? new Decimal(inv.total) : ZERO,
      credit: isCredit ? ZERO : new Decimal(inv.total),
      currencyDebit: isCredit ? new Decimal(inv.total) : ZERO,
      currencyCredit: isCredit ? ZERO : new Decimal(inv.total),
    });

    // Expense lines per invoice line (debit for regular, credit for NC)
    for (const line of inv.lines) {
      const expenseAccountId = line.accountId ?? expenseAccount?.id;
      if (!expenseAccountId) continue;
      journalLines.push({
        companyId,
        lineNumber: lineNum++,
        accountId: expenseAccountId,
        description: line.description,
        debit: isCredit ? ZERO : line.subtotal,
        credit: isCredit ? line.subtotal : ZERO,
        currencyDebit: isCredit ? ZERO : line.subtotal,
        currencyCredit: isCredit ? line.subtotal : ZERO,
      });
    }

    // ISV line (debit for regular — ISV acreditable, credit for NC)
    const totalTax = new Decimal(inv.taxAmount);
    if (isvAccount && totalTax.greaterThan(0)) {
      journalLines.push({
        companyId,
        lineNumber: lineNum++,
        accountId: isvAccount.id,
        description: `ISV Acreditable — ${docLabel} ${inv.supplierInvoiceNumber ?? id}`,
        debit: isCredit ? ZERO : totalTax,
        credit: isCredit ? totalTax : ZERO,
        currencyDebit: isCredit ? ZERO : totalTax,
        currencyCredit: isCredit ? totalTax : ZERO,
      });
    }

    const totalDebit = journalLines.reduce((s, l) => s.plus(l.debit), ZERO);
    const totalCredit = journalLines.reduce((s, l) => s.plus(l.credit), ZERO);

    // 6. Persist in transaction
    const posted = await (basePrisma as typeof basePrisma).$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.current_company_id', ${companyId}, true)`;
      const journalEntry = await tx.journalEntry.create({
        data: {
          companyId,
          journalId: purchasesJournal.id,
          fiscalPeriodId: fiscalPeriod.id,
          entryNumber,
          description: `${docLabel} ${inv.supplierInvoiceNumber ?? id} — ${inv.contact.legalName}`,
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

      return tx.supplierInvoice.update({
        where: { id },
        data: {
          status: 'POSTED',
          journalEntryId: journalEntry.id,
          postedBy: userId,
          postedAt: new Date(),
        },
        include: SUPPLIER_INVOICE_INCLUDE,
      });
    });

    return toRow(posted);
  },

  /**
   * Anula una factura de compra POSTED.
   * Crea asiento de reversión en el período fiscal actual.
   */
  async cancelSupplierInvoice(
    companyId: string,
    id: string,
    userId: string,
    cancelReason: string,
  ): Promise<SupplierInvoiceRow> {
    const db = createTenantPrisma(basePrisma, companyId);

    const inv = await db.supplierInvoice.findFirst({
      where: { id, companyId },
      include: { lines: true },
    });
    if (!inv) throw new Error('Factura de compra no encontrada');
    if (inv.status !== 'POSTED') {
      throw new Error('Solo las facturas de compra registradas pueden anularse');
    }
    if (!cancelReason.trim()) throw new Error('El motivo de anulación es requerido');

    const cancelled = await (basePrisma as typeof basePrisma).$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.current_company_id', ${companyId}, true)`;

      if (inv.journalEntryId) {
        const original = await tx.journalEntry.findUnique({
          where: { id: inv.journalEntryId },
          include: { lines: true },
        });

        if (original && original.status === 'POSTED') {
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
              `No existe un período fiscal abierto para la fecha de hoy (${today.toLocaleDateString('es-HN')}). No se puede anular la factura de compra sin registrar el asiento de reversión.`,
            );
          }

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

          const reversalEntry = await tx.journalEntry.create({
            data: {
              companyId,
              journalId: original.journalId,
              fiscalPeriodId: fiscalPeriod.id,
              entryNumber: reversalEntryNumber,
              description: `Anulación ${inv.supplierInvoiceNumber ?? id}: ${cancelReason}`,
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

          await tx.journalEntry.update({
            where: { id: original.id },
            data: { status: 'CANCELLED', cancelledById: reversalEntry.id },
          });
        }
      }

      return tx.supplierInvoice.update({
        where: { id },
        data: {
          status: 'CANCELLED',
          cancelledBy: userId,
          cancelledAt: new Date(),
          cancelReason,
        },
        include: SUPPLIER_INVOICE_INCLUDE,
      });
    });

    return toRow(cancelled);
  },

  /**
   * Sprint F5-B — Integración 4: PurchaseOrder → SupplierInvoice (DRAFT).
   *
   * Creates a DRAFT SupplierInvoice from a RECEIVED PurchaseOrder.
   * Copies lines from PO → SupplierInvoiceLines and links purchaseOrderId.
   * The PO is marked INVOICED after creation.
   */
  async createFromPurchaseOrder(
    companyId: string,
    purchaseOrderId: string,
    userId: string,
  ): Promise<SupplierInvoiceRow> {
    const db = createTenantPrisma(basePrisma, companyId);

    const po = await db.purchaseOrder.findFirst({
      where: { id: purchaseOrderId, companyId },
      include: {
        lines: {
          include: { taxRate: { select: { id: true } } },
          orderBy: { lineNumber: 'asc' },
        },
        paymentTerms: { select: { id: true } },
      },
    });
    if (!po) throw new Error('Orden de compra no encontrada');
    if (po.status !== 'RECEIVED') {
      throw new Error('Solo se pueden facturar órdenes en estado RECEIVED');
    }

    const linesData = po.lines.map((l) => ({
      companyId,
      lineNumber: l.lineNumber,
      description: l.description ?? l.productId,
      quantity: l.qtyOrdered,
      unitPrice: l.unitPrice,
      discountPct: l.discountPct,
      subtotal: l.subtotal,
      taxRateId: l.taxRateId,
      taxAmount: l.taxAmount,
      total: l.total,
      accountId: l.accountId ?? null,
    }));

    const inv = await basePrisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.current_company_id', ${companyId}, true)`;
      const created = await tx.supplierInvoice.create({
        data: {
          companyId,
          invoiceType: 'FACTURA_COMPRA',
          status: 'DRAFT',
          issueDate: new Date(),
          contactId: po.supplierId,
          paymentTermsId: po.paymentTermsId ?? null,
          currencyCode: po.currencyCode,
          exchangeRate: po.exchangeRate,
          subtotal: po.subtotal,
          taxAmount: po.taxAmount,
          total: po.total,
          purchaseOrderId: po.id,
          createdBy: userId,
          lines: { create: linesData },
        },
        include: SUPPLIER_INVOICE_INCLUDE,
      });
      return created;
    });

    // Mark PO as INVOICED
    await db.purchaseOrder.update({
      where: { id: purchaseOrderId },
      data: { status: 'INVOICED' },
    });

    return toRow(inv);
  },
};
