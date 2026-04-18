// src/app/api/v1/accounting/accounts/[id]/route.ts
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getAuthContextFromHeaders } from '@/lib/auth/request-auth';
import { checkPermission } from '@/lib/permissions/check-permission';
import { accountService } from '@/lib/services/accounting/account.service';
import { updateAccountSchema } from '@/lib/validations/account.schema';
import { handleApiError } from '@/lib/api/handle-error';

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const auth = getAuthContextFromHeaders(request);
    await checkPermission(auth, 'accounting.account.update');
    const { id } = await params;
    const body = await request.json();
    const input = updateAccountSchema.parse(body);
    const account = await accountService.updateAccount(auth.companyId, id, input);
    return NextResponse.json({ success: true, data: account });
  } catch (error) {
    return handleApiError(error, 'PATCH /api/v1/accounting/accounts/[id]');
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const auth = getAuthContextFromHeaders(request);
    await checkPermission(auth, 'accounting.account.delete');
    const { id } = await params;
    const result = await accountService.deleteAccount(auth.companyId, id);
    const message = result.deleted
      ? 'Cuenta eliminada permanentemente'
      : 'Cuenta desactivada (tiene movimientos contables asociados)';
    return NextResponse.json({ success: true, deleted: result.deleted, message });
  } catch (error) {
    return handleApiError(error, 'DELETE /api/v1/accounting/accounts/[id]');
  }
}
