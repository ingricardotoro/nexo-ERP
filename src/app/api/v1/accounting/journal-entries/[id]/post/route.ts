// src/app/api/v1/accounting/journal-entries/[id]/post/route.ts
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getAuthContextFromHeaders } from '@/lib/auth/request-auth';
import { checkPermission } from '@/lib/permissions/check-permission';
import { journalEntryService } from '@/lib/services/accounting/journal-entry.service';
import { handleApiError } from '@/lib/api/handle-error';

/** POST /api/v1/accounting/journal-entries/:id/post — publica (contabiliza) un asiento DRAFT */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = getAuthContextFromHeaders(request);
    await checkPermission(auth, 'accounting.journal_entry.post');
    const { id } = await params;
    const entry = await journalEntryService.postEntry(auth.companyId, id, auth.userId);
    return NextResponse.json({
      success: true,
      data: entry,
      message: `Asiento #${entry.entryNumber} publicado correctamente`,
    });
  } catch (error) {
    return handleApiError(error, 'POST /api/v1/accounting/journal-entries/[id]/post');
  }
}
