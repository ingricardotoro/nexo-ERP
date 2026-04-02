// src/__tests__/unit/contact-import-schema.test.ts
/**
 * Tests unitarios del schema Zod de importación de contactos (F2-03).
 *
 * Cubre:
 * - Filas válidas (mínima y completa)
 * - Errores de campo: tipo_contacto, nombre_legal, es_cliente/es_proveedor
 * - Transformaciones: booleanFromExcel, activo, email vacío
 * - Validación RTN (con y sin guiones, inválido)
 * - Refinement de al menos cliente o proveedor
 * - Normalización de valores numéricos (RTN recibido como número desde Excel)
 *
 * Sin conexión a BD — solo lógica Zod.
 */

import { describe, expect, it } from 'vitest';

import {
  contactImportRowSchema,
  contactImportRowSchemaWithRefine,
} from '@/lib/validations/contact-import.schema';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Fila mínima válida: solo campos requeridos */
function filaMinima(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    tipo_contacto: 'NATURAL',
    nombre_legal: 'Juan Pérez López',
    nombre_comercial: '',
    rtn: '',
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

// ─── Tests del schema base (sin refine) ───────────────────────────────────────

describe('contactImportRowSchema — campos base', () => {
  describe('tipo_contacto', () => {
    it('debería aceptar NATURAL en minúsculas (normaliza a mayúsculas)', () => {
      const resultado = contactImportRowSchema.safeParse(filaMinima({ tipo_contacto: 'natural' }));
      expect(resultado.success).toBe(true);
      if (resultado.success) {
        expect(resultado.data.tipo_contacto).toBe('NATURAL');
      }
    });

    it('debería aceptar JURIDICAL en mayúsculas', () => {
      const resultado = contactImportRowSchema.safeParse(
        filaMinima({ tipo_contacto: 'JURIDICAL' }),
      );
      expect(resultado.success).toBe(true);
      if (resultado.success) {
        expect(resultado.data.tipo_contacto).toBe('JURIDICAL');
      }
    });

    it('debería rechazar tipo_contacto con valor inválido', () => {
      const resultado = contactImportRowSchema.safeParse(filaMinima({ tipo_contacto: 'EMPRESA' }));
      expect(resultado.success).toBe(false);
      if (!resultado.success) {
        const campos = resultado.error.flatten().fieldErrors;
        expect(campos).toHaveProperty('tipo_contacto');
      }
    });

    it('debería rechazar tipo_contacto vacío', () => {
      const resultado = contactImportRowSchema.safeParse(filaMinima({ tipo_contacto: '' }));
      expect(resultado.success).toBe(false);
    });
  });

  describe('nombre_legal', () => {
    it('debería aceptar nombre de 2 caracteres (mínimo exacto)', () => {
      const resultado = contactImportRowSchema.safeParse(filaMinima({ nombre_legal: 'AB' }));
      expect(resultado.success).toBe(true);
    });

    it('debería rechazar nombre_legal vacío', () => {
      const resultado = contactImportRowSchema.safeParse(filaMinima({ nombre_legal: '' }));
      expect(resultado.success).toBe(false);
      if (!resultado.success) {
        expect(resultado.error.flatten().fieldErrors).toHaveProperty('nombre_legal');
      }
    });

    it('debería rechazar nombre_legal de 1 carácter (mínimo es 2)', () => {
      const resultado = contactImportRowSchema.safeParse(filaMinima({ nombre_legal: 'A' }));
      expect(resultado.success).toBe(false);
      if (!resultado.success) {
        expect(resultado.error.flatten().fieldErrors).toHaveProperty('nombre_legal');
      }
    });

    it('debería recortar espacios en blanco del nombre_legal', () => {
      const resultado = contactImportRowSchema.safeParse(
        filaMinima({ nombre_legal: '  Empresa Demo  ' }),
      );
      expect(resultado.success).toBe(true);
      if (resultado.success) {
        expect(resultado.data.nombre_legal).toBe('Empresa Demo');
      }
    });
  });

  describe('booleanFromExcel — es_cliente y es_proveedor', () => {
    it('debería transformar SI → true', () => {
      const resultado = contactImportRowSchema.safeParse(filaMinima({ es_cliente: 'SI' }));
      expect(resultado.success).toBe(true);
      if (resultado.success) {
        expect(resultado.data.es_cliente).toBe(true);
      }
    });

    it('debería transformar NO → false', () => {
      const resultado = contactImportRowSchema.safeParse(
        filaMinima({ es_cliente: 'NO', es_proveedor: 'SI' }),
      );
      expect(resultado.success).toBe(true);
      if (resultado.success) {
        expect(resultado.data.es_cliente).toBe(false);
      }
    });

    it('debería transformar si en minúsculas (normaliza a mayúsculas)', () => {
      const resultado = contactImportRowSchema.safeParse(filaMinima({ es_proveedor: 'si' }));
      expect(resultado.success).toBe(true);
      if (resultado.success) {
        expect(resultado.data.es_proveedor).toBe(true);
      }
    });

    it('debería rechazar valor distinto a SI/NO (ej: VERDADERO)', () => {
      const resultado = contactImportRowSchema.safeParse(filaMinima({ es_cliente: 'VERDADERO' }));
      expect(resultado.success).toBe(false);
      if (!resultado.success) {
        expect(resultado.error.flatten().fieldErrors).toHaveProperty('es_cliente');
      }
    });
  });

  describe('RTN', () => {
    it('debería aceptar RTN válido con guiones (0801-1990-00001)', () => {
      const resultado = contactImportRowSchema.safeParse(filaMinima({ rtn: '0801-1990-00001' }));
      // Nota: RTN con guiones tiene 15 chars pero 13 dígitos — cae en rango 13-14
      expect(resultado.success).toBe(true);
    });

    it('debería aceptar RTN válido sin guiones (08011990000014)', () => {
      const resultado = contactImportRowSchema.safeParse(filaMinima({ rtn: '08011990000014' }));
      expect(resultado.success).toBe(true);
    });

    it('debería aceptar RTN vacío (nullable/optional)', () => {
      const resultado = contactImportRowSchema.safeParse(filaMinima({ rtn: '' }));
      expect(resultado.success).toBe(true);
    });

    it('debería rechazar RTN con formato inválido (letras o guiones incorrectos)', () => {
      const resultado = contactImportRowSchema.safeParse(filaMinima({ rtn: '123-abc' }));
      expect(resultado.success).toBe(false);
      if (!resultado.success) {
        expect(resultado.error.flatten().fieldErrors).toHaveProperty('rtn');
      }
    });

    it('debería rechazar RTN con demasiados dígitos (15 dígitos sin guiones)', () => {
      const resultado = contactImportRowSchema.safeParse(filaMinima({ rtn: '123456789012345' }));
      expect(resultado.success).toBe(false);
    });

    it('debería rechazar RTN con muy pocos dígitos (12 dígitos)', () => {
      const resultado = contactImportRowSchema.safeParse(filaMinima({ rtn: '123456789012' }));
      expect(resultado.success).toBe(false);
    });
  });

  describe('email', () => {
    it('debería aceptar email válido y normalizarlo a minúsculas', () => {
      const resultado = contactImportRowSchema.safeParse(filaMinima({ email: 'JUAN@EMPRESA.HN' }));
      expect(resultado.success).toBe(true);
      if (resultado.success) {
        expect(resultado.data.email).toBe('juan@empresa.hn');
      }
    });

    it('debería rechazar email inválido', () => {
      const resultado = contactImportRowSchema.safeParse(filaMinima({ email: 'correo-invalido' }));
      expect(resultado.success).toBe(false);
      if (!resultado.success) {
        expect(resultado.error.flatten().fieldErrors).toHaveProperty('email');
      }
    });

    it('debería transformar email vacío a undefined (campo opcional)', () => {
      const resultado = contactImportRowSchema.safeParse(filaMinima({ email: '' }));
      expect(resultado.success).toBe(true);
      if (resultado.success) {
        expect(resultado.data.email).toBeUndefined();
      }
    });
  });

  describe('sitio_web', () => {
    it('debería aceptar URL válida con https', () => {
      const resultado = contactImportRowSchema.safeParse(
        filaMinima({ sitio_web: 'https://empresa.hn' }),
      );
      expect(resultado.success).toBe(true);
      if (resultado.success) {
        expect(resultado.data.sitio_web).toBe('https://empresa.hn');
      }
    });

    it('debería rechazar URL inválida sin protocolo', () => {
      const resultado = contactImportRowSchema.safeParse(filaMinima({ sitio_web: 'empresa.hn' }));
      expect(resultado.success).toBe(false);
      if (!resultado.success) {
        expect(resultado.error.flatten().fieldErrors).toHaveProperty('sitio_web');
      }
    });

    it('debería transformar sitio_web vacío a undefined', () => {
      const resultado = contactImportRowSchema.safeParse(filaMinima({ sitio_web: '' }));
      expect(resultado.success).toBe(true);
      if (resultado.success) {
        expect(resultado.data.sitio_web).toBeUndefined();
      }
    });
  });

  describe('activo', () => {
    it('debería transformar activo vacío a true (valor por defecto)', () => {
      const resultado = contactImportRowSchema.safeParse(filaMinima({ activo: '' }));
      expect(resultado.success).toBe(true);
      if (resultado.success) {
        expect(resultado.data.activo).toBe(true);
      }
    });

    it('debería transformar activo=SI a true', () => {
      const resultado = contactImportRowSchema.safeParse(filaMinima({ activo: 'SI' }));
      expect(resultado.success).toBe(true);
      if (resultado.success) {
        expect(resultado.data.activo).toBe(true);
      }
    });

    it('debería transformar activo=NO a false', () => {
      const resultado = contactImportRowSchema.safeParse(filaMinima({ activo: 'NO' }));
      expect(resultado.success).toBe(true);
      if (resultado.success) {
        expect(resultado.data.activo).toBe(false);
      }
    });

    it('debería ignorar activo=undefined y asumir true', () => {
      const { activo: _activo, ...sinActivo } = filaMinima();
      const resultado = contactImportRowSchema.safeParse(sinActivo);
      expect(resultado.success).toBe(true);
      if (resultado.success) {
        expect(resultado.data.activo).toBe(true);
      }
    });
  });

  describe('campos opcionales — nombre_comercial, telefono, notas', () => {
    it('debería aceptar nombre_comercial vacío', () => {
      const resultado = contactImportRowSchema.safeParse(filaMinima({ nombre_comercial: '' }));
      expect(resultado.success).toBe(true);
    });

    it('debería aceptar telefono hasta 20 caracteres', () => {
      const resultado = contactImportRowSchema.safeParse(
        filaMinima({ telefono: '2222-3333 ext 100' }),
      );
      expect(resultado.success).toBe(true);
    });

    it('debería rechazar notas que superen 1000 caracteres', () => {
      const resultado = contactImportRowSchema.safeParse(filaMinima({ notas: 'A'.repeat(1001) }));
      expect(resultado.success).toBe(false);
      if (!resultado.success) {
        expect(resultado.error.flatten().fieldErrors).toHaveProperty('notas');
      }
    });
  });
});

// ─── Tests del schema con refine ──────────────────────────────────────────────

describe('contactImportRowSchemaWithRefine — validación cliente/proveedor', () => {
  it('debería aceptar fila donde es_cliente=SI y es_proveedor=NO', () => {
    const resultado = contactImportRowSchemaWithRefine.safeParse(
      filaMinima({ es_cliente: 'SI', es_proveedor: 'NO' }),
    );
    expect(resultado.success).toBe(true);
  });

  it('debería aceptar fila donde es_cliente=NO y es_proveedor=SI', () => {
    const resultado = contactImportRowSchemaWithRefine.safeParse(
      filaMinima({ es_cliente: 'NO', es_proveedor: 'SI' }),
    );
    expect(resultado.success).toBe(true);
  });

  it('debería aceptar fila donde ambos son SI (cliente y proveedor)', () => {
    const resultado = contactImportRowSchemaWithRefine.safeParse(
      filaMinima({ es_cliente: 'SI', es_proveedor: 'SI' }),
    );
    expect(resultado.success).toBe(true);
    if (resultado.success) {
      expect(resultado.data.es_cliente).toBe(true);
      expect(resultado.data.es_proveedor).toBe(true);
    }
  });

  it('debería rechazar fila donde es_cliente=NO y es_proveedor=NO (refine)', () => {
    const resultado = contactImportRowSchemaWithRefine.safeParse(
      filaMinima({ es_cliente: 'NO', es_proveedor: 'NO' }),
    );
    expect(resultado.success).toBe(false);
    if (!resultado.success) {
      // El error de refine se reporta en path ['es_cliente'] según la definición del schema
      const todasLasIssues = resultado.error.issues;
      const tieneErrorRefine = todasLasIssues.some((issue) =>
        issue.message.includes('al menos cliente o proveedor'),
      );
      expect(tieneErrorRefine).toBe(true);
    }
  });

  it('debería parsear fila mínima válida completamente', () => {
    const resultado = contactImportRowSchemaWithRefine.safeParse(filaMinima());
    expect(resultado.success).toBe(true);
    if (resultado.success) {
      expect(resultado.data.tipo_contacto).toBe('NATURAL');
      expect(resultado.data.nombre_legal).toBe('Juan Pérez López');
      expect(resultado.data.es_cliente).toBe(true);
      expect(resultado.data.es_proveedor).toBe(false);
      expect(resultado.data.activo).toBe(true);
      expect(resultado.data.email).toBeUndefined();
      expect(resultado.data.sitio_web).toBeUndefined();
    }
  });

  it('debería parsear fila con todos los campos opcionales completos', () => {
    const resultado = contactImportRowSchemaWithRefine.safeParse(
      filaMinima({
        tipo_contacto: 'JURIDICAL',
        nombre_legal: 'Distribuidora Centroamericana S.A. de C.V.',
        nombre_comercial: 'DistriCentro',
        rtn: '0801-1990-00001',
        es_cliente: 'SI',
        es_proveedor: 'SI',
        email: 'info@distrocentro.hn',
        telefono: '2222-3333',
        sitio_web: 'https://distrocentro.hn',
        notas: 'Proveedor estratégico de hardware de oficina',
        activo: 'SI',
      }),
    );
    expect(resultado.success).toBe(true);
    if (resultado.success) {
      expect(resultado.data.tipo_contacto).toBe('JURIDICAL');
      expect(resultado.data.nombre_comercial).toBe('DistriCentro');
      expect(resultado.data.email).toBe('info@distrocentro.hn');
      expect(resultado.data.sitio_web).toBe('https://distrocentro.hn');
      expect(resultado.data.activo).toBe(true);
    }
  });

  describe('normalización de RTN numérico desde Excel', () => {
    it('debería aceptar RTN representado como string numérico sin guiones', () => {
      // Excel puede serializar 08011990000014 como número y el servicio lo convierte
      // a string antes de parsear. El schema recibe el string normalizado.
      const resultado = contactImportRowSchemaWithRefine.safeParse(
        filaMinima({ rtn: '08011990000014' }),
      );
      expect(resultado.success).toBe(true);
    });

    it('debería rechazar RTN que era número con menos de 13 dígitos significativos', () => {
      // Si Excel elimina ceros iniciales (ej: 801199000001 → 12 dígitos), el RTN es inválido
      const resultado = contactImportRowSchemaWithRefine.safeParse(
        filaMinima({ rtn: '801199000001' }),
      );
      expect(resultado.success).toBe(false);
    });
  });
});
