// src/app/api/v1/accounting/bank-accounts/[id]/route.ts
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getAuthContextFromHeaders } from '@/lib/auth/request-auth';
import { checkPermission } from '@/lib/permissions/check-permission';
import { bankAccountService } from '@/lib/services/accounting/bank-account.service';
import { updateBankAccountSchema } from '@/lib/validations/bank.schema';
import { handleApiError } from '@/lib/api/handle-error';

type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const auth = getAuthContextFromHeaders(request);
    await checkPermission(auth, 'accounting.bank.read');
    const { id } = await params;
    const account = await bankAccountService.getBankAccount(auth.companyId, id);
    return NextResponse.json({ success: true, data: account });
  } catch (error) {
    return handleApiError(error, 'GET /api/v1/accounting/bank-accounts/[id]');
  }
}

export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const auth = getAuthContextFromHeaders(request);
    await checkPermission(auth, 'accounting.bank.create');
    const { id } = await params;
    const body = await request.json();
    const input = updateBankAccountSchema.parse(body);
    const account = await bankAccountService.updateBankAccount(auth.companyId, id, input);
    return NextResponse.json({ success: true, data: account });
  } catch (error) {
    return handleApiError(error, 'PUT /api/v1/accounting/bank-accounts/[id]');
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const auth = getAuthContextFromHeaders(request);
    await checkPermission(auth, 'accounting.bank.create');
    const { id } = await params;
    const account = await bankAccountService.deactivateBankAccount(auth.companyId, id);
    return NextResponse.json({
      success: true,
      data: account,
      message: 'Cuenta bancaria desactivada',
    });
  } catch (error) {
    return handleApiError(error, 'DELETE /api/v1/accounting/bank-accounts/[id]');
  }
}
