// src/app/api/v1/accounting/bank-reconciliation/route.ts
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthContextFromHeaders } from '@/lib/auth/request-auth';
import { checkPermission } from '@/lib/permissions/check-permission';
import { bankReconciliationService } from '@/lib/services/accounting/bank-reconciliation.service';
import { bankStatementService } from '@/lib/services/accounting/bank-statement.service';
import {
  matchTransactionSchema,
  finalizeReconciliationSchema,
} from '@/lib/validations/bank.schema';
import { handleApiError } from '@/lib/api/handle-error';

const summaryQuerySchema = z.object({
  bankAccountId: z.string().uuid(),
  statementId: z.string().uuid(),
});

const suggestionsQuerySchema = z.object({
  statementId: z.string().uuid(),
});

/**
 * GET /api/v1/accounting/bank-reconciliation?bankAccountId=xxx&statementId=yyy
 * Returns reconciliation summary (progress, difference, canFinalize).
 */
export async function GET(request: NextRequest) {
  try {
    const auth = getAuthContextFromHeaders(request);
    await checkPermission(auth, 'accounting.bank.read');
    const { searchParams } = new URL(request.url);
    const { bankAccountId, statementId } = summaryQuerySchema.parse(
      Object.fromEntries(searchParams),
    );
    const summary = await bankReconciliationService.getReconciliationSummary(
      auth.companyId,
      bankAccountId,
      statementId,
    );
    return NextResponse.json({ success: true, data: summary });
  } catch (error) {
    return handleApiError(error, 'GET /api/v1/accounting/bank-reconciliation');
  }
}

/**
 * POST /api/v1/accounting/bank-reconciliation
 * Body: { action: 'finalize' | 'match' | 'unmatch' | 'ignore' | 'suggestions', ...params }
 */
export async function POST(request: NextRequest) {
  try {
    const auth = getAuthContextFromHeaders(request);
    await checkPermission(auth, 'accounting.bank.create');
    const body = await request.json();

    switch (body.action) {
      case 'finalize': {
        const { bankAccountId, bankStatementId } = finalizeReconciliationSchema.parse(body);
        const result = await bankReconciliationService.finalizeReconciliation(
          auth.companyId,
          bankAccountId,
          bankStatementId,
          auth.userId,
        );
        return NextResponse.json({
          success: true,
          data: result,
          message: 'Conciliación finalizada exitosamente',
        });
      }

      case 'match': {
        const { bankTransactionId, journalEntryLineId, matchNotes } =
          matchTransactionSchema.parse(body);
        const tx = await bankStatementService.matchTransaction(
          auth.companyId,
          bankTransactionId,
          journalEntryLineId,
          matchNotes,
        );
        return NextResponse.json({ success: true, data: tx });
      }

      case 'unmatch': {
        const { bankTransactionId } = z
          .object({ bankTransactionId: z.string().uuid() })
          .parse(body);
        const tx = await bankStatementService.unmatchTransaction(auth.companyId, bankTransactionId);
        return NextResponse.json({ success: true, data: tx });
      }

      case 'ignore': {
        const { bankTransactionId, matchNotes } = z
          .object({ bankTransactionId: z.string().uuid(), matchNotes: z.string().optional() })
          .parse(body);
        const tx = await bankStatementService.ignoreTransaction(
          auth.companyId,
          bankTransactionId,
          matchNotes,
        );
        return NextResponse.json({ success: true, data: tx });
      }

      case 'suggestions': {
        const { statementId } = suggestionsQuerySchema.parse(body);
        const suggestions = await bankStatementService.getSuggestedMatches(
          auth.companyId,
          statementId,
        );
        return NextResponse.json({ success: true, data: suggestions });
      }

      default:
        return NextResponse.json(
          {
            success: false,
            error: 'Acción no válida. Use: finalize, match, unmatch, ignore, suggestions',
          },
          { status: 400 },
        );
    }
  } catch (error) {
    return handleApiError(error, 'POST /api/v1/accounting/bank-reconciliation');
  }
}
