// src/__tests__/unit/fiscal-year-service.test.ts
/**
 * Tests unitarios del FiscalYearService (F2-06).
 *
 * Estrategia de mock:
 *   - prisma.fiscalYear.* y prisma.fiscalPeriod.* → mocks de Prisma con vi.hoisted
 *   - prisma.$transaction → mock que ejecuta callback (createFiscalYear)
 *                          o Promise.all (activateYear, closeYear)
 *
 * Sin conexión real a BD.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Mocks de Prisma (vi.hoisted para que estén disponibles en vi.mock) ───────

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    fiscalYear: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    fiscalPeriod: {
      findFirst: vi.fn(),
      createMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock('@/lib/db/prisma', () => ({ default: prismaMock }));

// ─── Import del servicio (después de los mocks) ───────────────────────────────

import { fiscalYearService } from '@/lib/services/accounting/fiscal-year.service';

// ─── Constantes de test ───────────────────────────────────────────────────────

const COMPANY_A = '00000000-0000-0000-0000-000000000001';
const AÑO_ID = '00000000-0000-0000-0000-000000000010';
const PERIODO_ID = '00000000-0000-0000-0000-000000000020';

/** Año fiscal mock en estado OPEN */
function añoMock(overrides: Record<string, unknown> = {}) {
  return {
    id: AÑO_ID,
    companyId: COMPANY_A,
    year: 2026,
    startDate: new Date('2026-01-01'),
    endDate: new Date('2026-12-31'),
    status: 'OPEN',
    isActive: false,
    createdAt: new Date('2026-01-01'),
    ...overrides,
  };
}

/** Período fiscal mock en estado OPEN */
function periodoMock(overrides: Record<string, unknown> = {}) {
  return {
    id: PERIODO_ID,
    companyId: COMPANY_A,
    fiscalYearId: AÑO_ID,
    periodNumber: 1,
    name: 'Enero 2026',
    startDate: new Date('2026-01-01'),
    endDate: new Date('2026-01-31'),
    status: 'OPEN',
    ...overrides,
  };
}

/**
 * Configura $transaction para el patrón callback (createFiscalYear).
 * El mock ejecuta el callback pasando prismaMock como tx.
 */
function mockTransaccionCallback() {
  prismaMock.$transaction.mockImplementation(async (arg: unknown) =>
    typeof arg === 'function'
      ? (arg as (tx: typeof prismaMock) => unknown)(prismaMock)
      : Promise.all(arg as Promise<unknown>[]),
  );
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('fiscalYearService.listFiscalYears', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('debería retornar lista de años con conteos de períodos correctos', async () => {
    // Arrange
    prismaMock.fiscalYear.findMany.mockResolvedValue([
      {
        ...añoMock({ isActive: true }),
        _count: { fiscalPeriods: 12 },
        fiscalPeriods: [
          { status: 'OPEN' },
          { status: 'OPEN' },
          { status: 'CLOSED' },
          { status: 'LOCKED' },
          ...Array(8).fill({ status: 'OPEN' }),
        ],
      },
    ]);

    // Act
    const resultado = await fiscalYearService.listFiscalYears(COMPANY_A);

    // Assert
    expect(resultado).toHaveLength(1);
    expect(resultado[0].periodsTotal).toBe(12);
    expect(resultado[0].periodsOpen).toBe(10);
    expect(resultado[0].periodsClosed).toBe(1);
    expect(resultado[0].periodsLocked).toBe(1);
  });

  it('debería retornar lista vacía cuando la empresa no tiene años fiscales', async () => {
    // Arrange
    prismaMock.fiscalYear.findMany.mockResolvedValue([]);

    // Act
    const resultado = await fiscalYearService.listFiscalYears(COMPANY_A);

    // Assert
    expect(resultado).toHaveLength(0);
  });

  it('debería filtrar por companyId (verificación multi-tenant)', async () => {
    // Arrange
    prismaMock.fiscalYear.findMany.mockResolvedValue([]);

    // Act
    await fiscalYearService.listFiscalYears(COMPANY_A);

    // Assert
    expect(prismaMock.fiscalYear.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { companyId: COMPANY_A } }),
    );
  });
});

// ─── createFiscalYear ─────────────────────────────────────────────────────────

describe('fiscalYearService.createFiscalYear', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTransaccionCallback();
  });

  it('debería crear año fiscal + 12 períodos usando $transaction (callback)', async () => {
    // Arrange
    prismaMock.fiscalYear.findFirst.mockResolvedValueOnce(null); // no existe año duplicado
    prismaMock.fiscalYear.count.mockResolvedValue(1); // ya hay otros años → isActive=false
    const añoCreado = añoMock({ isActive: false });
    prismaMock.fiscalYear.create.mockResolvedValue(añoCreado);
    prismaMock.fiscalPeriod.createMany.mockResolvedValue({ count: 12 });
    // getFiscalYear llamado al final
    prismaMock.fiscalYear.findFirst.mockResolvedValueOnce({
      ...añoCreado,
      _count: { fiscalPeriods: 12 },
      fiscalPeriods: Array(12)
        .fill(null)
        .map((_, i) => ({
          id: `periodo-${i}`,
          periodNumber: i + 1,
          name: `Periodo ${i + 1}`,
          startDate: new Date(),
          endDate: new Date(),
          status: 'OPEN',
          _count: { journalEntries: 0 },
        })),
    });

    // Act
    await fiscalYearService.createFiscalYear(COMPANY_A, {
      year: 2026,
      startDate: '2026-01-01',
      endDate: '2026-12-31',
    });

    // Assert
    expect(prismaMock.$transaction).toHaveBeenCalledOnce();
    expect(prismaMock.fiscalPeriod.createMany).toHaveBeenCalledOnce();
    const llamadaCreateMany = prismaMock.fiscalPeriod.createMany.mock.calls[0][0];
    expect(llamadaCreateMany.data).toHaveLength(12);
  });

  it('debería generar períodos con nombres correctos en español (Enero…Diciembre)', async () => {
    // Arrange
    prismaMock.fiscalYear.findFirst.mockResolvedValueOnce(null);
    prismaMock.fiscalYear.count.mockResolvedValue(1);
    const añoCreado = añoMock();
    prismaMock.fiscalYear.create.mockResolvedValue(añoCreado);
    prismaMock.fiscalPeriod.createMany.mockResolvedValue({ count: 12 });
    prismaMock.fiscalYear.findFirst.mockResolvedValueOnce({
      ...añoCreado,
      _count: { fiscalPeriods: 12 },
      fiscalPeriods: [],
    });
    let periodosCapturados: Array<{ name: string }> = [];
    prismaMock.fiscalPeriod.createMany.mockImplementation(
      async (args: { data: Array<{ name: string }> }) => {
        periodosCapturados = args.data;
        return { count: 12 };
      },
    );

    // Act
    await fiscalYearService.createFiscalYear(COMPANY_A, {
      year: 2026,
      startDate: '2026-01-01',
      endDate: '2026-12-31',
    });

    // Assert
    const nombres = periodosCapturados.map((p) => p.name);
    expect(nombres[0]).toContain('Enero');
    expect(nombres[5]).toContain('Junio');
    expect(nombres[11]).toContain('Diciembre');
  });

  it('debería crear el primer año como activo (isActive=true) cuando count=0', async () => {
    // Arrange
    prismaMock.fiscalYear.findFirst.mockResolvedValueOnce(null);
    prismaMock.fiscalYear.count.mockResolvedValue(0); // primer año de la empresa
    prismaMock.fiscalPeriod.createMany.mockResolvedValue({ count: 12 });
    let datosCreacion: Record<string, unknown> = {};
    prismaMock.fiscalYear.create.mockImplementation(
      async (args: { data: Record<string, unknown> }) => {
        datosCreacion = args.data;
        return añoMock({ isActive: true });
      },
    );
    prismaMock.fiscalYear.findFirst.mockResolvedValueOnce({
      ...añoMock({ isActive: true }),
      _count: { fiscalPeriods: 12 },
      fiscalPeriods: [],
    });

    // Act
    await fiscalYearService.createFiscalYear(COMPANY_A, {
      year: 2026,
      startDate: '2026-01-01',
      endDate: '2026-12-31',
    });

    // Assert
    expect(datosCreacion.isActive).toBe(true);
  });

  it('debería lanzar error cuando ya existe un año fiscal con el mismo número', async () => {
    // Arrange
    prismaMock.fiscalYear.findFirst.mockResolvedValueOnce(añoMock()); // año duplicado
    prismaMock.fiscalYear.count.mockResolvedValue(1);

    // Act / Assert
    await expect(
      fiscalYearService.createFiscalYear(COMPANY_A, {
        year: 2026,
        startDate: '2026-01-01',
        endDate: '2026-12-31',
      }),
    ).rejects.toThrow('Ya existe un año fiscal 2026');
  });
});

// ─── activateYear ─────────────────────────────────────────────────────────────

describe('fiscalYearService.activateYear', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Para activateYear se usa array pattern → Promise.all
    prismaMock.$transaction.mockImplementation(async (arg: unknown) =>
      typeof arg === 'function'
        ? (arg as (tx: typeof prismaMock) => unknown)(prismaMock)
        : Promise.all(arg as Promise<unknown>[]),
    );
    prismaMock.fiscalYear.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.fiscalYear.update.mockResolvedValue(añoMock({ isActive: true }));
  });

  it('debería desactivar el año activo actual y activar el nuevo en transacción', async () => {
    // Arrange
    prismaMock.fiscalYear.findFirst.mockResolvedValue(añoMock({ isActive: false, status: 'OPEN' }));

    // Act
    await fiscalYearService.activateYear(COMPANY_A, AÑO_ID);

    // Assert
    expect(prismaMock.$transaction).toHaveBeenCalledOnce();
    expect(prismaMock.fiscalYear.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { companyId: COMPANY_A, isActive: true } }),
    );
    expect(prismaMock.fiscalYear.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: AÑO_ID }, data: { isActive: true } }),
    );
  });

  it('debería lanzar error cuando el año no existe', async () => {
    // Arrange
    prismaMock.fiscalYear.findFirst.mockResolvedValue(null);

    // Act / Assert
    await expect(fiscalYearService.activateYear(COMPANY_A, AÑO_ID)).rejects.toThrow(
      'Año fiscal no encontrado',
    );
  });

  it('debería lanzar error cuando el año ya está activo', async () => {
    // Arrange
    prismaMock.fiscalYear.findFirst.mockResolvedValue(añoMock({ isActive: true, status: 'OPEN' }));

    // Act / Assert
    await expect(fiscalYearService.activateYear(COMPANY_A, AÑO_ID)).rejects.toThrow(
      'ya está activo',
    );
  });

  it('debería lanzar error cuando el año está CLOSED (solo OPEN puede activarse)', async () => {
    // Arrange
    prismaMock.fiscalYear.findFirst.mockResolvedValue(
      añoMock({ isActive: false, status: 'CLOSED' }),
    );

    // Act / Assert
    await expect(fiscalYearService.activateYear(COMPANY_A, AÑO_ID)).rejects.toThrow('ABIERTO');
  });
});

// ─── closeYear ────────────────────────────────────────────────────────────────

describe('fiscalYearService.closeYear', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Para closeYear se usa array pattern → Promise.all
    prismaMock.$transaction.mockImplementation(async (arg: unknown) =>
      typeof arg === 'function'
        ? (arg as (tx: typeof prismaMock) => unknown)(prismaMock)
        : Promise.all(arg as Promise<unknown>[]),
    );
    prismaMock.fiscalPeriod.updateMany.mockResolvedValue({ count: 10 });
    prismaMock.fiscalYear.update.mockResolvedValue(añoMock({ status: 'CLOSED', isActive: false }));
  });

  it('debería cerrar todos los períodos OPEN y marcar el año CLOSED en transacción', async () => {
    // Arrange
    prismaMock.fiscalYear.findFirst.mockResolvedValue(añoMock({ status: 'OPEN' }));

    // Act
    await fiscalYearService.closeYear(COMPANY_A, AÑO_ID);

    // Assert
    expect(prismaMock.$transaction).toHaveBeenCalledOnce();
    expect(prismaMock.fiscalPeriod.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { fiscalYearId: AÑO_ID, companyId: COMPANY_A, status: 'OPEN' },
        data: { status: 'CLOSED' },
      }),
    );
    expect(prismaMock.fiscalYear.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: 'CLOSED', isActive: false },
      }),
    );
  });

  it('debería lanzar error cuando el año no existe', async () => {
    // Arrange
    prismaMock.fiscalYear.findFirst.mockResolvedValue(null);

    // Act / Assert
    await expect(fiscalYearService.closeYear(COMPANY_A, AÑO_ID)).rejects.toThrow(
      'Año fiscal no encontrado',
    );
  });

  it('debería lanzar error cuando el año ya está CLOSED', async () => {
    // Arrange
    prismaMock.fiscalYear.findFirst.mockResolvedValue(añoMock({ status: 'CLOSED' }));

    // Act / Assert
    await expect(fiscalYearService.closeYear(COMPANY_A, AÑO_ID)).rejects.toThrow('ya está cerrado');
  });
});

// ─── closePeriod ──────────────────────────────────────────────────────────────

describe('fiscalYearService.closePeriod', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.fiscalPeriod.update.mockResolvedValue(periodoMock({ status: 'CLOSED' }));
  });

  it('debería cambiar período de OPEN a CLOSED exitosamente', async () => {
    // Arrange
    prismaMock.fiscalPeriod.findFirst.mockResolvedValue(periodoMock({ status: 'OPEN' }));

    // Act
    await fiscalYearService.closePeriod(COMPANY_A, PERIODO_ID);

    // Assert
    expect(prismaMock.fiscalPeriod.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: PERIODO_ID }, data: { status: 'CLOSED' } }),
    );
  });

  it('debería lanzar error cuando el período no existe', async () => {
    // Arrange
    prismaMock.fiscalPeriod.findFirst.mockResolvedValue(null);

    // Act / Assert
    await expect(fiscalYearService.closePeriod(COMPANY_A, PERIODO_ID)).rejects.toThrow(
      'Período fiscal no encontrado',
    );
  });

  it('debería lanzar error cuando el período ya está CLOSED', async () => {
    // Arrange
    prismaMock.fiscalPeriod.findFirst.mockResolvedValue(periodoMock({ status: 'CLOSED' }));

    // Act / Assert
    await expect(fiscalYearService.closePeriod(COMPANY_A, PERIODO_ID)).rejects.toThrow(
      'ya está cerrado',
    );
  });

  it('debería lanzar error cuando el período está LOCKED', async () => {
    // Arrange
    prismaMock.fiscalPeriod.findFirst.mockResolvedValue(periodoMock({ status: 'LOCKED' }));

    // Act / Assert
    await expect(fiscalYearService.closePeriod(COMPANY_A, PERIODO_ID)).rejects.toThrow('bloqueado');
  });
});

// ─── lockPeriod ───────────────────────────────────────────────────────────────

describe('fiscalYearService.lockPeriod', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.fiscalPeriod.update.mockResolvedValue(periodoMock({ status: 'LOCKED' }));
  });

  it('debería cambiar período de CLOSED a LOCKED exitosamente', async () => {
    // Arrange
    prismaMock.fiscalPeriod.findFirst.mockResolvedValue(periodoMock({ status: 'CLOSED' }));

    // Act
    await fiscalYearService.lockPeriod(COMPANY_A, PERIODO_ID);

    // Assert
    expect(prismaMock.fiscalPeriod.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: PERIODO_ID }, data: { status: 'LOCKED' } }),
    );
  });

  it('debería lanzar error cuando el período está OPEN (debe cerrarse primero)', async () => {
    // Arrange
    prismaMock.fiscalPeriod.findFirst.mockResolvedValue(periodoMock({ status: 'OPEN' }));

    // Act / Assert
    await expect(fiscalYearService.lockPeriod(COMPANY_A, PERIODO_ID)).rejects.toThrow('CERRADO');
  });

  it('debería lanzar error cuando el período ya está LOCKED', async () => {
    // Arrange
    prismaMock.fiscalPeriod.findFirst.mockResolvedValue(periodoMock({ status: 'LOCKED' }));

    // Act / Assert
    await expect(fiscalYearService.lockPeriod(COMPANY_A, PERIODO_ID)).rejects.toThrow(
      'ya está bloqueado',
    );
  });

  it('debería lanzar error cuando el período no existe', async () => {
    // Arrange
    prismaMock.fiscalPeriod.findFirst.mockResolvedValue(null);

    // Act / Assert
    await expect(fiscalYearService.lockPeriod(COMPANY_A, PERIODO_ID)).rejects.toThrow(
      'Período fiscal no encontrado',
    );
  });
});
