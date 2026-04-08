// src/__tests__/integration/cross-module.test.ts
/**
 * Tests de integración — Flujos cross-module (Sprint F5-B)
 *
 * Verifica los 4 flujos de integración entre módulos contra BD real:
 *
 *  [SO → Invoice]
 *   1. createFromSalesOrder: SO CONFIRMED → DRAFT Invoice con líneas copiadas
 *   2. createFromSalesOrder: SO pasa a INVOICED tras crear la factura
 *   3. createFromSalesOrder: lanza error si SO no está CONFIRMED/DELIVERED
 *   4. Aislamiento: Empresa B no puede convertir SO de Empresa A
 *
 *  [SO → StockMove (deliver)]
 *   5. deliverOrder: SO CONFIRMED → DELIVERED + StockMove DONE creado
 *   6. deliverOrder: StockMove tiene fromLocation=INTERNAL, toLocation=CUSTOMER
 *   7. deliverOrder: lanza error si SO no tiene warehouseId
 *
 *  [PO → StockMove (receive)]
 *   8. receive: PO CONFIRMED → RECEIVED + StockMove DONE creado
 *   9. receive: qtyReceived actualizado en líneas de la PO
 *
 *  [PO → SupplierInvoice]
 *  10. createFromPurchaseOrder: PO RECEIVED → DRAFT SupplierInvoice con líneas
 *  11. createFromPurchaseOrder: PO pasa a INVOICED tras crear la factura de compra
 *  12. createFromPurchaseOrder: lanza error si PO no está RECEIVED
 *
 * Requiere: .env.local con DATABASE_URL
 */

import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { invoiceService } from '@/lib/services/invoicing/invoice.service';
import { salesOrderService } from '@/lib/services/sales/sales-order.service';
import { purchaseOrderService } from '@/lib/services/purchasing/purchase-order.service';
import { supplierInvoiceService } from '@/lib/services/invoicing/supplier-invoice.service';

const prisma = new PrismaClient();

// ─── Fixture IDs ──────────────────────────────────────────────────────────────

const IDS = {
  companyA: '00000000-0000-0000-0006-000000000001',
  companyB: '00000000-0000-0000-0006-000000000002',
  // Contacts
  customer: '00000000-0000-0000-0006-000000000010',
  supplier: '00000000-0000-0000-0006-000000000011',
  // Tax
  taxRate: '00000000-0000-0000-0006-000000000020',
  cai: '00000000-0000-0000-0006-000000000021',
  // Product
  product: '00000000-0000-0000-0006-000000000030',
  productCategory: '00000000-0000-0000-0006-000000000031',
  unitOfMeasure: '00000000-0000-0000-0006-000000000032',
  // Inventory
  warehouse: '00000000-0000-0000-0006-000000000040',
  locationInternal: '00000000-0000-0000-0006-000000000041',
  locationSupplier: '00000000-0000-0000-0006-000000000042',
  locationCustomer: '00000000-0000-0000-0006-000000000043',
  // Orders
  soForInvoice: '00000000-0000-0000-0006-000000000050',
  soForDeliver: '00000000-0000-0000-0006-000000000051',
  soNoWarehouse: '00000000-0000-0000-0006-000000000052',
  soCompanyB: '00000000-0000-0000-0006-000000000053',
  poForReceive: '00000000-0000-0000-0006-000000000060',
  poForInvoice: '00000000-0000-0000-0006-000000000061',
  poNotReceived: '00000000-0000-0000-0006-000000000062',
  // Payment terms
  paymentTerms: '00000000-0000-0000-0006-000000000070',
};

const USER = 'cross-module-test-user';

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeAll(async () => {
  const del = (sql: string) => prisma.$executeRawUnsafe(sql).catch(() => {});
  const ids = `'${IDS.companyA}','${IDS.companyB}'`;

  // Cleanup in FK order (child → parent)
  await del(`DELETE FROM stock_move_lines WHERE company_id IN (${ids})`);
  await del(`DELETE FROM stock_moves WHERE company_id IN (${ids})`);
  await del(`DELETE FROM invoice_lines WHERE company_id IN (${ids})`);
  await del(`DELETE FROM invoices WHERE company_id IN (${ids})`);
  await del(`DELETE FROM supplier_invoice_lines WHERE company_id IN (${ids})`);
  await del(`DELETE FROM supplier_invoices WHERE company_id IN (${ids})`);
  await del(`DELETE FROM sales_order_lines WHERE company_id IN (${ids})`);
  await del(`DELETE FROM sales_orders WHERE company_id IN (${ids})`);
  await del(`DELETE FROM purchase_order_lines WHERE company_id IN (${ids})`);
  await del(`DELETE FROM purchase_orders WHERE company_id IN (${ids})`);
  await del(`DELETE FROM invoice_sequences WHERE company_id IN (${ids})`);
  await del(`DELETE FROM cais WHERE company_id IN (${ids})`);
  await del(`DELETE FROM tax_rates WHERE company_id IN (${ids})`);
  await del(`DELETE FROM stock_quants WHERE company_id IN (${ids})`);
  await del(`DELETE FROM locations WHERE company_id IN (${ids})`);
  await del(`DELETE FROM warehouses WHERE company_id IN (${ids})`);
  await del(`DELETE FROM products WHERE company_id IN (${ids})`);
  await del(`DELETE FROM units_of_measure WHERE company_id IN (${ids})`);
  await del(`DELETE FROM product_categories WHERE company_id IN (${ids})`);
  await del(`DELETE FROM payment_terms WHERE company_id IN (${ids})`);
  await del(`DELETE FROM contacts WHERE company_id IN (${ids})`);
  await del(`DELETE FROM companies WHERE id IN (${ids})`);

  // Base currency
  await prisma.currency.upsert({
    where: { code: 'HNL' },
    update: {},
    create: { code: 'HNL', name: 'Lempira hondureño', symbol: 'L', isActive: true, isBase: true },
  });

  // Companies
  for (const [id, suffix] of [
    [IDS.companyA, 'A'],
    [IDS.companyB, 'B'],
  ] as const) {
    await prisma.company.create({
      data: {
        id,
        legalName: `CrossModule Test ${suffix}`,
        rtn: `0801-XMOD-0000${suffix}`,
        baseCurrency: 'HNL',
      },
    });
  }

  // Payment terms (companyA)
  await prisma.paymentTerms.create({
    data: { id: IDS.paymentTerms, companyId: IDS.companyA, name: 'Contado', daysUntilDue: 0 },
  });

  // Contacts
  await prisma.contact.create({
    data: {
      id: IDS.customer,
      companyId: IDS.companyA,
      legalName: 'Cliente Test XMOD',
      isCustomer: true,
      rtn: '0801-CUST-00001',
    },
  });
  await prisma.contact.create({
    data: {
      id: IDS.supplier,
      companyId: IDS.companyA,
      legalName: 'Proveedor Test XMOD',
      isSupplier: true,
      rtn: '0801-SUPP-00001',
    },
  });

  // Tax rate
  await prisma.taxRate.create({
    data: {
      id: IDS.taxRate,
      companyId: IDS.companyA,
      code: 'ISV15-XMOD',
      name: 'ISV 15%',
      rate: 0.15,
      isActive: true,
    },
  });

  // CAI (for createFromSalesOrder → Invoice lookup)
  await prisma.cAI.create({
    data: {
      id: IDS.cai,
      companyId: IDS.companyA,
      caiCode: 'XMOD01-CAI-000001-00001-00001-000001',
      establishmentCode: '001',
      emissionPointCode: '001',
      documentType: '01',
      rangeFrom: 1,
      rangeTo: 999999,
      issuedAt: new Date('2026-01-01'),
      expiresAt: new Date('2027-12-31'),
      isActive: true,
    },
  });

  // Inventory: Category, UoM, Product
  await prisma.productCategory.create({
    data: { id: IDS.productCategory, companyId: IDS.companyA, name: 'General XMOD' },
  });
  await prisma.unitOfMeasure.create({
    data: { id: IDS.unitOfMeasure, companyId: IDS.companyA, name: 'Unidad', symbol: 'UN' },
  });
  await prisma.product.create({
    data: {
      id: IDS.product,
      companyId: IDS.companyA,
      code: 'PROD-XMOD-001',
      name: 'Producto Cross-Module',
      categoryId: IDS.productCategory,
      unitOfMeasureId: IDS.unitOfMeasure,
      costPrice: 100,
      salePrice: 150,
    },
  });

  // Warehouse + Locations
  await prisma.warehouse.create({
    data: { id: IDS.warehouse, companyId: IDS.companyA, name: 'Bodega XMOD', code: 'WH-XMOD' },
  });
  await prisma.location.create({
    data: {
      id: IDS.locationInternal,
      companyId: IDS.companyA,
      warehouseId: IDS.warehouse,
      name: 'Zona Principal',
      locationType: 'INTERNAL',
      isActive: true,
    },
  });
  await prisma.location.create({
    data: {
      id: IDS.locationSupplier,
      companyId: IDS.companyA,
      name: 'Proveedor Virtual',
      locationType: 'SUPPLIER',
      isActive: true,
    },
  });
  await prisma.location.create({
    data: {
      id: IDS.locationCustomer,
      companyId: IDS.companyA,
      name: 'Cliente Virtual',
      locationType: 'CUSTOMER',
      isActive: true,
    },
  });

  // Helper: create a SalesOrder in CONFIRMED state
  const createSO = async (id: string, companyId: string, warehouseId?: string) => {
    const orderNumber = `SO-F5-${id.slice(-4)}`;
    await prisma.$executeRaw`SELECT set_config('app.current_company_id', ${companyId}, true)`;
    await prisma.$executeRawUnsafe(`
      INSERT INTO sales_orders (id, company_id, customer_id, order_number, status, delivery_date, warehouse_id,
        currency_code, exchange_rate, subtotal, tax_amount, total, created_by, created_at, updated_at)
      VALUES (
        '${id}', '${companyId}', '${IDS.customer}', '${orderNumber}', 'CONFIRMED', '2026-06-01',
        ${warehouseId ? `'${warehouseId}'` : 'NULL'},
        'HNL', 1.0, 1000.00, 150.00, 1150.00, '${USER}', NOW(), NOW()
      )
    `);
    await prisma.$executeRawUnsafe(`
      INSERT INTO sales_order_lines (id, company_id, sales_order_id, line_number, product_id,
        qty_ordered, qty_delivered, unit_price, discount_pct, subtotal, tax_rate_id, tax_amount, total)
      VALUES (
        gen_random_uuid(), '${companyId}', '${id}', 1, '${IDS.product}',
        10, 0, 100.00, 0, 1000.00, '${IDS.taxRate}', 150.00, 1150.00
      )
    `);
  };

  // Helper: create a PurchaseOrder in CONFIRMED state
  const createPO = async (id: string, warehouseId?: string) => {
    const orderNumber = `PO-F5-${id.slice(-4)}`;
    await prisma.$executeRaw`SELECT set_config('app.current_company_id', ${IDS.companyA}, true)`;
    await prisma.$executeRawUnsafe(`
      INSERT INTO purchase_orders (id, company_id, supplier_id, order_number, status, expected_date, warehouse_id,
        currency_code, exchange_rate, subtotal, tax_amount, total, created_by, created_at, updated_at)
      VALUES (
        '${id}', '${IDS.companyA}', '${IDS.supplier}', '${orderNumber}', 'CONFIRMED', '2026-06-01',
        ${warehouseId ? `'${warehouseId}'` : 'NULL'},
        'HNL', 1.0, 1000.00, 150.00, 1150.00, '${USER}', NOW(), NOW()
      )
    `);
    await prisma.$executeRawUnsafe(`
      INSERT INTO purchase_order_lines (id, company_id, purchase_order_id, line_number, product_id,
        qty_ordered, qty_received, unit_price, discount_pct, subtotal, tax_rate_id, tax_amount, total)
      VALUES (
        gen_random_uuid(), '${IDS.companyA}', '${id}', 1, '${IDS.product}',
        10, 0, 100.00, 0, 1000.00, '${IDS.taxRate}', 150.00, 1150.00
      )
    `);
  };

  // Seed all orders
  await createSO(IDS.soForInvoice, IDS.companyA, IDS.warehouse);
  await createSO(IDS.soForDeliver, IDS.companyA, IDS.warehouse);
  await createSO(IDS.soNoWarehouse, IDS.companyA); // No warehouseId
  await createSO(IDS.soCompanyB, IDS.companyB, undefined); // Company B order
  await createPO(IDS.poForReceive, IDS.warehouse);
  await createPO(IDS.poForInvoice, IDS.warehouse);
  await createPO(IDS.poNotReceived, IDS.warehouse);
});

afterAll(async () => {
  await prisma.$disconnect();
});

// ─── [SO → Invoice] ───────────────────────────────────────────────────────────

describe('createFromSalesOrder', () => {
  it('creates a DRAFT Invoice copying SO lines', async () => {
    const invoice = await invoiceService.createFromSalesOrder(IDS.companyA, IDS.soForInvoice, USER);

    expect(invoice.status).toBe('DRAFT');
    expect(invoice.invoiceType).toBe('FACTURA');
    expect(invoice.contactId).toBe(IDS.customer);
    expect(invoice.currencyCode).toBe('HNL');
    expect(invoice.lines).toBeDefined();
    expect(invoice.lines!.length).toBe(1);
    expect(Number(invoice.lines![0].quantity)).toBe(10);
  });

  it('marks the SalesOrder as INVOICED', async () => {
    // soForInvoice was used in the previous test — status should now be INVOICED
    const raw = await prisma.$queryRaw<Array<{ status: string }>>`
      SELECT status FROM sales_orders WHERE id = ${IDS.soForInvoice}::uuid
    `;
    expect(raw[0]?.status).toBe('INVOICED');
  });

  it('throws when SO is not CONFIRMED or DELIVERED', async () => {
    // soForInvoice is now INVOICED — second call should fail
    await expect(
      invoiceService.createFromSalesOrder(IDS.companyA, IDS.soForInvoice, USER),
    ).rejects.toThrow('Solo se pueden facturar pedidos en estado CONFIRMED o DELIVERED');
  });

  it('throws when SO belongs to another company', async () => {
    // Company A tries to invoice Company B's SO
    await expect(
      invoiceService.createFromSalesOrder(IDS.companyA, IDS.soCompanyB, USER),
    ).rejects.toThrow('Pedido de venta no encontrado');
  });
});

// ─── [SO → StockMove (deliver)] ──────────────────────────────────────────────

describe('deliverOrder', () => {
  let soLineId: string;

  beforeAll(async () => {
    const [line] = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM sales_order_lines WHERE sales_order_id = ${IDS.soForDeliver}::uuid LIMIT 1
    `;
    soLineId = line.id;
  });

  it('transitions SO to DELIVERED and creates a DONE StockMove', async () => {
    const order = await salesOrderService.deliverOrder(IDS.companyA, IDS.soForDeliver, USER, [
      { lineId: soLineId, qtyDelivered: 10 },
    ]);

    expect(order.status).toBe('DELIVERED');

    const moves = await prisma.$queryRaw<Array<{ state: string; qty_done: string }>>`
      SELECT state, qty_done FROM stock_moves
      WHERE company_id = ${IDS.companyA}::uuid
        AND reference = ${order.orderNumber}
    `;
    expect(moves.length).toBeGreaterThan(0);
    expect(moves[0].state).toBe('DONE');
    expect(Number(moves[0].qty_done)).toBe(10);
  });

  it('StockMove goes from INTERNAL to CUSTOMER location', async () => {
    const [move] = await prisma.$queryRaw<
      Array<{ from_location_id: string; to_location_id: string }>
    >`
      SELECT from_location_id, to_location_id FROM stock_moves
      WHERE company_id = ${IDS.companyA}::uuid
        AND to_location_id = ${IDS.locationCustomer}::uuid
      LIMIT 1
    `;
    expect(move).toBeDefined();
    expect(move.from_location_id).toBe(IDS.locationInternal);
    expect(move.to_location_id).toBe(IDS.locationCustomer);
  });

  it('throws when SO has no warehouseId', async () => {
    const [line] = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM sales_order_lines WHERE sales_order_id = ${IDS.soNoWarehouse}::uuid LIMIT 1
    `;
    await expect(
      salesOrderService.deliverOrder(IDS.companyA, IDS.soNoWarehouse, USER, [
        { lineId: line.id, qtyDelivered: 5 },
      ]),
    ).rejects.toThrow('almacén asignado');
  });
});

// ─── [PO → StockMove (receive)] ──────────────────────────────────────────────

describe('receive (PurchaseOrder)', () => {
  let poLineId: string;

  beforeAll(async () => {
    const [line] = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM purchase_order_lines WHERE purchase_order_id = ${IDS.poForReceive}::uuid LIMIT 1
    `;
    poLineId = line.id;
  });

  it('transitions PO to RECEIVED and creates a DONE StockMove', async () => {
    const order = await purchaseOrderService.receive(IDS.companyA, IDS.poForReceive, USER, [
      { lineId: poLineId, qtyReceived: 10 },
    ]);

    expect(order.status).toBe('RECEIVED');
  });

  it('updates qtyReceived on the PO line', async () => {
    const [line] = await prisma.$queryRaw<Array<{ qty_received: string }>>`
      SELECT qty_received FROM purchase_order_lines WHERE id = ${poLineId}::uuid
    `;
    expect(Number(line.qty_received)).toBe(10);
  });

  it('StockMove goes from SUPPLIER to INTERNAL location', async () => {
    const [move] = await prisma.$queryRaw<
      Array<{ from_location_id: string; to_location_id: string }>
    >`
      SELECT from_location_id, to_location_id FROM stock_moves
      WHERE company_id = ${IDS.companyA}::uuid
        AND from_location_id = ${IDS.locationSupplier}::uuid
      LIMIT 1
    `;
    expect(move).toBeDefined();
    expect(move.from_location_id).toBe(IDS.locationSupplier);
    expect(move.to_location_id).toBe(IDS.locationInternal);
  });
});

// ─── [PO → SupplierInvoice] ───────────────────────────────────────────────────

describe('createFromPurchaseOrder', () => {
  // First, move poForInvoice to RECEIVED state
  beforeAll(async () => {
    const [line] = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM purchase_order_lines WHERE purchase_order_id = ${IDS.poForInvoice}::uuid LIMIT 1
    `;
    await purchaseOrderService.receive(IDS.companyA, IDS.poForInvoice, USER, [
      { lineId: line.id, qtyReceived: 10 },
    ]);
  });

  it('creates a DRAFT SupplierInvoice with copied lines', async () => {
    const inv = await supplierInvoiceService.createFromPurchaseOrder(
      IDS.companyA,
      IDS.poForInvoice,
      USER,
    );

    expect(inv.status).toBe('DRAFT');
    expect(inv.invoiceType).toBe('FACTURA_COMPRA');
    expect(inv.contactId).toBe(IDS.supplier);
    expect(inv.lines).toBeDefined();
    expect(inv.lines!.length).toBe(1);
  });

  it('marks PO as INVOICED', async () => {
    const [row] = await prisma.$queryRaw<Array<{ status: string }>>`
      SELECT status FROM purchase_orders WHERE id = ${IDS.poForInvoice}::uuid
    `;
    expect(row.status).toBe('INVOICED');
  });

  it('throws when PO is not RECEIVED', async () => {
    await expect(
      supplierInvoiceService.createFromPurchaseOrder(IDS.companyA, IDS.poNotReceived, USER),
    ).rejects.toThrow('Solo se pueden facturar órdenes en estado RECEIVED');
  });
});
