// src/app/api/v1/invoicing/tax-rates/[id]/route.ts
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getAuthContextFromHeaders } from '@/lib/auth/request-auth';
import { checkPermission } from '@/lib/permissions/check-permission';
import { taxRateService } from '@/lib/services/invoicing/tax-rate.service';
import { updateTaxRateSchema } from '@/lib/validations/tax-rate.schema';
import { handleApiError } from '@/lib/api/handle-error';

/** GET /api/v1/invoicing/tax-rates/:id — detalle de una tasa */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = getAuthContextFromHeaders(request);
    await checkPermission(auth, 'invoicing.tax_rate.read');
    const { id } = await params;
    const rate = await taxRateService.getTaxRate(auth.companyId, id);
    return NextResponse.json({ success: true, data: rate });
  } catch (error) {
    return handleApiError(error, 'GET /api/v1/invoicing/tax-rates/[id]');
  }
}

/** PATCH /api/v1/invoicing/tax-rates/:id — actualiza una tasa de impuesto */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = getAuthContextFromHeaders(request);
    await checkPermission(auth, 'invoicing.tax_rate.update');
    const { id } = await params;
    const body = await request.json();
    const input = updateTaxRateSchema.parse(body);
    const rate = await taxRateService.updateTaxRate(auth.companyId, id, input);
    return NextResponse.json({
      success: true,
      data: rate,
      message: 'Tasa de impuesto actualizada exitosamente',
    });
  } catch (error) {
    return handleApiError(error, 'PATCH /api/v1/invoicing/tax-rates/[id]');
  }
}
