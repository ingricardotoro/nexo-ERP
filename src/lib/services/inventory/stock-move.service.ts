// src/lib/services/inventory/stock-move.service.ts
//
// Handles stock movements (reception, delivery, adjustment).
// Core rule: when a StockMove is DONE, stock_quants are updated atomically.
//
// For LOT/SERIAL products: each StockMoveLine maps qty to one lot.
// For NONE products: exactly one StockMoveLine with lotId = null.

import basePrisma from '@/lib/db/prisma';
import { createTenantPrisma } from '@/lib/db/tenant-extension';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface StockMoveRow {
  id: string;
  productId: string;
  productCode: string;
  productName: string;
  fromLocationId: string;
  fromLocationName: string;
  toLocationId: string;
  toLocationName: string;
  state: 'DRAFT' | 'CONFIRMED' | 'DONE' | 'CANCELLED';
  scheduledDate: Date;
  doneDate: Date | null;
  qtyDemand: string;
  qtyDone: string;
  reference: string | null;
  lines: {
    id: string;
    lotId: string | null;
    lotNumber: string | null;
    quantity: string;
    doneQty: string;
  }[];
  createdAt: Date;
}

export interface ReceptionInput {
  productId: string;
  fromLocationId: string; // SUPPLIER virtual location
  toLocationId: string; // warehouse INTERNAL location
  scheduledDate: Date;
  reference?: string;
  notes?: string;
  createdBy: string;
  lines: {
    lotNumber?: string; // required for LOT/SERIAL, omit for NONE
    manufacturingDate?: Date;
    expirationDate?: Date;
    supplierId?: string;
    quantity: number;
  }[];
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const stockMoveService = {
  /**
   * Creates and immediately completes a reception move (SUPPLIER → Warehouse).
   *
   * For NONE products: single line without lot.
   * For LOT/SERIAL: each line must include lotNumber (creates lot if new).
   */
  async createReception(companyId: string, input: ReceptionInput): Promise<StockMoveRow> {
    const db = createTenantPrisma(basePrisma, companyId);

    // Validate product exists and get tracking type
    const product = await db.product.findFirst({
      where: { id: input.productId, companyId },
    });
    if (!product) throw new Error('Producto no encontrado');

    // Validate locations
    const [fromLoc, toLoc] = await Promise.all([
      db.location.findFirst({ where: { id: input.fromLocationId, companyId } }),
      db.location.findFirst({ where: { id: input.toLocationId, companyId } }),
    ]);
    if (!fromLoc) throw new Error('Ubicación de origen no encontrada');
    if (!toLoc) throw new Error('Ubicación de destino no encontrada');

    // Validate lines
    if (!input.lines.length) throw new Error('Se requiere al menos una línea');

    if (product.trackingType !== 'NONE') {
      const missingLot = input.lines.some((l) => !l.lotNumber?.trim());
      if (missingLot)
        throw new Error(
          `El producto requiere número de ${product.trackingType === 'SERIAL' ? 'serie' : 'lote'} en todas las líneas`,
        );
    }

    const totalQty = input.lines.reduce((s, l) => s + l.quantity, 0);

    // Execute in a single transaction: create move + lines + quants
    const move = await basePrisma.$transaction(async (tx) => {
      // Set RLS context
      await tx.$executeRaw`SELECT set_config('app.current_company_id', ${companyId}, true)`;

      // Create the StockMove
      const sm = await (tx as any).stockMove.create({
        data: {
          companyId,
          productId: input.productId,
          fromLocationId: input.fromLocationId,
          toLocationId: input.toLocationId,
          state: 'DONE',
          scheduledDate: input.scheduledDate,
          doneDate: new Date(),
          qtyDemand: totalQty,
          qtyDone: totalQty,
          reference: input.reference,
          notes: input.notes,
          createdBy: input.createdBy,
        },
      });

      const lineResults: {
        id: string;
        lotId: string | null;
        lotNumber: string | null;
        quantity: string;
        doneQty: string;
      }[] = [];

      for (const line of input.lines) {
        let lotId: string | null = null;
        let lotNumber: string | null = null;

        if (product.trackingType !== 'NONE' && line.lotNumber) {
          // Find or create lot
          const existingLot = await (tx as any).lot.findFirst({
            where: { companyId, productId: input.productId, lotNumber: line.lotNumber },
          });

          if (existingLot) {
            lotId = existingLot.id;
            lotNumber = existingLot.lotNumber;
          } else {
            const newLot = await (tx as any).lot.create({
              data: {
                companyId,
                productId: input.productId,
                lotNumber: line.lotNumber,
                manufacturingDate: line.manufacturingDate,
                expirationDate: line.expirationDate,
                supplierId: line.supplierId,
              },
            });
            lotId = newLot.id;
            lotNumber = newLot.lotNumber;
          }
        }

        // Create StockMoveLine
        const sml = await (tx as any).stockMoveLine.create({
          data: {
            companyId,
            stockMoveId: sm.id,
            lotId,
            quantity: line.quantity,
            doneQty: line.quantity,
          },
        });

        lineResults.push({
          id: sml.id,
          lotId,
          lotNumber,
          quantity: line.quantity.toString(),
          doneQty: line.quantity.toString(),
        });

        // Update StockQuant: increase destination (+qty)
        const existingQuant = await (tx as any).stockQuant.findFirst({
          where: {
            companyId,
            productId: input.productId,
            locationId: input.toLocationId,
            lotId: lotId ?? null,
          },
        });

        if (existingQuant) {
          const newQty = parseFloat(existingQuant.quantity.toString()) + line.quantity;
          await (tx as any).stockQuant.update({
            where: { id: existingQuant.id },
            data: { quantity: newQty },
          });
        } else {
          await (tx as any).stockQuant.create({
            data: {
              companyId,
              productId: input.productId,
              locationId: input.toLocationId,
              lotId,
              quantity: line.quantity,
            },
          });
        }
      }

      return { sm, lineResults };
    });

    return {
      id: move.sm.id,
      productId: input.productId,
      productCode: product.code,
      productName: product.name,
      fromLocationId: input.fromLocationId,
      fromLocationName: fromLoc.name,
      toLocationId: input.toLocationId,
      toLocationName: toLoc.name,
      state: 'DONE',
      scheduledDate: input.scheduledDate,
      doneDate: new Date(),
      qtyDemand: totalQty.toString(),
      qtyDone: totalQty.toString(),
      reference: input.reference ?? null,
      lines: move.lineResults,
      createdAt: new Date(),
    };
  },

  /** Lists recent stock moves for a company. */
  async listMoves(
    companyId: string,
    opts: { productId?: string; state?: string; limit?: number } = {},
  ): Promise<StockMoveRow[]> {
    const db = createTenantPrisma(basePrisma, companyId);

    const where: Record<string, unknown> = { companyId };
    if (opts.productId) where.productId = opts.productId;
    if (opts.state) where.state = opts.state;

    const moves = await db.stockMove.findMany({
      where,
      include: {
        product: { select: { code: true, name: true } },
        fromLocation: { select: { name: true } },
        toLocation: { select: { name: true } },
        lines: {
          include: { lot: { select: { lotNumber: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: opts.limit ?? 50,
    });

    return moves.map((m) => ({
      id: m.id,
      productId: m.productId,
      productCode: m.product.code,
      productName: m.product.name,
      fromLocationId: m.fromLocationId,
      fromLocationName: m.fromLocation.name,
      toLocationId: m.toLocationId,
      toLocationName: m.toLocation.name,
      state: m.state,
      scheduledDate: m.scheduledDate,
      doneDate: m.doneDate,
      qtyDemand: m.qtyDemand.toString(),
      qtyDone: m.qtyDone.toString(),
      reference: m.reference,
      lines: m.lines.map((l) => ({
        id: l.id,
        lotId: l.lotId,
        lotNumber: l.lot?.lotNumber ?? null,
        quantity: l.quantity.toString(),
        doneQty: l.doneQty.toString(),
      })),
      createdAt: m.createdAt,
    }));
  },

  /** Gets stock on hand per location for a product (optionally filtered by lot). */
  async getStockOnHand(
    companyId: string,
    productId: string,
  ): Promise<
    {
      locationId: string;
      locationName: string;
      lotId: string | null;
      lotNumber: string | null;
      quantity: string;
    }[]
  > {
    const db = createTenantPrisma(basePrisma, companyId);

    const quants = await db.stockQuant.findMany({
      where: { companyId, productId, quantity: { gt: 0 } },
      include: {
        location: { select: { name: true, fullPath: true } },
        lot: { select: { lotNumber: true } },
      },
      orderBy: [
        { location: { name: 'asc' } },
        { lot: { expirationDate: { sort: 'asc', nulls: 'last' } } },
      ],
    });

    return quants.map((q) => ({
      locationId: q.locationId,
      locationName: q.location.fullPath ?? q.location.name,
      lotId: q.lotId,
      lotNumber: q.lot?.lotNumber ?? null,
      quantity: q.quantity.toString(),
    }));
  },
};
