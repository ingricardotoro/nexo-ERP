import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { getAuthContextFromHeaders } from '@/lib/auth/request-auth';
import { contactImportService } from '@/lib/services/contacts/contact-import.service';
import { IMPORT_COLUMNS } from '@/lib/validations/contact-import.schema';
import { handleApiError } from '@/lib/api/handle-error';

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
const MAX_ROWS = 500;

// Magic bytes de un archivo OOXML (.xlsx): ZIP header PK\x03\x04
const XLSX_MAGIC = Buffer.from([0x50, 0x4b, 0x03, 0x04]);

/** POST /api/v1/contacts/import — importar contactos desde archivo .xlsx */
export async function POST(request: NextRequest) {
  try {
    const auth = getAuthContextFromHeaders(request);

    const formData = await request.formData();
    const file = formData.get('file');

    if (!file || typeof file === 'string') {
      return NextResponse.json(
        { success: false, error: 'Se requiere un archivo en el campo "file"' },
        { status: 400 },
      );
    }

    // Validar tipo MIME
    if (
      file.type !== 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' &&
      file.type !== 'application/octet-stream' &&
      !file.name.endsWith('.xlsx')
    ) {
      return NextResponse.json(
        { success: false, error: 'Solo se aceptan archivos .xlsx' },
        { status: 415 },
      );
    }

    // Validar tamaño
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { success: false, error: 'El archivo supera el límite de 5 MB' },
        { status: 413 },
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Validar magic bytes
    if (!buffer.slice(0, 4).equals(XLSX_MAGIC)) {
      return NextResponse.json(
        { success: false, error: 'El archivo no es un .xlsx válido' },
        { status: 415 },
      );
    }

    // Parsear Excel
    const wb = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = wb.SheetNames[0];

    if (!sheetName) {
      return NextResponse.json(
        { success: false, error: 'El archivo Excel no contiene hojas' },
        { status: 422 },
      );
    }

    const ws = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
      defval: '',
      raw: false, // todas las celdas como string para consistencia
    });

    // Validar columnas requeridas
    if (rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'El archivo no contiene filas de datos' },
        { status: 422 },
      );
    }

    const firstRow = rows[0];
    const missingColumns = IMPORT_COLUMNS.filter((col) => !(col in firstRow));
    if (missingColumns.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Columnas requeridas faltantes: ${missingColumns.join(', ')}. Usa el template oficial.`,
        },
        { status: 422 },
      );
    }

    // Validar límite de filas
    if (rows.length > MAX_ROWS) {
      return NextResponse.json(
        {
          success: false,
          error: `El archivo supera el límite de ${MAX_ROWS} filas. Divide el archivo en partes más pequeñas.`,
        },
        { status: 422 },
      );
    }

    const result = await contactImportService.importFromRows(auth.companyId, rows);

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return handleApiError(error, 'POST /api/v1/contacts/import');
  }
}
