// src/app/api/v1/invoicing/cais/route.ts
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getAuthContextFromHeaders } from '@/lib/auth/request-auth';
import { checkPermission } from '@/lib/permissions/check-permission';
import { caiService } from '@/lib/services/invoicing/cai.service';
import { createCaiSchema } from '@/lib/validations/cai.schema';
import { handleApiError } from '@/lib/api/handle-error';

/** GET /api/v1/invoicing/cais — lista CAIs de la empresa */
export async function GET(request: NextRequest) {
  try {
    const auth = getAuthContextFromHeaders(request);
    await checkPermission(auth, 'invoicing.cai.read');
    const cais = await caiService.listCais(auth.companyId);
    return NextResponse.json({ success: true, data: cais });
  } catch (error) {
    return handleApiError(error, 'GET /api/v1/invoicing/cais');
  }
}

/** POST /api/v1/invoicing/cais — registra un nuevo CAI */
export async function POST(request: NextRequest) {
  try {
    const auth = getAuthContextFromHeaders(request);
    await checkPermission(auth, 'invoicing.cai.create');
    const body = await request.json();
    const input = createCaiSchema.parse(body);
    const cai = await caiService.createCai(auth.companyId, input);
    return NextResponse.json(
      { success: true, data: cai, message: 'CAI registrado exitosamente' },
      { status: 201 },
    );
  } catch (error) {
    return handleApiError(error, 'POST /api/v1/invoicing/cais');
  }
}
