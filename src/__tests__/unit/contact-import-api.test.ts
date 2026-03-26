// src/__tests__/unit/contact-import-api.test.ts
/**
 * Tests unitarios del endpoint POST /api/v1/contacts/import (F2-03).
 *
 * Estrategia de construcción de requests:
 *   El ambiente jsdom/Node corrompe los bytes de archivos binarios cuando
 *   se serializa FormData como multipart en NextRequest({ body: formData }).
 *   Para preservar los bytes del xlsx, se mockea request.formData() directamente
 *   con vi.fn() que devuelve un FormData prearmado con el File correcto.
 *   Esto refleja exactamente lo que el runtime de Next.js vería en producción.
 *
 * Casos cubiertos:
 *   - 400: sin campo file / campo file es string
 *   - 415: MIME incorrecto, magic bytes incorrectos
 *   - 413: archivo > 5 MB
 *   - 422: columnas faltantes, > 500 filas
 *   - 200: archivo válido → delega al servicio y retorna resultado
 *   - Auth: error de auth context propagado
 */

import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as XLSX from 'xlsx';

// ─── Mocks (vi.hoisted para que estén disponibles en factories) ───────────────

const { importServiceMock, getAuthContextMock } = vi.hoisted(() => ({
  importServiceMock: {
    importFromRows: vi.fn(),
  },
  getAuthContextMock: vi.fn(),
}));

vi.mock('@/lib/services/contacts/contact-import.service', () => ({
  contactImportService: importServiceMock,
}));

vi.mock('@/lib/auth/request-auth', () => ({
  getAuthContextFromHeaders: getAuthContextMock,
}));

// ─── Import del handler (después de los mocks) ────────────────────────────────

import { POST } from '@/app/api/v1/contacts/import/route';

// ─── Constantes ───────────────────────────────────────────────────────────────

const COMPANY_ID = '00000000-0000-0000-0000-000000000001';
const MIME_XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Contexto de autenticación ficticio estándar */
function authContextFicticio() {
  return {
    userId: 'user-admin-001',
    companyId: COMPANY_ID,
    role: 'ADMIN' as const,
    email: 'admin@empresa-a.hn',
    fullName: 'Admin Empresa A',
    tokenUse: 'id' as const,
    claims: {},
  };
}

/**
 * Construye un workbook XLSX válido en memoria.
 * Retorna un Buffer de Node (los bytes se preservan correctamente).
 */
function construirXlsxBuffer(opciones: {
  columnas?: string[];
  filas?: string[][];
  cantidadFilas?: number;
}): Buffer {
  const { columnas, filas, cantidadFilas } = opciones;
  const wb = XLSX.utils.book_new();
  const cabeceras = columnas ?? ['tipo_contacto', 'nombre_legal', 'es_cliente', 'es_proveedor'];
  let datosHoja: string[][];

  if (cantidadFilas !== undefined) {
    // Generar N filas de datos
    datosHoja = [
      cabeceras,
      ...Array.from({ length: cantidadFilas }, (_, i) => [
        'NATURAL',
        `Contacto ${String(i + 1).padStart(3, '0')}`,
        'SI',
        'NO',
      ]),
    ];
  } else {
    datosHoja = [cabeceras, ...(filas ?? [['NATURAL', 'Juan Pérez', 'SI', 'NO']])];
  }

  const ws = XLSX.utils.aoa_to_sheet(datosHoja);
  XLSX.utils.book_append_sheet(wb, ws, 'Contactos');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

/**
 * Construye un NextRequest donde request.formData() está mockeado para devolver
 * un FormData con el File indicado. Esto evita la corrupción de bytes binarios
 * que ocurre en jsdom al serializar multipart/form-data en NextRequest({ body }).
 */
function crearRequestConFile(file: File | string | null): NextRequest {
  const req = new NextRequest('http://localhost:3000/api/v1/contacts/import', {
    method: 'POST',
  });
  const fd = new FormData();
  if (file !== null) {
    fd.set('file', file);
  }
  // Mock de formData() para devolver el FormData directamente
  req.formData = vi.fn().mockResolvedValue(fd);
  return req;
}

/**
 * Crea un File con un tamaño sobreescrito para simular archivos grandes
 * sin necesitar crear un buffer de 5MB en memoria.
 */
function crearFileConTamanoFicticio(tamanoBytes: number): File {
  const buf = construirXlsxBuffer({});
  const file = new File([new Uint8Array(buf)], 'grande.xlsx', { type: MIME_XLSX });
  return Object.defineProperty(file, 'size', { get: () => tamanoBytes }) as File;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('POST /api/v1/contacts/import', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAuthContextMock.mockReturnValue(authContextFicticio());
  });

  describe('validaciones de request — rechazo temprano', () => {
    it('debería retornar 400 cuando no se envía campo file en el FormData', async () => {
      // Arrange — FormData vacío, sin campo 'file'
      const req = new NextRequest('http://localhost:3000/api/v1/contacts/import', {
        method: 'POST',
      });
      const fdVacio = new FormData(); // sin campo file
      req.formData = vi.fn().mockResolvedValue(fdVacio);

      // Act
      const response = await POST(req);
      const body = await response.json();

      // Assert
      expect(response.status).toBe(400);
      expect(body.success).toBe(false);
      expect(body.error).toContain('archivo');
    });

    it('debería retornar 400 cuando el campo file es un string (no un File)', async () => {
      // Arrange — campo file con valor string
      const req = crearRequestConFile('esto-es-un-string-no-un-archivo');

      // Act
      const response = await POST(req);
      const body = await response.json();

      // Assert
      expect(response.status).toBe(400);
      expect(body.success).toBe(false);
    });

    it('debería retornar 415 cuando el tipo MIME es de un CSV', async () => {
      // Arrange — File con MIME de CSV
      const contenidoCsv = new TextEncoder().encode('tipo_contacto,nombre_legal\nNATURAL,Juan');
      const fileCsv = new File([contenidoCsv], 'contactos.csv', { type: 'text/csv' });
      const req = crearRequestConFile(fileCsv);

      // Act
      const response = await POST(req);
      const body = await response.json();

      // Assert
      expect(response.status).toBe(415);
      expect(body.success).toBe(false);
      expect(body.error).toContain('.xlsx');
    });

    it('debería retornar 413 cuando el archivo supera 5 MB', async () => {
      // Arrange — File con size sobreescrito para superar el límite
      const fileFicticio = crearFileConTamanoFicticio(5 * 1024 * 1024 + 1);
      const req = crearRequestConFile(fileFicticio);

      // Act
      const response = await POST(req);
      const body = await response.json();

      // Assert
      expect(response.status).toBe(413);
      expect(body.success).toBe(false);
      expect(body.error).toContain('5 MB');
    });

    it('debería retornar 415 cuando los magic bytes no corresponden a un xlsx', async () => {
      // Arrange — archivo con bytes arbitrarios (no empieza con PK\x03\x04)
      const bytesInvalidos = new Uint8Array([0x00, 0x01, 0x02, 0x03, 0x41, 0x42, 0x43]);
      const fileInvalido = new File([bytesInvalidos], 'falso.xlsx', { type: MIME_XLSX });
      const req = crearRequestConFile(fileInvalido);

      // Act
      const response = await POST(req);
      const body = await response.json();

      // Assert
      expect(response.status).toBe(415);
      expect(body.success).toBe(false);
      expect(body.error).toContain('.xlsx válido');
    });

    it('debería retornar 422 cuando faltan columnas requeridas en el xlsx', async () => {
      // Arrange — xlsx con columnas incorrectas (sin tipo_contacto, es_cliente, etc.)
      const buf = construirXlsxBuffer({ columnas: ['columna_rara', 'otra_columna'] });
      const file = new File([new Uint8Array(buf)], 'contactos.xlsx', { type: MIME_XLSX });
      const req = crearRequestConFile(file);

      // Act
      const response = await POST(req);
      const body = await response.json();

      // Assert
      expect(response.status).toBe(422);
      expect(body.success).toBe(false);
      expect(body.error).toContain('Columnas requeridas faltantes');
    });

    it('debería retornar 422 cuando el archivo tiene más de 500 filas', async () => {
      // Arrange — xlsx con 501 filas de datos
      const buf = construirXlsxBuffer({ cantidadFilas: 501 });
      const file = new File([new Uint8Array(buf)], 'contactos.xlsx', { type: MIME_XLSX });
      const req = crearRequestConFile(file);

      // Act
      const response = await POST(req);
      const body = await response.json();

      // Assert
      expect(response.status).toBe(422);
      expect(body.success).toBe(false);
      expect(body.error).toContain('500 filas');
    });
  });

  describe('flujo exitoso — delega al servicio', () => {
    it('debería retornar 200 con el resultado del servicio para archivo válido', async () => {
      // Arrange
      const resultadoServicio = {
        totalRows: 2,
        successCount: 2,
        errorCount: 0,
        duplicateCount: 0,
        errors: [],
        duplicates: [],
        importedIds: ['id-001', 'id-002'],
      };
      importServiceMock.importFromRows.mockResolvedValue(resultadoServicio);

      const buf = construirXlsxBuffer({
        filas: [
          ['NATURAL', 'Ana López', 'SI', 'NO'],
          ['JURIDICAL', 'TechHonduras S.A.', 'SI', 'SI'],
        ],
      });
      const file = new File([new Uint8Array(buf)], 'contactos.xlsx', { type: MIME_XLSX });
      const req = crearRequestConFile(file);

      // Act
      const response = await POST(req);
      const body = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data).toEqual(resultadoServicio);
    });

    it('debería llamar al servicio con el companyId del auth context (multi-tenant)', async () => {
      // Arrange
      importServiceMock.importFromRows.mockResolvedValue({
        totalRows: 1,
        successCount: 1,
        errorCount: 0,
        duplicateCount: 0,
        errors: [],
        duplicates: [],
        importedIds: ['id-001'],
      });

      const buf = construirXlsxBuffer({});
      const file = new File([new Uint8Array(buf)], 'contactos.xlsx', { type: MIME_XLSX });
      const req = crearRequestConFile(file);

      // Act
      await POST(req);

      // Assert: el servicio recibe el companyId correcto del JWT (no hardcoded)
      expect(importServiceMock.importFromRows).toHaveBeenCalledWith(COMPANY_ID, expect.any(Array));
    });

    it('debería retornar 200 incluso cuando el resultado tiene errores de fila (resultado parcial)', async () => {
      // Arrange — importación parcial: 2 éxitos, 1 error
      const resultadoParcial = {
        totalRows: 3,
        successCount: 2,
        errorCount: 1,
        duplicateCount: 0,
        errors: [{ row: 5, field: 'tipo_contacto', message: 'Debe ser NATURAL o JURIDICAL' }],
        duplicates: [],
        importedIds: ['id-001', 'id-002'],
      };
      importServiceMock.importFromRows.mockResolvedValue(resultadoParcial);

      const buf = construirXlsxBuffer({});
      const file = new File([new Uint8Array(buf)], 'contactos.xlsx', { type: MIME_XLSX });
      const req = crearRequestConFile(file);

      // Act
      const response = await POST(req);
      const body = await response.json();

      // Assert: siempre HTTP 200 — el cliente inspecciona errorCount
      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data.errorCount).toBe(1);
      expect(body.data.successCount).toBe(2);
      expect(body.data.errors).toHaveLength(1);
    });

    it('debería retornar 200 con resultado de 0 éxitos cuando todas las filas tienen errores', async () => {
      // Arrange
      const resultadoSinExitos = {
        totalRows: 2,
        successCount: 0,
        errorCount: 2,
        duplicateCount: 0,
        errors: [
          { row: 3, field: 'tipo_contacto', message: 'Debe ser NATURAL o JURIDICAL' },
          {
            row: 4,
            field: 'nombre_legal',
            message: 'El nombre/razón social debe tener al menos 2 caracteres',
          },
        ],
        duplicates: [],
        importedIds: [],
      };
      importServiceMock.importFromRows.mockResolvedValue(resultadoSinExitos);

      const buf = construirXlsxBuffer({});
      const file = new File([new Uint8Array(buf)], 'contactos.xlsx', { type: MIME_XLSX });
      const req = crearRequestConFile(file);

      // Act
      const response = await POST(req);
      const body = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(body.data.successCount).toBe(0);
      expect(body.data.errorCount).toBe(2);
    });
  });

  describe('manejo de errores de autenticación', () => {
    it('debería retornar error cuando el auth context lanza AuthError (sin headers de tenant)', async () => {
      // Arrange — simular que el middleware no inyectó headers de autenticación
      const { AuthError } = await import('@/types/auth');
      getAuthContextMock.mockImplementation(() => {
        throw new AuthError(
          'Contexto de autenticación ausente. Verifica middleware y token JWT.',
          401,
          'AUTH_CONTEXT_MISSING',
        );
      });

      const buf = construirXlsxBuffer({});
      const file = new File([new Uint8Array(buf)], 'contactos.xlsx', { type: MIME_XLSX });
      const req = crearRequestConFile(file);

      // Act
      const response = await POST(req);
      const body = await response.json();

      // Assert — handleApiError maneja el AuthError
      expect(response.status).toBeGreaterThanOrEqual(400);
      expect(body.success).toBe(false);
    });
  });
});
