// src/app/api/v1/inventory/receptions/route.ts
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthContextFromHeaders } from '@/lib/auth/request-auth';
import { checkPermission } from '@/lib/permissions/check-permission';
import { stockMoveService } from '@/lib/services/inventory/stock-move.service';
import { handleApiError } from '@/lib/api/handle-error';

const receptionLineSchema = z.object({
  lotNumber: z.string().max(100).optional(),
  manufacturingDate: z.string().datetime({ offset: true }).optional(),
  expirationDate: z.string().datetime({ offset: true }).optional(),
  supplierId: z.string().uuid().optional(),
  quantity: z.number().positive('La cantidad debe ser mayor a 0'),
});

const createReceptionSchema = z.object({
  productId: z.string().uuid('Producto requerido'),
  fromLocationId: z.string().uuid('Ubicación de origen requerida'),
  toLocationId: z.string().uuid('Ubicación de destino requerida'),
  scheduledDate: z.string().datetime({ offset: true }),
  reference: z.string().max(100).optional(),
  notes: z.string().max(500).optional(),
  lines: z.array(receptionLineSchema).min(1, 'Se requiere al menos una línea'),
});

/** POST /api/v1/inventory/receptions — crea y completa una recepción */
export async function POST(request: NextRequest) {
  try {
    const auth = getAuthContextFromHeaders(request);
    await checkPermission(auth, 'inventory.product.create');

    const body = await request.json();
    const input = createReceptionSchema.parse(body);

    const move = await stockMoveService.createReception(auth.companyId, {
      productId: input.productId,
      fromLocationId: input.fromLocationId,
      toLocationId: input.toLocationId,
      scheduledDate: new Date(input.scheduledDate),
      reference: input.reference,
      notes: input.notes,
      createdBy: auth.userId,
      lines: input.lines.map((l) => ({
        lotNumber: l.lotNumber,
        manufacturingDate: l.manufacturingDate ? new Date(l.manufacturingDate) : undefined,
        expirationDate: l.expirationDate ? new Date(l.expirationDate) : undefined,
        supplierId: l.supplierId,
        quantity: l.quantity,
      })),
    });

    return NextResponse.json(
      { success: true, data: move, message: 'Recepción registrada exitosamente' },
      { status: 201 },
    );
  } catch (error) {
    return handleApiError(error, 'POST /api/v1/inventory/receptions');
  }
}
