// src/app/api/v1/invoicing/cais/[id]/route.ts
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getAuthContextFromHeaders } from '@/lib/auth/request-auth';
import { checkPermission } from '@/lib/permissions/check-permission';
import { caiService } from '@/lib/services/invoicing/cai.service';
import { updateCaiSchema } from '@/lib/validations/cai.schema';
import { handleApiError } from '@/lib/api/handle-error';

/** GET /api/v1/invoicing/cais/:id — detalle de un CAI */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = getAuthContextFromHeaders(request);
    await checkPermission(auth, 'invoicing.cai.read');
    const { id } = await params;
    const cai = await caiService.getCai(auth.companyId, id);
    return NextResponse.json({ success: true, data: cai });
  } catch (error) {
    return handleApiError(error, 'GET /api/v1/invoicing/cais/[id]');
  }
}

/** PATCH /api/v1/invoicing/cais/:id — activa o desactiva un CAI */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = getAuthContextFromHeaders(request);
    await checkPermission(auth, 'invoicing.cai.update');
    const { id } = await params;
    const body = await request.json();
    const input = updateCaiSchema.parse(body);
    const cai = await caiService.updateCai(auth.companyId, id, input);
    return NextResponse.json({ success: true, data: cai, message: 'CAI actualizado exitosamente' });
  } catch (error) {
    return handleApiError(error, 'PATCH /api/v1/invoicing/cais/[id]');
  }
}
