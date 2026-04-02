// src/app/api/v1/accounting/bank-accounts/[id]/statements/route.ts
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getAuthContextFromHeaders } from '@/lib/auth/request-auth';
import { checkPermission } from '@/lib/permissions/check-permission';
import { bankStatementService } from '@/lib/services/accounting/bank-statement.service';
import { handleApiError } from '@/lib/api/handle-error';

type Params = { params: Promise<{ id: string }> };

/** GET /api/v1/accounting/bank-accounts/[id]/statements — lista estados de cuenta */
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const auth = getAuthContextFromHeaders(request);
    await checkPermission(auth, 'accounting.bank.read');
    const { id } = await params;
    const statements = await bankStatementService.listStatements(auth.companyId, id);
    return NextResponse.json({ success: true, data: statements });
  } catch (error) {
    return handleApiError(error, 'GET /api/v1/accounting/bank-accounts/[id]/statements');
  }
}
