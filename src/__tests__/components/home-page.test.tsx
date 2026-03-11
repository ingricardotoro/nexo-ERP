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
    expect(screen.getByText(/sistema erp modular para pymes hondureñas/i)).toBeInTheDocument();
  });

  it('debe renderizar el indicador de fase', () => {
    render(<HomePage />);
    expect(screen.getByText(/fase 0/i)).toBeInTheDocument();
  });
});
