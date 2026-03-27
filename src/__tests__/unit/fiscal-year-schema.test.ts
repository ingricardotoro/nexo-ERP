// src/__tests__/unit/fiscal-year-schema.test.ts
/**
 * Tests unitarios del schema Zod de años fiscales (F2-06).
 *
 * Cubre:
 * - Año válido y fuera de rango (mínimo/máximo)
 * - Año decimal (debe rechazarse por .int())
 * - Fechas válidas estándar Honduras y año fiscal no estándar
 * - Refinement: fecha de fin anterior a fecha de inicio
 *
 * Sin conexión a BD — solo lógica Zod.
 */

import { describe, expect, it } from 'vitest';

import { createFiscalYearSchema } from '@/lib/validations/fiscal-year.schema';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Objeto mínimo válido para el schema */
function datosValidos(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    year: 2026,
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    ...overrides,
  };
}

// ─── Tests del campo `year` ───────────────────────────────────────────────────

describe('createFiscalYearSchema — campo year', () => {
  it('debería aceptar año válido dentro del rango (2026)', () => {
    // Arrange
    const datos = datosValidos({ year: 2026 });
    // Act
    const resultado = createFiscalYearSchema.safeParse(datos);
    // Assert
    expect(resultado.success).toBe(true);
    if (resultado.success) {
      expect(resultado.data.year).toBe(2026);
    }
  });

  it('debería rechazar año por debajo del mínimo (1999)', () => {
    // Arrange
    const datos = datosValidos({ year: 1999 });
    // Act
    const resultado = createFiscalYearSchema.safeParse(datos);
    // Assert
    expect(resultado.success).toBe(false);
    if (!resultado.success) {
      const errores = resultado.error.flatten().fieldErrors;
      expect(errores).toHaveProperty('year');
    }
  });

  it('debería rechazar año igual al mínimo restando uno (1999 es menor a 2000)', () => {
    // Arrange — límite inferior exacto: 2000 debe pasar, 1999 debe fallar
    const datos2000 = datosValidos({ year: 2000 });
    const datos1999 = datosValidos({ year: 1999 });
    // Act
    const resultado2000 = createFiscalYearSchema.safeParse(datos2000);
    const resultado1999 = createFiscalYearSchema.safeParse(datos1999);
    // Assert
    expect(resultado2000.success).toBe(true);
    expect(resultado1999.success).toBe(false);
  });

  it('debería rechazar año por encima del máximo (2100)', () => {
    // Arrange
    const datos = datosValidos({ year: 2100 });
    // Act
    const resultado = createFiscalYearSchema.safeParse(datos);
    // Assert
    expect(resultado.success).toBe(false);
    if (!resultado.success) {
      const errores = resultado.error.flatten().fieldErrors;
      expect(errores).toHaveProperty('year');
    }
  });

  it('debería rechazar año igual al máximo sumando uno (2099 debe pasar, 2100 debe fallar)', () => {
    // Arrange — límite superior exacto
    const datos2099 = datosValidos({ year: 2099 });
    const datos2100 = datosValidos({ year: 2100 });
    // Act
    const resultado2099 = createFiscalYearSchema.safeParse(datos2099);
    const resultado2100 = createFiscalYearSchema.safeParse(datos2100);
    // Assert
    expect(resultado2099.success).toBe(true);
    expect(resultado2100.success).toBe(false);
  });

  it('debería rechazar año como decimal (2026.5 no es entero)', () => {
    // Arrange
    const datos = datosValidos({ year: 2026.5 });
    // Act
    const resultado = createFiscalYearSchema.safeParse(datos);
    // Assert
    expect(resultado.success).toBe(false);
    if (!resultado.success) {
      const errores = resultado.error.flatten().fieldErrors;
      expect(errores).toHaveProperty('year');
    }
  });
});

// ─── Tests de fechas ──────────────────────────────────────────────────────────

describe('createFiscalYearSchema — fechas', () => {
  it('debería aceptar fechas estándar Honduras (2026-01-01 / 2026-12-31)', () => {
    // Arrange
    const datos = datosValidos({
      year: 2026,
      startDate: '2026-01-01',
      endDate: '2026-12-31',
    });
    // Act
    const resultado = createFiscalYearSchema.safeParse(datos);
    // Assert
    expect(resultado.success).toBe(true);
    if (resultado.success) {
      expect(resultado.data.startDate).toBe('2026-01-01');
      expect(resultado.data.endDate).toBe('2026-12-31');
    }
  });

  it('debería aceptar año fiscal no estándar (2025-07-01 / 2026-06-30)', () => {
    // Arrange — año fiscal que cruza año calendario
    const datos = datosValidos({
      year: 2026,
      startDate: '2025-07-01',
      endDate: '2026-06-30',
    });
    // Act
    const resultado = createFiscalYearSchema.safeParse(datos);
    // Assert
    expect(resultado.success).toBe(true);
    if (resultado.success) {
      expect(resultado.data.startDate).toBe('2025-07-01');
      expect(resultado.data.endDate).toBe('2026-06-30');
    }
  });

  it('debería rechazar startDate con formato inválido (no es fecha ISO)', () => {
    // Arrange
    const datos = datosValidos({ startDate: '01/01/2026' });
    // Act
    const resultado = createFiscalYearSchema.safeParse(datos);
    // Assert
    expect(resultado.success).toBe(false);
    if (!resultado.success) {
      const errores = resultado.error.flatten().fieldErrors;
      expect(errores).toHaveProperty('startDate');
    }
  });

  it('debería rechazar endDate con formato inválido (no es fecha ISO)', () => {
    // Arrange
    const datos = datosValidos({ endDate: '31-12-2026' });
    // Act
    const resultado = createFiscalYearSchema.safeParse(datos);
    // Assert
    expect(resultado.success).toBe(false);
    if (!resultado.success) {
      const errores = resultado.error.flatten().fieldErrors;
      expect(errores).toHaveProperty('endDate');
    }
  });
});

// ─── Tests del refinement (endDate > startDate) ───────────────────────────────

describe('createFiscalYearSchema — refinement fecha de fin posterior', () => {
  it('debería rechazar cuando endDate es anterior a startDate', () => {
    // Arrange
    const datos = datosValidos({
      startDate: '2026-12-31',
      endDate: '2026-01-01',
    });
    // Act
    const resultado = createFiscalYearSchema.safeParse(datos);
    // Assert
    expect(resultado.success).toBe(false);
    if (!resultado.success) {
      // El refine usa path: ['endDate'], va a fieldErrors.endDate
      const errores = resultado.error.flatten().fieldErrors;
      expect(errores).toHaveProperty('endDate');
      expect(errores.endDate?.[0]).toContain('posterior');
    }
  });

  it('debería rechazar cuando endDate es igual a startDate', () => {
    // Arrange — misma fecha no cumple "estrictamente posterior"
    const datos = datosValidos({
      startDate: '2026-06-01',
      endDate: '2026-06-01',
    });
    // Act
    const resultado = createFiscalYearSchema.safeParse(datos);
    // Assert
    expect(resultado.success).toBe(false);
    if (!resultado.success) {
      const errores = resultado.error.flatten().fieldErrors;
      expect(errores).toHaveProperty('endDate');
    }
  });

  it('debería aceptar cuando endDate es exactamente un día posterior a startDate', () => {
    // Arrange
    const datos = datosValidos({
      startDate: '2026-01-01',
      endDate: '2026-01-02',
    });
    // Act
    const resultado = createFiscalYearSchema.safeParse(datos);
    // Assert
    expect(resultado.success).toBe(true);
  });
});
