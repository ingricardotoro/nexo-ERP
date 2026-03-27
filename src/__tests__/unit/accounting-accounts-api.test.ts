// src/__tests__/unit/accounting-accounts-api.test.ts
/**
 * Tests de integración de los endpoints de contabilidad (F2-06 / F2-07).
 *
 * Cubre:
 * - GET  /api/v1/accounting/accounts
 * - GET  /api/v1/accounting/fiscal-years
 * - POST /api/v1/accounting/fiscal-years
 * - POST /api/v1/accounting/fiscal-years/:id/close
 * - POST /api/v1/accounting/fiscal-years/:id/activate
 * - PATCH /api/v1/accounting/fiscal-years/:id/periods/:periodId
 *
 * Los servicios están mockeados con vi.hoisted(); no hay conexión a BD.
 * Los params de rutas dinámicas son Promise<{...}> (Next.js 15 async params).
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

// ─── Mocks de servicios y auth (vi.hoisted para que estén disponibles en vi.mock) ─

const { accountServiceMock, fiscalYearServiceMock, getAuthContextMock } = vi.hoisted(() => ({
  accountServiceMock: {
    getAccountsTree: vi.fn(),
    getAccountStats: vi.fn(),
  },
  fiscalYearServiceMock: {
    listFiscalYears: vi.fn(),
    createFiscalYear: vi.fn(),
    closeYear: vi.fn(),
    activateYear: vi.fn(),
    closePeriod: vi.fn(),
    lockPeriod: vi.fn(),
  },
  getAuthContextMock: vi.fn(),
}));

vi.mock('@/lib/services/accounting/account.service', () => ({
  accountService: accountServiceMock,
}));

vi.mock('@/lib/services/accounting/fiscal-year.service', () => ({
  fiscalYearService: fiscalYearServiceMock,
}));

vi.mock('@/lib/auth/request-auth', () => ({
  getAuthContextFromHeaders: getAuthContextMock,
}));

// ─── Import de handlers (después de los mocks) ────────────────────────────────

import { GET as getAccounts } from '@/app/api/v1/accounting/accounts/route';
import {
  GET as getFiscalYears,
  POST as postFiscalYears,
} from '@/app/api/v1/accounting/fiscal-years/route';
import { POST as closeFiscalYear } from '@/app/api/v1/accounting/fiscal-years/[id]/close/route';
import { POST as activateFiscalYear } from '@/app/api/v1/accounting/fiscal-years/[id]/activate/route';
import { PATCH as patchPeriod } from '@/app/api/v1/accounting/fiscal-years/[id]/periods/[periodId]/route';

// ─── Constantes de test ───────────────────────────────────────────────────────

const COMPANY_A = '00000000-0000-0000-0000-000000000001';
const AÑO_ID = '00000000-0000-0000-0000-000000000010';
const PERIODO_ID = '00000000-0000-0000-0000-000000000020';

/** Contexto de autenticación genérico */
const authContextMock = {
  userId: '00000000-0000-0000-0000-000000000099',
  companyId: COMPANY_A,
  role: 'ACCOUNTANT' as const,
  tokenUse: 'id' as const,
  claims: {},
};

/** Crea un NextRequest con headers de auth */
function crearRequest(body?: unknown): NextRequest {
  const req = new NextRequest('http://localhost/api/v1/accounting/accounts', {
    method: body ? 'POST' : 'GET',
    headers: {
      'content-type': 'application/json',
      'x-company-id': COMPANY_A,
      'x-user-id': authContextMock.userId,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return req;
}

/** Árbol de cuentas mínimo para tests */
function árbolCuentasMock() {
  return [
    {
      id: 'cuenta-1',
      code: '1',
      name: 'Activos',
      accountType: 'ASSET',
      accountNature: 'DEBIT',
      isParent: true,
      allowDirectEntry: false,
      isActive: true,
      description: null,
      level: 1,
      parentId: null,
      children: [],
    },
  ];
}

/** Stats de cuentas mínimas */
function statsCuentasMock() {
  return { total: 50, active: 48, leafAccounts: 30, byType: { ASSET: 20 } };
}

/** Año fiscal mock para respuestas de API */
function añoFiscalMock() {
  return {
    id: AÑO_ID,
    year: 2026,
    startDate: new Date('2026-01-01'),
    endDate: new Date('2026-12-31'),
    status: 'OPEN',
    isActive: true,
    periodsTotal: 12,
    periodsOpen: 12,
    periodsClosed: 0,
    periodsLocked: 0,
  };
}

// ─── Tests: GET /accounting/accounts ─────────────────────────────────────────

describe('GET /api/v1/accounting/accounts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAuthContextMock.mockReturnValue(authContextMock);
  });

  it('debería retornar 200 con árbol de cuentas y stats cuando el servicio retorna datos', async () => {
    // Arrange
    accountServiceMock.getAccountsTree.mockResolvedValue(árbolCuentasMock());
    accountServiceMock.getAccountStats.mockResolvedValue(statsCuentasMock());

    // Act
    const response = await getAccounts(crearRequest());
    const body = await response.json();

    // Assert
    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(1);
    expect(body.stats.total).toBe(50);
  });

  it('debería retornar 200 con árbol vacío cuando la empresa no tiene plan de cuentas', async () => {
    // Arrange
    accountServiceMock.getAccountsTree.mockResolvedValue([]);
    accountServiceMock.getAccountStats.mockResolvedValue({
      total: 0,
      active: 0,
      leafAccounts: 0,
      byType: {},
    });

    // Act
    const response = await getAccounts(crearRequest());
    const body = await response.json();

    // Assert
    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(0);
    expect(body.stats.total).toBe(0);
  });

  it('debería propagar error de auth cuando getAuthContextFromHeaders lanza AuthError', async () => {
    // Arrange — simulamos que el middleware no inyectó headers de auth
    getAuthContextMock.mockImplementation(() => {
      const err = new Error('Contexto de autenticación ausente. Verifica middleware y token JWT.');
      err.name = 'AuthError';
      throw err;
    });

    // Act
    const response = await getAccounts(crearRequest());
    const body = await response.json();

    // Assert — handleApiError captura Error genérico → 400
    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(body.success).toBe(false);
  });
});

// ─── Tests: GET /accounting/fiscal-years ─────────────────────────────────────

describe('GET /api/v1/accounting/fiscal-years', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAuthContextMock.mockReturnValue(authContextMock);
  });

  it('debería retornar 200 con lista de años fiscales', async () => {
    // Arrange
    fiscalYearServiceMock.listFiscalYears.mockResolvedValue([añoFiscalMock()]);

    // Act
    const response = await getFiscalYears(crearRequest());
    const body = await response.json();

    // Assert
    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].year).toBe(2026);
  });

  it('debería retornar 200 con data:[] cuando no hay años fiscales', async () => {
    // Arrange
    fiscalYearServiceMock.listFiscalYears.mockResolvedValue([]);

    // Act
    const response = await getFiscalYears(crearRequest());
    const body = await response.json();

    // Assert
    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(0);
  });

  it('debería retornar ≥400 cuando falla la autenticación', async () => {
    // Arrange
    getAuthContextMock.mockImplementation(() => {
      throw new Error('Contexto de autenticación ausente. Verifica middleware y token JWT.');
    });

    // Act
    const response = await getFiscalYears(crearRequest());

    // Assert
    expect(response.status).toBeGreaterThanOrEqual(400);
  });
});

// ─── Tests: POST /accounting/fiscal-years ────────────────────────────────────

describe('POST /api/v1/accounting/fiscal-years', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAuthContextMock.mockReturnValue(authContextMock);
  });

  it('debería retornar 201 cuando el servicio crea el año exitosamente', async () => {
    // Arrange
    const añoDetalle = { ...añoFiscalMock(), periods: [] };
    fiscalYearServiceMock.createFiscalYear.mockResolvedValue(añoDetalle);

    // Act
    const response = await postFiscalYears(
      crearRequest({ year: 2026, startDate: '2026-01-01', endDate: '2026-12-31' }),
    );
    const body = await response.json();

    // Assert
    expect(response.status).toBe(201);
    expect(body.success).toBe(true);
    expect(body.data.year).toBe(2026);
    expect(body.message).toBe('Año fiscal creado exitosamente');
  });

  it('debería retornar 400 cuando el servicio lanza error de año duplicado', async () => {
    // Arrange
    fiscalYearServiceMock.createFiscalYear.mockRejectedValue(
      new Error('Ya existe un año fiscal 2026 para esta empresa'),
    );

    // Act
    const response = await postFiscalYears(
      crearRequest({ year: 2026, startDate: '2026-01-01', endDate: '2026-12-31' }),
    );
    const body = await response.json();

    // Assert
    expect(response.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error).toContain('Ya existe un año fiscal 2026');
  });
});

// ─── Tests: POST /accounting/fiscal-years/:id/close ──────────────────────────

describe('POST /api/v1/accounting/fiscal-years/:id/close', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAuthContextMock.mockReturnValue(authContextMock);
  });

  it('debería retornar 200 cuando el año se cierra exitosamente', async () => {
    // Arrange
    fiscalYearServiceMock.closeYear.mockResolvedValue(undefined);
    const params = Promise.resolve({ id: AÑO_ID });

    // Act
    const response = await closeFiscalYear(crearRequest(), { params });
    const body = await response.json();

    // Assert
    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.message).toBe('Año fiscal cerrado exitosamente');
  });

  it('debería retornar 400 cuando el año ya está cerrado', async () => {
    // Arrange
    fiscalYearServiceMock.closeYear.mockRejectedValue(new Error('El año fiscal ya está cerrado'));
    const params = Promise.resolve({ id: AÑO_ID });

    // Act
    const response = await closeFiscalYear(crearRequest(), { params });
    const body = await response.json();

    // Assert
    expect(response.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error).toContain('ya está cerrado');
  });
});

// ─── Tests: POST /accounting/fiscal-years/:id/activate ───────────────────────

describe('POST /api/v1/accounting/fiscal-years/:id/activate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAuthContextMock.mockReturnValue(authContextMock);
  });

  it('debería retornar 200 cuando el año se activa exitosamente', async () => {
    // Arrange
    fiscalYearServiceMock.activateYear.mockResolvedValue(undefined);
    const params = Promise.resolve({ id: AÑO_ID });

    // Act
    const response = await activateFiscalYear(crearRequest(), { params });
    const body = await response.json();

    // Assert
    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.message).toBe('Año fiscal activado exitosamente');
  });

  it('debería retornar 404 cuando el servicio lanza error (ej: año no encontrado)', async () => {
    // Arrange
    fiscalYearServiceMock.activateYear.mockRejectedValue(new Error('Año fiscal no encontrado'));
    const params = Promise.resolve({ id: AÑO_ID });

    // Act
    const response = await activateFiscalYear(crearRequest(), { params });
    const body = await response.json();

    // Assert
    expect(response.status).toBe(404);
    expect(body.success).toBe(false);
  });
});

// ─── Tests: PATCH /accounting/fiscal-years/:id/periods/:periodId ─────────────

describe('PATCH /api/v1/accounting/fiscal-years/:id/periods/:periodId', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAuthContextMock.mockReturnValue(authContextMock);
  });

  it('debería retornar 200 con mensaje correcto cuando action=close', async () => {
    // Arrange
    fiscalYearServiceMock.closePeriod.mockResolvedValue(undefined);
    const params = Promise.resolve({ id: AÑO_ID, periodId: PERIODO_ID });

    // Act
    const response = await patchPeriod(crearRequest({ action: 'close' }), { params });
    const body = await response.json();

    // Assert
    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.message).toBe('Período cerrado exitosamente');
    expect(fiscalYearServiceMock.closePeriod).toHaveBeenCalledWith(COMPANY_A, PERIODO_ID);
  });

  it('debería retornar 200 con mensaje correcto cuando action=lock', async () => {
    // Arrange
    fiscalYearServiceMock.lockPeriod.mockResolvedValue(undefined);
    const params = Promise.resolve({ id: AÑO_ID, periodId: PERIODO_ID });

    // Act
    const response = await patchPeriod(crearRequest({ action: 'lock' }), { params });
    const body = await response.json();

    // Assert
    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.message).toBe('Período bloqueado exitosamente');
    expect(fiscalYearServiceMock.lockPeriod).toHaveBeenCalledWith(COMPANY_A, PERIODO_ID);
  });

  it('debería retornar 422 cuando action es inválida (ej: delete)', async () => {
    // Arrange — Zod rechaza action='delete' con ZodError → 422
    const params = Promise.resolve({ id: AÑO_ID, periodId: PERIODO_ID });

    // Act
    const response = await patchPeriod(crearRequest({ action: 'delete' }), { params });
    const body = await response.json();

    // Assert — handleApiError convierte ZodError → 422
    expect(response.status).toBe(422);
    expect(body.success).toBe(false);
  });

  it('debería retornar 400 cuando closePeriod lanza error (período ya cerrado)', async () => {
    // Arrange
    fiscalYearServiceMock.closePeriod.mockRejectedValue(new Error('El período ya está cerrado'));
    const params = Promise.resolve({ id: AÑO_ID, periodId: PERIODO_ID });

    // Act
    const response = await patchPeriod(crearRequest({ action: 'close' }), { params });
    const body = await response.json();

    // Assert
    expect(response.status).toBe(400);
    expect(body.error).toContain('ya está cerrado');
  });

  it('debería retornar 400 cuando lockPeriod lanza error (período debe cerrarse primero)', async () => {
    // Arrange
    fiscalYearServiceMock.lockPeriod.mockRejectedValue(
      new Error('El período debe estar CERRADO antes de bloquearse'),
    );
    const params = Promise.resolve({ id: AÑO_ID, periodId: PERIODO_ID });

    // Act
    const response = await patchPeriod(crearRequest({ action: 'lock' }), { params });
    const body = await response.json();

    // Assert
    expect(response.status).toBe(400);
    expect(body.error).toContain('CERRADO');
  });
});
