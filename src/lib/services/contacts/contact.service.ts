import type {
  AddressType,
  Contact,
  ContactAddress,
  ContactPerson,
  ContactType,
} from '@prisma/client';
import prisma from '@/lib/db/prisma';
import {
  createContactSchema,
  updateContactSchema,
  type CreateContactInput,
  type UpdateContactInput,
  type ContactFilters,
} from '@/lib/validations/contact.schema';
import {
  createContactAddressSchema,
  updateContactAddressSchema,
  type CreateContactAddressInput,
  type UpdateContactAddressInput,
} from '@/lib/validations/contact-address.schema';
import {
  createContactPersonSchema,
  updateContactPersonSchema,
  type CreateContactPersonInput,
  type UpdateContactPersonInput,
} from '@/lib/validations/contact-person.schema';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ContactListResult {
  contacts: Array<{
    id: string;
    contactType: ContactType;
    legalName: string;
    tradeName: string | null;
    rtn: string | null;
    isCustomer: boolean;
    isSupplier: boolean;
    email: string | null;
    phone: string | null;
    isActive: boolean;
    paymentTerms: { id: string; name: string; daysUntilDue: number } | null;
    createdAt: Date;
    updatedAt: Date;
  }>;
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

interface ContactDetail extends Contact {
  addresses: ContactAddress[];
  persons: ContactPerson[];
  paymentTerms: { id: string; name: string; daysUntilDue: number } | null;
}

// ─── ContactService ───────────────────────────────────────────────────────────

export class ContactService {
  // === Contacts CRUD ===

  async listContacts(companyId: string, filters?: ContactFilters): Promise<ContactListResult> {
    const page = filters?.page ?? 1;
    const limit = filters?.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { companyId };

    if (typeof filters?.isActive === 'boolean') {
      where.isActive = filters.isActive;
    }

    if (filters?.type) {
      where.contactType = filters.type;
    }

    if (filters?.role === 'customer') {
      where.isCustomer = true;
    } else if (filters?.role === 'supplier') {
      where.isSupplier = true;
    } else if (filters?.role === 'both') {
      where.isCustomer = true;
      where.isSupplier = true;
    }

    if (filters?.paymentTermsId) {
      where.paymentTermsId = filters.paymentTermsId;
    }

    if (filters?.search) {
      where.OR = [
        { legalName: { contains: filters.search, mode: 'insensitive' } },
        { tradeName: { contains: filters.search, mode: 'insensitive' } },
        { rtn: { contains: filters.search, mode: 'insensitive' } },
        { email: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const orderBy = filters?.orderBy ?? 'legalName';
    const orderDir = filters?.orderDir ?? 'asc';

    const [contacts, total] = await Promise.all([
      prisma.contact.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [orderBy]: orderDir },
        select: {
          id: true,
          contactType: true,
          legalName: true,
          tradeName: true,
          rtn: true,
          isCustomer: true,
          isSupplier: true,
          email: true,
          phone: true,
          isActive: true,
          paymentTerms: { select: { id: true, name: true, daysUntilDue: true } },
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.contact.count({ where }),
    ]);

    return {
      contacts,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async getContactById(id: string, companyId: string): Promise<ContactDetail> {
    const contact = await prisma.contact.findFirst({
      where: { id, companyId },
      include: {
        addresses: { orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }] },
        persons: {
          where: { isActive: true },
          orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
        },
        paymentTerms: { select: { id: true, name: true, daysUntilDue: true } },
      },
    });

    if (!contact) {
      throw new Error('Contacto no encontrado');
    }

    return contact;
  }

  async createContact(companyId: string, data: CreateContactInput): Promise<Contact> {
    const validated = createContactSchema.parse(data);

    // Validar RTN único dentro del tenant (solo si se provee)
    if (validated.rtn) {
      const rtnExists = await prisma.contact.findFirst({
        where: { companyId, rtn: validated.rtn },
      });
      if (rtnExists) {
        throw new Error('Ya existe un contacto con ese RTN en esta empresa');
      }
    }

    // Validar que paymentTermsId pertenece a la empresa
    if (validated.paymentTermsId) {
      const terms = await prisma.paymentTerms.findFirst({
        where: { id: validated.paymentTermsId, companyId },
      });
      if (!terms) {
        throw new Error('Términos de pago no encontrados');
      }
    }

    return prisma.contact.create({
      data: { ...validated, companyId },
    });
  }

  async updateContact(id: string, companyId: string, data: UpdateContactInput): Promise<Contact> {
    const validated = updateContactSchema.parse({ ...data, id });

    await this.getContactById(id, companyId);

    if (validated.rtn) {
      const rtnInUse = await prisma.contact.findFirst({
        where: { companyId, rtn: validated.rtn, id: { not: id } },
      });
      if (rtnInUse) {
        throw new Error('Ya existe un contacto con ese RTN en esta empresa');
      }
    }

    if (validated.paymentTermsId) {
      const terms = await prisma.paymentTerms.findFirst({
        where: { id: validated.paymentTermsId, companyId },
      });
      if (!terms) {
        throw new Error('Términos de pago no encontrados');
      }
    }

    const { id: _id, ...updateData } = validated;

    return prisma.contact.update({ where: { id }, data: updateData });
  }

  async deleteContact(id: string, companyId: string): Promise<{ success: boolean }> {
    await this.getContactById(id, companyId);

    await prisma.contact.update({
      where: { id },
      data: { isActive: false },
    });

    return { success: true };
  }

  // === Addresses ===

  async listAddresses(contactId: string, companyId: string): Promise<ContactAddress[]> {
    await this.getContactById(contactId, companyId);

    return prisma.contactAddress.findMany({
      where: { contactId, companyId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    });
  }

  async createAddress(
    contactId: string,
    companyId: string,
    data: CreateContactAddressInput,
  ): Promise<ContactAddress> {
    const validated = createContactAddressSchema.parse(data);

    await this.getContactById(contactId, companyId);

    // Si es default, desmarcar la anterior del mismo tipo
    if (validated.isDefault) {
      await prisma.contactAddress.updateMany({
        where: {
          contactId,
          companyId,
          addressType: validated.addressType as AddressType,
          isDefault: true,
        },
        data: { isDefault: false },
      });
    }

    return prisma.contactAddress.create({
      data: { ...validated, contactId, companyId },
    });
  }

  async updateAddress(
    addressId: string,
    contactId: string,
    companyId: string,
    data: UpdateContactAddressInput,
  ): Promise<ContactAddress> {
    const validated = updateContactAddressSchema.parse({ ...data, id: addressId });

    const existing = await prisma.contactAddress.findFirst({
      where: { id: addressId, contactId, companyId },
    });
    if (!existing) throw new Error('Dirección no encontrada');

    if (validated.isDefault) {
      const addressType = (validated.addressType ?? existing.addressType) as AddressType;
      await prisma.contactAddress.updateMany({
        where: { contactId, companyId, addressType, isDefault: true, id: { not: addressId } },
        data: { isDefault: false },
      });
    }

    const { id: _id, ...updateData } = validated;

    return prisma.contactAddress.update({ where: { id: addressId }, data: updateData });
  }

  async deleteAddress(
    addressId: string,
    contactId: string,
    companyId: string,
  ): Promise<{ success: boolean }> {
    const existing = await prisma.contactAddress.findFirst({
      where: { id: addressId, contactId, companyId },
    });
    if (!existing) throw new Error('Dirección no encontrada');

    await prisma.contactAddress.delete({ where: { id: addressId } });

    return { success: true };
  }

  // === Persons ===

  async listPersons(contactId: string, companyId: string): Promise<ContactPerson[]> {
    await this.getContactById(contactId, companyId);

    return prisma.contactPerson.findMany({
      where: { contactId, companyId, isActive: true },
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
    });
  }

  async createPerson(
    contactId: string,
    companyId: string,
    data: CreateContactPersonInput,
  ): Promise<ContactPerson> {
    const validated = createContactPersonSchema.parse(data);

    await this.getContactById(contactId, companyId);

    // Si es primario, desmarcar el anterior
    if (validated.isPrimary) {
      await prisma.contactPerson.updateMany({
        where: { contactId, companyId, isPrimary: true },
        data: { isPrimary: false },
      });
    }

    return prisma.contactPerson.create({
      data: { ...validated, contactId, companyId },
    });
  }

  async updatePerson(
    personId: string,
    contactId: string,
    companyId: string,
    data: UpdateContactPersonInput,
  ): Promise<ContactPerson> {
    const validated = updateContactPersonSchema.parse({ ...data, id: personId });

    const existing = await prisma.contactPerson.findFirst({
      where: { id: personId, contactId, companyId },
    });
    if (!existing) throw new Error('Persona de contacto no encontrada');

    if (validated.isPrimary) {
      await prisma.contactPerson.updateMany({
        where: { contactId, companyId, isPrimary: true, id: { not: personId } },
        data: { isPrimary: false },
      });
    }

    const { id: _id, ...updateData } = validated;

    return prisma.contactPerson.update({ where: { id: personId }, data: updateData });
  }

  async deletePerson(
    personId: string,
    contactId: string,
    companyId: string,
  ): Promise<{ success: boolean }> {
    const existing = await prisma.contactPerson.findFirst({
      where: { id: personId, contactId, companyId },
    });
    if (!existing) throw new Error('Persona de contacto no encontrada');

    await prisma.contactPerson.update({
      where: { id: personId },
      data: { isActive: false },
    });

    return { success: true };
  }
}

export const contactService = new ContactService();
