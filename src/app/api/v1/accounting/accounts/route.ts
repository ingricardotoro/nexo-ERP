// src/app/api/v1/accounting/accounts/route.ts
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getAuthContextFromHeaders } from '@/lib/auth/request-auth';
import { checkPermission } from '@/lib/permissions/check-permission';
import { accountService } from '@/lib/services/accounting/account.service';
import { createAccountSchema } from '@/lib/validations/account.schema';
import { handleApiError } from '@/lib/api/handle-error';

/**
 * GET /api/v1/accounting/accounts
 * Retorna el plan de cuentas completo como árbol jerárquico + estadísticas de resumen.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = getAuthContextFromHeaders(request);
    await checkPermission(auth, 'accounting.account.read');

    const [tree, stats] = await Promise.all([
      accountService.getAccountsTree(auth.companyId),
      accountService.getAccountStats(auth.companyId),
    ]);

    return NextResponse.json({ success: true, data: tree, stats });
  } catch (error) {
    return handleApiError(error, 'GET /api/v1/accounting/accounts');
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = getAuthContextFromHeaders(request);
    await checkPermission(auth, 'accounting.account.create');
    const body = await request.json();
    const input = createAccountSchema.parse(body);
    const account = await accountService.createAccount(auth.companyId, input);
    return NextResponse.json({ success: true, data: account }, { status: 201 });
  } catch (error) {
    return handleApiError(error, 'POST /api/v1/accounting/accounts');
  }
}
