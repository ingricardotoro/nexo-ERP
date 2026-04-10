// src/app/api/v1/inventory/adjustments/route.ts
/**
 * POST /api/v1/inventory/adjustments — Ajuste manual de inventario (F6-02)
 *
 * Permite a usuarios con permiso inventory.product.update establecer
 * la cantidad on-hand de un producto en una ubicación específica.
 *
 * Estrategia (sin migración de schema):
 * - Positive delta (añadir stock):  StockMove SUPPLIER → locationId
 * - Negative delta (reducir stock): StockMove locationId → SUPPLIER
 * - Actualiza StockQuant directamente para reflejar la nueva cantidad
 * - Crea registro de auditoría con referencia ADJ/YYYY/NNNNN
 *
 * El uso de SUPPLIER como contraparte virtual es consistente con el
 * patrón existente de recepciones (PO → StockMove SUPPLIER → INTERNAL).
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthContextFromHeaders } from '@/lib/auth/request-auth';
import { checkPermission } from '@/lib/permissions/check-permission';
import { handleApiError } from '@/lib/api/handle-error';
import basePrisma from '@/lib/db/prisma';
import { createTenantPrisma } from '@/lib/db/tenant-extension';

const adjustmentSchema = z.object({
  productId: z.string().uuid('Producto requerido'),
  locationId: z.string().uuid('Ubicación requerida'),
  newQuantity: z.number().min(0, 'La cantidad no puede ser negativa'),
  reason: z.enum(['CONTEO_FISICO', 'MERMA', 'DANO', 'DEVOLUCION', 'OTRO'], {
    errorMap: () => ({ message: 'Razón de ajuste inválida' }),
  }),
  notes: z.string().max(300).optional(),
});

/** Genera referencia de ajuste: ADJ/YYYY/NNNNN */
async function nextAdjustmentRef(companyId: string): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `ADJ/${year}/`;
  const last = await basePrisma.stockMove.findFirst({
    where: { companyId, reference: { startsWith: prefix } },
    orderBy: { reference: 'desc' },
  });
  const lastNum = last?.reference ? parseInt(last.reference.split('/')[2] ?? '0') : 0;
  return `${prefix}${String(lastNum + 1).padStart(5, '0')}`;
}

export async function POST(request: NextRequest) {
  try {
    const auth = getAuthContextFromHeaders(request);
    await checkPermission(auth, 'inventory.product.update');

    const body = adjustmentSchema.parse(await request.json());
    const { productId, locationId, newQuantity, reason, notes } = body;
    const companyId = auth.companyId;
    const db = createTenantPrisma(basePrisma, companyId);

    // Validar producto
    const product = await db.product.findFirst({ where: { id: productId, companyId } });
    if (!product)
      return NextResponse.json(
        { success: false, error: 'Producto no encontrado' },
        { status: 404 },
      );

    // Validar ubicación (debe ser INTERNAL de esta empresa)
    const location = await db.location.findFirst({
      where: { id: locationId, companyId, locationType: 'INTERNAL' },
    });
    if (!location)
      return NextResponse.json(
        { success: false, error: 'Ubicación no encontrada o no es INTERNAL' },
        { status: 404 },
      );

    // Ubicación virtual SUPPLIER de esta empresa
    const supplierLoc = await db.location.findFirst({
      where: { companyId, locationType: 'SUPPLIER' },
    });
    if (!supplierLoc)
      return NextResponse.json(
        { success: false, error: 'Ubicación virtual SUPPLIER no configurada' },
        { status: 400 },
      );

    // Stock actual en esa ubicación
    const currentQuant = await db.stockQuant.findFirst({
      where: { companyId, productId, locationId, lotId: null },
    });
    const currentQty = currentQuant ? parseFloat(currentQuant.quantity.toString()) : 0;
    const delta = newQuantity - currentQty;

    if (Math.abs(delta) < 0.0001) {
      return NextResponse.json({
        success: true,
        data: { message: 'Sin cambios — la cantidad ya es la indicada', delta: 0 },
      });
    }

    const reference = await nextAdjustmentRef(companyId);
    const now = new Date();

    await basePrisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.current_company_id', ${companyId}, true)`;

      const isPositive = delta > 0;
      const fromLocationId = isPositive ? supplierLoc.id : locationId;
      const toLocationId = isPositive ? locationId : supplierLoc.id;
      const absDelta = Math.abs(delta);

      // Crear StockMove de ajuste
      const sm = await tx.stockMove.create({
        data: {
          companyId,
          productId,
          fromLocationId,
          toLocationId,
          state: 'DONE',
          scheduledDate: now,
          doneDate: now,
          qtyDemand: absDelta,
          qtyDone: absDelta,
          reference,
          createdBy: auth.userId,
          lines: {
            create: { companyId, quantity: absDelta, doneQty: absDelta },
          },
        },
      });

      // Actualizar StockQuant
      if (currentQuant) {
        await tx.stockQuant.update({
          where: { id: currentQuant.id },
          data: { quantity: newQuantity },
        });
      } else if (newQuantity > 0) {
        await tx.stockQuant.create({
          data: { companyId, productId, locationId, quantity: newQuantity },
        });
      }

      return sm;
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          reference,
          productId,
          locationId,
          previousQty: currentQty.toFixed(4),
          newQty: newQuantity.toFixed(4),
          delta: delta.toFixed(4),
          reason,
          notes: notes ?? null,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    return handleApiError(error, 'POST /api/v1/inventory/adjustments');
  }
}
