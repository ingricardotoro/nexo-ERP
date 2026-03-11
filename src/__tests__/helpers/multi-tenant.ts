// src/__tests__/helpers/multi-tenant.ts
/**
 * Helpers para tests de aislamiento multi-tenant.
 *
 * Se usarán extensivamente en Fase 1+ para verificar
 * que los datos de una empresa nunca se filtran a otra.
 *
 * @see REQUIREMENTS.md §11 — Modelo de Multi-tenencia
 */

export const TENANT_A = {
  id: '00000000-0000-0000-0000-000000000001',
  name: 'Empresa A (Test)',
  rtn: '0801-TEST-00001',
};

export const TENANT_B = {
  id: '00000000-0000-0000-0000-000000000002',
  name: 'Empresa B (Test)',
  rtn: '0501-TEST-00002',
};

/**
 * Verifica que un array de resultados solo contiene items del tenant esperado.
 * Uso: expectTenantIsolation(results, TENANT_A.id);
 */
export function expectTenantIsolation<T extends { companyId: string }>(
  results: T[],
  expectedCompanyId: string,
): void {
  results.forEach((item) => {
    expect(item.companyId).toBe(expectedCompanyId);
  });
}

/**
 * Verifica que dos conjuntos de resultados no comparten IDs.
 * Uso: expectNoDataLeakage(resultsA, resultsB);
 */
export function expectNoDataLeakage<T extends { id: string }>(resultsA: T[], resultsB: T[]): void {
  const idsA = new Set(resultsA.map((item) => item.id));
  const idsB = new Set(resultsB.map((item) => item.id));

  idsA.forEach((id) => {
    expect(idsB.has(id)).toBe(false);
  });
}
