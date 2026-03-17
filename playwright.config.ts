// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

/**
 * NexoERP — Playwright E2E Test Configuration
 *
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/*.spec.ts',

  // Configuración de ejecución
  fullyParallel: true,
  forbidOnly: !!process.env.CI, // Fail si hay .only en CI
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,

  // Reporter
  reporter: process.env.CI
    ? [['github'], ['html', { open: 'never' }]]
    : [['html', { open: 'on-failure' }]],

  // Configuración global
  use: {
    // Base URL del servidor de desarrollo
    baseURL: 'http://localhost:3000',

    // Captura de evidencia
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',

    // Locale y timezone para Honduras
    locale: 'es-HN',
    timezoneId: 'America/Tegucigalpa',
  },

  // Proyectos (browsers)
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    // Descomentar cuando se necesiten tests cross-browser (Fase 1+)
    // {
    //   name: 'firefox',
    //   use: { ...devices['Desktop Firefox'] },
    // },
    // {
    //   name: 'webkit',
    //   use: { ...devices['Desktop Safari'] },
    // },
    // {
    //   name: 'tablet',
    //   use: { ...devices['iPad (gen 7)'] },
    // },
    // {
    //   name: 'mobile',
    //   use: { ...devices['iPhone 14'] },
    // },
  ],

  // Servidor de desarrollo
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000, // 2 minutos para arrancar
    env: {
      NEXT_PUBLIC_BYPASS_AMPLIFY_ERROR: 'true', // Bypass error screen en tests E2E
    },
  },
});
