// prisma/seed/accounting-journals.ts
// Diarios contables por defecto para Honduras (NIIF para PYMES)
import type { PrismaClient } from '@prisma/client';

const DEFAULT_JOURNALS = [
  { code: 'DJ', name: 'Diario General', journalType: 'GENERAL' as const },
  { code: 'LV', name: 'Libro de Ventas', journalType: 'SALES' as const },
  { code: 'LC', name: 'Libro de Compras', journalType: 'PURCHASES' as const },
  { code: 'CA', name: 'Caja y Efectivo', journalType: 'CASH' as const },
  { code: 'BK', name: 'Diario de Bancos', journalType: 'BANK' as const },
  { code: 'NM', name: 'Nómina y Planillas', journalType: 'PAYROLL' as const },
  { code: 'AJ', name: 'Ajustes y Correcciones', journalType: 'ADJUSTMENT' as const },
] as const;

export async function seedAccountingJournals(
  companyId: string,
  prisma: PrismaClient,
): Promise<void> {
  for (const journal of DEFAULT_JOURNALS) {
    await prisma.journal.upsert({
      where: { companyId_code: { companyId, code: journal.code } },
      update: { name: journal.name },
      create: { companyId, ...journal, isActive: true },
    });
  }
  console.log(`✅ Diarios contables: ${DEFAULT_JOURNALS.length} creados para la empresa`);
}
