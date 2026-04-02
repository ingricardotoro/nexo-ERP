// src/__tests__/components/invoicing/invoice-type-badge.test.tsx
import { render, screen } from '@testing-library/react';

import {
  InvoiceTypeBadge,
  getInvoiceTypeLabel,
  type InvoiceType,
} from '@/components/invoicing/invoice-type-badge';

describe('InvoiceTypeBadge', () => {
  describe('renderizado por cada tipo de documento', () => {
    it('debería mostrar "Factura" para el tipo FACTURA', () => {
      render(<InvoiceTypeBadge invoiceType="FACTURA" />);
      expect(screen.getByText('Factura')).toBeInTheDocument();
    });

    it('debería mostrar "Nota de Crédito" para el tipo NOTA_CREDITO', () => {
      render(<InvoiceTypeBadge invoiceType="NOTA_CREDITO" />);
      expect(screen.getByText('Nota de Crédito')).toBeInTheDocument();
    });

    it('debería mostrar "Nota de Débito" para el tipo NOTA_DEBITO', () => {
      render(<InvoiceTypeBadge invoiceType="NOTA_DEBITO" />);
      expect(screen.getByText('Nota de Débito')).toBeInTheDocument();
    });
  });

  describe('clases de color por tipo de documento', () => {
    it('debería aplicar clases de color violeta para FACTURA', () => {
      render(<InvoiceTypeBadge invoiceType="FACTURA" />);
      const badge = screen.getByText('Factura');
      expect(badge).toHaveClass('bg-violet-50', 'text-violet-700');
    });

    it('debería aplicar clases de color ámbar para NOTA_CREDITO', () => {
      render(<InvoiceTypeBadge invoiceType="NOTA_CREDITO" />);
      const badge = screen.getByText('Nota de Crédito');
      expect(badge).toHaveClass('bg-amber-50', 'text-amber-700');
    });

    it('debería aplicar clases de color naranja para NOTA_DEBITO', () => {
      render(<InvoiceTypeBadge invoiceType="NOTA_DEBITO" />);
      const badge = screen.getByText('Nota de Débito');
      expect(badge).toHaveClass('bg-orange-50', 'text-orange-700');
    });
  });

  describe('caso borde: tipo desconocido', () => {
    it('debería mostrar "Factura" como fallback cuando el tipo no es reconocido', () => {
      render(<InvoiceTypeBadge invoiceType={'DESCONOCIDO' as InvoiceType} />);
      expect(screen.getByText('Factura')).toBeInTheDocument();
    });
  });
});

describe('getInvoiceTypeLabel', () => {
  it('debería retornar "Factura" para FACTURA', () => {
    expect(getInvoiceTypeLabel('FACTURA')).toBe('Factura');
  });

  it('debería retornar "Nota de Crédito" para NOTA_CREDITO', () => {
    expect(getInvoiceTypeLabel('NOTA_CREDITO')).toBe('Nota de Crédito');
  });

  it('debería retornar "Nota de Débito" para NOTA_DEBITO', () => {
    expect(getInvoiceTypeLabel('NOTA_DEBITO')).toBe('Nota de Débito');
  });

  it('debería retornar el tipo original cuando no está en el mapa', () => {
    expect(getInvoiceTypeLabel('INVALIDO' as InvoiceType)).toBe('INVALIDO');
  });
});
