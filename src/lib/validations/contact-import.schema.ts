import { z } from 'zod';
import { rtnSchema } from './contact.schema';

// ─── Columnas esperadas en el Excel (orden definido por el template) ──────────

export const IMPORT_COLUMNS = [
  'tipo_contacto',
  'nombre_legal',
  'es_cliente',
  'es_proveedor',
] as const;

// Coerce "SI"/"NO" a boolean
const booleanFromExcel = z
  .string()
  .trim()
  .toUpperCase()
  .pipe(z.enum(['SI', 'NO']))
  .transform((v) => v === 'SI');

// ─── Schema de una fila del Excel ─────────────────────────────────────────────

export const contactImportRowSchema = z.object({
  tipo_contacto: z
    .string()
    .trim()
    .toUpperCase()
    .pipe(z.enum(['NATURAL', 'JURIDICAL'], { message: 'Debe ser NATURAL o JURIDICAL' })),
  nombre_legal: z
    .string()
    .trim()
    .min(2, 'El nombre/razón social debe tener al menos 2 caracteres')
    .max(255),
  nombre_comercial: z.string().trim().max(255).optional().or(z.literal('')),
  rtn: rtnSchema,
  es_cliente: booleanFromExcel,
  es_proveedor: booleanFromExcel,
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email('Email inválido')
    .optional()
    .or(z.literal(''))
    .transform((v) => (v === '' ? undefined : v)),
  telefono: z.string().trim().max(20).optional().or(z.literal('')),
  sitio_web: z
    .string()
    .trim()
    .url('URL inválida')
    .optional()
    .or(z.literal(''))
    .transform((v) => (v === '' ? undefined : v)),
  notas: z.string().trim().max(1000).optional().or(z.literal('')),
  activo: z
    .string()
    .trim()
    .toUpperCase()
    .optional()
    .transform((v) => (v === undefined || v === '' ? true : v === 'SI')),
});

// ─── Refinement: debe ser al menos cliente o proveedor ────────────────────────

export const contactImportRowSchemaWithRefine = contactImportRowSchema.refine(
  (data) => data.es_cliente || data.es_proveedor,
  { message: 'El contacto debe ser al menos cliente o proveedor', path: ['es_cliente'] },
);

export type ContactImportRowInput = z.input<typeof contactImportRowSchema>;
export type ContactImportRowParsed = z.output<typeof contactImportRowSchemaWithRefine>;

// ─── Resultado de la importación ──────────────────────────────────────────────

export interface ImportRowError {
  row: number;
  field: string;
  message: string;
}

export interface ImportDuplicate {
  row: number;
  rtn: string;
  legalName: string;
}

export interface ContactImportResult {
  totalRows: number;
  successCount: number;
  errorCount: number;
  duplicateCount: number;
  errors: ImportRowError[];
  duplicates: ImportDuplicate[];
  importedIds: string[];
}
