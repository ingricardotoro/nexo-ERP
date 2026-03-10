# F0-05: Testing — Vitest + Playwright

> **ID:** F0-05
> **Fase:** 0 — Fundación
> **Prioridad:** 🟡 Alta
> **Estimación:** 2–3 horas
> **Dependencias:** F0-01 (Setup proyecto), F0-04 (Tooling)
> **Bloquea a:** F0-06 (Repositorio — CI pipeline necesita tests)

---

## 1. Objetivo

Configurar la infraestructura de testing completa: Vitest para tests unitarios e integración, Testing Library para componentes React, y Playwright para tests end-to-end. Crear tests de smoke iniciales que validen que la configuración funciona correctamente.

---

## 2. Prerrequisitos

| Requisito | Detalle | Verificación |
|-----------|---------|-------------|
| F0-01 completado | Proyecto Next.js 15 funcional | `npm run dev` funciona |
| F0-04 completado | Tooling configurado | `npm run lint` funciona |

---

## 3. Pasos de Implementación

### 3.1 Instalar Vitest y dependencias

```powershell
npm install --save-dev vitest @vitejs/plugin-react @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom
```

### 3.2 Configurar `vitest.config.ts`

```typescript
// vitest.config.ts
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: {
    // Entorno de ejecución
    environment: 'jsdom',

    // Setup files (matchers de jest-dom, etc.)
    setupFiles: ['./src/__tests__/setup.ts'],

    // Glob patterns para encontrar tests
    include: [
      'src/**/*.{test,spec}.{ts,tsx}',
      'src/__tests__/**/*.{test,spec}.{ts,tsx}',
    ],

    // Excluir
    exclude: [
      'node_modules',
      '.next',
      'tests/e2e/**', // E2E se ejecuta con Playwright
    ],

    // Cobertura
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'lcov', 'html'],
      reportsDirectory: './coverage',
      include: [
        'src/lib/**/*.ts',
        'src/hooks/**/*.ts',
        'src/components/**/*.{ts,tsx}',
        'src/app/api/**/*.ts',
      ],
      exclude: [
        'src/__tests__/**',
        'src/**/*.test.{ts,tsx}',
        'src/**/*.spec.{ts,tsx}',
        'src/types/**',
        'src/constants/**',
      ],
      thresholds: {
        // Fase 0: Thresholds base, se incrementan en fases posteriores
        // Objetivo final: 80% en lógica de negocio (RNF-14)
        statements: 0,
        branches: 0,
        functions: 0,
        lines: 0,
      },
    },

    // Globals (describe, it, expect sin imports)
    globals: true,

    // Timeouts
    testTimeout: 10000,
    hookTimeout: 10000,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
});
```

### 3.3 Crear setup file para Vitest

```typescript
// src/__tests__/setup.ts
import '@testing-library/jest-dom/vitest';

/**
 * NexoERP — Test Setup
 *
 * Este archivo se ejecuta antes de cada suite de tests.
 * Configura:
 * - Matchers de jest-dom (toBeInTheDocument, toHaveClass, etc.)
 * - Mocks globales
 */

// Mock de next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/',
  useParams: () => ({}),
  redirect: vi.fn(),
  notFound: vi.fn(),
}));

// Mock de next/image
vi.mock('next/image', () => ({
  default: (props: Record<string, unknown>) => {
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    return <img {...props} />;
  },
}));
```

### 3.4 Agregar types de Vitest al TypeScript

Actualizar `tsconfig.json` para incluir tipos de Vitest:

```json
{
  "compilerOptions": {
    "types": ["vitest/globals"]
  }
}
```

O en un archivo separado:

```typescript
// src/__tests__/vitest.d.ts
/// <reference types="vitest/globals" />
/// <reference types="@testing-library/jest-dom" />
```

### 3.5 Crear test de smoke — Utilidades

```typescript
// src/__tests__/smoke.test.ts
import { APP_NAME, APP_VERSION, CURRENCIES, MODULES, ROLES } from '@/constants/app';

/**
 * Smoke tests — Verifican que la configuración básica funciona.
 * Estos tests validan que el proyecto está correctamente configurado
 * y que las constantes del sistema están definidas.
 */

describe('NexoERP — Smoke Tests', () => {
  it('debe tener el nombre correcto de la aplicación', () => {
    expect(APP_NAME).toBe('NexoERP');
  });

  it('debe tener una versión definida', () => {
    expect(APP_VERSION).toBeDefined();
    expect(APP_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('debe tener HNL como moneda base', () => {
    expect(CURRENCIES.BASE).toBe('HNL');
  });

  it('debe soportar HNL y USD', () => {
    expect(CURRENCIES.SUPPORTED).toContain('HNL');
    expect(CURRENCIES.SUPPORTED).toContain('USD');
  });

  it('debe tener 5 roles RBAC definidos', () => {
    const roleValues = Object.values(ROLES);
    expect(roleValues).toHaveLength(5);
    expect(roleValues).toContain('administrador');
    expect(roleValues).toContain('gerente');
    expect(roleValues).toContain('contador');
    expect(roleValues).toContain('vendedor');
    expect(roleValues).toContain('auditor');
  });

  it('debe tener 7 módulos definidos', () => {
    const moduleValues = Object.values(MODULES);
    expect(moduleValues).toHaveLength(7);
    expect(moduleValues).toContain('core');
    expect(moduleValues).toContain('contacts');
    expect(moduleValues).toContain('accounting');
    expect(moduleValues).toContain('invoicing');
    expect(moduleValues).toContain('purchasing');
    expect(moduleValues).toContain('sales');
    expect(moduleValues).toContain('inventory');
  });
});
```

### 3.6 Crear test de smoke — Componente

```typescript
// src/__tests__/components/home-page.test.tsx
import { render, screen } from '@testing-library/react';

import HomePage from '@/app/page';

describe('HomePage', () => {
  it('debe renderizar el nombre de la aplicación', () => {
    render(<HomePage />);
    expect(screen.getByText('NexoERP')).toBeInTheDocument();
  });

  it('debe renderizar la descripción', () => {
    render(<HomePage />);
    expect(
      screen.getByText(/sistema erp modular para pymes hondureñas/i),
    ).toBeInTheDocument();
  });

  it('debe renderizar el indicador de fase', () => {
    render(<HomePage />);
    expect(screen.getByText(/fase 0/i)).toBeInTheDocument();
  });
});
```

### 3.7 Crear helper de testing multi-tenant

```typescript
// src/__tests__/helpers/multi-tenant.ts
/**
 * Helpers para tests de aislamiento multi-tenant.
 *
 * Se usarán extensivamente en Fase 1+ para verificar
 * que los datos de una empresa nunca se filtran a otra.
 *
 * @see REQUIREMENTS.md §11 — Modelo de Multi-tenencia
 */

export const TENANT_A = {
  id: '00000000-0000-0000-0000-000000000001',
  name: 'Empresa A (Test)',
  rtn: '0801-TEST-00001',
};

export const TENANT_B = {
  id: '00000000-0000-0000-0000-000000000002',
  name: 'Empresa B (Test)',
  rtn: '0501-TEST-00002',
};

/**
 * Verifica que un array de resultados solo contiene items del tenant esperado.
 * Uso: expectTenantIsolation(results, TENANT_A.id);
 */
export function expectTenantIsolation<T extends { companyId: string }>(
  results: T[],
  expectedCompanyId: string,
): void {
  results.forEach((item) => {
    expect(item.companyId).toBe(expectedCompanyId);
  });
}

/**
 * Verifica que dos conjuntos de resultados no comparten IDs.
 * Uso: expectNoDataLeakage(resultsA, resultsB);
 */
export function expectNoDataLeakage<T extends { id: string }>(
  resultsA: T[],
  resultsB: T[],
): void {
  const idsA = new Set(resultsA.map((item) => item.id));
  const idsB = new Set(resultsB.map((item) => item.id));

  idsA.forEach((id) => {
    expect(idsB.has(id)).toBe(false);
  });
}
```

### 3.8 Scripts de testing en `package.json`

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "test:ui": "vitest --ui",
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui"
  }
}
```

### 3.9 Instalar y configurar Playwright

```powershell
# Instalar Playwright
npm install --save-dev @playwright/test

# Instalar browsers
npx playwright install --with-deps chromium
```

> **Nota:** Solo instalamos Chromium para Fase 0. Firefox y WebKit se agregan cuando se necesiten tests cross-browser (Fase 1+).

### 3.10 Configurar `playwright.config.ts`

```typescript
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
  },
});
```

### 3.11 Crear E2E smoke test

```typescript
// tests/e2e/smoke.spec.ts
import { test, expect } from '@playwright/test';

/**
 * Smoke E2E Tests — Verifican que la aplicación carga correctamente.
 */

test.describe('NexoERP — Smoke E2E', () => {
  test('debe cargar la página principal', async ({ page }) => {
    await page.goto('/');

    // Verificar que el título de la app aparece
    await expect(page.getByText('NexoERP')).toBeVisible();
  });

  test('debe tener el título correcto en la pestaña', async ({ page }) => {
    await page.goto('/');

    await expect(page).toHaveTitle(/NexoERP/);
  });

  test('debe cargar en menos de 5 segundos', async ({ page }) => {
    const start = Date.now();
    await page.goto('/');
    await expect(page.getByText('NexoERP')).toBeVisible();
    const duration = Date.now() - start;

    // La página debe cargar en menos de 5s (generoso para CI)
    expect(duration).toBeLessThan(5000);
  });

  test('no debe tener errores de consola', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Filtrar errores conocidos/esperados
    const realErrors = errors.filter(
      (e) => !e.includes('favicon') && !e.includes('hydration'),
    );
    expect(realErrors).toHaveLength(0);
  });
});
```

### 3.12 Ejecutar tests y verificar

```powershell
# Ejecutar tests unitarios
npx vitest run

# Ejecutar tests con cobertura
npx vitest run --coverage

# Ejecutar E2E (requiere que dev server esté corriendo o usa el webServer config)
npx playwright test

# Abrir UI de Playwright
npx playwright test --ui
```

---

## 4. Estructura Resultante

```
src/
├── __tests__/
│   ├── setup.ts                     # Setup global (jest-dom, mocks)
│   ├── vitest.d.ts                  # Type declarations
│   ├── smoke.test.ts                # Smoke tests unitarios
│   ├── components/
│   │   └── home-page.test.tsx       # Test del componente HomePage
│   └── helpers/
│       └── multi-tenant.ts          # Helpers para testing multi-tenant

tests/
└── e2e/
    └── smoke.spec.ts                # Playwright smoke test

vitest.config.ts                     # Configuración Vitest
playwright.config.ts                 # Configuración Playwright
coverage/                            # (generado, gitignored)
test-results/                        # (generado, gitignored)
playwright-report/                   # (generado, gitignored)
```

---

## 5. Criterios de Aceptación

| # | Criterio | Verificación |
|---|----------|-------------|
| 1 | `npx vitest run` ejecuta todos los tests sin errores | Exit code 0 |
| 2 | Tests de smoke validan constantes de NexoERP | 5 roles, 7 módulos, HNL/USD |
| 3 | Test de componente renderiza HomePage correctamente | Testing Library + jest-dom |
| 4 | `npx vitest run --coverage` genera reporte | Directorio `coverage/` |
| 5 | `npx playwright test` ejecuta E2E sin errores | Todos passing |
| 6 | E2E smoke verifica carga de página y título | Playwright assertions |
| 7 | Playwright configurado con locale `es-HN` y timezone Honduras | Config verificada |
| 8 | Scripts `test`, `test:watch`, `test:coverage`, `test:e2e` funcionan | Verificar cada uno |
| 9 | Mocks globales de next/navigation y next/image configurados | Setup file |
| 10 | Helpers de multi-tenant disponibles para futuros tests | Archivos creados |

---

## 6. Checklist de Verificación

```
□ Vitest instalado y configurado
□ @testing-library/react instalado
□ @testing-library/jest-dom instalado
□ vitest.config.ts con alias @/ y cobertura
□ src/__tests__/setup.ts con matchers y mocks
□ Smoke tests unitarios passing
□ Test de componente passing
□ Helpers de multi-tenant creados
□ Playwright instalado
□ Chromium installed (playwright install)
□ playwright.config.ts configurado
□ E2E smoke test passing
□ Locale es-HN y timezone America/Tegucigalpa
□ Scripts npm configurados
□ Coverage report se genera
□ Archivos generados en .gitignore (coverage/, test-results/, playwright-report/)
```

---

## 7. Agregar al `.gitignore`

```gitignore
# Testing
coverage/
test-results/
playwright-report/
blob-report/
```

---

## 8. Notas Técnicas

- **Vitest vs Jest:** Vitest es significativamente más rápido para proyectos con Vite/Next.js, comparte configuración con el proyecto, y tiene API compatible con Jest.
- **Globals: true** permite usar `describe`, `it`, `expect`, `vi` sin importarlos explícitamente. Requiere el type declaration.
- **Solo Chromium en Fase 0:** Cross-browser testing (Firefox, WebKit) se agrega en Fase 1 cuando haya suficientes tests para justificarlo.
- **webServer en Playwright:** Automáticamente inicia `npm run dev` antes de los tests y lo detiene al terminar. En CI, no reutiliza servidor existente.
- **Prisma Mock:** Se instalará en Fase 1 (`prisma-mock` o mock manual del singleton) cuando haya tests de API routes y lógica de negocio que requieran interacción con la BD.
- **Convención de ubicación:** Tests unitarios junto al código fuente (`*.test.ts`), tests E2E en `tests/e2e/` separados.
