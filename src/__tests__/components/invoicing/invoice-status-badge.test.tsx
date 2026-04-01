// src/__tests__/components/invoicing/invoice-status-badge.test.tsx
import { render, screen } from '@testing-library/react';

import {
  InvoiceStatusBadge,
  getInvoiceStatusLabel,
  type InvoiceStatus,
} from '@/components/invoicing/invoice-status-badge';

describe('InvoiceStatusBadge', () => {
  describe('renderizado por cada status', () => {
    it('debería mostrar "Borrador" para el estado DRAFT', () => {
      render(<InvoiceStatusBadge status="DRAFT" />);
      expect(screen.getByText('Borrador')).toBeInTheDocument();
    });

    it('debería mostrar "Emitida" para el estado PUBLISHED', () => {
      render(<InvoiceStatusBadge status="PUBLISHED" />);
      expect(screen.getByText('Emitida')).toBeInTheDocument();
    });

    it('debería mostrar "Pagada" para el estado PAID', () => {
      render(<InvoiceStatusBadge status="PAID" />);
      expect(screen.getByText('Pagada')).toBeInTheDocument();
    });

    it('debería mostrar "Anulada" para el estado CANCELLED', () => {
      render(<InvoiceStatusBadge status="CANCELLED" />);
      expect(screen.getByText('Anulada')).toBeInTheDocument();
    });
  });

  describe('clases de color por status', () => {
    it('debería aplicar clases de color gris para DRAFT', () => {
      render(<InvoiceStatusBadge status="DRAFT" />);
      const badge = screen.getByText('Borrador');
      expect(badge).toHaveClass('bg-gray-100', 'text-gray-700');
    });

    it('debería aplicar clases de color azul para PUBLISHED', () => {
      render(<InvoiceStatusBadge status="PUBLISHED" />);
      const badge = screen.getByText('Emitida');
      expect(badge).toHaveClass('bg-blue-50', 'text-blue-700');
    });

    it('debería aplicar clases de color verde para PAID', () => {
      render(<InvoiceStatusBadge status="PAID" />);
      const badge = screen.getByText('Pagada');
      expect(badge).toHaveClass('bg-green-50', 'text-green-700');
    });

    it('debería aplicar clases de color rojo para CANCELLED', () => {
      render(<InvoiceStatusBadge status="CANCELLED" />);
      const badge = screen.getByText('Anulada');
      expect(badge).toHaveClass('bg-red-50', 'text-red-700');
    });
  });

  describe('caso borde: status desconocido', () => {
    it('debería mostrar "Borrador" como fallback cuando el status no es reconocido', () => {
      // Simular un status inválido (forzado con cast para entorno de prueba)
      render(<InvoiceStatusBadge status={'UNKNOWN' as InvoiceStatus} />);
      expect(screen.getByText('Borrador')).toBeInTheDocument();
    });
  });
});

describe('getInvoiceStatusLabel', () => {
  it('debería retornar "Borrador" para DRAFT', () => {
    expect(getInvoiceStatusLabel('DRAFT')).toBe('Borrador');
  });

  it('debería retornar "Emitida" para PUBLISHED', () => {
    expect(getInvoiceStatusLabel('PUBLISHED')).toBe('Emitida');
  });

  it('debería retornar "Pagada" para PAID', () => {
    expect(getInvoiceStatusLabel('PAID')).toBe('Pagada');
  });

  it('debería retornar "Anulada" para CANCELLED', () => {
    expect(getInvoiceStatusLabel('CANCELLED')).toBe('Anulada');
  });

  it('debería retornar el status original cuando no está en el mapa', () => {
    expect(getInvoiceStatusLabel('INVALID' as InvoiceStatus)).toBe('INVALID');
  });
});
