// src/__tests__/components/invoicing/format-currency.test.ts
import { formatCurrency, formatTaxRate } from '@/components/invoicing/format-currency';

describe('formatCurrency', () => {
  describe('moneda HNL (Lempira)', () => {
    it('debería formatear monto entero en HNL con símbolo L', () => {
      expect(formatCurrency(1000, 'HNL')).toBe('L 1,000.00');
    });

    it('debería formatear monto con decimales en HNL', () => {
      expect(formatCurrency(1234.56, 'HNL')).toBe('L 1,234.56');
    });

    it('debería usar HNL como moneda por defecto cuando no se especifica', () => {
      expect(formatCurrency(500)).toBe('L 500.00');
    });

    it('debería formatear cero en HNL', () => {
      expect(formatCurrency(0, 'HNL')).toBe('L 0.00');
    });

    it('debería redondear a 2 decimales en HNL', () => {
      // 1000 * 0.15 = 150.00 — caso típico de ISV 15%
      expect(formatCurrency(150, 'HNL')).toBe('L 150.00');
    });

    it('debería formatear montos grandes con separador de miles en HNL', () => {
      expect(formatCurrency(1000000, 'HNL')).toBe('L 1,000,000.00');
    });
  });

  describe('moneda USD (Dólar)', () => {
    it('debería formatear monto en USD con símbolo $', () => {
      expect(formatCurrency(1000, 'USD')).toBe('$ 1,000.00');
    });

    it('debería formatear monto con decimales en USD', () => {
      expect(formatCurrency(1234.56, 'USD')).toBe('$ 1,234.56');
    });

    it('debería formatear cero en USD', () => {
      expect(formatCurrency(0, 'USD')).toBe('$ 0.00');
    });

    it('debería formatear montos grandes con separador de miles en USD', () => {
      expect(formatCurrency(50000, 'USD')).toBe('$ 50,000.00');
    });
  });

  describe('casos de cálculos fiscales típicos', () => {
    it('debería formatear correctamente subtotal de factura HNL', () => {
      // Servicio de consultoría: 1 unidad × L 5,000
      expect(formatCurrency(5000, 'HNL')).toBe('L 5,000.00');
    });

    it('debería formatear correctamente ISV 15% sobre L 5,000', () => {
      // ISV 15% de 5000 = 750
      expect(formatCurrency(750, 'HNL')).toBe('L 750.00');
    });

    it('debería formatear correctamente total de factura con ISV 15%', () => {
      // Total = 5000 + 750 = 5750
      expect(formatCurrency(5750, 'HNL')).toBe('L 5,750.00');
    });
  });
});

describe('formatTaxRate', () => {
  it('debería formatear tasa 0.15 como "15.00%"', () => {
    expect(formatTaxRate(0.15)).toBe('15.00%');
  });

  it('debería formatear tasa 0.18 como "18.00%"', () => {
    expect(formatTaxRate(0.18)).toBe('18.00%');
  });

  it('debería formatear tasa 0 como "0.00%" para productos exentos', () => {
    expect(formatTaxRate(0)).toBe('0.00%');
  });

  it('debería formatear tasa 1.0 como "100.00%"', () => {
    expect(formatTaxRate(1.0)).toBe('100.00%');
  });

  it('debería mostrar dos decimales aunque la tasa sea entera', () => {
    expect(formatTaxRate(0.1)).toBe('10.00%');
  });
});
