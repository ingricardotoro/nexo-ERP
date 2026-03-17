// vitest.config.ts
import { resolve } from 'path';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: {
    // Entorno de ejecución
    environment: 'jsdom',

    // Setup files (matchers de jest-dom, etc.)
    setupFiles: ['./src/__tests__/setup.ts'],

    // Glob patterns para encontrar tests
    include: ['src/**/*.{test,spec}.{ts,tsx}', 'src/__tests__/**/*.{test,spec}.{ts,tsx}'],

    // Excluir
    exclude: [
      'node_modules',
      '.next',
      'tests/e2e/**', // E2E se ejecuta con Playwright
      // Tests diagnósticos solo para desarrollo local (no en CI)
      'src/__tests__/debug-*.test.ts',
      'src/__tests__/diagnostic-*.test.ts',
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
