// tests/e2e/sales-inventory.spec.ts
import { test, expect } from '@playwright/test';

/**
 * E2E Tests — Módulos de Ventas e Inventario (Sprint F5-E)
 *
 * Verifica la navegación y renderizado correcto de las páginas
 * de Pedidos de Venta, Órdenes de Compra e Inventario.
 *
 * Los tests son smoke tests de UI: verifican que las páginas cargan,
 * muestran los elementos clave y no producen errores visibles.
 */

// ─── Pedidos de Venta ────────────────────────────────────────────────────────

test.describe('Pedidos de Venta — Lista', () => {
  test('debe cargar la página de pedidos de venta', async ({ page }) => {
    await page.goto('/dashboard/sales/orders');
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('heading', { name: /pedidos de venta/i })).toBeVisible({
      timeout: 10000,
    });
  });

  test('debe mostrar el botón "Nuevo Pedido"', async ({ page }) => {
    await page.goto('/dashboard/sales/orders');
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('button', { name: /nuevo pedido/i })).toBeVisible({
      timeout: 10000,
    });
  });

  test('debe mostrar la tabla de pedidos (headers)', async ({ page }) => {
    await page.goto('/dashboard/sales/orders');
    await page.waitForLoadState('networkidle');

    // Encabezados de columnas de la tabla
    await expect(page.getByText(/número|pedido/i).first()).toBeVisible({ timeout: 10000 });
  });

  test('debe mostrar el badge "Fase 4" en el sidebar', async ({ page }) => {
    await page.goto('/dashboard/sales/orders');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('Fase 4').first()).toBeVisible({ timeout: 10000 });
  });
});

// ─── Órdenes de Compra ───────────────────────────────────────────────────────

test.describe('Órdenes de Compra — Lista', () => {
  test('debe cargar la página de órdenes de compra', async ({ page }) => {
    await page.goto('/dashboard/purchasing/purchase-orders');
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('heading', { name: /órdenes de compra/i })).toBeVisible({
      timeout: 10000,
    });
  });

  test('debe mostrar el botón "Nueva Orden"', async ({ page }) => {
    await page.goto('/dashboard/purchasing/purchase-orders');
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('button', { name: /nueva orden/i })).toBeVisible({
      timeout: 10000,
    });
  });
});

// ─── Dashboard — KPIs ────────────────────────────────────────────────────────

test.describe('Dashboard — KPIs', () => {
  test('debe cargar el dashboard principal con KPIs', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // El dashboard tiene tarjetas KPI
    await expect(page.locator('[class*="card"]').first()).toBeVisible({ timeout: 10000 });
  });

  test('debe mostrar el botón de refrescar KPIs', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // Botón de refresh (RefreshCw icon en el dashboard)
    const refreshBtn = page.getByRole('button', { name: /refrescar|refresh/i });
    await expect(refreshBtn).toBeVisible({ timeout: 10000 });
  });
});

// ─── Libro de Ventas ─────────────────────────────────────────────────────────

test.describe('Libro de Ventas — API endpoints', () => {
  test('GET /api/v1/invoicing/sales-book debe requerir autenticación', async ({ request }) => {
    const resp = await request.get('/api/v1/invoicing/sales-book');
    // Sin auth header → 401
    expect([401, 400]).toContain(resp.status());
  });

  test('GET /api/v1/invoicing/sales-book/xlsx debe requerir autenticación', async ({ request }) => {
    const resp = await request.get('/api/v1/invoicing/sales-book/xlsx');
    expect([401, 400]).toContain(resp.status());
  });

  test('GET /api/v1/invoicing/sales-book/det-csv debe requerir autenticación', async ({
    request,
  }) => {
    const resp = await request.get('/api/v1/invoicing/sales-book/det-csv');
    expect([401, 400]).toContain(resp.status());
  });
});

// ─── Cross-module endpoints — auth guard ────────────────────────────────────

test.describe('Cross-module endpoints — auth guard', () => {
  test('POST /api/v1/sales/orders/:id/create-invoice debe requerir autenticación', async ({
    request,
  }) => {
    const resp = await request.post(
      '/api/v1/sales/orders/00000000-0000-0000-0000-000000000001/create-invoice',
    );
    expect([401, 400]).toContain(resp.status());
  });

  test('POST /api/v1/sales/orders/:id/deliver debe requerir autenticación', async ({ request }) => {
    const resp = await request.post(
      '/api/v1/sales/orders/00000000-0000-0000-0000-000000000001/deliver',
    );
    expect([401, 400]).toContain(resp.status());
  });

  test('POST /api/v1/purchasing/purchase-orders/:id/receive debe requerir autenticación', async ({
    request,
  }) => {
    const resp = await request.post(
      '/api/v1/purchasing/purchase-orders/00000000-0000-0000-0000-000000000001/receive',
    );
    expect([401, 400]).toContain(resp.status());
  });

  test('POST /api/v1/purchasing/purchase-orders/:id/create-supplier-invoice debe requerir autenticación', async ({
    request,
  }) => {
    const resp = await request.post(
      '/api/v1/purchasing/purchase-orders/00000000-0000-0000-0000-000000000001/create-supplier-invoice',
    );
    expect([401, 400]).toContain(resp.status());
  });
});
