// src/app/api/v1/accounting/journals/[id]/route.ts
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getAuthContextFromHeaders } from '@/lib/auth/request-auth';
import { checkPermission } from '@/lib/permissions/check-permission';
import { journalService } from '@/lib/services/accounting/journal.service';
import { handleApiError } from '@/lib/api/handle-error';

/** PATCH /api/v1/accounting/journals/:id — actualiza nombre y/o estado */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = getAuthContextFromHeaders(request);
    await checkPermission(auth, 'accounting.journal.update');
    const { id } = await params;
    const body = (await request.json()) as Record<string, unknown>;

    const journal = await journalService.updateJournal(auth.companyId, id, {
      name: body.name !== undefined ? String(body.name) : undefined,
      isActive: body.isActive !== undefined ? Boolean(body.isActive) : undefined,
    });

    return NextResponse.json({ success: true, data: journal, message: 'Diario actualizado' });
  } catch (error) {
    return handleApiError(error, 'PATCH /api/v1/accounting/journals/[id]');
  }
}

/** DELETE /api/v1/accounting/journals/:id — elimina un diario sin asientos */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = getAuthContextFromHeaders(request);
    await checkPermission(auth, 'accounting.journal.delete');
    const { id } = await params;
    await journalService.deleteJournal(auth.companyId, id);
    return NextResponse.json({ success: true, message: 'Diario eliminado' });
  } catch (error) {
    return handleApiError(error, 'DELETE /api/v1/accounting/journals/[id]');
  }
}
