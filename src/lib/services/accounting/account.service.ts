// src/lib/services/accounting/account.service.ts
import type { AccountNature, AccountType } from '@prisma/client';
import basePrisma from '@/lib/db/prisma';
import { createTenantPrisma } from '@/lib/db/tenant-extension';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AccountNode {
  id: string;
  code: string;
  name: string;
  accountType: AccountType;
  accountNature: AccountNature;
  isParent: boolean;
  allowDirectEntry: boolean;
  isActive: boolean;
  showInReports: boolean;
  description: string | null;
  level: number;
  parentId: string | null;
  children: AccountNode[];
}

export interface AccountStats {
  total: number;
  active: number;
  leafAccounts: number; // allowDirectEntry=true
  byType: Record<AccountType, number>;
}

import type { z } from 'zod';
import type { createAccountSchema, updateAccountSchema } from '@/lib/validations/account.schema';

export type CreateAccountInput = z.infer<typeof createAccountSchema>;
export type UpdateAccountInput = z.infer<typeof updateAccountSchema>;

// ─── Service ──────────────────────────────────────────────────────────────────

export const accountService = {
  /**
   * Obtiene el plan de cuentas completo como árbol jerárquico.
   * Retorna los nodos raíz (level=1); cada nodo tiene su `children` populado recursivamente.
   */
  async getAccountsTree(companyId: string): Promise<AccountNode[]> {
    const db = createTenantPrisma(basePrisma, companyId);
    const rows = await db.account.findMany({
      where: { companyId },
      select: {
        id: true,
        code: true,
        name: true,
        accountType: true,
        accountNature: true,
        isParent: true,
        allowDirectEntry: true,
        isActive: true,
        showInReports: true,
        description: true,
        parentId: true,
      },
      orderBy: { code: 'asc' },
    });

    // Build map id → node
    const nodeMap = new Map<string, AccountNode>();
    for (const row of rows) {
      nodeMap.set(row.id, { ...row, level: 0, children: [] });
    }

    // Assign levels and build children arrays
    const roots: AccountNode[] = [];
    for (const node of nodeMap.values()) {
      if (node.parentId === null) {
        node.level = 1;
        roots.push(node);
      } else {
        const parent = nodeMap.get(node.parentId);
        if (parent) {
          node.level = 0; // will be resolved below
          parent.children.push(node);
        }
      }
    }

    // Resolve levels recursively
    function assignLevels(nodes: AccountNode[], level: number) {
      for (const node of nodes) {
        node.level = level;
        assignLevels(node.children, level + 1);
      }
    }
    assignLevels(roots, 1);

    return roots;
  },

  /**
   * Estadísticas del plan de cuentas para las tarjetas de resumen.
   */
  async getAccountStats(companyId: string): Promise<AccountStats> {
    const db = createTenantPrisma(basePrisma, companyId);
    const [total, active, leafCount, byTypeRaw] = await Promise.all([
      db.account.count({ where: { companyId } }),
      db.account.count({ where: { companyId, isActive: true } }),
      db.account.count({ where: { companyId, allowDirectEntry: true } }),
      db.account.groupBy({
        by: ['accountType'],
        where: { companyId },
        _count: { _all: true },
      }),
    ]);

    const byType = {} as Record<AccountType, number>;
    for (const row of byTypeRaw) {
      byType[row.accountType] = row._count._all;
    }

    return { total, active, leafAccounts: leafCount, byType };
  },

  async createAccount(companyId: string, input: CreateAccountInput): Promise<AccountNode> {
    const db = createTenantPrisma(basePrisma, companyId);

    const existing = await db.account.findFirst({ where: { companyId, code: input.code } });
    if (existing) throw new Error('Ya existe una cuenta con ese código en esta empresa');

    if (input.parentId) {
      const parent = await db.account.findFirst({ where: { id: input.parentId, companyId } });
      if (!parent) throw new Error('Cuenta padre no encontrada');
      if (!parent.isParent) {
        await db.account.update({
          where: { id: input.parentId },
          data: { isParent: true, allowDirectEntry: false },
        });
      }
    }

    const account = await db.account.create({
      data: {
        companyId,
        code: input.code,
        name: input.name,
        accountType: input.accountType,
        accountNature: input.accountNature,
        parentId: input.parentId ?? null,
        allowDirectEntry: input.allowDirectEntry ?? true,
        isActive: input.isActive ?? true,
        showInReports: input.showInReports ?? true,
        description: input.description ?? null,
        isParent: false,
      },
      select: {
        id: true,
        code: true,
        name: true,
        accountType: true,
        accountNature: true,
        isParent: true,
        allowDirectEntry: true,
        isActive: true,
        showInReports: true,
        description: true,
        parentId: true,
      },
    });
    return { ...account, level: 0, children: [] };
  },

  async updateAccount(
    companyId: string,
    id: string,
    input: UpdateAccountInput,
  ): Promise<AccountNode> {
    const db = createTenantPrisma(basePrisma, companyId);

    const existing = await db.account.findFirst({ where: { id, companyId } });
    if (!existing) throw new Error('Cuenta no encontrada');

    if (input.code && input.code !== existing.code) {
      const dup = await db.account.findFirst({ where: { companyId, code: input.code } });
      if (dup) throw new Error('Ya existe una cuenta con ese código en esta empresa');
    }

    const account = await db.account.update({
      where: { id },
      data: { ...input },
      select: {
        id: true,
        code: true,
        name: true,
        accountType: true,
        accountNature: true,
        isParent: true,
        allowDirectEntry: true,
        isActive: true,
        showInReports: true,
        description: true,
        parentId: true,
      },
    });
    return { ...account, level: 0, children: [] };
  },

  async deleteAccount(companyId: string, id: string): Promise<{ deleted: boolean }> {
    const db = createTenantPrisma(basePrisma, companyId);

    const account = await db.account.findFirst({
      where: { id, companyId },
      include: {
        _count: {
          select: {
            journalEntryLines: true,
            invoiceLines: true,
            bankAccounts: true,
            children: true,
          },
        },
      },
    });

    if (!account) throw new Error('Cuenta no encontrada');

    if (account._count.children > 0) {
      throw new Error('No se puede eliminar una cuenta con subcuentas');
    }

    const hasMovements =
      account._count.journalEntryLines > 0 ||
      account._count.invoiceLines > 0 ||
      account._count.bankAccounts > 0;

    if (hasMovements) {
      await db.account.update({ where: { id }, data: { isActive: false } });
      return { deleted: false };
    }

    await db.account.delete({ where: { id } });
    return { deleted: true };
  },
};
