// src/__tests__/unit/contact-import-template.test.ts
/**
 * Tests unitarios del endpoint GET /api/v1/contacts/import/template (F2-03).
 *
 * Verifican:
 * - Content-Type correcto para OOXML (.xlsx)
 * - Header Content-Disposition con filename esperado
 * - Cache-Control: no-store
 * - Buffer de respuesta no vacío (workbook generado)
 * - Estructura del workbook: dos hojas, columnas correctas, fila de ejemplo
 *
 * El handler usa SheetJS (xlsx) en memoria — no requiere BD ni auth.
 */

import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';

import { GET } from '@/app/api/v1/contacts/import/template/route';

const MIME_XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const MAGIC_BYTES_ZIP = [0x50, 0x4b, 0x03, 0x04]; // PK\x03\x04

describe('GET /api/v1/contacts/import/template', () => {
  describe('headers de la respuesta', () => {
    it('debería retornar Content-Type application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', async () => {
      // Act
      const response = await GET();

      // Assert
      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe(MIME_XLSX);
    });

    it('debería incluir Content-Disposition con filename del template', async () => {
      // Act
      const response = await GET();
      const disposicion = response.headers.get('Content-Disposition');

      // Assert
      expect(disposicion).toBeTruthy();
      expect(disposicion).toContain('attachment');
      expect(disposicion).toContain('filename');
      expect(disposicion).toContain('template-importacion-contactos.xlsx');
    });

    it('debería incluir Cache-Control: no-store para evitar cacheo del template', async () => {
      // Act
      const response = await GET();

      // Assert
      expect(response.headers.get('Cache-Control')).toBe('no-store');
    });
  });

  describe('validación del buffer XLSX generado', () => {
    it('debería retornar un buffer no vacío', async () => {
      // Act
      const response = await GET();
      const buffer = await response.arrayBuffer();

      // Assert
      expect(buffer.byteLength).toBeGreaterThan(0);
    });

    it('debería retornar un archivo que comienza con magic bytes XLSX (ZIP PK header)', async () => {
      // Act
      const response = await GET();
      const buffer = await response.arrayBuffer();
      const bytes = new Uint8Array(buffer);

      // Assert — los primeros 4 bytes deben ser PK\x03\x04
      expect(bytes[0]).toBe(MAGIC_BYTES_ZIP[0]); // 0x50 = 'P'
      expect(bytes[1]).toBe(MAGIC_BYTES_ZIP[1]); // 0x4B = 'K'
      expect(bytes[2]).toBe(MAGIC_BYTES_ZIP[2]); // 0x03
      expect(bytes[3]).toBe(MAGIC_BYTES_ZIP[3]); // 0x04
    });

    it('debería generar un workbook parseable con SheetJS', async () => {
      // Act
      const response = await GET();
      const buffer = await response.arrayBuffer();

      // Assert — XLSX.read no debe lanzar
      let wb: XLSX.WorkBook;
      expect(() => {
        wb = XLSX.read(new Uint8Array(buffer), { type: 'array' });
      }).not.toThrow();

      // Verificar que el workbook tiene hojas
      expect(wb!.SheetNames.length).toBeGreaterThan(0);
    });
  });

  describe('estructura del workbook', () => {
    async function obtenerWorkbook(): Promise<XLSX.WorkBook> {
      const response = await GET();
      const buffer = await response.arrayBuffer();
      return XLSX.read(new Uint8Array(buffer), { type: 'array' });
    }

    it('debería tener exactamente 2 hojas: Contactos e Instrucciones', async () => {
      const wb = await obtenerWorkbook();
      expect(wb.SheetNames).toHaveLength(2);
      expect(wb.SheetNames[0]).toBe('Contactos');
      expect(wb.SheetNames[1]).toBe('Instrucciones');
    });

    it('debería tener la hoja Contactos con las columnas requeridas en la cabecera', async () => {
      const wb = await obtenerWorkbook();
      const ws = wb.Sheets['Contactos'];
      expect(ws).toBeDefined();

      // Parsear hoja como array de arrays para inspeccionar fila 1 (cabeceras)
      const datos = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1 });
      const cabeceras = datos[0] as string[];

      // Columnas requeridas definidas en IMPORT_COLUMNS
      expect(cabeceras).toContain('tipo_contacto');
      expect(cabeceras).toContain('nombre_legal');
      expect(cabeceras).toContain('es_cliente');
      expect(cabeceras).toContain('es_proveedor');
    });

    it('debería tener la hoja Contactos con todas las columnas del schema (incluyendo opcionales)', async () => {
      const wb = await obtenerWorkbook();
      const ws = wb.Sheets['Contactos'];
      const datos = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1 });
      const cabeceras = datos[0] as string[];

      const columnasEsperadas = [
        'tipo_contacto',
        'nombre_legal',
        'nombre_comercial',
        'rtn',
        'es_cliente',
        'es_proveedor',
        'email',
        'telefono',
        'sitio_web',
        'notas',
        'activo',
      ];
      columnasEsperadas.forEach((col) => {
        expect(cabeceras).toContain(col);
      });
    });

    it('debería tener una fila de ejemplo en la hoja Contactos', async () => {
      const wb = await obtenerWorkbook();
      const ws = wb.Sheets['Contactos'];
      const datos = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1 });

      // Fila 1 = cabeceras, fila 2 = ejemplo → debe haber al menos 2 filas
      expect(datos.length).toBeGreaterThanOrEqual(2);

      const filaEjemplo = datos[1] as string[];
      // La fila de ejemplo no debe estar completamente vacía
      const tieneContenido = filaEjemplo.some((celda) => celda !== '' && celda !== undefined);
      expect(tieneContenido).toBe(true);
    });

    it('debería tener la fila de ejemplo con tipo_contacto NATURAL', async () => {
      const wb = await obtenerWorkbook();
      const ws = wb.Sheets['Contactos'];
      const datos = XLSX.utils.sheet_to_json<Record<string, string>>(ws);

      // La primera fila de datos (índice 0 tras omitir cabeceras) es el ejemplo
      expect(datos[0]).toBeDefined();
      expect(datos[0]!['tipo_contacto']).toBe('NATURAL');
    });

    it('debería tener la fila de ejemplo con es_cliente=SI', async () => {
      const wb = await obtenerWorkbook();
      const ws = wb.Sheets['Contactos'];
      const datos = XLSX.utils.sheet_to_json<Record<string, string>>(ws);

      expect(datos[0]!['es_cliente']).toBe('SI');
    });

    it('debería tener la hoja Instrucciones con contenido no vacío', async () => {
      const wb = await obtenerWorkbook();
      const ws = wb.Sheets['Instrucciones'];
      expect(ws).toBeDefined();

      const datos = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1 });
      expect(datos.length).toBeGreaterThan(0);

      // La primera celda debe tener texto de instrucciones
      const primeraCelda = (datos[0] as string[])[0];
      expect(typeof primeraCelda).toBe('string');
      expect(primeraCelda.length).toBeGreaterThan(5);
    });
  });

  describe('idempotencia — múltiples llamadas generan resultados consistentes', () => {
    it('debería generar el mismo Content-Type en llamadas sucesivas', async () => {
      // Act
      const respuesta1 = await GET();
      const respuesta2 = await GET();

      // Assert
      expect(respuesta1.headers.get('Content-Type')).toBe(respuesta2.headers.get('Content-Type'));
    });

    it('debería generar workbooks de tamaño similar en llamadas sucesivas', async () => {
      // Act
      const respuesta1 = await GET();
      const respuesta2 = await GET();
      const buffer1 = await respuesta1.arrayBuffer();
      const buffer2 = await respuesta2.arrayBuffer();

      // Assert — mismo tamaño (contenido determinístico)
      expect(Math.abs(buffer1.byteLength - buffer2.byteLength)).toBeLessThan(100);
    });
  });
});
