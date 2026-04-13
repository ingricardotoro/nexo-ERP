import type { SystemRole } from '@prisma/client';
import prisma from '@/lib/db/prisma';
import { createTenantPrisma } from '@/lib/db/tenant-extension';
import {
  createUserSchema,
  updateUserSchema,
  type CreateUserInput,
  type UpdateUserInput,
  type UserFilters,
  canCreateUser,
} from '@/lib/validations/user.schema';

interface UserListResult {
  users: Array<{
    id: string;
    fullName: string;
    email: string;
    role: SystemRole;
    isActive: boolean;
    cognitoSub: string;
    lastLoginAt: Date | null;
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

export class UserService {
  async listUsers(companyId: string, filters?: UserFilters): Promise<UserListResult> {
    const db = createTenantPrisma(prisma, companyId);
    const page = filters?.page ?? 1;
    const limit = filters?.limit ?? 10;
    const skip = (page - 1) * limit;

    const where: {
      isActive?: boolean;
      role?: SystemRole;
      OR?: Array<
        | { fullName: { contains: string; mode: 'insensitive' } }
        | { email: { contains: string; mode: 'insensitive' } }
      >;
    } = {};

    if (typeof filters?.isActive === 'boolean') {
      where.isActive = filters.isActive;
    }

    if (filters?.role) {
      where.role = filters.role;
    }

    if (filters?.search) {
      where.OR = [
        { fullName: { contains: filters.search, mode: 'insensitive' } },
        { email: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const orderBy = filters?.orderBy ?? 'createdAt';
    const orderDir = filters?.orderDir ?? 'desc';

    const [users, totalCount] = await Promise.all([
      db.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [orderBy]: orderDir },
        select: {
          id: true,
          fullName: true,
          email: true,
          role: true,
          isActive: true,
          cognitoSub: true,
          lastLoginAt: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      db.user.count({ where }),
    ]);

    return {
      users,
      pagination: {
        total: totalCount,
        page,
        limit,
        totalPages: Math.ceil(totalCount / limit),
      },
    };
  }

  async getUserById(id: string, companyId: string) {
    const db = createTenantPrisma(prisma, companyId);
    const user = await db.user.findFirst({
      where: { id, isActive: true },
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
        isActive: true,
        cognitoSub: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new Error('Usuario no encontrado');
    }

    return user;
  }

  async createUser(companyId: string, data: CreateUserInput) {
    const db = createTenantPrisma(prisma, companyId);
    const validatedData = createUserSchema.parse(data);

    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { maxUsers: true },
    });

    if (!company) {
      throw new Error('Empresa no encontrada');
    }

    const activeUsersCount = await db.user.count({
      where: { isActive: true },
    });

    if (!canCreateUser(activeUsersCount, company.maxUsers)) {
      throw new Error(
        `Has alcanzado el limite de ${company.maxUsers} usuarios activos. Desactiva usuarios existentes o contacta a soporte para aumentar el limite.`,
      );
    }

    const existingUser = await db.user.findFirst({
      where: {
        email: validatedData.email,
        isActive: true,
      },
    });

    if (existingUser) {
      throw new Error('Este email ya esta en uso por otro usuario en esta empresa');
    }

    return db.user.create({
      data: {
        id: `temp-${Date.now()}`,
        cognitoSub: `temp-cognito-${Date.now()}`,
        companyId, // la extensión lo sobreescribe, pero Prisma types lo requieren
        fullName: validatedData.fullName,
        email: validatedData.email,
        role: validatedData.role,
        isActive: validatedData.isActive,
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });
  }

  async updateUser(id: string, companyId: string, data: UpdateUserInput) {
    const db = createTenantPrisma(prisma, companyId);
    const validatedData = updateUserSchema.parse({ ...data, id });

    const existingUser = await this.getUserById(id, companyId);

    if (validatedData.email && validatedData.email !== existingUser.email) {
      const emailInUse = await db.user.findFirst({
        where: {
          email: validatedData.email,
          isActive: true,
          id: { not: id },
        },
      });

      if (emailInUse) {
        throw new Error('Este email ya esta en uso por otro usuario en esta empresa');
      }
    }

    return db.user.update({
      where: { id },
      data: {
        ...(validatedData.fullName && { fullName: validatedData.fullName }),
        ...(validatedData.email && { email: validatedData.email }),
        ...(validatedData.role && { role: validatedData.role }),
        ...(typeof validatedData.isActive === 'boolean' && { isActive: validatedData.isActive }),
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
        isActive: true,
        updatedAt: true,
      },
    });
  }

  async deleteUser(id: string, companyId: string) {
    const db = createTenantPrisma(prisma, companyId);
    await this.getUserById(id, companyId);

    await db.user.update({
      where: { id },
      data: { isActive: false },
    });

    return { success: true };
  }
}

export const userService = new UserService();
