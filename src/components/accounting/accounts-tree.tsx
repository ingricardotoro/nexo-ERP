'use client';

// src/components/accounting/accounts-tree.tsx
import { useState, useMemo } from 'react';
import { ChevronRight, ChevronDown, Minus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { AccountNode } from '@/lib/services/accounting/account.service';
import type { AccountType } from '@prisma/client';

// ─── Types ────────────────────────────────────────────────────────────────────

interface AccountsTreeProps {
  roots: AccountNode[];
  searchQuery: string;
  typeFilter: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<AccountType, string> = {
  ASSET: 'Activo',
  LIABILITY: 'Pasivo',
  EQUITY: 'Patrimonio',
  INCOME: 'Ingreso',
  COST: 'Costo',
  EXPENSE: 'Gasto',
  CONTRA: 'Contra',
};

const TYPE_COLORS: Record<AccountType, string> = {
  ASSET: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  LIABILITY: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  EQUITY: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  INCOME: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  COST: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  EXPENSE: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  CONTRA: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

interface FlatRow {
  node: AccountNode;
  depth: number; // 0-based depth for indentation
}

/** Returns true if node or any descendant matches the query */
function nodeMatchesQuery(node: AccountNode, query: string, type: string): boolean {
  const q = query.toLowerCase();
  const selfMatch =
    (!q || node.code.toLowerCase().includes(q) || node.name.toLowerCase().includes(q)) &&
    (!type || node.accountType === type);

  if (selfMatch) return true;
  return node.children.some((child) => nodeMatchesQuery(child, query, type));
}

/** Filter tree keeping only branches that contain matches */
function filterTree(nodes: AccountNode[], query: string, type: string): AccountNode[] {
  if (!query && !type) return nodes;
  return nodes
    .filter((node) => nodeMatchesQuery(node, query, type))
    .map((node) => ({
      ...node,
      children: filterTree(node.children, query, type),
    }));
}

// ─── Row Component ────────────────────────────────────────────────────────────

interface RowProps {
  node: AccountNode;
  depth: number;
  isExpanded: boolean;
  onToggle: (id: string) => void;
}

function AccountRow({ node, depth, isExpanded, onToggle }: RowProps) {
  const indent = depth * 20; // 20px per level
  const hasChildren = node.children.length > 0;

  return (
    <tr
      className={[
        'border-b transition-colors last:border-0',
        'hover:bg-muted/40',
        !node.isActive ? 'opacity-50' : '',
        depth === 0 ? 'bg-muted/20 font-semibold' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {/* Code + Expand */}
      <td className="px-4 py-2">
        <div className="flex items-center gap-1" style={{ paddingLeft: `${indent}px` }}>
          {hasChildren ? (
            <button
              onClick={() => onToggle(node.id)}
              className="text-muted-foreground hover:text-foreground flex h-5 w-5 flex-shrink-0 items-center justify-center rounded transition-colors"
              aria-label={isExpanded ? 'Colapsar' : 'Expandir'}
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </button>
          ) : (
            <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center">
              <Minus className="text-muted-foreground/40 h-3 w-3" />
            </span>
          )}
          <span
            className={[
              'font-mono text-sm',
              depth === 0 ? 'text-foreground font-bold' : 'text-muted-foreground',
            ].join(' ')}
          >
            {node.code}
          </span>
        </div>
      </td>

      {/* Name */}
      <td className="px-4 py-2">
        <span
          className={[
            'text-sm',
            depth === 0 ? 'font-semibold' : depth === 1 ? 'font-medium' : '',
          ].join(' ')}
        >
          {node.name}
        </span>
        {node.description && (
          <p className="text-muted-foreground mt-0.5 truncate text-xs">{node.description}</p>
        )}
      </td>

      {/* Type */}
      <td className="hidden px-4 py-2 sm:table-cell">
        <span
          className={[
            'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
            TYPE_COLORS[node.accountType],
          ].join(' ')}
        >
          {TYPE_LABELS[node.accountType]}
        </span>
      </td>

      {/* Nature */}
      <td className="hidden px-4 py-2 text-center sm:table-cell">
        <span
          className={[
            'inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold',
            node.accountNature === 'DEBIT'
              ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
              : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
          ].join(' ')}
          title={node.accountNature === 'DEBIT' ? 'Naturaleza Deudora' : 'Naturaleza Acreedora'}
        >
          {node.accountNature === 'DEBIT' ? 'D' : 'C'}
        </span>
      </td>

      {/* Entry */}
      <td className="hidden px-4 py-2 text-center lg:table-cell">
        {node.allowDirectEntry ? (
          <Badge
            variant="outline"
            className="border-green-300 text-xs text-green-700 dark:text-green-400"
          >
            Hoja
          </Badge>
        ) : (
          <Badge variant="outline" className="text-muted-foreground text-xs">
            Grupo
          </Badge>
        )}
      </td>

      {/* Status */}
      <td className="hidden px-4 py-2 text-center md:table-cell">
        <span
          className={[
            'inline-block h-2 w-2 rounded-full',
            node.isActive ? 'bg-green-500' : 'bg-gray-300',
          ].join(' ')}
          title={node.isActive ? 'Activa' : 'Inactiva'}
        />
      </td>
    </tr>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function AccountsTree({ roots, searchQuery, typeFilter }: AccountsTreeProps) {
  const filtered = useMemo(
    () => filterTree(roots, searchQuery, typeFilter),
    [roots, searchQuery, typeFilter],
  );

  // Auto-expand L1 and L2 by default; L3+ collapsed
  const defaultExpanded = useMemo(() => {
    const ids = new Set<string>();
    function collect(nodes: AccountNode[], depth: number) {
      for (const node of nodes) {
        if (depth < 2 && node.children.length > 0) {
          ids.add(node.id);
          collect(node.children, depth + 1);
        }
      }
    }
    collect(roots, 0);
    return ids;
  }, [roots]);

  const [expandedIds, setExpandedIds] = useState<Set<string>>(defaultExpanded);

  // When search/filter is active, auto-expand everything that matches
  const effectiveExpanded = useMemo(() => {
    if (!searchQuery && !typeFilter) return expandedIds;
    // Expand all parent nodes in filtered tree
    const ids = new Set<string>();
    function expandAll(nodes: AccountNode[]) {
      for (const node of nodes) {
        if (node.children.length > 0) {
          ids.add(node.id);
          expandAll(node.children);
        }
      }
    }
    expandAll(filtered);
    return ids;
  }, [searchQuery, typeFilter, filtered, expandedIds]);

  const handleToggle = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Build visible flat rows respecting expand state
  function buildVisibleRows(nodes: AccountNode[], depth: number): FlatRow[] {
    const rows: FlatRow[] = [];
    for (const node of nodes) {
      rows.push({ node, depth });
      if (node.children.length > 0 && effectiveExpanded.has(node.id)) {
        rows.push(...buildVisibleRows(node.children, depth + 1));
      }
    }
    return rows;
  }

  const visibleRows = buildVisibleRows(filtered, 0);

  if (visibleRows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-muted-foreground text-sm">
          {searchQuery || typeFilter
            ? 'No se encontraron cuentas con los filtros aplicados.'
            : 'No hay cuentas en el plan contable de esta empresa.'}
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b">
            <th className="text-muted-foreground px-4 py-3 text-left text-xs font-medium tracking-wide uppercase">
              Código
            </th>
            <th className="text-muted-foreground px-4 py-3 text-left text-xs font-medium tracking-wide uppercase">
              Nombre de la Cuenta
            </th>
            <th className="text-muted-foreground hidden px-4 py-3 text-left text-xs font-medium tracking-wide uppercase sm:table-cell">
              Tipo
            </th>
            <th className="text-muted-foreground hidden px-4 py-3 text-center text-xs font-medium tracking-wide uppercase sm:table-cell">
              Nat.
            </th>
            <th className="text-muted-foreground hidden px-4 py-3 text-center text-xs font-medium tracking-wide uppercase lg:table-cell">
              Nivel
            </th>
            <th className="text-muted-foreground hidden px-4 py-3 text-center text-xs font-medium tracking-wide uppercase md:table-cell">
              Estado
            </th>
          </tr>
        </thead>
        <tbody>
          {visibleRows.map(({ node, depth }) => (
            <AccountRow
              key={node.id}
              node={node}
              depth={depth}
              isExpanded={effectiveExpanded.has(node.id)}
              onToggle={handleToggle}
            />
          ))}
        </tbody>
      </table>
      <p className="text-muted-foreground px-4 py-3 text-xs">
        Mostrando {visibleRows.length} cuentas
        {searchQuery || typeFilter ? ' (filtradas)' : ''}
      </p>
    </div>
  );
}
