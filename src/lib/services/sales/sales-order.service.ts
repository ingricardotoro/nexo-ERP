// src/lib/services/sales/sales-order.service.ts
//
// Flujo: DRAFT → CONFIRMED (assign SO number) → DELIVERED → INVOICED | CANCELLED
// Numeración: SO/YYYY/NNNNN (5 dígitos, por empresa y año)

import basePrisma from '@/lib/db/prisma';
import { createTenantPrisma } from '@/lib/db/tenant-extension';
import { logAudit } from '@/lib/audit/log';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SalesOrderLine {
  id: string;
  lineNumber: number;
  productId: string;
  productCode: string;
  productName: string;
  description: string | null;
  qtyOrdered: string;
  qtyDelivered: string;
  unitPrice: string;
  discountPct: string;
  subtotal: string;
  taxRateId: string;
  taxRateName: string;
  taxAmount: string;
  total: string;
  accountId: string | null;
}

export interface SalesOrderRow {
  id: string;
  orderNumber: string | null;
  status: 'DRAFT' | 'CONFIRMED' | 'DELIVERED' | 'INVOICED' | 'CANCELLED';
  customerId: string;
  customerName: string;
  currencyCode: string;
  exchangeRate: string;
  deliveryDate: Date;
  warehouseId: string | null;
  warehouseName: string | null;
  subtotal: string;
  taxAmount: string;
  total: string;
  notes: string | null;
  confirmedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  lines?: SalesOrderLine[];
}

export interface SalesOrderListResult {
  success: boolean;
  orders: Omit<SalesOrderRow, 'lines'>[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export interface CreateSalesOrderInput {
  customerId: string;
  deliveryDate: Date;
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

/** Generates next SO number: SO/YYYY/NNNNN */
async function nextOrderNumber(
  db: ReturnType<typeof createTenantPrisma>,
  companyId: string,
): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `SO/${year}/`;
  const last = await db.salesOrder.findFirst({
    where: { companyId, orderNumber: { startsWith: prefix } },
    orderBy: { orderNumber: 'desc' },
  });
  const lastNum = last?.orderNumber ? parseInt(last.orderNumber.split('/')[2] ?? '0') : 0;
  const next = String(lastNum + 1).padStart(5, '0');
  return `${prefix}${next}`;
}

function mapRow(so: {
  id: string;
  orderNumber: string | null;
  status: string;
  customerId: string;
  customer: { legalName: string };
  currencyCode: string;
  exchangeRate: { toString(): string };
  deliveryDate: Date;
  warehouseId: string | null;
  warehouse: { name: string } | null;
  subtotal: { toString(): string };
  taxAmount: { toString(): string };
  total: { toString(): string };
  notes: string | null;
  confirmedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): Omit<SalesOrderRow, 'lines'> {
  return {
    id: so.id,
    orderNumber: so.orderNumber,
    status: so.status as SalesOrderRow['status'],
    customerId: so.customerId,
    customerName: so.customer.legalName,
    currencyCode: so.currencyCode,
    exchangeRate: so.exchangeRate.toString(),
    deliveryDate: so.deliveryDate,
    warehouseId: so.warehouseId,
    warehouseName: so.warehouse?.name ?? null,
    subtotal: so.subtotal.toString(),
    taxAmount: so.taxAmount.toString(),
    total: so.total.toString(),
    notes: so.notes,
    confirmedAt: so.confirmedAt,
    createdAt: so.createdAt,
    updatedAt: so.updatedAt,
  };
}

const SO_INCLUDE = {
  customer: { select: { legalName: true } },
  warehouse: { select: { name: true } },
} as const;

const LINE_INCLUDE = {
  product: { select: { code: true, name: true } },
  taxRate: { select: { name: true } },
} as const;

function mapLines(
  lines: {
    id: string;
    lineNumber: number;
    productId: string;
    product: { code: string; name: string };
    description: string | null;
    qtyOrdered: { toString(): string };
    qtyDelivered: { toString(): string };
    unitPrice: { toString(): string };
    discountPct: { toString(): string };
    subtotal: { toString(): string };
    taxRateId: string;
    taxRate: { name: string };
    taxAmount: { toString(): string };
    total: { toString(): string };
    accountId: string | null;
  }[],
): SalesOrderLine[] {
  return lines.map((l) => ({
    id: l.id,
    lineNumber: l.lineNumber,
    productId: l.productId,
    productCode: l.product.code,
    productName: l.product.name,
    description: l.description,
    qtyOrdered: l.qtyOrdered.toString(),
    qtyDelivered: l.qtyDelivered.toString(),
    unitPrice: l.unitPrice.toString(),
    discountPct: l.discountPct.toString(),
    subtotal: l.subtotal.toString(),
    taxRateId: l.taxRateId,
    taxRateName: l.taxRate.name,
    taxAmount: l.taxAmount.toString(),
    total: l.total.toString(),
    accountId: l.accountId,
  }));
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const salesOrderService = {
  async listOrders(
    companyId: string,
    opts: { page?: number; limit?: number; search?: string; status?: string } = {},
  ): Promise<SalesOrderListResult> {
    const db = createTenantPrisma(basePrisma, companyId);
    const page = Math.max(1, opts.page ?? 1);
    const limit = Math.min(100, opts.limit ?? 20);

    const where: Record<string, unknown> = { companyId };
    if (opts.status) where.status = opts.status;
    if (opts.search) {
      where.OR = [
        { orderNumber: { contains: opts.search, mode: 'insensitive' } },
        { customer: { legalName: { contains: opts.search, mode: 'insensitive' } } },
      ];
    }

    const [orders, total] = await Promise.all([
      db.salesOrder.findMany({
        where,
        include: SO_INCLUDE,
        orderBy: [{ createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.salesOrder.count({ where }),
    ]);

    return {
      success: true,
      orders: orders.map(mapRow),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  },

  async getOrder(companyId: string, id: string): Promise<SalesOrderRow> {
    const db = createTenantPrisma(basePrisma, companyId);
    const so = await db.salesOrder.findFirst({
      where: { id, companyId },
      include: {
        ...SO_INCLUDE,
        lines: { include: LINE_INCLUDE, orderBy: { lineNumber: 'asc' } },
      },
    });
    if (!so) throw new Error('Pedido de venta no encontrado');
    return { ...mapRow(so), lines: mapLines(so.lines) };
  },

  async createOrder(companyId: string, input: CreateSalesOrderInput): Promise<SalesOrderRow> {
    const db = createTenantPrisma(basePrisma, companyId);

    // Validate customer
    const customer = await db.contact.findFirst({
      where: { id: input.customerId, companyId, isCustomer: true },
    });
    if (!customer) throw new Error('Cliente no encontrado');

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

    const so = await db.salesOrder.create({
      data: {
        companyId,
        customerId: input.customerId,
        deliveryDate: input.deliveryDate,
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
        ...SO_INCLUDE,
        lines: { include: LINE_INCLUDE, orderBy: { lineNumber: 'asc' } },
      },
    });

    return { ...mapRow(so), lines: mapLines(so.lines) };
  },

  /** DRAFT → CONFIRMED: asigna número SO/YYYY/NNNNN */
  async confirmOrder(companyId: string, id: string, confirmedBy: string): Promise<SalesOrderRow> {
    const db = createTenantPrisma(basePrisma, companyId);
    const so = await db.salesOrder.findFirst({ where: { id, companyId } });
    if (!so) throw new Error('Pedido de venta no encontrado');
    if (so.status !== 'DRAFT') throw new Error('Solo se pueden confirmar pedidos en estado DRAFT');

    const orderNumber = await nextOrderNumber(db, companyId);

    const updated = await db.salesOrder.update({
      where: { id },
      data: { status: 'CONFIRMED', orderNumber, confirmedBy, confirmedAt: new Date() },
      include: { ...SO_INCLUDE, lines: { include: LINE_INCLUDE, orderBy: { lineNumber: 'asc' } } },
    });

    void logAudit(basePrisma, {
      companyId,
      userId: confirmedBy,
      action: 'UPDATE',
      entity: 'SalesOrder',
      entityId: id,
      newValues: { status: 'CONFIRMED', orderNumber },
    });

    return { ...mapRow(updated), lines: mapLines(updated.lines) };
  },

  /**
   * Sprint F5-B — Integración 2: SalesOrder → StockMove (entrega).
   *
   * CONFIRMED → DELIVERED: crea un StockMove DONE por producto desde
   * la ubicación INTERNAL del almacén hacia la ubicación virtual CUSTOMER.
   * Actualiza qtyDelivered en cada línea y marca el pedido como DELIVERED.
   */
  async deliverOrder(
    companyId: string,
    id: string,
    deliveredBy: string,
    lines: { lineId: string; qtyDelivered: number }[],
  ): Promise<SalesOrderRow> {
    const db = createTenantPrisma(basePrisma, companyId);
    const so = await db.salesOrder.findFirst({
      where: { id, companyId },
      include: {
        ...SO_INCLUDE,
        lines: { include: LINE_INCLUDE, orderBy: { lineNumber: 'asc' } },
      },
    });
    if (!so) throw new Error('Pedido de venta no encontrado');
    if (so.status !== 'CONFIRMED')
      throw new Error('Solo se pueden entregar pedidos en estado CONFIRMED');
    if (!so.warehouseId) throw new Error('El pedido no tiene almacén asignado para la entrega');

    // Find INTERNAL location for the warehouse (first active INTERNAL)
    const fromLocation = await db.location.findFirst({
      where: { companyId, warehouseId: so.warehouseId, locationType: 'INTERNAL', isActive: true },
    });
    if (!fromLocation)
      throw new Error('No se encontró una ubicación interna activa en el almacén asignado');

    // Find CUSTOMER virtual location (company-wide, no warehouseId)
    const toLocation = await db.location.findFirst({
      where: { companyId, locationType: 'CUSTOMER', isActive: true },
    });
    if (!toLocation)
      throw new Error('No se encontró la ubicación virtual CUSTOMER para esta empresa');

    const today = new Date();

    // Create one StockMove per SO line
    await basePrisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.current_company_id', ${companyId}, true)`;

      for (const lineInput of lines) {
        const soLine = so.lines.find((l) => l.id === lineInput.lineId);
        if (!soLine) throw new Error(`Línea ${lineInput.lineId} no encontrada en el pedido`);
        const qty = lineInput.qtyDelivered;
        if (qty <= 0) continue;

        await tx.stockMove.create({
          data: {
            companyId,
            productId: soLine.productId,
            fromLocationId: fromLocation.id,
            toLocationId: toLocation.id,
            state: 'DONE',
            scheduledDate: today,
            doneDate: today,
            qtyDemand: qty,
            qtyDone: qty,
            reference: so.orderNumber ?? id,
            createdBy: deliveredBy,
            lines: {
              create: {
                companyId,
                quantity: qty,
                doneQty: qty,
              },
            },
          },
        });

        // Update qtyDelivered on the SO line
        await tx.salesOrderLine.update({
          where: { id: lineInput.lineId },
          data: { qtyDelivered: { increment: qty } },
        });
      }

      // Mark SO as DELIVERED
      await tx.salesOrder.update({
        where: { id },
        data: { status: 'DELIVERED' },
      });
    });

    return salesOrderService.getOrder(companyId, id);
  },

  /** Cancels a DRAFT or CONFIRMED order */
  async cancelOrder(
    companyId: string,
    id: string,
    cancelledBy: string,
    cancelReason: string,
  ): Promise<void> {
    const db = createTenantPrisma(basePrisma, companyId);
    const so = await db.salesOrder.findFirst({ where: { id, companyId } });
    if (!so) throw new Error('Pedido de venta no encontrado');
    if (!['DRAFT', 'CONFIRMED'].includes(so.status))
      throw new Error('Solo se pueden cancelar pedidos en estado DRAFT o CONFIRMED');

    await db.salesOrder.update({
      where: { id },
      data: { status: 'CANCELLED', cancelledBy, cancelledAt: new Date(), cancelReason },
    });

    void logAudit(basePrisma, {
      companyId,
      userId: cancelledBy,
      action: 'UPDATE',
      entity: 'SalesOrder',
      entityId: id,
      newValues: { status: 'CANCELLED', cancelReason },
    });
  },
};
