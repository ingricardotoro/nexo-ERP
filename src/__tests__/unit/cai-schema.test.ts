// src/__tests__/unit/cai-schema.test.ts
/**
 * Tests unitarios para cai.schema.ts (F3-tests).
 *
 * Cubre:
 * - createCaiSchema: formato CAI válido e inválido
 * - createCaiSchema: códigos de establecimiento/punto de emisión
 * - createCaiSchema: tipo de documento (01, 03, 04)
 * - createCaiSchema: rango from > to → error
 * - createCaiSchema: expiresAt <= issuedAt → error
 * - updateCaiSchema: solo acepta boolean
 */

import { describe, expect, it } from 'vitest';
import { createCaiSchema, updateCaiSchema } from '@/lib/validations/cai.schema';

// ─── Fixture de CAI válido ────────────────────────────────────────────────────

const VALID_CAI = {
  caiCode: 'ABC123-DEF456-GHI789-JKL012-MNO345-PQ',
  establishmentCode: '001',
  emissionPointCode: '001',
  documentType: '01' as const,
  rangeFrom: 1,
  rangeTo: 1000,
  issuedAt: '2026-01-01',
  expiresAt: '2026-12-31',
};

describe('createCaiSchema', () => {
  it('acepta un CAI válido', () => {
    const result = createCaiSchema.safeParse(VALID_CAI);
    expect(result.success).toBe(true);
  });

  it('convierte caiCode a mayúsculas automáticamente', () => {
    const result = createCaiSchema.safeParse({
      ...VALID_CAI,
      caiCode: 'abc123-def456-ghi789-jkl012-mno345-pq',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.caiCode).toBe('ABC123-DEF456-GHI789-JKL012-MNO345-PQ');
    }
  });

  describe('caiCode — formato', () => {
    it('rechaza formato incorrecto (bloques con longitud errónea)', () => {
      const result = createCaiSchema.safeParse({
        ...VALID_CAI,
        caiCode: 'ABC-DEF-GHI-JKL-MNO-PQ',
      });
      expect(result.success).toBe(false);
    });

    it('rechaza formato sin guiones', () => {
      const result = createCaiSchema.safeParse({
        ...VALID_CAI,
        caiCode: 'ABC123DEF456GHI789JKL012MNO345PQ',
      });
      expect(result.success).toBe(false);
    });

    it('rechaza formato con caracteres especiales', () => {
      const result = createCaiSchema.safeParse({
        ...VALID_CAI,
        caiCode: 'ABC!23-DEF456-GHI789-JKL012-MNO345-PQ',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('establishmentCode / emissionPointCode', () => {
    it('rechaza código de establecimiento con menos de 3 dígitos', () => {
      const result = createCaiSchema.safeParse({ ...VALID_CAI, establishmentCode: '01' });
      expect(result.success).toBe(false);
    });

    it('rechaza código de establecimiento no numérico', () => {
      const result = createCaiSchema.safeParse({ ...VALID_CAI, establishmentCode: 'ABC' });
      expect(result.success).toBe(false);
    });

    it('rechaza código de punto de emisión con más de 3 dígitos', () => {
      const result = createCaiSchema.safeParse({ ...VALID_CAI, emissionPointCode: '0001' });
      expect(result.success).toBe(false);
    });
  });

  describe('documentType', () => {
    it('acepta tipo 01 (Factura)', () => {
      expect(createCaiSchema.safeParse({ ...VALID_CAI, documentType: '01' }).success).toBe(true);
    });

    it('acepta tipo 03 (Nota de Crédito)', () => {
      expect(createCaiSchema.safeParse({ ...VALID_CAI, documentType: '03' }).success).toBe(true);
    });

    it('acepta tipo 04 (Nota de Débito)', () => {
      expect(createCaiSchema.safeParse({ ...VALID_CAI, documentType: '04' }).success).toBe(true);
    });

    it('rechaza tipo 02', () => {
      expect(createCaiSchema.safeParse({ ...VALID_CAI, documentType: '02' }).success).toBe(false);
    });

    it('rechaza tipo vacío', () => {
      expect(createCaiSchema.safeParse({ ...VALID_CAI, documentType: '' }).success).toBe(false);
    });
  });

  describe('rango from/to', () => {
    it('rechaza rangeTo < rangeFrom', () => {
      const result = createCaiSchema.safeParse({ ...VALID_CAI, rangeFrom: 500, rangeTo: 100 });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('rangeTo');
      }
    });

    it('acepta rangeTo = rangeFrom (rango de 1 número)', () => {
      expect(
        createCaiSchema.safeParse({ ...VALID_CAI, rangeFrom: 100, rangeTo: 100 }).success,
      ).toBe(true);
    });

    it('rechaza rangeFrom = 0', () => {
      expect(createCaiSchema.safeParse({ ...VALID_CAI, rangeFrom: 0 }).success).toBe(false);
    });
  });

  describe('fechas issuedAt / expiresAt', () => {
    it('rechaza expiresAt igual a issuedAt', () => {
      const result = createCaiSchema.safeParse({
        ...VALID_CAI,
        issuedAt: '2026-01-01',
        expiresAt: '2026-01-01',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('expiresAt');
      }
    });

    it('rechaza expiresAt anterior a issuedAt', () => {
      const result = createCaiSchema.safeParse({
        ...VALID_CAI,
        issuedAt: '2026-06-01',
        expiresAt: '2026-01-01',
      });
      expect(result.success).toBe(false);
    });

    it('rechaza formato de fecha inválido', () => {
      expect(createCaiSchema.safeParse({ ...VALID_CAI, issuedAt: '01/01/2026' }).success).toBe(
        false,
      );
    });
  });
});

describe('updateCaiSchema', () => {
  it('acepta { isActive: true }', () => {
    expect(updateCaiSchema.safeParse({ isActive: true }).success).toBe(true);
  });

  it('acepta { isActive: false }', () => {
    expect(updateCaiSchema.safeParse({ isActive: false }).success).toBe(true);
  });

  it('rechaza objeto vacío', () => {
    expect(updateCaiSchema.safeParse({}).success).toBe(false);
  });

  it('rechaza isActive como string', () => {
    expect(updateCaiSchema.safeParse({ isActive: 'true' }).success).toBe(false);
  });
});
