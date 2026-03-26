// src/__tests__/unit/contact-import-service.test.ts
/**
 * Tests unitarios del ContactImportService (F2-03).
 *
 * Estrategia de mock:
 *   - prisma.contact.findMany  → controla RTNs existentes en DB
 *   - prisma.$transaction      → intercepta la inserción en batch
 *
 * Sin conexión real a BD. Vitest intercepta el módulo '@/lib/db/prisma'
 * antes de que el servicio lo importe, usando vi.hoisted para que los
 * mocks estén disponibles en el scope correcto.
 *
 * Numeración de filas: el servicio suma +3 al índice porque considera
 * fila 1 = cabecera y fila 2 = ejemplo del template.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Mocks de Prisma ──────────────────────────────────────────────────────────
// vi.mock se hoisatea al tope del archivo. Para que la factory pueda referenciar
// variables locales, se usa vi.hoisted() que también se hoisatea.

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    contact: {
      findMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock('@/lib/db/prisma', () => ({
  default: prismaMock,
}));

// ─── Import del servicio (después de los mocks) ───────────────────────────────

import { ContactImportService } from '@/lib/services/contacts/contact-import.service';

// ─── Constantes de test ───────────────────────────────────────────────────────

const COMPANY_ID_EMPRESA_A = '00000000-0000-0000-0000-000000000001';

/** Fila cruda mínima válida, como viene de xlsx.utils.sheet_to_json */
function filaRawValida(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    tipo_contacto: 'NATURAL',
    nombre_legal: 'Juan Pérez López',
    nombre_comercial: '',
    rtn: '0801-1990-00001',
    es_cliente: 'SI',
    es_proveedor: 'NO',
    email: '',
    telefono: '',
    sitio_web: '',
    notas: '',
    activo: '',
    ...overrides,
  };
}

/** Simula el retorno de createManyAndReturn con IDs ficticios */
function mockTransaccionExitosa(cantidad: number) {
  const ids = Array.from({ length: cantidad }, (_, i) => ({
    id: `00000000-0000-0000-0000-${String(i + 1).padStart(12, '0')}`,
  }));
  prismaMock.$transaction.mockImplementation(async (fn: (tx: typeof prismaMock) => unknown) => {
    const txMock = {
      contact: {
        createManyAndReturn: vi.fn().mockResolvedValue(ids),
      },
    };
    return fn(txMock as unknown as typeof prismaMock);
  });
  return ids;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ContactImportService.importFromRows', () => {
  let servicio: ContactImportService;

  beforeEach(() => {
    servicio = new ContactImportService();
    vi.clearAllMocks();
    // Por defecto: empresa sin RTNs existentes
    prismaMock.contact.findMany.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('flujo exitoso', () => {
    it('debería importar 2 filas válidas con successCount=2 y sin errores', async () => {
      // Arrange
      mockTransaccionExitosa(2);
      const filas = [
        filaRawValida({ rtn: '0801-1990-00001' }),
        filaRawValida({ rtn: '0801-1990-00002', nombre_legal: 'María García' }),
      ];

      // Act
      const resultado = await servicio.importFromRows(COMPANY_ID_EMPRESA_A, filas);

      // Assert
      expect(resultado.totalRows).toBe(2);
      expect(resultado.successCount).toBe(2);
      expect(resultado.errorCount).toBe(0);
      expect(resultado.duplicateCount).toBe(0);
      expect(resultado.errors).toHaveLength(0);
      expect(resultado.duplicates).toHaveLength(0);
      expect(resultado.importedIds).toHaveLength(2);
    });

    it('debería asignar companyId del tenant a todos los contactos importados', async () => {
      // Arrange
      mockTransaccionExitosa(1);
      let datosCapturados: unknown[] = [];
      prismaMock.$transaction.mockImplementation(async (fn: (tx: typeof prismaMock) => unknown) => {
        const txMock = {
          contact: {
            createManyAndReturn: vi.fn().mockImplementation(async (args: { data: unknown[] }) => {
              datosCapturados = args.data;
              return [{ id: '00000000-0000-0000-0000-000000000001' }];
            }),
          },
        };
        return fn(txMock as unknown as typeof prismaMock);
      });

      // Act
      await servicio.importFromRows(COMPANY_ID_EMPRESA_A, [filaRawValida()]);

      // Assert: verificar que companyId es el del tenant activo (multi-tenant)
      expect(datosCapturados).toHaveLength(1);
      expect((datosCapturados[0] as { companyId: string }).companyId).toBe(COMPANY_ID_EMPRESA_A);
    });

    it('debería aceptar fila con todos los campos opcionales vacíos', async () => {
      // Arrange
      mockTransaccionExitosa(1);
      const fila = {
        tipo_contacto: 'NATURAL',
        nombre_legal: 'Pedro Ramírez',
        nombre_comercial: '',
        rtn: '',
        es_cliente: 'SI',
        es_proveedor: 'NO',
        email: '',
        telefono: '',
        sitio_web: '',
        notas: '',
        activo: '',
      };

      // Act
      const resultado = await servicio.importFromRows(COMPANY_ID_EMPRESA_A, [fila]);

      // Assert
      expect(resultado.successCount).toBe(1);
      expect(resultado.errorCount).toBe(0);
    });

    it('debería retornar totalRows=0 y no llamar a la transacción si el array está vacío', async () => {
      // Act
      const resultado = await servicio.importFromRows(COMPANY_ID_EMPRESA_A, []);

      // Assert
      expect(resultado.totalRows).toBe(0);
      expect(resultado.successCount).toBe(0);
      expect(resultado.errorCount).toBe(0);
      expect(resultado.duplicateCount).toBe(0);
      expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });
  });

  describe('errores de validación', () => {
    it('debería acumular error cuando tipo_contacto es inválido', async () => {
      // Arrange — sin transacción porque no hay filas válidas
      const fila = filaRawValida({ tipo_contacto: 'EMPRESA_SA' });

      // Act
      const resultado = await servicio.importFromRows(COMPANY_ID_EMPRESA_A, [fila]);

      // Assert
      expect(resultado.successCount).toBe(0);
      expect(resultado.errorCount).toBeGreaterThan(0);
      const errorTipo = resultado.errors.find((e) => e.field === 'tipo_contacto');
      expect(errorTipo).toBeDefined();
      expect(errorTipo?.message).toBeTruthy();
      expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });

    it('debería acumular error de refine cuando ni es_cliente ni es_proveedor son SI', async () => {
      // Arrange
      const fila = filaRawValida({ es_cliente: 'NO', es_proveedor: 'NO' });

      // Act
      const resultado = await servicio.importFromRows(COMPANY_ID_EMPRESA_A, [fila]);

      // Assert
      expect(resultado.errorCount).toBeGreaterThan(0);
      // El refine tiene path: ['es_cliente'], por lo que Zod lo coloca en
      // fieldErrors.es_cliente (no en formErrors). El servicio lo mapea como field='es_cliente'.
      // Si el path estuviera vacío, iría a formErrors y el servicio lo mapearía como
      // 'es_cliente/es_proveedor'. Verificamos que hay al menos un error relacionado.
      const tieneErrorClienteProveedor = resultado.errors.some(
        (e) => e.field === 'es_cliente' || e.field === 'es_cliente/es_proveedor',
      );
      expect(tieneErrorClienteProveedor).toBe(true);
      const mensajeError = resultado.errors.find(
        (e) => e.field === 'es_cliente' || e.field === 'es_cliente/es_proveedor',
      );
      expect(mensajeError?.message).toContain('al menos cliente o proveedor');
      expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });

    it('debería reportar el número de fila correcto comenzando desde 3', async () => {
      // Arrange — fila 1 del array → rowNum debe ser 3 (cabecera=1, ejemplo=2, datos=3+)
      const fila = filaRawValida({ tipo_contacto: 'INVALIDO' });

      // Act
      const resultado = await servicio.importFromRows(COMPANY_ID_EMPRESA_A, [fila]);

      // Assert
      expect(resultado.errors[0]?.row).toBe(3);
    });

    it('debería reportar fila 4 para el segundo elemento del array', async () => {
      // Arrange
      const filas = [
        filaRawValida(), // índice 0 → fila 3 (válida)
        filaRawValida({ tipo_contacto: 'INVALIDO' }), // índice 1 → fila 4 (error)
      ];
      mockTransaccionExitosa(1);

      // Act
      const resultado = await servicio.importFromRows(COMPANY_ID_EMPRESA_A, filas);

      // Assert
      expect(resultado.errors[0]?.row).toBe(4);
    });

    it('debería importar filas válidas aunque otras tengan errores (no abortar batch)', async () => {
      // Arrange — primera fila inválida, segunda válida
      mockTransaccionExitosa(1);
      const filas = [
        filaRawValida({ tipo_contacto: 'INVALIDO' }), // error
        filaRawValida({ rtn: '0801-1991-00002', nombre_legal: 'Empresa Válida' }), // ok
      ];

      // Act
      const resultado = await servicio.importFromRows(COMPANY_ID_EMPRESA_A, filas);

      // Assert
      expect(resultado.totalRows).toBe(2);
      expect(resultado.errorCount).toBe(1);
      expect(resultado.successCount).toBe(1);
    });
  });

  describe('duplicados', () => {
    it('debería detectar RTN duplicado contra RTNs existentes en la DB (pre-fetch)', async () => {
      // Arrange — simular que la empresa ya tiene el mismo RTN.
      // normalizeRtn('0801-1990-00001') produce '0801199000001' (13 dígitos).
      // La DB debe contener exactamente ese valor normalizado para que haya match.
      prismaMock.contact.findMany.mockResolvedValue([
        { rtn: '0801199000001' }, // normalizado: coincide con '0801-1990-00001'
      ]);
      const fila = filaRawValida({ rtn: '0801-1990-00001' }); // mismo RTN con guiones

      // Act
      const resultado = await servicio.importFromRows(COMPANY_ID_EMPRESA_A, [fila]);

      // Assert
      expect(resultado.duplicateCount).toBe(1);
      expect(resultado.successCount).toBe(0);
      expect(resultado.duplicates[0]?.row).toBe(3);
      expect(resultado.duplicates[0]?.legalName).toBe('Juan Pérez López');
      expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });

    it('debería detectar RTN duplicado dentro del propio archivo (segunda fila es duplicado)', async () => {
      // Arrange — DB vacía, pero el archivo tiene dos filas con el mismo RTN
      mockTransaccionExitosa(1);
      const filas = [
        filaRawValida({ rtn: '0801-1990-00001', nombre_legal: 'Primer Contacto' }),
        filaRawValida({ rtn: '0801-1990-00001', nombre_legal: 'Segundo Contacto (duplicado)' }),
      ];

      // Act
      const resultado = await servicio.importFromRows(COMPANY_ID_EMPRESA_A, filas);

      // Assert: primera se importa, segunda es duplicado
      expect(resultado.successCount).toBe(1);
      expect(resultado.duplicateCount).toBe(1);
      expect(resultado.duplicates[0]?.row).toBe(4); // segunda fila → índice 1 → fila 4
      expect(resultado.duplicates[0]?.legalName).toBe('Segundo Contacto (duplicado)');
    });

    it('debería permitir múltiples filas sin RTN (RTN vacío no se considera duplicado)', async () => {
      // Arrange — dos filas sin RTN
      mockTransaccionExitosa(2);
      const filas = [
        filaRawValida({ rtn: '', nombre_legal: 'Contacto Sin RTN 1' }),
        filaRawValida({ rtn: '', nombre_legal: 'Contacto Sin RTN 2' }),
      ];

      // Act
      const resultado = await servicio.importFromRows(COMPANY_ID_EMPRESA_A, filas);

      // Assert: ambas se importan, ninguna se detecta como duplicado
      expect(resultado.successCount).toBe(2);
      expect(resultado.duplicateCount).toBe(0);
    });

    it('debería pre-fetch de RTNs usando el companyId correcto (multi-tenant)', async () => {
      // Arrange
      prismaMock.contact.findMany.mockResolvedValue([]);

      // Act
      await servicio.importFromRows(COMPANY_ID_EMPRESA_A, [filaRawValida()]);

      // Assert: verificar que findMany filtra por el companyId del tenant activo
      expect(prismaMock.contact.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { companyId: COMPANY_ID_EMPRESA_A },
        }),
      );
    });
  });

  describe('normalización de valores de Excel', () => {
    it('debería normalizar campos numéricos a string (RTN como número de Excel)', async () => {
      // Arrange — Excel puede devolver el RTN como número; el servicio normaliza a string
      mockTransaccionExitosa(1);
      const fila = filaRawValida({
        // Simulamos que xlsx devolvió el RTN como número nativo
        rtn: 8011990000014, // número JavaScript — el servicio lo convierte con String()
      });

      // Act
      const resultado = await servicio.importFromRows(COMPANY_ID_EMPRESA_A, [fila]);

      // Assert: se importó correctamente (no falló por tipo)
      expect(resultado.successCount).toBe(1);
      expect(resultado.errorCount).toBe(0);
    });

    it('debería normalizar campo null de Excel a string vacío', async () => {
      // Arrange — xlsx puede devolver null para celdas vacías aunque se use defval: ''
      mockTransaccionExitosa(1);
      const fila = filaRawValida({ notas: null, telefono: null });

      // Act
      const resultado = await servicio.importFromRows(COMPANY_ID_EMPRESA_A, [fila]);

      // Assert
      expect(resultado.successCount).toBe(1);
    });
  });
});
