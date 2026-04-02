// src/app/api/v1/invoicing/supplier-invoices/route.ts
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getAuthContextFromHeaders } from '@/lib/auth/request-auth';
import { checkPermission } from '@/lib/permissions/check-permission';
import { supplierInvoiceService } from '@/lib/services/invoicing/supplier-invoice.service';
import {
  createSupplierInvoiceSchema,
  listSupplierInvoicesSchema,
} from '@/lib/validations/supplier-invoice.schema';
import { handleApiError } from '@/lib/api/handle-error';

/** GET /api/v1/invoicing/supplier-invoices — lista facturas de compra */
export async function GET(request: NextRequest) {
  try {
    const auth = getAuthContextFromHeaders(request);
    await checkPermission(auth, 'invoicing.invoice.read');
    const { searchParams } = new URL(request.url);
    const query = listSupplierInvoicesSchema.parse(Object.fromEntries(searchParams));
    const result = await supplierInvoiceService.listSupplierInvoices(auth.companyId, query);
    return NextResponse.json({
      success: true,
      data: result.invoices,
      pagination: result.pagination,
    });
  } catch (error) {
    return handleApiError(error, 'GET /api/v1/invoicing/supplier-invoices');
  }
}

/** POST /api/v1/invoicing/supplier-invoices — crea factura de compra en borrador */
export async function POST(request: NextRequest) {
  try {
    const auth = getAuthContextFromHeaders(request);
    await checkPermission(auth, 'invoicing.invoice.create');
    const body = await request.json();
    const input = createSupplierInvoiceSchema.parse(body);
    const invoice = await supplierInvoiceService.createSupplierInvoice(
      auth.companyId,
      auth.userId,
      input,
    );
    return NextResponse.json(
      { success: true, data: invoice, message: 'Factura de compra creada exitosamente' },
      { status: 201 },
    );
  } catch (error) {
    return handleApiError(error, 'POST /api/v1/invoicing/supplier-invoices');
  }
}
