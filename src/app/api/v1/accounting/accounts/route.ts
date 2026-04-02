// src/app/api/v1/accounting/accounts/route.ts
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getAuthContextFromHeaders } from '@/lib/auth/request-auth';
import { checkPermission } from '@/lib/permissions/check-permission';
import { accountService } from '@/lib/services/accounting/account.service';
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
