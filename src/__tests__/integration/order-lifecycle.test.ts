// src/__tests__/integration/order-lifecycle.test.ts
/**
 * Tests de integración — Ciclo de vida de Órdenes (Sprint F6-01)
 *
 * Verifica confirmOrder y cancelOrder para SalesOrder y PurchaseOrder
 * contra BD real. Cubre el bug del tenant extension (AND injection en update).
 *
 * Flujos cubiertos:
 *  [SalesOrder lifecycle]
 *   1. confirmOrder: DRAFT → CONFIRMED, asigna orderNumber
 *   2. confirmOrder: lanza error si estado no es DRAFT
 *   3. confirmOrder: aislamiento — empresa B no puede confirmar SO de empresa A
 *   4. cancelOrder: DRAFT → CANCELLED
 *   5. cancelOrder: CONFIRMED → CANCELLED
 *   6. cancelOrder: aislamiento — empresa B no puede cancelar SO de empresa A
 *
 *  [PurchaseOrder lifecycle]
 *   7. confirmOrder: DRAFT → CONFIRMED, asigna orderNumber
 *   8. confirmOrder: aislamiento — empresa B no puede confirmar PO de empresa A
 *   9. cancelOrder: DRAFT → CANCELLED
 *   10. cancelOrder: aislamiento — empresa B no puede cancelar PO de empresa A
 *
 * Requiere: .env.local con DATABASE_URL
 */

import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { salesOrderService } from '@/lib/services/sales/sales-order.service';
import { purchaseOrderService } from '@/lib/services/purchasing/purchase-order.service';

const prisma = new PrismaClient();

// ─── Fixture IDs (namespace 0007 para evitar colisiones con otros tests) ──────

const IDS = {
  companyA: '00000000-0000-0000-0007-000000000001',
  companyB: '00000000-0000-0000-0007-000000000002',
  customer: '00000000-0000-0000-0007-000000000010',
  customerB: '00000000-0000-0000-0007-000000000012',
  supplier: '00000000-0000-0000-0007-000000000011',
  taxRate: '00000000-0000-0000-0007-000000000020',
  productCategory: '00000000-0000-0000-0007-000000000030',
  unitOfMeasure: '00000000-0000-0000-0007-000000000031',
  product: '00000000-0000-0000-0007-000000000032',
  // SalesOrders
  soDraftForConfirm: '00000000-0000-0000-0007-000000000050',
  soDraftForCancel: '00000000-0000-0000-0007-000000000051',
  soConfirmedForCancel: '00000000-0000-0000-0007-000000000052',
  soCompanyBForIsolation: '00000000-0000-0000-0007-000000000053',
  soCompanyAForBAttack: '00000000-0000-0000-0007-000000000054',
  // PurchaseOrders
  poDraftForConfirm: '00000000-0000-0000-0007-000000000060',
  poDraftForCancel: '00000000-0000-0000-0007-000000000061',
  poCompanyAForBAttack: '00000000-0000-0000-0007-000000000062',
};

const USER = 'order-lifecycle-test-user';

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeAll(async () => {
  const del = (sql: string) => prisma.$executeRawUnsafe(sql).catch(() => {});
  const ids = `'${IDS.companyA}','${IDS.companyB}'`;

  // Cleanup en orden FK
  await del(`DELETE FROM purchase_order_lines WHERE company_id IN (${ids})`);
  await del(`DELETE FROM purchase_orders WHERE company_id IN (${ids})`);
  await del(`DELETE FROM sales_order_lines WHERE company_id IN (${ids})`);
  await del(`DELETE FROM sales_orders WHERE company_id IN (${ids})`);
  await del(`DELETE FROM tax_rates WHERE company_id IN (${ids})`);
  await del(`DELETE FROM products WHERE company_id IN (${ids})`);
  await del(`DELETE FROM units_of_measure WHERE company_id IN (${ids})`);
  await del(`DELETE FROM product_categories WHERE company_id IN (${ids})`);
  await del(`DELETE FROM contacts WHERE company_id IN (${ids})`);
  await del(`DELETE FROM companies WHERE id IN (${ids})`);

  // Moneda base (upsert — puede existir del seed)
  await prisma.currency.upsert({
    where: { code: 'HNL' },
    update: {},
    create: { code: 'HNL', name: 'Lempira hondureño', symbol: 'L', isActive: true, isBase: true },
  });

  // Companies
  await prisma.company.create({
    data: {
      id: IDS.companyA,
      legalName: 'Test Company A LC',
      rtn: '08019999000001',
      baseCurrency: 'HNL',
    },
  });
  await prisma.company.create({
    data: {
      id: IDS.companyB,
      legalName: 'Test Company B LC',
      rtn: '08019999000002',
      baseCurrency: 'HNL',
    },
  });

  // Contacts
  await prisma.contact.create({
    data: {
      id: IDS.customer,
      companyId: IDS.companyA,
      legalName: 'Cliente F6',
      isCustomer: true,
      rtn: '08019999000003',
    },
  });
  await prisma.contact.create({
    data: {
      id: IDS.customerB,
      companyId: IDS.companyB,
      legalName: 'Cliente B F6',
      isCustomer: true,
      rtn: '08019999000012',
    },
  });
  await prisma.contact.create({
    data: {
      id: IDS.supplier,
      companyId: IDS.companyA,
      legalName: 'Proveedor F6',
      isSupplier: true,
      rtn: '08019999000004',
    },
  });

  // Tax rate
  await prisma.taxRate.create({
    data: {
      id: IDS.taxRate,
      companyId: IDS.companyA,
      code: 'ISV15-LC',
      name: 'ISV 15%',
      rate: 0.15,
      isActive: true,
    },
  });

  // Inventario: categoría, UoM, producto
  await prisma.productCategory.create({
    data: { id: IDS.productCategory, companyId: IDS.companyA, name: 'General LC' },
  });
  await prisma.unitOfMeasure.create({
    data: { id: IDS.unitOfMeasure, companyId: IDS.companyA, name: 'Unidad', symbol: 'UN' },
  });
  await prisma.product.create({
    data: {
      id: IDS.product,
      companyId: IDS.companyA,
      code: 'PROD-LC-001',
      name: 'Producto Test LC',
      categoryId: IDS.productCategory,
      unitOfMeasureId: IDS.unitOfMeasure,
      costPrice: 100,
    },
  });

  // Helper para crear SO en DRAFT
  const createSO = async (id: string, companyId: string) => {
    const orderNum = `SO-LC-${id.slice(-4)}`;
    const customerId = companyId === IDS.companyA ? IDS.customer : IDS.customerB;
    await prisma.$executeRaw`SELECT set_config('app.current_company_id', ${companyId}, true)`;
    await prisma.$executeRawUnsafe(`
      INSERT INTO sales_orders (id, company_id, customer_id, order_number, status,
        currency_code, exchange_rate, delivery_date, subtotal, tax_amount, total, created_by, created_at, updated_at)
      VALUES (
        '${id}', '${companyId}', '${customerId}', '${orderNum}', 'DRAFT',
        'HNL', 1.0, NOW()::date + 30, 1000.00, 150.00, 1150.00, '${USER}', NOW(), NOW()
      )
    `);
    await prisma.$executeRawUnsafe(`
      INSERT INTO sales_order_lines (id, company_id, sales_order_id, line_number,
        product_id, qty_ordered, qty_delivered, unit_price, discount_pct,
        subtotal, tax_rate_id, tax_amount, total)
      VALUES (
        gen_random_uuid(), '${companyId}', '${id}', 1,
        '${IDS.product}', 10, 0, 100.00, 0,
        1000.00, '${IDS.taxRate}', 150.00, 1150.00
      )
    `);
  };

  // Helper para crear PO en DRAFT
  const createPO = async (id: string, companyId: string) => {
    const orderNum = `PO-LC-${id.slice(-4)}`;
    await prisma.$executeRaw`SELECT set_config('app.current_company_id', ${companyId}, true)`;
    await prisma.$executeRawUnsafe(`
      INSERT INTO purchase_orders (id, company_id, supplier_id, order_number, status,
        currency_code, exchange_rate, expected_date, subtotal, tax_amount, total, created_by, created_at, updated_at)
      VALUES (
        '${id}', '${companyId}', '${IDS.supplier}', '${orderNum}', 'DRAFT',
        'HNL', 1.0, NOW()::date + 30, 1000.00, 150.00, 1150.00, '${USER}', NOW(), NOW()
      )
    `);
    await prisma.$executeRawUnsafe(`
      INSERT INTO purchase_order_lines (id, company_id, purchase_order_id, line_number,
        product_id, qty_ordered, qty_received, unit_price, discount_pct,
        subtotal, tax_rate_id, tax_amount, total)
      VALUES (
        gen_random_uuid(), '${companyId}', '${id}', 1,
        '${IDS.product}', 10, 0, 100.00, 0,
        1000.00, '${IDS.taxRate}', 150.00, 1150.00
      )
    `);
  };

  // Crear fixtures
  await createSO(IDS.soDraftForConfirm, IDS.companyA);
  await createSO(IDS.soDraftForCancel, IDS.companyA);
  await createSO(IDS.soConfirmedForCancel, IDS.companyA);
  await createSO(IDS.soCompanyBForIsolation, IDS.companyB);
  await createSO(IDS.soCompanyAForBAttack, IDS.companyA);
  await createPO(IDS.poDraftForConfirm, IDS.companyA);
  await createPO(IDS.poDraftForCancel, IDS.companyA);
  await createPO(IDS.poCompanyAForBAttack, IDS.companyA);

  // Confirmar manualmente soConfirmedForCancel para probar cancel desde CONFIRMED
  await prisma.$executeRaw`SELECT set_config('app.current_company_id', ${IDS.companyA}, true)`;
  await prisma.$executeRawUnsafe(`
    UPDATE sales_orders SET status = 'CONFIRMED', order_number = 'SO-LC-CONF', confirmed_by = '${USER}', confirmed_at = NOW()
    WHERE id = '${IDS.soConfirmedForCancel}'
  `);
});

afterAll(async () => {
  await prisma.$disconnect();
});

// ─── SalesOrder lifecycle ─────────────────────────────────────────────────────

describe('SalesOrder — confirmOrder', () => {
  it('confirma un pedido DRAFT y asigna orderNumber', async () => {
    const result = await salesOrderService.confirmOrder(IDS.companyA, IDS.soDraftForConfirm, USER);

    expect(result.status).toBe('CONFIRMED');
    expect(result.orderNumber).toBeTruthy();
    expect(result.orderNumber).toMatch(/^SO\//);
  });

  it('lanza error si el pedido ya está CONFIRMED', async () => {
    // Reutiliza el pedido ya confirmado en el test anterior
    await expect(
      salesOrderService.confirmOrder(IDS.companyA, IDS.soDraftForConfirm, USER),
    ).rejects.toThrow('Solo se pueden confirmar pedidos en estado DRAFT');
  });

  it('aislamiento: empresa B no puede confirmar pedido de empresa A', async () => {
    await expect(
      salesOrderService.confirmOrder(IDS.companyB, IDS.soCompanyAForBAttack, USER),
    ).rejects.toThrow('Pedido de venta no encontrado');
  });
});

describe('SalesOrder — cancelOrder', () => {
  it('cancela un pedido en estado DRAFT', async () => {
    await salesOrderService.cancelOrder(IDS.companyA, IDS.soDraftForCancel, USER, 'Test cancel');

    const [row] = await prisma.$queryRaw<Array<{ status: string }>>`
      SELECT status FROM sales_orders WHERE id = ${IDS.soDraftForCancel}::uuid
    `;
    expect(row.status).toBe('CANCELLED');
  });

  it('cancela un pedido en estado CONFIRMED', async () => {
    await salesOrderService.cancelOrder(
      IDS.companyA,
      IDS.soConfirmedForCancel,
      USER,
      'Cancelled from CONFIRMED',
    );

    const [row] = await prisma.$queryRaw<Array<{ status: string }>>`
      SELECT status FROM sales_orders WHERE id = ${IDS.soConfirmedForCancel}::uuid
    `;
    expect(row.status).toBe('CANCELLED');
  });

  it('aislamiento: empresa B no puede cancelar pedido de empresa A', async () => {
    await expect(
      salesOrderService.cancelOrder(IDS.companyB, IDS.soCompanyAForBAttack, USER, 'attack'),
    ).rejects.toThrow('Pedido de venta no encontrado');
  });
});

// ─── PurchaseOrder lifecycle ──────────────────────────────────────────────────

describe('PurchaseOrder — confirmOrder', () => {
  it('confirma una orden de compra DRAFT y asigna orderNumber', async () => {
    const result = await purchaseOrderService.confirmOrder(
      IDS.companyA,
      IDS.poDraftForConfirm,
      USER,
    );

    expect(result.status).toBe('CONFIRMED');
    expect(result.orderNumber).toBeTruthy();
    expect(result.orderNumber).toMatch(/^PO\//);
  });

  it('lanza error si la orden ya está CONFIRMED', async () => {
    await expect(
      purchaseOrderService.confirmOrder(IDS.companyA, IDS.poDraftForConfirm, USER),
    ).rejects.toThrow('Solo se pueden confirmar órdenes en estado DRAFT');
  });

  it('aislamiento: empresa B no puede confirmar orden de empresa A', async () => {
    await expect(
      purchaseOrderService.confirmOrder(IDS.companyB, IDS.poCompanyAForBAttack, USER),
    ).rejects.toThrow('Orden de compra no encontrada');
  });
});

describe('PurchaseOrder — cancelOrder', () => {
  it('cancela una orden de compra en estado DRAFT', async () => {
    await purchaseOrderService.cancelOrder(
      IDS.companyA,
      IDS.poDraftForCancel,
      USER,
      'Test cancel PO',
    );

    const [row] = await prisma.$queryRaw<Array<{ status: string }>>`
      SELECT status FROM purchase_orders WHERE id = ${IDS.poDraftForCancel}::uuid
    `;
    expect(row.status).toBe('CANCELLED');
  });

  it('aislamiento: empresa B no puede cancelar orden de empresa A', async () => {
    await expect(
      purchaseOrderService.cancelOrder(IDS.companyB, IDS.poCompanyAForBAttack, USER, 'attack'),
    ).rejects.toThrow('Orden de compra no encontrada');
  });
});
