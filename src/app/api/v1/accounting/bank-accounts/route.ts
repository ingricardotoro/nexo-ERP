// src/app/api/v1/accounting/bank-accounts/route.ts
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthContextFromHeaders } from '@/lib/auth/request-auth';
import { checkPermission } from '@/lib/permissions/check-permission';
import { bankAccountService } from '@/lib/services/accounting/bank-account.service';
import { createBankAccountSchema } from '@/lib/validations/bank.schema';
import { handleApiError } from '@/lib/api/handle-error';

const listQuerySchema = z.object({
  activeOnly: z.coerce.boolean().default(true),
});

export async function GET(request: NextRequest) {
  try {
    const auth = getAuthContextFromHeaders(request);
    await checkPermission(auth, 'accounting.bank.read');
    const { searchParams } = new URL(request.url);
    const { activeOnly } = listQuerySchema.parse(Object.fromEntries(searchParams));
    const accounts = await bankAccountService.listBankAccounts(auth.companyId, activeOnly);
    return NextResponse.json({ success: true, data: accounts });
  } catch (error) {
    return handleApiError(error, 'GET /api/v1/accounting/bank-accounts');
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = getAuthContextFromHeaders(request);
    await checkPermission(auth, 'accounting.bank.create');
    const body = await request.json();
    const input = createBankAccountSchema.parse(body);
    const account = await bankAccountService.createBankAccount(auth.companyId, input);
    return NextResponse.json(
      { success: true, data: account, message: 'Cuenta bancaria creada exitosamente' },
      { status: 201 },
    );
  } catch (error) {
    return handleApiError(error, 'POST /api/v1/accounting/bank-accounts');
  }
}
