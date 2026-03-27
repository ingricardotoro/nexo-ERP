// src/lib/services/accounting/account.service.ts
import type { AccountNature, AccountType } from '@prisma/client';
import prisma from '@/lib/db/prisma';

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

// ─── Service ──────────────────────────────────────────────────────────────────

export const accountService = {
  /**
   * Obtiene el plan de cuentas completo como árbol jerárquico.
   * Retorna los nodos raíz (level=1); cada nodo tiene su `children` populado recursivamente.
   */
  async getAccountsTree(companyId: string): Promise<AccountNode[]> {
    const rows = await prisma.account.findMany({
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
    const [total, active, leafCount, byTypeRaw] = await Promise.all([
      prisma.account.count({ where: { companyId } }),
      prisma.account.count({ where: { companyId, isActive: true } }),
      prisma.account.count({ where: { companyId, allowDirectEntry: true } }),
      prisma.account.groupBy({
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
};
