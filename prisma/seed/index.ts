// prisma/seed/index.ts
// Seed para Fase 1 + Fase 2 — empresas, módulos, plan de cuentas NIIF Honduras

import { config as loadDotenv } from 'dotenv';

// tsx no carga .env.local automáticamente → cargar manualmente.
// SEED_DATABASE_URL permite apuntar a staging sin modificar .env.local.
if (!process.env.SEED_DATABASE_URL) {
  loadDotenv({ path: '.env.local' });
}

import { PrismaClient, SystemRole } from '@prisma/client';

import { seedAccountingChartOfAccounts } from './accounting-chart-of-accounts';
import { seedAccountingJournals } from './accounting-journals';

const dbUrl = process.env.SEED_DATABASE_URL ?? process.env.DATABASE_URL;
const prisma = new PrismaClient({
  datasources: { db: { url: dbUrl } },
});

async function main() {
  console.log('🌱 Iniciando seed de NexoERP...');

  // UUID fijo para la empresa demo — permite configurar Cognito custom:company_id
  // sin necesidad de consultar la BD después del seed.
  const DEMO_COMPANY_ID = '1360f768-f6e8-4d7a-98a1-2589dec76660';

  // Empresa demo para desarrollo
  const demoCompany = await prisma.company.upsert({
    where: { rtn: '0801-1990-00001' },
    update: {},
    create: {
      id: DEMO_COMPANY_ID,
      legalName: 'Empresa Demo S.A. de C.V.',
      tradeName: 'Demo NexoERP',
      rtn: '0801-1990-00001',
      email: 'demo@nexoerp.com',
      phone: '+504 2222-3333',
      address: 'Col. Kennedy, Blvd. Morazán',
      city: 'Tegucigalpa',
      department: 'Francisco Morazán',
      baseCurrency: 'HNL',
      maxUsers: 10,
    },
  });

  console.log(`✅ Empresa demo: ${demoCompany.legalName} (${demoCompany.id})`);

  // Segunda empresa para testing de multi-tenant isolation
  const testCompany = await prisma.company.upsert({
    where: { rtn: '0501-2000-00002' },
    update: {},
    create: {
      legalName: 'Empresa Test Aislamiento Ltda.',
      tradeName: 'Test Isolation',
      rtn: '0501-2000-00002',
      email: 'test@nexoerp.com',
      phone: '+504 3333-4444',
      address: 'Bo. El Centro, 3ra Calle',
      city: 'San Pedro Sula',
      department: 'Cortés',
      baseCurrency: 'HNL',
      maxUsers: 5,
    },
  });

  console.log(`✅ Empresa test: ${testCompany.legalName} (${testCompany.id})`);

  // === Módulos del sistema ===
  const modules = [
    {
      id: 'core',
      name: 'Core',
      description: 'Gestión de usuarios, roles y configuración del sistema',
      icon: 'Settings',
      color: '#6B7280',
      dependencies: [],
      isCore: true,
      sortOrder: 0,
    },
    {
      id: 'contacts',
      name: 'Contactos',
      description: 'Gestión de clientes y proveedores',
      icon: 'Users',
      color: '#3B82F6',
      dependencies: ['core'],
      isCore: false,
      sortOrder: 1,
    },
    {
      id: 'accounting',
      name: 'Contabilidad',
      description: 'Plan de cuentas NIIF, asientos y reportes financieros',
      icon: 'BarChart3',
      color: '#10B981',
      dependencies: ['core', 'contacts'],
      isCore: false,
      sortOrder: 2,
    },
    {
      id: 'invoicing',
      name: 'Facturación',
      description: 'Facturación fiscal Honduras (SAR/CAI)',
      icon: 'FileText',
      color: '#F59E0B',
      dependencies: ['core', 'contacts', 'accounting'],
      isCore: false,
      sortOrder: 3,
    },
    {
      id: 'purchasing',
      name: 'Compras',
      description: 'Órdenes de compra y gestión de proveedores',
      icon: 'ShoppingCart',
      color: '#8B5CF6',
      dependencies: ['core', 'contacts'],
      isCore: false,
      sortOrder: 4,
    },
    {
      id: 'sales',
      name: 'Ventas',
      description: 'Cotizaciones, pedidos y CRM',
      icon: 'TrendingUp',
      color: '#EF4444',
      dependencies: ['core', 'contacts'],
      isCore: false,
      sortOrder: 5,
    },
    {
      id: 'inventory',
      name: 'Inventario',
      description: 'Control de stock y almacenes',
      icon: 'Package',
      color: '#F97316',
      dependencies: ['core', 'purchasing', 'sales'],
      isCore: false,
      sortOrder: 6,
    },
  ];

  for (const mod of modules) {
    await prisma.module.upsert({
      where: { id: mod.id },
      update: { name: mod.name, sortOrder: mod.sortOrder },
      create: mod,
    });
  }
  console.log(`✅ Módulos del sistema: ${modules.length} creados`);

  // === CompanyModules — activar core para todas las empresas ===
  // Solo core está activo por defecto. Los demás módulos se activan según el plan.
  for (const company of [demoCompany, testCompany]) {
    // Demo tiene core + contacts + accounting activos
    const activeModules =
      company.id === demoCompany.id ? ['core', 'contacts', 'accounting'] : ['core'];

    for (const moduleId of activeModules) {
      await prisma.companyModule.upsert({
        where: { companyId_moduleId: { companyId: company.id, moduleId } },
        update: { isActive: true },
        create: { companyId: company.id, moduleId, isActive: true },
      });
    }
    console.log(`✅ CompanyModules para ${company.tradeName}: [${activeModules.join(', ')}]`);
  }

  // === PaymentTerms por empresa ===
  const defaultPaymentTerms = [
    { name: 'Contado', description: 'Pago inmediato', daysUntilDue: 0, isDefault: true },
    { name: 'Neto 15', description: 'Pago a 15 días', daysUntilDue: 15, isDefault: false },
    { name: 'Neto 30', description: 'Pago a 30 días', daysUntilDue: 30, isDefault: false },
    { name: 'Neto 60', description: 'Pago a 60 días', daysUntilDue: 60, isDefault: false },
    {
      name: 'Personalizado',
      description: 'Términos personalizados',
      daysUntilDue: 0,
      isDefault: false,
    },
  ];

  for (const company of [demoCompany, testCompany]) {
    for (const terms of defaultPaymentTerms) {
      await prisma.paymentTerms.upsert({
        where: {
          companyId_name: { companyId: company.id, name: terms.name },
        } as never,
        update: {},
        create: { companyId: company.id, ...terms },
      });
    }
    console.log(
      `✅ PaymentTerms para ${company.tradeName}: ${defaultPaymentTerms.length} términos`,
    );
  }

  // === Permisos base del sistema (core) ===
  const corePermissions = [
    {
      id: 'core.user.create',
      moduleId: 'core',
      resource: 'user',
      action: 'create',
      description: 'Crear usuarios',
    },
    {
      id: 'core.user.read',
      moduleId: 'core',
      resource: 'user',
      action: 'read',
      description: 'Ver usuarios',
    },
    {
      id: 'core.user.update',
      moduleId: 'core',
      resource: 'user',
      action: 'update',
      description: 'Editar usuarios',
    },
    {
      id: 'core.user.delete',
      moduleId: 'core',
      resource: 'user',
      action: 'delete',
      description: 'Eliminar usuarios',
    },
    {
      id: 'core.tenant.read',
      moduleId: 'core',
      resource: 'tenant',
      action: 'read',
      description: 'Ver información del tenant',
    },
    {
      id: 'core.module.read',
      moduleId: 'core',
      resource: 'module',
      action: 'read',
      description: 'Ver módulos activos',
    },
  ];

  const contactsPermissions = [
    {
      id: 'contacts.contact.create',
      moduleId: 'contacts',
      resource: 'contact',
      action: 'create',
      description: 'Crear contactos',
    },
    {
      id: 'contacts.contact.read',
      moduleId: 'contacts',
      resource: 'contact',
      action: 'read',
      description: 'Ver contactos',
    },
    {
      id: 'contacts.contact.update',
      moduleId: 'contacts',
      resource: 'contact',
      action: 'update',
      description: 'Editar contactos',
    },
    {
      id: 'contacts.contact.delete',
      moduleId: 'contacts',
      resource: 'contact',
      action: 'delete',
      description: 'Eliminar contactos',
    },
    {
      id: 'contacts.payment_terms.create',
      moduleId: 'contacts',
      resource: 'payment_terms',
      action: 'create',
      description: 'Crear términos de pago',
    },
    {
      id: 'contacts.payment_terms.read',
      moduleId: 'contacts',
      resource: 'payment_terms',
      action: 'read',
      description: 'Ver términos de pago',
    },
    {
      id: 'contacts.payment_terms.update',
      moduleId: 'contacts',
      resource: 'payment_terms',
      action: 'update',
      description: 'Editar términos de pago',
    },
    {
      id: 'contacts.payment_terms.delete',
      moduleId: 'contacts',
      resource: 'payment_terms',
      action: 'delete',
      description: 'Eliminar términos de pago',
    },
  ];

  const accountingPermissions = [
    {
      id: 'accounting.account.read',
      moduleId: 'accounting',
      resource: 'account',
      action: 'read',
      description: 'Ver plan de cuentas',
    },
    {
      id: 'accounting.account.create',
      moduleId: 'accounting',
      resource: 'account',
      action: 'create',
      description: 'Crear cuentas contables',
    },
    {
      id: 'accounting.account.update',
      moduleId: 'accounting',
      resource: 'account',
      action: 'update',
      description: 'Editar cuentas contables y configuración de reportes',
    },
    {
      id: 'accounting.account.delete',
      moduleId: 'accounting',
      resource: 'account',
      action: 'delete',
      description: 'Eliminar o desactivar cuentas contables',
    },
    {
      id: 'accounting.fiscal_year.create',
      moduleId: 'accounting',
      resource: 'fiscal_year',
      action: 'create',
      description: 'Crear años fiscales',
    },
    {
      id: 'accounting.fiscal_year.read',
      moduleId: 'accounting',
      resource: 'fiscal_year',
      action: 'read',
      description: 'Ver años fiscales y períodos',
    },
    {
      id: 'accounting.fiscal_year.close',
      moduleId: 'accounting',
      resource: 'fiscal_year',
      action: 'close',
      description: 'Cerrar años y períodos fiscales',
    },
    {
      id: 'accounting.fiscal_period.lock',
      moduleId: 'accounting',
      resource: 'fiscal_period',
      action: 'lock',
      description: 'Bloquear períodos fiscales (irreversible)',
    },
    {
      id: 'accounting.journal.create',
      moduleId: 'accounting',
      resource: 'journal',
      action: 'create',
      description: 'Crear diarios contables',
    },
    {
      id: 'accounting.journal.read',
      moduleId: 'accounting',
      resource: 'journal',
      action: 'read',
      description: 'Ver diarios contables',
    },
    {
      id: 'accounting.journal.update',
      moduleId: 'accounting',
      resource: 'journal',
      action: 'update',
      description: 'Editar diarios contables',
    },
    {
      id: 'accounting.journal.delete',
      moduleId: 'accounting',
      resource: 'journal',
      action: 'delete',
      description: 'Eliminar diarios contables sin asientos',
    },
    {
      id: 'accounting.journal_entry.create',
      moduleId: 'accounting',
      resource: 'journal_entry',
      action: 'create',
      description: 'Crear asientos contables en borrador',
    },
    {
      id: 'accounting.journal_entry.read',
      moduleId: 'accounting',
      resource: 'journal_entry',
      action: 'read',
      description: 'Ver asientos contables',
    },
    {
      id: 'accounting.journal_entry.post',
      moduleId: 'accounting',
      resource: 'journal_entry',
      action: 'post',
      description: 'Publicar (contabilizar) asientos',
    },
    {
      id: 'accounting.journal_entry.cancel',
      moduleId: 'accounting',
      resource: 'journal_entry',
      action: 'cancel',
      description: 'Anular asientos publicados (genera contraasiento)',
    },
    {
      id: 'accounting.exchange_rate.read',
      moduleId: 'accounting',
      resource: 'exchange_rate',
      action: 'read',
      description: 'Ver tipos de cambio',
    },
    {
      id: 'accounting.exchange_rate.write',
      moduleId: 'accounting',
      resource: 'exchange_rate',
      action: 'write',
      description: 'Crear, editar y eliminar tipos de cambio de empresa',
    },
    {
      id: 'accounting.report.read',
      moduleId: 'accounting',
      resource: 'report',
      action: 'read',
      description: 'Ver reportes financieros (Balance General, Estado de Resultados, CxC/CxP)',
    },
  ];

  const invoicingPermissions = [
    {
      id: 'invoicing.cai.create',
      moduleId: 'invoicing',
      resource: 'cai',
      action: 'create',
      description: 'Crear CAI (autorización SAR)',
    },
    {
      id: 'invoicing.cai.read',
      moduleId: 'invoicing',
      resource: 'cai',
      action: 'read',
      description: 'Ver CAIs registrados',
    },
    {
      id: 'invoicing.cai.update',
      moduleId: 'invoicing',
      resource: 'cai',
      action: 'update',
      description: 'Editar CAIs',
    },
    {
      id: 'invoicing.tax_rate.create',
      moduleId: 'invoicing',
      resource: 'tax_rate',
      action: 'create',
      description: 'Crear tasas de impuesto',
    },
    {
      id: 'invoicing.tax_rate.read',
      moduleId: 'invoicing',
      resource: 'tax_rate',
      action: 'read',
      description: 'Ver tasas de impuesto',
    },
    {
      id: 'invoicing.tax_rate.update',
      moduleId: 'invoicing',
      resource: 'tax_rate',
      action: 'update',
      description: 'Editar tasas de impuesto',
    },
    {
      id: 'invoicing.invoice.create',
      moduleId: 'invoicing',
      resource: 'invoice',
      action: 'create',
      description: 'Crear facturas en borrador',
    },
    {
      id: 'invoicing.invoice.read',
      moduleId: 'invoicing',
      resource: 'invoice',
      action: 'read',
      description: 'Ver facturas',
    },
    {
      id: 'invoicing.invoice.update',
      moduleId: 'invoicing',
      resource: 'invoice',
      action: 'update',
      description: 'Editar facturas en borrador',
    },
    {
      id: 'invoicing.invoice.publish',
      moduleId: 'invoicing',
      resource: 'invoice',
      action: 'publish',
      description: 'Publicar factura con número SAR',
    },
    {
      id: 'invoicing.invoice.cancel',
      moduleId: 'invoicing',
      resource: 'invoice',
      action: 'cancel',
      description: 'Anular facturas publicadas',
    },
    {
      id: 'invoicing.invoice.delete',
      moduleId: 'invoicing',
      resource: 'invoice',
      action: 'delete',
      description: 'Eliminar facturas en borrador',
    },
  ];

  const purchasingPermissions = [
    {
      id: 'purchasing.purchase_order.create',
      moduleId: 'purchasing',
      resource: 'purchase_order',
      action: 'create',
      description: 'Crear órdenes de compra',
    },
    {
      id: 'purchasing.purchase_order.read',
      moduleId: 'purchasing',
      resource: 'purchase_order',
      action: 'read',
      description: 'Ver órdenes de compra',
    },
    {
      id: 'purchasing.purchase_order.update',
      moduleId: 'purchasing',
      resource: 'purchase_order',
      action: 'update',
      description: 'Confirmar/cancelar órdenes de compra',
    },
  ];

  const salesPermissions = [
    {
      id: 'sales.order.create',
      moduleId: 'sales',
      resource: 'order',
      action: 'create',
      description: 'Crear pedidos de venta',
    },
    {
      id: 'sales.order.read',
      moduleId: 'sales',
      resource: 'order',
      action: 'read',
      description: 'Ver pedidos de venta',
    },
    {
      id: 'sales.order.update',
      moduleId: 'sales',
      resource: 'order',
      action: 'update',
      description: 'Confirmar/cancelar pedidos de venta',
    },
  ];

  const inventoryPermissions = [
    {
      id: 'inventory.product.create',
      moduleId: 'inventory',
      resource: 'product',
      action: 'create',
      description: 'Crear productos',
    },
    {
      id: 'inventory.product.read',
      moduleId: 'inventory',
      resource: 'product',
      action: 'read',
      description: 'Ver productos y catálogo',
    },
    {
      id: 'inventory.product.update',
      moduleId: 'inventory',
      resource: 'product',
      action: 'update',
      description: 'Editar productos',
    },
    {
      id: 'inventory.warehouse.create',
      moduleId: 'inventory',
      resource: 'warehouse',
      action: 'create',
      description: 'Crear almacenes',
    },
    {
      id: 'inventory.warehouse.read',
      moduleId: 'inventory',
      resource: 'warehouse',
      action: 'read',
      description: 'Ver almacenes y ubicaciones',
    },
    {
      id: 'inventory.warehouse.update',
      moduleId: 'inventory',
      resource: 'warehouse',
      action: 'update',
      description: 'Editar almacenes',
    },
    {
      id: 'inventory.stock.read',
      moduleId: 'inventory',
      resource: 'stock',
      action: 'read',
      description: 'Ver stock disponible, lotes y movimientos',
    },
  ];

  const coreExtraPermissions = [
    {
      id: 'core.dashboard.read',
      moduleId: 'core',
      resource: 'dashboard',
      action: 'read',
      description: 'Ver dashboard y KPIs',
    },
    {
      id: 'accounting.bank.create',
      moduleId: 'accounting',
      resource: 'bank',
      action: 'create',
      description: 'Crear cuentas bancarias y estados de cuenta',
    },
    {
      id: 'accounting.bank.read',
      moduleId: 'accounting',
      resource: 'bank',
      action: 'read',
      description: 'Ver cuentas bancarias y conciliaciones',
    },
  ];

  const allPermissions = [
    ...corePermissions,
    ...coreExtraPermissions,
    ...contactsPermissions,
    ...accountingPermissions,
    ...invoicingPermissions,
    ...purchasingPermissions,
    ...salesPermissions,
    ...inventoryPermissions,
  ];

  for (const perm of allPermissions) {
    await prisma.permission.upsert({
      where: { id: perm.id },
      update: {},
      create: perm,
    });
  }
  console.log(
    `✅ Permisos base core: ${corePermissions.length + coreExtraPermissions.length} creados`,
  );
  console.log(`✅ Permisos contacts: ${contactsPermissions.length} creados`);
  console.log(`✅ Permisos accounting: ${accountingPermissions.length} creados`);
  console.log(`✅ Permisos invoicing: ${invoicingPermissions.length} creados`);
  console.log(`✅ Permisos purchasing: ${purchasingPermissions.length} creados`);
  console.log(`✅ Permisos sales: ${salesPermissions.length} creados`);
  console.log(`✅ Permisos inventory: ${inventoryPermissions.length} creados`);

  // === RolePermission — Matriz de permisos por rol ===
  // ADMIN: acceso total
  // MANAGER: lectura total + escritura operativa (sin cerrar fiscal years, sin cancelar asientos)
  // ACCOUNTANT: acceso contable completo
  // SALESPERSON: sin acceso contable
  // AUDITOR: solo lectura
  const rolePermissions: { role: SystemRole; permissionId: string }[] = [
    // ── ADMIN — acceso total ──────────────────────────────────────────────────
    { role: SystemRole.ADMIN, permissionId: 'core.user.create' },
    { role: SystemRole.ADMIN, permissionId: 'core.user.read' },
    { role: SystemRole.ADMIN, permissionId: 'core.user.update' },
    { role: SystemRole.ADMIN, permissionId: 'core.user.delete' },
    { role: SystemRole.ADMIN, permissionId: 'core.tenant.read' },
    { role: SystemRole.ADMIN, permissionId: 'core.module.read' },
    { role: SystemRole.ADMIN, permissionId: 'contacts.contact.create' },
    { role: SystemRole.ADMIN, permissionId: 'contacts.contact.read' },
    { role: SystemRole.ADMIN, permissionId: 'contacts.contact.update' },
    { role: SystemRole.ADMIN, permissionId: 'contacts.contact.delete' },
    { role: SystemRole.ADMIN, permissionId: 'contacts.payment_terms.create' },
    { role: SystemRole.ADMIN, permissionId: 'contacts.payment_terms.read' },
    { role: SystemRole.ADMIN, permissionId: 'contacts.payment_terms.update' },
    { role: SystemRole.ADMIN, permissionId: 'contacts.payment_terms.delete' },
    { role: SystemRole.ADMIN, permissionId: 'accounting.account.read' },
    { role: SystemRole.ADMIN, permissionId: 'accounting.account.create' },
    { role: SystemRole.ADMIN, permissionId: 'accounting.account.update' },
    { role: SystemRole.ADMIN, permissionId: 'accounting.account.delete' },
    { role: SystemRole.ADMIN, permissionId: 'accounting.fiscal_year.create' },
    { role: SystemRole.ADMIN, permissionId: 'accounting.fiscal_year.read' },
    { role: SystemRole.ADMIN, permissionId: 'accounting.fiscal_year.close' },
    { role: SystemRole.ADMIN, permissionId: 'accounting.fiscal_period.lock' },
    { role: SystemRole.ADMIN, permissionId: 'accounting.journal.create' },
    { role: SystemRole.ADMIN, permissionId: 'accounting.journal.read' },
    { role: SystemRole.ADMIN, permissionId: 'accounting.journal.update' },
    { role: SystemRole.ADMIN, permissionId: 'accounting.journal.delete' },
    { role: SystemRole.ADMIN, permissionId: 'accounting.journal_entry.create' },
    { role: SystemRole.ADMIN, permissionId: 'accounting.journal_entry.read' },
    { role: SystemRole.ADMIN, permissionId: 'accounting.journal_entry.post' },
    { role: SystemRole.ADMIN, permissionId: 'accounting.journal_entry.cancel' },
    { role: SystemRole.ADMIN, permissionId: 'accounting.exchange_rate.read' },
    { role: SystemRole.ADMIN, permissionId: 'accounting.exchange_rate.write' },
    { role: SystemRole.ADMIN, permissionId: 'accounting.report.read' },
    { role: SystemRole.ADMIN, permissionId: 'accounting.bank.create' },
    { role: SystemRole.ADMIN, permissionId: 'accounting.bank.read' },
    { role: SystemRole.ADMIN, permissionId: 'core.dashboard.read' },
    // Invoicing
    { role: SystemRole.ADMIN, permissionId: 'invoicing.cai.create' },
    { role: SystemRole.ADMIN, permissionId: 'invoicing.cai.read' },
    { role: SystemRole.ADMIN, permissionId: 'invoicing.cai.update' },
    { role: SystemRole.ADMIN, permissionId: 'invoicing.tax_rate.create' },
    { role: SystemRole.ADMIN, permissionId: 'invoicing.tax_rate.read' },
    { role: SystemRole.ADMIN, permissionId: 'invoicing.tax_rate.update' },
    { role: SystemRole.ADMIN, permissionId: 'invoicing.invoice.create' },
    { role: SystemRole.ADMIN, permissionId: 'invoicing.invoice.read' },
    { role: SystemRole.ADMIN, permissionId: 'invoicing.invoice.update' },
    { role: SystemRole.ADMIN, permissionId: 'invoicing.invoice.publish' },
    { role: SystemRole.ADMIN, permissionId: 'invoicing.invoice.cancel' },
    { role: SystemRole.ADMIN, permissionId: 'invoicing.invoice.delete' },
    // Purchasing
    { role: SystemRole.ADMIN, permissionId: 'purchasing.purchase_order.create' },
    { role: SystemRole.ADMIN, permissionId: 'purchasing.purchase_order.read' },
    { role: SystemRole.ADMIN, permissionId: 'purchasing.purchase_order.update' },
    // Sales
    { role: SystemRole.ADMIN, permissionId: 'sales.order.create' },
    { role: SystemRole.ADMIN, permissionId: 'sales.order.read' },
    { role: SystemRole.ADMIN, permissionId: 'sales.order.update' },
    // Inventory
    { role: SystemRole.ADMIN, permissionId: 'inventory.product.create' },
    { role: SystemRole.ADMIN, permissionId: 'inventory.product.read' },
    { role: SystemRole.ADMIN, permissionId: 'inventory.product.update' },
    { role: SystemRole.ADMIN, permissionId: 'inventory.warehouse.create' },
    { role: SystemRole.ADMIN, permissionId: 'inventory.warehouse.read' },
    { role: SystemRole.ADMIN, permissionId: 'inventory.warehouse.update' },
    { role: SystemRole.ADMIN, permissionId: 'inventory.stock.read' },

    // ── MANAGER — lectura total + escritura operativa ─────────────────────────
    { role: SystemRole.MANAGER, permissionId: 'core.user.read' },
    { role: SystemRole.MANAGER, permissionId: 'core.tenant.read' },
    { role: SystemRole.MANAGER, permissionId: 'core.module.read' },
    { role: SystemRole.MANAGER, permissionId: 'contacts.contact.create' },
    { role: SystemRole.MANAGER, permissionId: 'contacts.contact.read' },
    { role: SystemRole.MANAGER, permissionId: 'contacts.contact.update' },
    { role: SystemRole.MANAGER, permissionId: 'contacts.payment_terms.read' },
    { role: SystemRole.MANAGER, permissionId: 'accounting.account.read' },
    { role: SystemRole.MANAGER, permissionId: 'accounting.fiscal_year.read' },
    { role: SystemRole.MANAGER, permissionId: 'accounting.journal.read' },
    { role: SystemRole.MANAGER, permissionId: 'accounting.journal_entry.read' },
    { role: SystemRole.MANAGER, permissionId: 'accounting.exchange_rate.read' },
    { role: SystemRole.MANAGER, permissionId: 'accounting.report.read' },
    { role: SystemRole.MANAGER, permissionId: 'accounting.bank.read' },
    { role: SystemRole.MANAGER, permissionId: 'core.dashboard.read' },
    // Invoicing
    { role: SystemRole.MANAGER, permissionId: 'invoicing.cai.read' },
    { role: SystemRole.MANAGER, permissionId: 'invoicing.tax_rate.read' },
    { role: SystemRole.MANAGER, permissionId: 'invoicing.invoice.create' },
    { role: SystemRole.MANAGER, permissionId: 'invoicing.invoice.read' },
    { role: SystemRole.MANAGER, permissionId: 'invoicing.invoice.update' },
    { role: SystemRole.MANAGER, permissionId: 'invoicing.invoice.publish' },
    { role: SystemRole.MANAGER, permissionId: 'invoicing.invoice.cancel' },
    // Purchasing
    { role: SystemRole.MANAGER, permissionId: 'purchasing.purchase_order.create' },
    { role: SystemRole.MANAGER, permissionId: 'purchasing.purchase_order.read' },
    { role: SystemRole.MANAGER, permissionId: 'purchasing.purchase_order.update' },
    // Sales
    { role: SystemRole.MANAGER, permissionId: 'sales.order.create' },
    { role: SystemRole.MANAGER, permissionId: 'sales.order.read' },
    { role: SystemRole.MANAGER, permissionId: 'sales.order.update' },
    // Inventory
    { role: SystemRole.MANAGER, permissionId: 'inventory.product.create' },
    { role: SystemRole.MANAGER, permissionId: 'inventory.product.read' },
    { role: SystemRole.MANAGER, permissionId: 'inventory.product.update' },
    { role: SystemRole.MANAGER, permissionId: 'inventory.warehouse.create' },
    { role: SystemRole.MANAGER, permissionId: 'inventory.warehouse.read' },
    { role: SystemRole.MANAGER, permissionId: 'inventory.warehouse.update' },
    { role: SystemRole.MANAGER, permissionId: 'inventory.stock.read' },

    // ── ACCOUNTANT — acceso contable completo ─────────────────────────────────
    { role: SystemRole.ACCOUNTANT, permissionId: 'core.tenant.read' },
    { role: SystemRole.ACCOUNTANT, permissionId: 'core.module.read' },
    { role: SystemRole.ACCOUNTANT, permissionId: 'contacts.contact.read' },
    { role: SystemRole.ACCOUNTANT, permissionId: 'contacts.payment_terms.read' },
    { role: SystemRole.ACCOUNTANT, permissionId: 'accounting.account.read' },
    { role: SystemRole.ACCOUNTANT, permissionId: 'accounting.account.create' },
    { role: SystemRole.ACCOUNTANT, permissionId: 'accounting.account.update' },
    { role: SystemRole.ACCOUNTANT, permissionId: 'accounting.account.delete' },
    { role: SystemRole.ACCOUNTANT, permissionId: 'accounting.fiscal_year.create' },
    { role: SystemRole.ACCOUNTANT, permissionId: 'accounting.fiscal_year.read' },
    { role: SystemRole.ACCOUNTANT, permissionId: 'accounting.fiscal_year.close' },
    { role: SystemRole.ACCOUNTANT, permissionId: 'accounting.fiscal_period.lock' },
    { role: SystemRole.ACCOUNTANT, permissionId: 'accounting.journal.create' },
    { role: SystemRole.ACCOUNTANT, permissionId: 'accounting.journal.read' },
    { role: SystemRole.ACCOUNTANT, permissionId: 'accounting.journal.update' },
    { role: SystemRole.ACCOUNTANT, permissionId: 'accounting.journal.delete' },
    { role: SystemRole.ACCOUNTANT, permissionId: 'accounting.journal_entry.create' },
    { role: SystemRole.ACCOUNTANT, permissionId: 'accounting.journal_entry.read' },
    { role: SystemRole.ACCOUNTANT, permissionId: 'accounting.journal_entry.post' },
    { role: SystemRole.ACCOUNTANT, permissionId: 'accounting.journal_entry.cancel' },
    { role: SystemRole.ACCOUNTANT, permissionId: 'accounting.exchange_rate.read' },
    { role: SystemRole.ACCOUNTANT, permissionId: 'accounting.exchange_rate.write' },
    { role: SystemRole.ACCOUNTANT, permissionId: 'accounting.report.read' },
    { role: SystemRole.ACCOUNTANT, permissionId: 'accounting.bank.create' },
    { role: SystemRole.ACCOUNTANT, permissionId: 'accounting.bank.read' },
    { role: SystemRole.ACCOUNTANT, permissionId: 'core.dashboard.read' },
    // Invoicing — contador tiene acceso completo
    { role: SystemRole.ACCOUNTANT, permissionId: 'invoicing.cai.create' },
    { role: SystemRole.ACCOUNTANT, permissionId: 'invoicing.cai.read' },
    { role: SystemRole.ACCOUNTANT, permissionId: 'invoicing.cai.update' },
    { role: SystemRole.ACCOUNTANT, permissionId: 'invoicing.tax_rate.create' },
    { role: SystemRole.ACCOUNTANT, permissionId: 'invoicing.tax_rate.read' },
    { role: SystemRole.ACCOUNTANT, permissionId: 'invoicing.tax_rate.update' },
    { role: SystemRole.ACCOUNTANT, permissionId: 'invoicing.invoice.create' },
    { role: SystemRole.ACCOUNTANT, permissionId: 'invoicing.invoice.read' },
    { role: SystemRole.ACCOUNTANT, permissionId: 'invoicing.invoice.update' },
    { role: SystemRole.ACCOUNTANT, permissionId: 'invoicing.invoice.publish' },
    { role: SystemRole.ACCOUNTANT, permissionId: 'invoicing.invoice.cancel' },
    { role: SystemRole.ACCOUNTANT, permissionId: 'invoicing.invoice.delete' },
    // Purchasing — acceso de lectura para cruzar con contabilidad
    { role: SystemRole.ACCOUNTANT, permissionId: 'purchasing.purchase_order.read' },
    // Sales — acceso de lectura para cruzar con facturación
    { role: SystemRole.ACCOUNTANT, permissionId: 'sales.order.read' },
    // Inventory — lectura para reportes de valorización
    { role: SystemRole.ACCOUNTANT, permissionId: 'inventory.product.read' },
    { role: SystemRole.ACCOUNTANT, permissionId: 'inventory.warehouse.read' },
    { role: SystemRole.ACCOUNTANT, permissionId: 'inventory.stock.read' },

    // ── SALESPERSON — solo contactos ──────────────────────────────────────────
    { role: SystemRole.SALESPERSON, permissionId: 'core.tenant.read' },
    { role: SystemRole.SALESPERSON, permissionId: 'contacts.contact.create' },
    { role: SystemRole.SALESPERSON, permissionId: 'contacts.contact.read' },
    { role: SystemRole.SALESPERSON, permissionId: 'contacts.contact.update' },
    { role: SystemRole.SALESPERSON, permissionId: 'contacts.payment_terms.read' },
    { role: SystemRole.SALESPERSON, permissionId: 'core.dashboard.read' },
    // Invoicing — vendedor puede crear y publicar facturas
    { role: SystemRole.SALESPERSON, permissionId: 'invoicing.tax_rate.read' },
    { role: SystemRole.SALESPERSON, permissionId: 'invoicing.invoice.create' },
    { role: SystemRole.SALESPERSON, permissionId: 'invoicing.invoice.read' },
    { role: SystemRole.SALESPERSON, permissionId: 'invoicing.invoice.update' },
    { role: SystemRole.SALESPERSON, permissionId: 'invoicing.invoice.publish' },
    // Sales — acceso completo a pedidos de venta
    { role: SystemRole.SALESPERSON, permissionId: 'sales.order.create' },
    { role: SystemRole.SALESPERSON, permissionId: 'sales.order.read' },
    { role: SystemRole.SALESPERSON, permissionId: 'sales.order.update' },
    // Inventory — solo lectura de catálogo y stock
    { role: SystemRole.SALESPERSON, permissionId: 'inventory.product.read' },
    { role: SystemRole.SALESPERSON, permissionId: 'inventory.stock.read' },

    // ── AUDITOR — solo lectura ────────────────────────────────────────────────
    { role: SystemRole.AUDITOR, permissionId: 'core.tenant.read' },
    { role: SystemRole.AUDITOR, permissionId: 'core.module.read' },
    { role: SystemRole.AUDITOR, permissionId: 'contacts.contact.read' },
    { role: SystemRole.AUDITOR, permissionId: 'contacts.payment_terms.read' },
    { role: SystemRole.AUDITOR, permissionId: 'accounting.account.read' },
    { role: SystemRole.AUDITOR, permissionId: 'accounting.fiscal_year.read' },
    { role: SystemRole.AUDITOR, permissionId: 'accounting.journal.read' },
    { role: SystemRole.AUDITOR, permissionId: 'accounting.journal_entry.read' },
    { role: SystemRole.AUDITOR, permissionId: 'accounting.exchange_rate.read' },
    { role: SystemRole.AUDITOR, permissionId: 'accounting.report.read' },
    { role: SystemRole.AUDITOR, permissionId: 'accounting.bank.read' },
    { role: SystemRole.AUDITOR, permissionId: 'core.dashboard.read' },
    // Invoicing — auditor solo lectura
    { role: SystemRole.AUDITOR, permissionId: 'invoicing.cai.read' },
    { role: SystemRole.AUDITOR, permissionId: 'invoicing.tax_rate.read' },
    { role: SystemRole.AUDITOR, permissionId: 'invoicing.invoice.read' },
    // Purchasing — solo lectura
    { role: SystemRole.AUDITOR, permissionId: 'purchasing.purchase_order.read' },
    // Sales — solo lectura
    { role: SystemRole.AUDITOR, permissionId: 'sales.order.read' },
    // Inventory — solo lectura
    { role: SystemRole.AUDITOR, permissionId: 'inventory.product.read' },
    { role: SystemRole.AUDITOR, permissionId: 'inventory.warehouse.read' },
    { role: SystemRole.AUDITOR, permissionId: 'inventory.stock.read' },
  ];

  for (const rp of rolePermissions) {
    await prisma.rolePermission.upsert({
      where: { role_permissionId: { role: rp.role, permissionId: rp.permissionId } },
      update: {},
      create: { role: rp.role, permissionId: rp.permissionId },
    });
  }
  console.log(`✅ RolePermissions seeded: ${rolePermissions.length} asignaciones`);

  // === Monedas (catálogo global — sin companyId) ===
  const currencies = [
    { code: 'HNL', name: 'Lempira hondureño', symbol: 'L', isActive: true, isBase: true },
    { code: 'USD', name: 'Dólar estadounidense', symbol: '$', isActive: true, isBase: false },
    { code: 'EUR', name: 'Euro', symbol: '€', isActive: true, isBase: false },
  ];

  for (const currency of currencies) {
    await prisma.currency.upsert({
      where: { code: currency.code },
      update: { name: currency.name, symbol: currency.symbol, isActive: currency.isActive },
      create: currency,
    });
  }
  console.log(`✅ Monedas: ${currencies.length} creadas (HNL, USD, EUR)`);

  // Establecer contexto RLS para la empresa demo antes de insertar data tenant-específica
  // (tax_rates, accounts, journals tienen RLS habilitado y requieren app.current_company_id)
  await prisma.$executeRaw`SELECT set_config('app.current_company_id', ${demoCompany.id}::text, false)`;

  // === Tasas de Impuesto (ISV Honduras) — solo para empresa demo ===
  const taxRates = [
    { code: 'ISV15', name: 'ISV 15%', rate: 0.15, isActive: true },
    { code: 'ISV18', name: 'ISV 18% (Bebidas/Tabaco)', rate: 0.18, isActive: true },
    { code: 'EXENTO', name: 'Exento', rate: 0.0, isActive: true },
  ];
  for (const tr of taxRates) {
    await prisma.taxRate.upsert({
      where: { companyId_code: { companyId: demoCompany.id, code: tr.code } },
      update: { name: tr.name, rate: tr.rate, isActive: tr.isActive },
      create: { companyId: demoCompany.id, ...tr },
    });
  }
  console.log(
    `✅ Tasas de Impuesto (ISV): ${taxRates.length} creadas para ${demoCompany.tradeName}`,
  );

  // === Plan de Cuentas NIIF Honduras — solo para empresa demo ===
  // La empresa test solo tiene módulo core activo, no necesita plan de cuentas
  await seedAccountingChartOfAccounts(demoCompany.id, prisma);

  // === Diarios contables por defecto — solo para empresa demo ===
  await seedAccountingJournals(demoCompany.id, prisma);

  console.log('');
  console.log('🌱 Seed completado exitosamente.');
  console.log(`   Companies: 2`);
  console.log(`   Módulos: ${modules.length}`);
  console.log(`   PaymentTerms: ${defaultPaymentTerms.length} por empresa`);
  console.log(`   Monedas: ${currencies.length}`);
  console.log(
    `   Permisos: ${allPermissions.length} (core + contacts + accounting + invoicing + purchasing + sales + inventory)`,
  );
  console.log(`   Tasas ISV: ${taxRates.length} (ISV15, ISV18, EXENTO)`);
  console.log(`   Plan de cuentas NIIF: seeded para ${demoCompany.tradeName}`);
  console.log(`   Diarios contables: 7 por defecto para ${demoCompany.tradeName}`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('❌ Error en seed:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
