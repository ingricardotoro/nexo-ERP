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
