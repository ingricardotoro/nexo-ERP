// src/lib/services/purchasing/purchase-order.service.ts
//
// Flujo: DRAFT → CONFIRMED (assign PO number) → RECEIVED → INVOICED | CANCELLED
// Numeración: PO/YYYY/NNNNN (5 dígitos, por empresa y año)

import basePrisma from '@/lib/db/prisma';
import { createTenantPrisma } from '@/lib/db/tenant-extension';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PurchaseOrderLine {
  id: string;
  lineNumber: number;
  productId: string;
  productCode: string;
  productName: string;
  description: string | null;
  qtyOrdered: string;
  qtyReceived: string;
  unitPrice: string;
  discountPct: string;
  subtotal: string;
  taxRateId: string;
  taxRateName: string;
  taxAmount: string;
  total: string;
  accountId: string | null;
}

export interface PurchaseOrderRow {
  id: string;
  orderNumber: string | null;
  status: 'DRAFT' | 'CONFIRMED' | 'RECEIVED' | 'INVOICED' | 'CANCELLED';
  supplierId: string;
  supplierName: string;
  currencyCode: string;
  exchangeRate: string;
  expectedDate: Date;
  warehouseId: string | null;
  warehouseName: string | null;
  subtotal: string;
  taxAmount: string;
  total: string;
  notes: string | null;
  confirmedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  lines?: PurchaseOrderLine[];
}

export interface PurchaseOrderListResult {
  success: boolean;
  orders: Omit<PurchaseOrderRow, 'lines'>[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export interface CreatePurchaseOrderInput {
  supplierId: string;
  expectedDate: Date;
  warehouseId?: string;
  currencyCode?: string;
  exchangeRate?: number;
  paymentTermsId?: string;
  notes?: string;
  createdBy: string;
  lines: {
    productId: string;
    description?: string;
    qtyOrdered: number;
    unitPrice: number;
    discountPct?: number;
    taxRateId: string;
    accountId?: string;
  }[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function calcLine(qtyOrdered: number, unitPrice: number, discountPct: number, taxRate: number) {
  const subtotal = qtyOrdered * unitPrice * (1 - discountPct / 100);
  const taxAmount = subtotal * taxRate;
  const total = subtotal + taxAmount;
  return {
    subtotal: parseFloat(subtotal.toFixed(2)),
    taxAmount: parseFloat(taxAmount.toFixed(2)),
    total: parseFloat(total.toFixed(2)),
  };
}

/** Generates next PO number: PO/YYYY/NNNNN */
async function nextOrderNumber(
  db: ReturnType<typeof createTenantPrisma>,
  companyId: string,
): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `PO/${year}/`;
  const last = await db.purchaseOrder.findFirst({
    where: { companyId, orderNumber: { startsWith: prefix } },
    orderBy: { orderNumber: 'desc' },
  });
  const lastNum = last?.orderNumber ? parseInt(last.orderNumber.split('/')[2] ?? '0') : 0;
  const next = String(lastNum + 1).padStart(5, '0');
  return `${prefix}${next}`;
}

function mapRow(po: {
  id: string;
  orderNumber: string | null;
  status: string;
  supplierId: string;
  supplier: { legalName: string };
  currencyCode: string;
  exchangeRate: { toString(): string };
  expectedDate: Date;
  warehouseId: string | null;
  warehouse: { name: string } | null;
  subtotal: { toString(): string };
  taxAmount: { toString(): string };
  total: { toString(): string };
  notes: string | null;
  confirmedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): Omit<PurchaseOrderRow, 'lines'> {
  return {
    id: po.id,
    orderNumber: po.orderNumber,
    status: po.status as PurchaseOrderRow['status'],
    supplierId: po.supplierId,
    supplierName: po.supplier.legalName,
    currencyCode: po.currencyCode,
    exchangeRate: po.exchangeRate.toString(),
    expectedDate: po.expectedDate,
    warehouseId: po.warehouseId,
    warehouseName: po.warehouse?.name ?? null,
    subtotal: po.subtotal.toString(),
    taxAmount: po.taxAmount.toString(),
    total: po.total.toString(),
    notes: po.notes,
    confirmedAt: po.confirmedAt,
    createdAt: po.createdAt,
    updatedAt: po.updatedAt,
  };
}

const PO_INCLUDE = {
  supplier: { select: { legalName: true } },
  warehouse: { select: { name: true } },
} as const;

const LINE_INCLUDE = {
  product: { select: { code: true, name: true } },
  taxRate: { select: { name: true } },
} as const;

// ─── Service ──────────────────────────────────────────────────────────────────

export const purchaseOrderService = {
  async listOrders(
    companyId: string,
    opts: { page?: number; limit?: number; search?: string; status?: string } = {},
  ): Promise<PurchaseOrderListResult> {
    const db = createTenantPrisma(basePrisma, companyId);
    const page = Math.max(1, opts.page ?? 1);
    const limit = Math.min(100, opts.limit ?? 20);

    const where: Record<string, unknown> = { companyId };
    if (opts.status) where.status = opts.status;
    if (opts.search) {
      where.OR = [
        { orderNumber: { contains: opts.search, mode: 'insensitive' } },
        { supplier: { legalName: { contains: opts.search, mode: 'insensitive' } } },
      ];
    }

    const [orders, total] = await Promise.all([
      db.purchaseOrder.findMany({
        where,
        include: PO_INCLUDE,
        orderBy: [{ createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.purchaseOrder.count({ where }),
    ]);

    return {
      success: true,
      orders: orders.map(mapRow),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  },

  async getOrder(companyId: string, id: string): Promise<PurchaseOrderRow> {
    const db = createTenantPrisma(basePrisma, companyId);
    const po = await db.purchaseOrder.findFirst({
      where: { id, companyId },
      include: {
        ...PO_INCLUDE,
        lines: { include: LINE_INCLUDE, orderBy: { lineNumber: 'asc' } },
      },
    });
    if (!po) throw new Error('Orden de compra no encontrada');

    return {
      ...mapRow(po),
      lines: po.lines.map((l) => ({
        id: l.id,
        lineNumber: l.lineNumber,
        productId: l.productId,
        productCode: l.product.code,
        productName: l.product.name,
        description: l.description,
        qtyOrdered: l.qtyOrdered.toString(),
        qtyReceived: l.qtyReceived.toString(),
        unitPrice: l.unitPrice.toString(),
        discountPct: l.discountPct.toString(),
        subtotal: l.subtotal.toString(),
        taxRateId: l.taxRateId,
        taxRateName: l.taxRate.name,
        taxAmount: l.taxAmount.toString(),
        total: l.total.toString(),
        accountId: l.accountId,
      })),
    };
  },

  async createOrder(companyId: string, input: CreatePurchaseOrderInput): Promise<PurchaseOrderRow> {
    const db = createTenantPrisma(basePrisma, companyId);

    // Validate supplier
    const supplier = await db.contact.findFirst({
      where: { id: input.supplierId, companyId, isSupplier: true },
    });
    if (!supplier) throw new Error('Proveedor no encontrado');

    // Fetch tax rates for lines
    const taxRateIds = [...new Set(input.lines.map((l) => l.taxRateId))];
    const taxRates = await db.taxRate.findMany({ where: { id: { in: taxRateIds }, companyId } });
    const taxRateMap = new Map(taxRates.map((t) => [t.id, parseFloat(t.rate.toString())]));

    // Calculate totals
    let orderSubtotal = 0;
    let orderTax = 0;

    const lineData = input.lines.map((l, idx) => {
      const rate = taxRateMap.get(l.taxRateId);
      if (rate === undefined) throw new Error(`Tasa de impuesto no encontrada: ${l.taxRateId}`);
      const calc = calcLine(l.qtyOrdered, l.unitPrice, l.discountPct ?? 0, rate);
      orderSubtotal += calc.subtotal;
      orderTax += calc.taxAmount;
      return { ...l, lineNumber: idx + 1, ...calc, discountPct: l.discountPct ?? 0 };
    });

    const po = await db.purchaseOrder.create({
      data: {
        companyId,
        supplierId: input.supplierId,
        expectedDate: input.expectedDate,
        warehouseId: input.warehouseId,
        currencyCode: input.currencyCode ?? 'HNL',
        exchangeRate: input.exchangeRate ?? 1,
        paymentTermsId: input.paymentTermsId,
        notes: input.notes,
        createdBy: input.createdBy,
        subtotal: parseFloat(orderSubtotal.toFixed(2)),
        taxAmount: parseFloat(orderTax.toFixed(2)),
        total: parseFloat((orderSubtotal + orderTax).toFixed(2)),
        lines: {
          create: lineData.map((l) => ({
            companyId,
            lineNumber: l.lineNumber,
            productId: l.productId,
            description: l.description,
            qtyOrdered: l.qtyOrdered,
            unitPrice: l.unitPrice,
            discountPct: l.discountPct,
            subtotal: l.subtotal,
            taxRateId: l.taxRateId,
            taxAmount: l.taxAmount,
            total: l.total,
            accountId: l.accountId,
          })),
        },
      },
      include: {
        ...PO_INCLUDE,
        lines: { include: LINE_INCLUDE, orderBy: { lineNumber: 'asc' } },
      },
    });

    return {
      ...mapRow(po),
      lines: po.lines.map((l) => ({
        id: l.id,
        lineNumber: l.lineNumber,
        productId: l.productId,
        productCode: l.product.code,
        productName: l.product.name,
        description: l.description,
        qtyOrdered: l.qtyOrdered.toString(),
        qtyReceived: l.qtyReceived.toString(),
        unitPrice: l.unitPrice.toString(),
        discountPct: l.discountPct.toString(),
        subtotal: l.subtotal.toString(),
        taxRateId: l.taxRateId,
        taxRateName: l.taxRate.name,
        taxAmount: l.taxAmount.toString(),
        total: l.total.toString(),
        accountId: l.accountId,
      })),
    };
  },

  /** DRAFT → CONFIRMED: asigna número PO/YYYY/NNNNN */
  async confirmOrder(
    companyId: string,
    id: string,
    confirmedBy: string,
  ): Promise<PurchaseOrderRow> {
    const db = createTenantPrisma(basePrisma, companyId);
    const po = await db.purchaseOrder.findFirst({ where: { id, companyId } });
    if (!po) throw new Error('Orden de compra no encontrada');
    if (po.status !== 'DRAFT') throw new Error('Solo se pueden confirmar órdenes en estado DRAFT');

    const orderNumber = await nextOrderNumber(db, companyId);

    const updated = await db.purchaseOrder.update({
      where: { id },
      data: {
        status: 'CONFIRMED',
        orderNumber,
        confirmedBy,
        confirmedAt: new Date(),
      },
      include: { ...PO_INCLUDE, lines: { include: LINE_INCLUDE, orderBy: { lineNumber: 'asc' } } },
    });

    return {
      ...mapRow(updated),
      lines: updated.lines.map((l) => ({
        id: l.id,
        lineNumber: l.lineNumber,
        productId: l.productId,
        productCode: l.product.code,
        productName: l.product.name,
        description: l.description,
        qtyOrdered: l.qtyOrdered.toString(),
        qtyReceived: l.qtyReceived.toString(),
        unitPrice: l.unitPrice.toString(),
        discountPct: l.discountPct.toString(),
        subtotal: l.subtotal.toString(),
        taxRateId: l.taxRateId,
        taxRateName: l.taxRate.name,
        taxAmount: l.taxAmount.toString(),
        total: l.total.toString(),
        accountId: l.accountId,
      })),
    };
  },

  /** Cancels a DRAFT or CONFIRMED order */
  async cancelOrder(
    companyId: string,
    id: string,
    cancelledBy: string,
    cancelReason: string,
  ): Promise<void> {
    const db = createTenantPrisma(basePrisma, companyId);
    const po = await db.purchaseOrder.findFirst({ where: { id, companyId } });
    if (!po) throw new Error('Orden de compra no encontrada');
    if (!['DRAFT', 'CONFIRMED'].includes(po.status))
      throw new Error('Solo se pueden cancelar órdenes en estado DRAFT o CONFIRMED');

    await db.purchaseOrder.update({
      where: { id },
      data: { status: 'CANCELLED', cancelledBy, cancelledAt: new Date(), cancelReason },
    });
  },
};
