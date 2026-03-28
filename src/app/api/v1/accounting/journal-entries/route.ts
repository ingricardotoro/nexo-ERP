// src/app/api/v1/accounting/journal-entries/route.ts
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getAuthContextFromHeaders } from '@/lib/auth/request-auth';
import { journalEntryService } from '@/lib/services/accounting/journal-entry.service';
import {
  createJournalEntrySchema,
  journalEntryFiltersSchema,
} from '@/lib/validations/journal-entry.schema';
import { handleApiError } from '@/lib/api/handle-error';

/** GET /api/v1/accounting/journal-entries — lista asientos con filtros y paginación */
export async function GET(request: NextRequest) {
  try {
    const auth = getAuthContextFromHeaders(request);
    const p = request.nextUrl.searchParams;

    const filters = journalEntryFiltersSchema.parse({
      journalId: p.get('journalId') ?? undefined,
      fiscalPeriodId: p.get('fiscalPeriodId') ?? undefined,
      status: p.get('status') ?? undefined,
      dateFrom: p.get('dateFrom') ?? undefined,
      dateTo: p.get('dateTo') ?? undefined,
      search: p.get('search') ?? undefined,
      page: p.get('page') ?? '1',
      limit: p.get('limit') ?? '20',
    });

    const result = await journalEntryService.listJournalEntries(auth.companyId, filters);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return handleApiError(error, 'GET /api/v1/accounting/journal-entries');
  }
}

/** POST /api/v1/accounting/journal-entries — crea un asiento en borrador */
export async function POST(request: NextRequest) {
  try {
    const auth = getAuthContextFromHeaders(request);
    const body = await request.json();
    const input = createJournalEntrySchema.parse(body);
    const entry = await journalEntryService.createDraftEntry(auth.companyId, auth.userId, input);
    return NextResponse.json(
      { success: true, data: entry, message: 'Asiento creado en borrador' },
      { status: 201 },
    );
  } catch (error) {
    return handleApiError(error, 'POST /api/v1/accounting/journal-entries');
  }
}
