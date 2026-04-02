// src/app/api/v1/accounting/bank-accounts/[id]/statements/import/route.ts
//
// POST con body JSON (transacciones ya parseadas) o multipart/form-data (CSV raw).
// Soporta dos modos:
//   1. JSON: { periodFrom, periodTo, beginningBalance, endingBalance, transactions: [...] }
//   2. CSV: form-data con campos period_from, period_to, beginning_balance, ending_balance + file
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getAuthContextFromHeaders } from '@/lib/auth/request-auth';
import { checkPermission } from '@/lib/permissions/check-permission';
import {
  bankStatementService,
  parseHondurasBankCsv,
} from '@/lib/services/accounting/bank-statement.service';
import { bankStatementImportSchema } from '@/lib/validations/bank.schema';
import { handleApiError } from '@/lib/api/handle-error';

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const auth = getAuthContextFromHeaders(request);
    await checkPermission(auth, 'accounting.bank.create');
    const { id: bankAccountId } = await params;

    const contentType = request.headers.get('content-type') ?? '';

    let input;
    if (contentType.includes('multipart/form-data')) {
      // CSV upload mode
      const formData = await request.formData();
      const file = formData.get('file') as File | null;
      if (!file) throw new Error('Se requiere el archivo CSV del estado de cuenta');

      const csvContent = await file.text();
      const transactions = parseHondurasBankCsv(csvContent);

      input = bankStatementImportSchema.parse({
        bankAccountId,
        periodFrom: formData.get('periodFrom') as string,
        periodTo: formData.get('periodTo') as string,
        beginningBalance: Number(formData.get('beginningBalance')),
        endingBalance: Number(formData.get('endingBalance')),
        fileName: file.name,
        transactions,
      });
    } else {
      // JSON mode — caller has already parsed the CSV or provides transactions directly
      const body = await request.json();
      input = bankStatementImportSchema.parse({ ...body, bankAccountId });
    }

    const statement = await bankStatementService.importStatement(
      auth.companyId,
      auth.userId,
      input,
    );
    return NextResponse.json(
      {
        success: true,
        data: statement,
        message: `Estado de cuenta importado con ${statement.transactions.length} transacciones`,
      },
      { status: 201 },
    );
  } catch (error) {
    return handleApiError(error, 'POST /api/v1/accounting/bank-accounts/[id]/statements/import');
  }
}
