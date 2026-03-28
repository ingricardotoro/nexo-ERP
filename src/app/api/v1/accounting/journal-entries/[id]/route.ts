// src/app/api/v1/accounting/journal-entries/[id]/route.ts
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getAuthContextFromHeaders } from '@/lib/auth/request-auth';
import { journalEntryService } from '@/lib/services/accounting/journal-entry.service';
import { updateJournalEntrySchema } from '@/lib/validations/journal-entry.schema';
import { handleApiError } from '@/lib/api/handle-error';

/** GET /api/v1/accounting/journal-entries/:id — obtiene asiento con líneas */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = getAuthContextFromHeaders(request);
    const { id } = await params;
    const entry = await journalEntryService.getJournalEntry(auth.companyId, id);
    return NextResponse.json({ success: true, data: entry });
  } catch (error) {
    return handleApiError(error, 'GET /api/v1/accounting/journal-entries/[id]');
  }
}

/** PATCH /api/v1/accounting/journal-entries/:id — actualiza un asiento DRAFT */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = getAuthContextFromHeaders(request);
    const { id } = await params;
    const body = await request.json();
    const input = updateJournalEntrySchema.parse(body);
    const entry = await journalEntryService.updateDraftEntry(auth.companyId, id, input);
    return NextResponse.json({ success: true, data: entry, message: 'Asiento actualizado' });
  } catch (error) {
    return handleApiError(error, 'PATCH /api/v1/accounting/journal-entries/[id]');
  }
}

/** DELETE /api/v1/accounting/journal-entries/:id — elimina un asiento DRAFT */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = getAuthContextFromHeaders(request);
    const { id } = await params;
    await journalEntryService.deleteDraftEntry(auth.companyId, id);
    return NextResponse.json({ success: true, message: 'Asiento eliminado' });
  } catch (error) {
    return handleApiError(error, 'DELETE /api/v1/accounting/journal-entries/[id]');
  }
}
