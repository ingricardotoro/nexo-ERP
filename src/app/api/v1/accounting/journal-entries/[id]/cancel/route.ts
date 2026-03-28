// src/app/api/v1/accounting/journal-entries/[id]/cancel/route.ts
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getAuthContextFromHeaders } from '@/lib/auth/request-auth';
import { journalEntryService } from '@/lib/services/accounting/journal-entry.service';
import { handleApiError } from '@/lib/api/handle-error';

/** POST /api/v1/accounting/journal-entries/:id/cancel — anula un asiento POSTED con contraasiento */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = getAuthContextFromHeaders(request);
    const { id } = await params;
    const reversal = await journalEntryService.cancelEntry(auth.companyId, id, auth.userId);
    return NextResponse.json({
      success: true,
      data: reversal,
      message: `Asiento anulado. Contraasiento #${reversal.entryNumber} generado`,
    });
  } catch (error) {
    return handleApiError(error, 'POST /api/v1/accounting/journal-entries/[id]/cancel');
  }
}
