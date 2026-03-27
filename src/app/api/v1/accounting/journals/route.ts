// src/app/api/v1/accounting/journals/route.ts
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getAuthContextFromHeaders } from '@/lib/auth/request-auth';
import { journalService } from '@/lib/services/accounting/journal.service';
import { createJournalSchema } from '@/lib/validations/journal.schema';
import { handleApiError } from '@/lib/api/handle-error';

/** GET /api/v1/accounting/journals — lista diarios con conteo de asientos */
export async function GET(request: NextRequest) {
  try {
    const auth = getAuthContextFromHeaders(request);
    const journals = await journalService.listJournals(auth.companyId);
    return NextResponse.json({ success: true, data: journals });
  } catch (error) {
    return handleApiError(error, 'GET /api/v1/accounting/journals');
  }
}

/** POST /api/v1/accounting/journals — crea un nuevo diario */
export async function POST(request: NextRequest) {
  try {
    const auth = getAuthContextFromHeaders(request);
    const body = await request.json();
    const input = createJournalSchema.parse(body);
    const journal = await journalService.createJournal(auth.companyId, input);
    return NextResponse.json(
      { success: true, data: journal, message: 'Diario creado exitosamente' },
      { status: 201 },
    );
  } catch (error) {
    return handleApiError(error, 'POST /api/v1/accounting/journals');
  }
}
