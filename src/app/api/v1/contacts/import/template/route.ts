import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { handleApiError } from '@/lib/api/handle-error';

/** GET /api/v1/contacts/import/template — descarga el template Excel para importación masiva */
export async function GET() {
  try {
    const wb = XLSX.utils.book_new();

    // ── Hoja de datos ─────────────────────────────────────────────────────────
    const headers = [
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

    const exampleRow = [
      'NATURAL', // tipo_contacto
      'Juan Pérez López', // nombre_legal
      '', // nombre_comercial (opcional)
      '0801-1990-00001', // rtn (opcional)
      'SI', // es_cliente
      'NO', // es_proveedor
      'juan@email.com', // email (opcional)
      '2222-3333', // telefono (opcional)
      '', // sitio_web (opcional)
      '', // notas (opcional)
      'SI', // activo (default SI)
    ];

    const ws = XLSX.utils.aoa_to_sheet([headers, exampleRow]);

    // Formato texto en columna RTN (col 3, 0-indexed) para evitar que Excel
    // convierta el RTN a número eliminando ceros iniciales
    if (!ws['!cols']) ws['!cols'] = [];
    for (let i = 0; i < headers.length; i++) {
      ws['!cols'][i] = { wch: i === 1 ? 40 : i === 9 ? 50 : 20 };
    }

    // Ancho columna RTN
    ws['!cols'][3] = { wch: 22 };

    XLSX.utils.book_append_sheet(wb, ws, 'Contactos');

    // ── Hoja de instrucciones ─────────────────────────────────────────────────
    const instrucciones = [
      ['INSTRUCCIONES PARA IMPORTACIÓN DE CONTACTOS'],
      [''],
      ['1. NO modifiques los nombres de las columnas en la fila 1.'],
      ['2. La fila 2 es un ejemplo — puedes borrarla o reemplazarla con tus datos.'],
      ['3. Los datos deben comenzar en la fila 2 (o 3 si dejas el ejemplo).'],
      ['4. Máximo 500 contactos por archivo.'],
      [''],
      ['COLUMNAS REQUERIDAS:'],
      ['  tipo_contacto  → NATURAL (persona física) o JURIDICAL (empresa)'],
      ['  nombre_legal   → Nombre completo o razón social (2-255 caracteres)'],
      ['  es_cliente     → SI o NO'],
      ['  es_proveedor   → SI o NO (al menos uno debe ser SI)'],
      [''],
      ['COLUMNAS OPCIONALES:'],
      ['  nombre_comercial → Nombre comercial (solo empresas)'],
      ['  rtn              → Formato: DDDD-DDDD-DDDDD (ej: 0801-1990-00001)'],
      ['  email            → Correo electrónico válido'],
      ['  telefono         → Número de teléfono (máx 20 caracteres)'],
      ['  sitio_web        → URL con https:// (ej: https://empresa.hn)'],
      ['  notas            → Notas internas (máx 1000 caracteres)'],
      ['  activo           → SI o NO (default: SI si se deja vacío)'],
      [''],
      ['NOTAS IMPORTANTES:'],
      ['  - El RTN debe ser único por empresa. Duplicados serán omitidos.'],
      ['  - Formatea la columna RTN como TEXTO en Excel para evitar perder ceros iniciales.'],
      ['  - Si hay errores en una fila, esa fila se omite y las demás se importan.'],
    ];

    const wsInstrucciones = XLSX.utils.aoa_to_sheet(instrucciones);
    wsInstrucciones['!cols'] = [{ wch: 80 }];
    XLSX.utils.book_append_sheet(wb, wsInstrucciones, 'Instrucciones');

    // ── Generar buffer y respuesta ────────────────────────────────────────────
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="template-importacion-contactos.xlsx"',
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    return handleApiError(error, 'GET /api/v1/contacts/import/template');
  }
}
