// scripts/update-notion.mjs
// Actualiza la página principal de NexoERP en Notion con el estado actual del proyecto.
// Uso: node scripts/update-notion.mjs

import https from 'https';

const TOKEN = process.env.NOTION_TOKEN;
const PAGE_ID = '31feffd5c61c80b68b70dfc1f98c4074';
const NOTION_VERSION = '2022-06-28';

// ─── API helpers ─────────────────────────────────────────────────────────────

function notionRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const options = {
      hostname: 'api.notion.com',
      path,
      method,
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        'Notion-Version': NOTION_VERSION,
        'Content-Type': 'application/json',
        ...(data && { 'Content-Length': Buffer.byteLength(data) }),
      },
    };
    const req = https.request(options, (res) => {
      let raw = '';
      res.on('data', (c) => (raw += c));
      res.on('end', () => {
        try {
          resolve(JSON.parse(raw));
        } catch {
          resolve(raw);
        }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

const getChildren = (id) => notionRequest('GET', `/v1/blocks/${id}/children?page_size=100`);
const deleteBlock = (id) => notionRequest('DELETE', `/v1/blocks/${id}`);
const appendChildren = (id, children) =>
  notionRequest('PATCH', `/v1/blocks/${id}/children`, { children });

// ─── Text helpers ─────────────────────────────────────────────────────────────

const t = (content, opts = {}) => ({
  type: 'text',
  text: { content },
  annotations: { bold: false, italic: false, code: false, color: 'default', ...opts.annotations },
});
const bold = (content) => t(content, { annotations: { bold: true } });
const code = (content) => ({ type: 'text', text: { content }, annotations: { code: true } });

// ─── Block builders ───────────────────────────────────────────────────────────

const h1 = (content) => ({
  object: 'block',
  type: 'heading_1',
  heading_1: { rich_text: [t(content)] },
});
const h2 = (content) => ({
  object: 'block',
  type: 'heading_2',
  heading_2: { rich_text: [t(content)] },
});
const h3 = (content) => ({
  object: 'block',
  type: 'heading_3',
  heading_3: { rich_text: [t(content)] },
});
const para = (richText) => ({
  object: 'block',
  type: 'paragraph',
  paragraph: { rich_text: richText },
});
const divider = () => ({ object: 'block', type: 'divider', divider: {} });
const callout = (richText, emoji = '📌') => ({
  object: 'block',
  type: 'callout',
  callout: { rich_text: richText, icon: { type: 'emoji', emoji }, color: 'gray_background' },
});
const todo = (content, checked = false) => ({
  object: 'block',
  type: 'to_do',
  to_do: { rich_text: [t(content)], checked },
});
const bullet = (richText) => ({
  object: 'block',
  type: 'bulleted_list_item',
  bulleted_list_item: { rich_text: richText },
});

// Tabla simple (sin row header)
function table(headers, rows) {
  const width = headers.length;
  const tableBlock = {
    object: 'block',
    type: 'table',
    table: { table_width: width, has_column_header: true, has_row_header: false },
  };
  const rowBlocks = [
    // header row
    {
      object: 'block',
      type: 'table_row',
      table_row: { cells: headers.map((h) => [bold(h)]) },
    },
    // data rows
    ...rows.map((row) => ({
      object: 'block',
      type: 'table_row',
      table_row: { cells: row.map((cell) => [t(cell)]) },
    })),
  ];
  return { tableBlock, rowBlocks };
}

// ─── Content definition ───────────────────────────────────────────────────────

function buildHeaderBlocks() {
  return [
    // Título
    h1('NexoERP — Estado del Proyecto'),

    // Callout de metadata
    callout(
      [
        bold('Última actualización:'),
        t(' 28 de marzo de 2026  |  '),
        bold('Rama activa:'),
        t(' '),
        code('feat/fase-2-contabilidad-seed-niif'),
        t('  |  '),
        bold('Fase 2:'),
        t(' ~75% completada'),
      ],
      '🗓️',
    ),

    divider(),

    // Resumen ejecutivo
    h2('Resumen Ejecutivo'),
    para([
      t(
        'NexoERP es un ERP multi-tenant en la nube para PYMEs hondureñas con cumplimiento fiscal SAR y contabilidad NIIF. ',
      ),
      t('Actualmente en '),
      bold('Fase 2 de 5 (~75% completada)'),
      t(', con Fase 0 y Fase 1 completadas. '),
      t('El Módulo de Contactos está completo y el Módulo de Contabilidad tiene '),
      bold('9 de 12 entregables completados'),
      t(
        ' (F2-01 a F2-11 y F2-14). Pendientes: exportación PDF/Excel (F2-12), conciliación bancaria (F2-13) y tests de integración (F2-15).',
      ),
    ]),

    divider(),
  ];
}

function buildMetricsTableBlocks() {
  const rows = [
    ['Fases completadas', '2 de 5 (Fase 0 + Fase 1)'],
    ['Fase en progreso', 'Fase 2 — Contabilidad + Contactos (~75%)'],
    ['Endpoints REST', '47 endpoints (7 core + 17 contactos + 2 import + 21 contabilidad)'],
    ['Modelos Prisma', '20 modelos activos'],
    ['Migraciones aplicadas', '6'],
    ['Permisos RBAC seeded', '27 (core + contacts + accounting)'],
    ['Cuentas NIIF seeded', '~360 cuentas del Plan de Cuentas Honduras'],
    ['Diarios seeded', '7 (DJ, LV, LC, CA, BK, NM, AJ)'],
    ['Monedas', '3 (HNL base, USD, EUR)'],
    ['Tests unitarios', '~52 tests'],
    ['Ambiente staging', 'AWS Amplify (activo)'],
    ['Presupuesto AWS', '~$1.35/mes con Free Tier activo'],
    ['Repositorio', 'GitHub — rama principal: main'],
  ];
  return table(['Métrica', 'Valor'], rows);
}

function buildPhasesTableBlocks() {
  const rows = [
    ['Fase 0', 'Fundamentos', '✅ Completa', 'Marzo 2026', '100%'],
    ['Fase 1', 'Core System', '✅ Completa', '10-16 marzo 2026', '100%'],
    ['Fase 2', 'Contabilidad + Contactos', '🔄 En progreso', 'Marzo 2026 — presente', '~75%'],
    ['Fase 3', 'Facturación Honduras (SAR/CAI)', '⏳ Pendiente', '—', '0%'],
    ['Fase 4', 'Compras + Ventas + Inventarios', '⏳ Pendiente', '—', '0%'],
  ];
  return table(['Fase', 'Nombre', 'Estado', 'Período', 'Progreso'], rows);
}

function buildModulesTableBlocks() {
  const rows = [
    [
      'Contactos',
      'F2-01 a F2-03',
      '✅ Completo',
      'CRUD clientes/proveedores, importación Excel, términos de pago',
    ],
    [
      'Plan de Cuentas NIIF',
      'F2-05 / F2-06',
      '✅ Completo',
      '~360 cuentas NIIF, árbol jerárquico, API + UI',
    ],
    ['Años y Períodos Fiscales', 'F2-07', '✅ Completo', 'CRUD, apertura/cierre de períodos, RLS'],
    ['Diarios Contables', 'F2-08', '✅ Completo', '7 diarios seeded, CRUD completo'],
    [
      'Asientos Contables',
      'F2-09',
      '✅ Completo',
      'Ciclo DRAFT→POSTED→CANCELLED, partida doble, contraasientos, numeración atómica',
    ],
    [
      'Tipos de Cambio',
      'F2-10',
      '✅ Completo',
      'Global + empresa, lookup inteligente, auto-fill en formularios',
    ],
    [
      'Reportes Financieros',
      'F2-11',
      '✅ Completo',
      'Balance General + Estado de Resultados, propagación bottom-up',
    ],
    [
      'Aging CxC / CxP',
      'F2-14',
      '✅ Completo',
      'Antigüedad de saldos en 4 tramos (0-30, 31-60, 61-90, +90 días)',
    ],
    [
      'Exportación PDF / Excel',
      'F2-12',
      '⏳ Pendiente',
      'Lambda PDF, S3 almacenamiento, export Excel',
    ],
    [
      'Conciliación Bancaria',
      'F2-13',
      '⏳ Pendiente',
      'Match transacciones banco vs asientos contables',
    ],
    [
      'Tests de Integración',
      'F2-15',
      '⏳ Pendiente',
      'Tests unitarios e integración, aislamiento tenant',
    ],
  ];
  return table(['Módulo', 'ID', 'Estado', 'Descripción'], rows);
}

function buildPhaseChecklistBlocks() {
  return [
    h3('Checklist de Avance — Fase 2'),
    todo('F2-01 Contactos CRUD (create/read/update/delete)', true),
    todo('F2-02 Importación de Contactos (Excel/CSV)', true),
    todo('F2-03 Términos de Pago', true),
    todo('F2-04 Schema Contabilidad + Migraciones SQL', true),
    todo('F2-05 Plan de Cuentas NIIF (seed ~360 cuentas)', true),
    todo('F2-06 Gestión de Plan de Cuentas (API + UI)', true),
    todo('F2-07 Años y Períodos Fiscales', true),
    todo('F2-08 Diarios Contables', true),
    todo('F2-09 Asientos Contables (partida doble)', true),
    todo('F2-10 Tipos de Cambio', true),
    todo('F2-11 Reportes Financieros (Balance + Resultados)', true),
    todo('F2-12 Exportación PDF/Excel', false),
    todo('F2-13 Conciliación Bancaria', false),
    todo('F2-14 Aging CxC/CxP (antigüedad de saldos)', true),
    todo('F2-15 Tests de Integración Contabilidad', false),
  ];
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  if (!TOKEN) {
    throw new Error('Missing NOTION_TOKEN environment variable');
  }

  console.log('🔍 Obteniendo bloques actuales...');
  const current = await getChildren(PAGE_ID);
  const existingIds = current.results?.map((b) => b.id) ?? [];
  console.log(`   → ${existingIds.length} bloques encontrados`);

  // Borrar todos los bloques existentes
  console.log('🗑️  Eliminando bloques existentes...');
  for (const id of existingIds) {
    await deleteBlock(id);
    process.stdout.write('.');
  }
  console.log(`\n   → ${existingIds.length} bloques eliminados`);

  // ── Bloque 1: Header (título, callout, resumen, divider) ──────────────────
  console.log('\n✍️  Escribiendo sección de encabezado...');
  const headerBlocks = buildHeaderBlocks();
  await appendChildren(PAGE_ID, headerBlocks);
  console.log(`   → ${headerBlocks.length} bloques de encabezado creados`);

  // ── Bloque 2: Tabla de métricas ───────────────────────────────────────────
  console.log('📊 Escribiendo tabla de métricas...');
  const metricsSection = [h2('Métricas Generales del Proyecto')];
  await appendChildren(PAGE_ID, metricsSection);
  const { tableBlock: metricsTable, rowBlocks: metricsRows } = buildMetricsTableBlocks();
  const metricsTableResult = await appendChildren(PAGE_ID, [metricsTable]);
  const metricsTableId = metricsTableResult.results?.[0]?.id;
  if (metricsTableId) {
    await appendChildren(metricsTableId, metricsRows);
  }
  await appendChildren(PAGE_ID, [divider()]);
  console.log('   → Tabla de métricas creada');

  // ── Bloque 3: Estado de fases ─────────────────────────────────────────────
  console.log('🚦 Escribiendo estado de fases...');
  await appendChildren(PAGE_ID, [h2('Estado de Fases')]);
  const { tableBlock: phasesTable, rowBlocks: phasesRows } = buildPhasesTableBlocks();
  const phasesTableResult = await appendChildren(PAGE_ID, [phasesTable]);
  const phasesTableId = phasesTableResult.results?.[0]?.id;
  if (phasesTableId) {
    await appendChildren(phasesTableId, phasesRows);
  }
  await appendChildren(PAGE_ID, [divider()]);
  console.log('   → Tabla de fases creada');

  // ── Bloque 4: Módulos Fase 2 ──────────────────────────────────────────────
  console.log('📦 Escribiendo módulos Fase 2...');
  await appendChildren(PAGE_ID, [h2('Módulos Fase 2 — al 28 de marzo de 2026')]);
  const { tableBlock: modulesTable, rowBlocks: modulesRows } = buildModulesTableBlocks();
  const modulesTableResult = await appendChildren(PAGE_ID, [modulesTable]);
  const modulesTableId = modulesTableResult.results?.[0]?.id;
  if (modulesTableId) {
    await appendChildren(modulesTableId, modulesRows);
  }
  await appendChildren(PAGE_ID, [divider()]);
  console.log('   → Tabla de módulos creada');

  // ── Bloque 5: Checklist de avance ─────────────────────────────────────────
  console.log('✅ Escribiendo checklist de avance...');
  const checklistBlocks = buildPhaseChecklistBlocks();
  await appendChildren(PAGE_ID, checklistBlocks);
  await appendChildren(PAGE_ID, [divider()]);
  console.log(`   → ${checklistBlocks.length} items de checklist creados`);

  // ── Bloque 6: Próximos pasos ──────────────────────────────────────────────
  console.log('⏭️  Escribiendo próximos pasos...');
  await appendChildren(PAGE_ID, [
    h2('Próximos Pasos'),
    bullet([bold('F2-12'), t(' — Exportación PDF/Excel de reportes financieros (Lambda + S3)')]),
    bullet([
      bold('F2-13'),
      t(' — Conciliación bancaria (import extractos OFX/CSV, match automático)'),
    ]),
    bullet([
      bold('F2-15'),
      t(' — Tests de integración del módulo contable (vitest + Prisma real)'),
    ]),
    bullet([bold('Fase 3'), t(' — Facturación Honduras: CAI, numeración SAR, ISV 15%')]),
    divider(),
    callout(
      [
        bold('Nota técnica:'),
        t(' Los reportes de CxC/CxP (F2-14) utilizan antigüedad por fecha del asiento contable. '),
        t(
          'El aging basado en fecha de vencimiento de factura requiere el módulo de Facturación (Fase 3).',
        ),
      ],
      '⚠️',
    ),
  ]);
  console.log('   → Próximos pasos creados');

  console.log('\n🎉 Página de Notion actualizada exitosamente!');
  console.log(`   URL: https://www.notion.so/NEXO-ERP-${PAGE_ID.replace(/-/g, '')}`);
}

main().catch((err) => {
  console.error('❌ Error:', err);
  process.exit(1);
});
