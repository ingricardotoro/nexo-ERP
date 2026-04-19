'use client';

// src/components/accounting/accounts-tree.tsx
import { useState, useMemo } from 'react';
import { ChevronRight, ChevronDown, Minus, Pencil, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { AccountNode } from '@/lib/services/accounting/account.service';
import type { AccountType } from '@prisma/client';

interface AccountsTreeProps {
  roots: AccountNode[];
  searchQuery: string;
  typeFilter: string;
  reportFilter: 'all' | 'in_reports' | 'not_in_reports';
  companyId: string;
  canWrite: boolean;
  onEdit: (node: AccountNode) => void;
  onDelete: (node: AccountNode) => void;
  onToggleReport: (id: string, value: boolean) => Promise<void>;
}

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
  ASSET: 'bg-blue-100 text-blue-800',
  LIABILITY: 'bg-red-100 text-red-800',
  EQUITY: 'bg-purple-100 text-purple-800',
  INCOME: 'bg-green-100 text-green-800',
  COST: 'bg-orange-100 text-orange-800',
  EXPENSE: 'bg-yellow-100 text-yellow-800',
  CONTRA: 'bg-gray-100 text-gray-700',
};

interface FlatRow {
  node: AccountNode;
  depth: number;
}

function nodeMatchesQuery(node: AccountNode, query: string, type: string): boolean {
  const q = query.toLowerCase();
  const selfMatch =
    (!q || node.code.toLowerCase().includes(q) || node.name.toLowerCase().includes(q)) &&
    (!type || node.accountType === type);
  if (selfMatch) return true;
  return node.children.some((child) => nodeMatchesQuery(child, query, type));
}

function filterTree(nodes: AccountNode[], query: string, type: string): AccountNode[] {
  if (!query && !type) return nodes;
  return nodes
    .filter((node) => nodeMatchesQuery(node, query, type))
    .map((node) => ({ ...node, children: filterTree(node.children, query, type) }));
}

function filterByReport(
  nodes: AccountNode[],
  filter: 'all' | 'in_reports' | 'not_in_reports',
): AccountNode[] {
  if (filter === 'all') return nodes;
  return nodes
    .map((n) => ({ ...n, children: filterByReport(n.children, filter) }))
    .filter((n) => {
      const selfMatch = filter === 'in_reports' ? n.showInReports : !n.showInReports;
      return selfMatch || n.children.length > 0;
    });
}

interface RowProps {
  node: AccountNode;
  depth: number;
  isExpanded: boolean;
  canWrite: boolean;
  onToggle: (id: string) => void;
  onEdit: (node: AccountNode) => void;
  onDelete: (node: AccountNode) => void;
  onToggleReport: (id: string, value: boolean) => Promise<void>;
}

function AccountRow({
  node,
  depth,
  isExpanded,
  canWrite,
  onToggle,
  onEdit,
  onDelete,
  onToggleReport,
}: RowProps) {
  const indent = depth * 20;
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
              className="text-muted-foreground hover:text-foreground flex h-5 w-5 shrink-0 items-center justify-center rounded transition-colors"
              aria-label={isExpanded ? 'Colapsar' : 'Expandir'}
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </button>
          ) : (
            <span className="flex h-5 w-5 shrink-0 items-center justify-center">
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
              ? 'bg-blue-100 text-blue-700'
              : 'bg-emerald-100 text-emerald-700',
          ].join(' ')}
          title={node.accountNature === 'DEBIT' ? 'Naturaleza Deudora' : 'Naturaleza Acreedora'}
        >
          {node.accountNature === 'DEBIT' ? 'D' : 'C'}
        </span>
      </td>

      {/* Entry level */}
      <td className="hidden px-4 py-2 text-center lg:table-cell">
        {node.allowDirectEntry ? (
          <Badge variant="outline" className="border-green-300 text-xs text-green-700">
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

      {/* Reportes toggle */}
      <td className="hidden px-4 py-2 text-center md:table-cell">
        <button
          onClick={canWrite ? () => void onToggleReport(node.id, !node.showInReports) : undefined}
          disabled={!canWrite}
          className={[
            'inline-flex h-5 w-9 items-center rounded-full transition-colors',
            node.showInReports ? 'bg-emerald-500' : 'bg-slate-200',
            canWrite ? 'cursor-pointer' : 'cursor-default opacity-70',
          ].join(' ')}
          title={
            node.showInReports
              ? 'Visible en reportes — clic para ocultar'
              : 'Oculto en reportes — clic para incluir'
          }
        >
          <span
            className={[
              'inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform',
              node.showInReports ? 'translate-x-4' : 'translate-x-0.5',
            ].join(' ')}
          />
        </button>
      </td>

      {/* Actions */}
      {canWrite && (
        <td className="px-4 py-2 text-right">
          <div className="flex items-center justify-end gap-1">
            <button
              onClick={() => onEdit(node)}
              className="text-muted-foreground hover:text-foreground rounded p-1 transition-colors"
              title="Editar cuenta"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => onDelete(node)}
              className="text-muted-foreground rounded p-1 transition-colors hover:text-red-500"
              title="Eliminar / Desactivar"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </td>
      )}
    </tr>
  );
}

export function AccountsTree({
  roots,
  searchQuery,
  typeFilter,
  reportFilter,
  companyId,
  canWrite,
  onEdit,
  onDelete,
  onToggleReport,
}: AccountsTreeProps) {
  const STORAGE_KEY = `nexoerp:accounts:expanded:${companyId}`;

  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') return new Set<string>();
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      return saved ? new Set<string>(JSON.parse(saved) as string[]) : new Set<string>();
    } catch {
      return new Set<string>();
    }
  });

  const filtered = useMemo(() => {
    const bySearch = filterTree(roots, searchQuery, typeFilter);
    return filterByReport(bySearch, reportFilter);
  }, [roots, searchQuery, typeFilter, reportFilter]);

  const effectiveExpanded = useMemo(() => {
    if (!searchQuery && !typeFilter && reportFilter === 'all') return expandedIds;
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
  }, [searchQuery, typeFilter, reportFilter, filtered, expandedIds]);

  const handleToggle = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
      } catch {}
      return next;
    });
  };

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
          {searchQuery || typeFilter || reportFilter !== 'all'
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
            <th className="text-muted-foreground hidden px-4 py-3 text-center text-xs font-medium tracking-wide uppercase md:table-cell">
              Reportes
            </th>
            {canWrite && (
              <th className="text-muted-foreground px-4 py-3 text-right text-xs font-medium tracking-wide uppercase">
                Acciones
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {visibleRows.map(({ node, depth }) => (
            <AccountRow
              key={node.id}
              node={node}
              depth={depth}
              isExpanded={effectiveExpanded.has(node.id)}
              canWrite={canWrite}
              onToggle={handleToggle}
              onEdit={onEdit}
              onDelete={onDelete}
              onToggleReport={onToggleReport}
            />
          ))}
        </tbody>
      </table>
      <p className="text-muted-foreground px-4 py-3 text-xs">
        Mostrando {visibleRows.length} cuentas
        {searchQuery || typeFilter || reportFilter !== 'all' ? ' (filtradas)' : ''}
      </p>
    </div>
  );
}
