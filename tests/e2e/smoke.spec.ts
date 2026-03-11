// tests/e2e/smoke.spec.ts
import { test, expect } from '@playwright/test';

/**
 * Smoke E2E Tests — Verifican que la aplicación carga correctamente.
 */

test.describe('NexoERP — Smoke E2E', () => {
  test('debe cargar la página principal', async ({ page }) => {
    await page.goto('/');

    // Wait for page to be fully loaded
    await page.waitForLoadState('networkidle');

    // Verificar que el título de la app aparece usando el heading role
    await expect(page.getByRole('heading', { name: 'NexoERP' })).toBeVisible({ timeout: 10000 });
  });

  test('debe tener el título correcto en la pestaña', async ({ page }) => {
    await page.goto('/');

    await expect(page).toHaveTitle(/NexoERP/);
  });

  test('debe cargar en menos de 10 segundos', async ({ page }) => {
    const start = Date.now();
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { name: 'NexoERP' })).toBeVisible({
      timeout: 10000,
    });
    const duration = Date.now() - start;

    // La página debe cargar en menos de 10s (generoso para CI/primer build)
    expect(duration).toBeLessThan(10000);
  });

  test('no debe tener errores de consola críticos', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Filtrar errores conocidos/esperados (favicon, hydration, amplify config)
    const realErrors = errors.filter(
      (e) => !e.includes('favicon') && !e.includes('hydration') && !e.includes('amplify_outputs'),
    );
    expect(realErrors).toHaveLength(0);
  });
});
