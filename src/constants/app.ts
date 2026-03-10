export const APP_NAME = 'NexoERP';
export const APP_DESCRIPTION = 'Sistema ERP modular para PYMEs hondureñas';
export const APP_VERSION = '0.0.0';

export const LOCALES = {
  DEFAULT: 'es-HN',
  SUPPORTED: ['es-HN'] as const,
} as const;

export const CURRENCIES = {
  BASE: 'HNL',
  SUPPORTED: ['HNL', 'USD'] as const,
} as const;

export const ROLES = {
  ADMIN: 'administrador',
  MANAGER: 'gerente',
  ACCOUNTANT: 'contador',
  SALESPERSON: 'vendedor',
  AUDITOR: 'auditor',
} as const;

export const MODULES = {
  CORE: 'core',
  CONTACTS: 'contacts',
  ACCOUNTING: 'accounting',
  INVOICING: 'invoicing',
  PURCHASING: 'purchasing',
  SALES: 'sales',
  INVENTORY: 'inventory',
} as const;
