// src/lib/services/invoicing/sar-numbering.service.ts
//
// SAR Honduras invoice numbering:
//   Format: PPP-PPP-TT-NNNNNNNN
//   PPP = establishment code (3 digits)
//   PPP = emission point code (3 digits)
//   TT  = document type (01=Factura, 03=NC, 04=ND)
//   NNNNNNNN = 8-digit zero-padded sequential number within CAI range
//
// Atomicity: uses INSERT ... ON CONFLICT DO UPDATE ... RETURNING
// (same pattern as JournalSequence) to avoid race conditions under
// serverless concurrent invocations.

import type { PrismaClient } from '@prisma/client';
import basePrisma from '@/lib/db/prisma';
import { createTenantPrisma } from '@/lib/db/tenant-extension';
import { caiService } from './cai.service';

export interface NextInvoiceNumber {
  invoiceNumber: string; // full SAR number e.g. "001-001-01-00000001"
  sequenceNumber: number; // raw correlativo (e.g. 1)
  caiId: string;
}

/**
 * Assigns the next sequential SAR invoice number for a given company and document type.
 *
 * Steps:
 *  1. Resolve the active, non-expired CAI with available range.
 *  2. Atomically increment the sequence counter using UPSERT.
 *  3. Build and return the formatted SAR number.
 *
 * @throws if no valid active CAI exists or the range is exhausted.
 */
export async function getNextInvoiceNumber(
  companyId: string,
  documentType: string,
): Promise<NextInvoiceNumber> {
  // 1. Validate active CAI (throws if invalid/expired/exhausted)
  const cai = await caiService.getActiveCai(companyId, documentType);

  // 2. Atomic UPSERT on invoice_sequences
  //    INSERT a new sequence row if none exists for this CAI,
  //    or UPDATE last_number += 1 atomically.
  //    Wrapped in $transaction with set_config because invoice_sequences
  //    has FORCE ROW LEVEL SECURITY — RLS requires app.current_company_id. (Bug fix: same pattern as invoice.service.ts)
  const [result] = await (basePrisma as PrismaClient).$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.current_company_id', ${companyId}, true)`;
    return tx.$queryRaw<Array<{ last_number: number }>>`
      INSERT INTO invoice_sequences (id, company_id, cai_id, last_number, updated_at)
      VALUES (
        gen_random_uuid(),
        ${companyId}::uuid,
        ${cai.id}::uuid,
        1,
        NOW()
      )
      ON CONFLICT (cai_id) DO UPDATE
        SET last_number = invoice_sequences.last_number + 1,
            updated_at  = NOW()
      RETURNING last_number
    `;
  });

  const sequenceNumber = Number(result.last_number);

  // Validate still within authorized range
  if (sequenceNumber > cai.rangeTo) {
    throw new Error(
      `El CAI ha agotado su rango de numeración (máx. ${cai.rangeTo}). Registre un nuevo CAI.`,
    );
  }

  // 3. Build SAR-formatted invoice number
  const invoiceNumber = buildInvoiceNumber(
    cai.establishmentCode,
    cai.emissionPointCode,
    documentType,
    sequenceNumber,
  );

  return { invoiceNumber, sequenceNumber, caiId: cai.id };
}

/**
 * Builds the SAR Honduras invoice number string.
 * Format: PPP-PPP-TT-NNNNNNNN
 */
export function buildInvoiceNumber(
  establishmentCode: string,
  emissionPointCode: string,
  documentType: string,
  sequenceNumber: number,
): string {
  const seq = String(sequenceNumber).padStart(8, '0');
  return `${establishmentCode}-${emissionPointCode}-${documentType}-${seq}`;
}

/**
 * Validates that an invoice number matches the expected SAR format.
 */
export function isValidInvoiceNumber(invoiceNumber: string): boolean {
  return /^\d{3}-\d{3}-\d{2}-\d{8}$/.test(invoiceNumber);
}

// Re-export createTenantPrisma for tests that need it
export { createTenantPrisma };
