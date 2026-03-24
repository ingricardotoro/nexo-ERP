import type { PaymentTerms } from '@prisma/client';
import prisma from '@/lib/db/prisma';
import {
  createPaymentTermsSchema,
  updatePaymentTermsSchema,
  type CreatePaymentTermsInput,
  type UpdatePaymentTermsInput,
  type PaymentTermsFilters,
} from '@/lib/validations/payment-terms.schema';

export class PaymentTermsService {
  async listPaymentTerms(
    companyId: string,
    filters?: PaymentTermsFilters,
  ): Promise<PaymentTerms[]> {
    const where: { companyId: string; isActive?: boolean } = { companyId };

    if (typeof filters?.isActive === 'boolean') {
      where.isActive = filters.isActive;
    }

    return prisma.paymentTerms.findMany({
      where,
      orderBy: [{ isDefault: 'desc' }, { daysUntilDue: 'asc' }],
    });
  }

  async getPaymentTermsById(id: string, companyId: string): Promise<PaymentTerms> {
    const terms = await prisma.paymentTerms.findFirst({
      where: { id, companyId },
    });

    if (!terms) {
      throw new Error('Términos de pago no encontrados');
    }

    return terms;
  }

  async createPaymentTerms(
    companyId: string,
    data: CreatePaymentTermsInput,
  ): Promise<PaymentTerms> {
    const validated = createPaymentTermsSchema.parse(data);

    const existing = await prisma.paymentTerms.findFirst({
      where: { companyId, name: validated.name },
    });

    if (existing) {
      throw new Error('Ya existe un término de pago con ese nombre');
    }

    // Si se marca como default, desmarcar el anterior
    if (validated.isDefault) {
      await prisma.paymentTerms.updateMany({
        where: { companyId, isDefault: true },
        data: { isDefault: false },
      });
    }

    return prisma.paymentTerms.create({
      data: { ...validated, companyId },
    });
  }

  async updatePaymentTerms(
    id: string,
    companyId: string,
    data: UpdatePaymentTermsInput,
  ): Promise<PaymentTerms> {
    const validated = updatePaymentTermsSchema.parse({ ...data, id });

    await this.getPaymentTermsById(id, companyId);

    if (validated.name) {
      const nameInUse = await prisma.paymentTerms.findFirst({
        where: { companyId, name: validated.name, id: { not: id } },
      });
      if (nameInUse) {
        throw new Error('Ya existe un término de pago con ese nombre');
      }
    }

    // Si se marca como default, desmarcar el anterior
    if (validated.isDefault) {
      await prisma.paymentTerms.updateMany({
        where: { companyId, isDefault: true, id: { not: id } },
        data: { isDefault: false },
      });
    }

    const { id: _id, ...updateData } = validated;

    return prisma.paymentTerms.update({
      where: { id },
      data: updateData,
    });
  }

  async deletePaymentTerms(id: string, companyId: string): Promise<{ success: boolean }> {
    const terms = await this.getPaymentTermsById(id, companyId);

    if (terms.isDefault) {
      throw new Error('No se puede eliminar el término de pago predeterminado');
    }

    // Verificar que no esté en uso por algún contacto
    const inUse = await prisma.contact.count({
      where: { companyId, paymentTermsId: id },
    });

    if (inUse > 0) {
      throw new Error(
        `Este término de pago está en uso por ${inUse} contacto(s). Reasígnalo antes de eliminarlo`,
      );
    }

    await prisma.paymentTerms.delete({ where: { id } });

    return { success: true };
  }
}

export const paymentTermsService = new PaymentTermsService();
