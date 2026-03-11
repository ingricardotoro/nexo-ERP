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
    return { type: 'img', props };
  },
}));
