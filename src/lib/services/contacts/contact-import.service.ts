import prisma from '@/lib/db/prisma';
import { normalizeRtn } from '@/lib/validations/contact.schema';
import {
  contactImportRowSchemaWithRefine,
  type ContactImportResult,
  type ImportDuplicate,
  type ImportRowError,
} from '@/lib/validations/contact-import.schema';

// ─── Raw row type coming from xlsx sheet_to_json ──────────────────────────────

type RawExcelRow = Record<string, unknown>;

// ─── ContactImportService ─────────────────────────────────────────────────────

export class ContactImportService {
  /**
   * Procesa un array de filas crudas del Excel e inserta los contactos válidos.
   * Estrategia: pre-fetch de RTNs existentes + createMany en transacción.
   * Filas con errores se acumulan en el resultado sin abortar las demás.
   *
   * @param companyId - Tenant activo extraído del JWT
   * @param rawRows   - Filas obtenidas con xlsx.utils.sheet_to_json (defval: '')
   * @returns ContactImportResult con conteos, errores y duplicados
   */
  async importFromRows(companyId: string, rawRows: RawExcelRow[]): Promise<ContactImportResult> {
    const errors: ImportRowError[] = [];
    const duplicates: ImportDuplicate[] = [];
    const importedIds: string[] = [];

    // Pre-fetch de todos los RTNs existentes del tenant para O(1) lookup
    const existingRtns = await prisma.contact.findMany({
      where: { companyId },
      select: { rtn: true },
    });
    const existingRtnSet = new Set(
      existingRtns.map((c) => normalizeRtn(c.rtn)).filter(Boolean) as string[],
    );

    // RTNs vistos en el propio archivo (para detectar duplicados dentro del batch)
    const seenRtnsInBatch = new Set<string>();

    type ContactCreateData = {
      companyId: string;
      contactType: 'NATURAL' | 'JURIDICAL';
      legalName: string;
      tradeName: string | null;
      rtn: string | null;
      isCustomer: boolean;
      isSupplier: boolean;
      email: string | undefined;
      phone: string | undefined;
      website: string | undefined;
      notes: string | undefined;
      isActive: boolean;
    };

    const validRows: ContactCreateData[] = [];

    for (let i = 0; i < rawRows.length; i++) {
      const rowNum = i + 3; // Fila 1 = cabecera, Fila 2 = ejemplo; datos desde fila 3
      const raw = rawRows[i];

      // Normalizar strings: Excel puede devolver números para celdas numéricas
      const normalized: Record<string, unknown> = {};
      for (const key of Object.keys(raw)) {
        const val = raw[key];
        normalized[key] = val === null || val === undefined ? '' : String(val);
      }

      const result = contactImportRowSchemaWithRefine.safeParse(normalized);

      if (!result.success) {
        const fieldErrors = result.error.flatten().fieldErrors;
        for (const [field, messages] of Object.entries(fieldErrors)) {
          errors.push({ row: rowNum, field, message: messages?.[0] ?? 'Valor inválido' });
        }
        // Errores de refine (raíz)
        const formErrors = result.error.flatten().formErrors;
        for (const msg of formErrors) {
          errors.push({ row: rowNum, field: 'es_cliente/es_proveedor', message: msg });
        }
        continue;
      }

      const parsed = result.data;
      const normalizedRtn = normalizeRtn(parsed.rtn ?? null);

      // Verificar duplicado: en DB o en el propio archivo
      if (normalizedRtn) {
        if (existingRtnSet.has(normalizedRtn) || seenRtnsInBatch.has(normalizedRtn)) {
          duplicates.push({
            row: rowNum,
            rtn: parsed.rtn ?? normalizedRtn,
            legalName: parsed.nombre_legal,
          });
          continue;
        }
        seenRtnsInBatch.add(normalizedRtn);
      }

      validRows.push({
        companyId,
        contactType: parsed.tipo_contacto,
        legalName: parsed.nombre_legal,
        tradeName: parsed.nombre_comercial || null,
        rtn: parsed.rtn ? (normalizedRtn ?? null) : null,
        isCustomer: parsed.es_cliente,
        isSupplier: parsed.es_proveedor,
        email: parsed.email,
        phone: parsed.telefono || undefined,
        website: parsed.sitio_web,
        notes: parsed.notas || undefined,
        isActive: parsed.activo,
      });
    }

    // Inserción en batch dentro de transacción
    if (validRows.length > 0) {
      await prisma.$transaction(async (tx) => {
        const created = await tx.contact.createManyAndReturn({
          data: validRows,
          skipDuplicates: false,
        });
        importedIds.push(...created.map((c) => c.id));
      });
    }

    return {
      totalRows: rawRows.length,
      successCount: importedIds.length,
      errorCount: errors.length,
      duplicateCount: duplicates.length,
      errors,
      duplicates,
      importedIds,
    };
  }
}

export const contactImportService = new ContactImportService();
