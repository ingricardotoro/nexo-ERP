/**
 * Tests Unitarios: tenant-extension.ts
 *
 * CRITICIDAD: P0 — Multi-tenant isolation es FUNDAMENTAL para seguridad del sistema
 *
 * ESTRATEGIA:
 * - Tests unitarios puros (SIN base de datos)
 * - Mockear Prisma Client Extensions behavior
 * - Verificar que args son modificados correctamente antes de ejecutar queries
 * - Cobertura objetivo: 90%+
 *
 * ÁREAS CUBIERTAS:
 * 1. Validación de entrada (companyId null/undefined/empty)
 * 2. Operaciones de lectura (findMany, findFirst, findUnique, count, aggregate)
 * 3. Operaciones de escritura (create, createMany, upsert)
 * 4. Operaciones de actualización/borrado (update, updateMany, delete, deleteMany)
 * 5. Modelos sin filtro (Company table)
 * 6. Relaciones (include, select)
 * 7. Edge cases (transacciones, queries complejos con AND/OR/NOT)
 *
 * NOTA: Tests de integración con BD real están en multi-tenant-isolation.test.ts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { createTenantPrisma, createAdminPrisma } from '../tenant-extension';

// ============================================================================
// TEST SUITE 1: Validación de Entrada
// ============================================================================

describe('tenant-extension.ts — Validación de Entrada', () => {
  it('debería aceptar companyId con formato UUID válido', () => {
    // Arrange
    const prismaMock = {
      $extends: vi.fn((extension) => {
        return { ...prismaMock, __extension: extension };
      }),
    } as unknown as PrismaClient;
    const companyId = '12345678-90ab-cdef-1234-567890abcdef';

    // Act & Assert
    expect(() => createTenantPrisma(prismaMock, companyId)).not.toThrow();
  });

  it('debería aceptar companyId sin validar formato (validación ocurre en PostgreSQL)', () => {
    // Arrange
    const prismaMock = {
      $extends: vi.fn((extension) => {
        return { ...prismaMock, __extension: extension };
      }),
    } as unknown as PrismaClient;

    // Act & Assert
    // La extensión NO valida el formato del companyId
    // La validación de UUID ocurre en PostgreSQL cuando se ejecuta el query
    expect(() => createTenantPrisma(prismaMock, '')).not.toThrow();
    expect(() => createTenantPrisma(prismaMock, 'invalid-uuid')).not.toThrow();
    expect(() => createTenantPrisma(prismaMock, '123')).not.toThrow();
  });
});

// ============================================================================
// TEST SUITE 2: Operaciones de Lectura
// ============================================================================

describe('tenant-extension.ts — Operaciones de Lectura (findMany, findFirst, etc.)', () => {
  let mockPrisma: PrismaClient;
  let mockQuery: ReturnType<typeof vi.fn>;
  const companyId = 'company-a-uuid';

  beforeEach(() => {
    // Mock del comportamiento de Prisma Client Extensions
    mockQuery = vi.fn(async (args) => args);

    mockPrisma = {
      $extends: vi.fn((extension) => {
        // Simular que la extensión se aplica y retorna un nuevo cliente
        const extendedClient = { ...mockPrisma };

        // Capturar el $allOperations handler para poder invocarlo en tests
        (extendedClient as any).__extensionHandler = extension.query?.$allModels?.$allOperations;

        return extendedClient;
      }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      $transaction: vi.fn(async (fn: (tx: any) => unknown) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const txMock: any = new Proxy({ $executeRaw: vi.fn().mockResolvedValue(0) } as any, {
          get(target: any, prop: string) {
            if (prop === '$executeRaw') return target.$executeRaw;
            // Model access (e.g. tx.user, tx.invoice) — route operation calls to mockQuery
            return new Proxy({} as any, { get: () => mockQuery });
          },
        });
        return fn(txMock);
      }),
    } as unknown as PrismaClient;
  });

  it('findMany debería inyectar companyId en WHERE', async () => {
    // Arrange
    const tenantPrisma = createTenantPrisma(mockPrisma, companyId);
    const handler = (tenantPrisma as any).__extensionHandler;

    const queryContext = {
      operation: 'findMany',
      model: 'User',
      args: { where: { isActive: true } },
      query: mockQuery,
    };

    // Act
    await handler(queryContext);

    // Assert
    expect(mockQuery).toHaveBeenCalledWith({
      where: {
        AND: [{ isActive: true }, { companyId }],
      },
    });
  });

  it('findMany SIN filtros previos debería crear WHERE solo con companyId', async () => {
    // Arrange
    const tenantPrisma = createTenantPrisma(mockPrisma, companyId);
    const handler = (tenantPrisma as any).__extensionHandler;

    const queryContext = {
      operation: 'findMany',
      model: 'User',
      args: {}, // Sin WHERE inicial
      query: mockQuery,
    };

    // Act
    await handler(queryContext);

    // Assert
    expect(mockQuery).toHaveBeenCalledWith({
      where: { companyId },
    });
  });

  it('findFirst debería inyectar companyId en WHERE', async () => {
    // Arrange
    const tenantPrisma = createTenantPrisma(mockPrisma, companyId);
    const handler = (tenantPrisma as any).__extensionHandler;

    const queryContext = {
      operation: 'findFirst',
      model: 'User',
      args: { where: { email: 'test@example.com' } },
      query: mockQuery,
    };

    // Act
    await handler(queryContext);

    // Assert
    expect(mockQuery).toHaveBeenCalledWith({
      where: {
        AND: [{ email: 'test@example.com' }, { companyId }],
      },
    });
  });

  it('findUnique NO inyecta companyId en WHERE (AND inválido para unique) — seguridad por FORCE RLS', async () => {
    // Arrange
    const tenantPrisma = createTenantPrisma(mockPrisma, companyId);
    const handler = (tenantPrisma as any).__extensionHandler;

    const userId = 'user-uuid-123';
    const queryContext = {
      operation: 'findUnique',
      model: 'User',
      args: { where: { id: userId } },
      query: mockQuery,
    };

    // Act
    await handler(queryContext);

    // Assert
    // findUnique no admite AND — companyId no se inyecta en WHERE.
    // La seguridad multi-tenant se garantiza mediante set_config en la transacción FORCE RLS.
    expect(mockQuery).toHaveBeenCalledWith({ where: { id: userId } });
  });

  it('count debería filtrar por companyId', async () => {
    // Arrange
    const tenantPrisma = createTenantPrisma(mockPrisma, companyId);
    const handler = (tenantPrisma as any).__extensionHandler;

    const queryContext = {
      operation: 'count',
      model: 'User',
      args: { where: { isActive: true } },
      query: mockQuery,
    };

    // Act
    await handler(queryContext);

    // Assert
    expect(mockQuery).toHaveBeenCalledWith({
      where: {
        AND: [{ isActive: true }, { companyId }],
      },
    });
  });

  it('aggregate debería filtrar por companyId', async () => {
    // Arrange
    const tenantPrisma = createTenantPrisma(mockPrisma, companyId);
    const handler = (tenantPrisma as any).__extensionHandler;

    const queryContext = {
      operation: 'aggregate',
      model: 'User',
      args: {
        where: { isActive: true },
        _count: true,
      },
      query: mockQuery,
    };

    // Act
    await handler(queryContext);

    // Assert
    expect(mockQuery).toHaveBeenCalledWith({
      where: {
        AND: [{ isActive: true }, { companyId }],
      },
      _count: true,
    });
  });

  it('groupBy debería filtrar por companyId', async () => {
    // Arrange
    const tenantPrisma = createTenantPrisma(mockPrisma, companyId);
    const handler = (tenantPrisma as any).__extensionHandler;

    const queryContext = {
      operation: 'groupBy',
      model: 'User',
      args: {
        by: ['role'],
        where: { isActive: true },
      },
      query: mockQuery,
    };

    // Act
    await handler(queryContext);

    // Assert
    expect(mockQuery).toHaveBeenCalledWith({
      by: ['role'],
      where: {
        AND: [{ isActive: true }, { companyId }],
      },
    });
  });

  it('debería preservar filtros WHERE complejos (AND, OR, NOT)', async () => {
    // Arrange
    const tenantPrisma = createTenantPrisma(mockPrisma, companyId);
    const handler = (tenantPrisma as any).__extensionHandler;

    const complexWhere = {
      OR: [{ role: 'CONTADOR' }, { role: 'ADMINISTRADOR' }],
      AND: [{ isActive: true }, { NOT: { email: { contains: 'test' } } }],
    };

    const queryContext = {
      operation: 'findMany',
      model: 'User',
      args: { where: complexWhere },
      query: mockQuery,
    };

    // Act
    await handler(queryContext);

    // Assert
    expect(mockQuery).toHaveBeenCalledWith({
      where: {
        AND: [complexWhere, { companyId }],
      },
    });
  });
});

// ============================================================================
// TEST SUITE 3: Operaciones de Escritura
// ============================================================================

describe('tenant-extension.ts — Operaciones de Escritura (create, createMany)', () => {
  let mockPrisma: PrismaClient;
  let mockQuery: ReturnType<typeof vi.fn>;
  const companyId = 'company-a-uuid';

  beforeEach(() => {
    mockQuery = vi.fn(async (args) => args);

    mockPrisma = {
      $extends: vi.fn((extension) => {
        const extendedClient = { ...mockPrisma };
        (extendedClient as any).__extensionHandler = extension.query?.$allModels?.$allOperations;
        return extendedClient;
      }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      $transaction: vi.fn(async (fn: (tx: any) => unknown) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const txMock: any = new Proxy({ $executeRaw: vi.fn().mockResolvedValue(0) } as any, {
          get(target: any, prop: string) {
            if (prop === '$executeRaw') return target.$executeRaw;
            // Model access (e.g. tx.user, tx.invoice) — route operation calls to mockQuery
            return new Proxy({} as any, { get: () => mockQuery });
          },
        });
        return fn(txMock);
      }),
    } as unknown as PrismaClient;
  });

  it('create debería inyectar companyId en data', async () => {
    // Arrange
    const tenantPrisma = createTenantPrisma(mockPrisma, companyId);
    const handler = (tenantPrisma as any).__extensionHandler;

    const userData = {
      email: 'new@example.com',
      name: 'New User',
      role: 'VENDEDOR',
    };

    const queryContext = {
      operation: 'create',
      model: 'User',
      args: { data: userData },
      query: mockQuery,
    };

    // Act
    await handler(queryContext);

    // Assert
    expect(mockQuery).toHaveBeenCalledWith({
      data: {
        ...userData,
        companyId,
      },
    });
  });

  it('create debería sobrescribir companyId si ya existe en data (tenant context es autoritativo)', async () => {
    // Arrange
    const tenantPrisma = createTenantPrisma(mockPrisma, companyId);
    const handler = (tenantPrisma as any).__extensionHandler;

    const userData = {
      email: 'malicious@example.com',
      name: 'Attacker',
      companyId: 'other-company-uuid', // ⚠️ Intento de inyectar otra empresa
    };

    const queryContext = {
      operation: 'create',
      model: 'User',
      args: { data: userData },
      query: mockQuery,
    };

    // Act
    await handler(queryContext);

    // Assert
    // Debe sobrescribir con el companyId del tenant context (defensa contra ataques)
    expect(mockQuery).toHaveBeenCalledWith({
      data: {
        email: 'malicious@example.com',
        name: 'Attacker',
        companyId, // Sobrescrito correctamente
      },
    });
  });

  it('createMany con array debería inyectar companyId en cada item', async () => {
    // Arrange
    const tenantPrisma = createTenantPrisma(mockPrisma, companyId);
    const handler = (tenantPrisma as any).__extensionHandler;

    const usersData = [
      { email: 'user1@example.com', name: 'User 1', role: 'VENDEDOR' },
      { email: 'user2@example.com', name: 'User 2', role: 'CONTADOR' },
    ];

    const queryContext = {
      operation: 'createMany',
      model: 'User',
      args: { data: usersData },
      query: mockQuery,
    };

    // Act
    await handler(queryContext);

    // Assert
    expect(mockQuery).toHaveBeenCalledWith({
      data: [
        { ...usersData[0], companyId },
        { ...usersData[1], companyId },
      ],
    });
  });

  it('createMany con objeto debería inyectar companyId', async () => {
    // Arrange
    const tenantPrisma = createTenantPrisma(mockPrisma, companyId);
    const handler = (tenantPrisma as any).__extensionHandler;

    const userData = {
      email: 'single@example.com',
      name: 'Single User',
    };

    const queryContext = {
      operation: 'createMany',
      model: 'User',
      args: { data: userData }, // Objeto plano (no array)
      query: mockQuery,
    };

    // Act
    await handler(queryContext);

    // Assert
    expect(mockQuery).toHaveBeenCalledWith({
      data: {
        ...userData,
        companyId,
      },
    });
  });

  it('upsert debería inyectar companyId en create, update y where', async () => {
    // Arrange
    const tenantPrisma = createTenantPrisma(mockPrisma, companyId);
    const handler = (tenantPrisma as any).__extensionHandler;

    const queryContext = {
      operation: 'upsert',
      model: 'User',
      args: {
        where: { email: 'test@example.com' },
        create: { email: 'test@example.com', name: 'Test User', role: 'VENDEDOR' },
        update: { name: 'Updated User' },
      },
      query: mockQuery,
    };

    // Act
    await handler(queryContext);

    // Assert
    expect(mockQuery).toHaveBeenCalledWith({
      where: { email: 'test@example.com', companyId },
      create: {
        email: 'test@example.com',
        name: 'Test User',
        role: 'VENDEDOR',
        companyId,
      },
      update: { name: 'Updated User', companyId },
    });
  });
});

// ============================================================================
// TEST SUITE 4: Operaciones de Actualización y Borrado
// ============================================================================

describe('tenant-extension.ts — Operaciones UPDATE/DELETE', () => {
  let mockPrisma: PrismaClient;
  let mockQuery: ReturnType<typeof vi.fn>;
  const companyId = 'company-a-uuid';

  beforeEach(() => {
    mockQuery = vi.fn(async (args) => args);

    mockPrisma = {
      $extends: vi.fn((extension) => {
        const extendedClient = { ...mockPrisma };
        (extendedClient as any).__extensionHandler = extension.query?.$allModels?.$allOperations;
        return extendedClient;
      }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      $transaction: vi.fn(async (fn: (tx: any) => unknown) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const txMock: any = new Proxy({ $executeRaw: vi.fn().mockResolvedValue(0) } as any, {
          get(target: any, prop: string) {
            if (prop === '$executeRaw') return target.$executeRaw;
            // Model access (e.g. tx.user, tx.invoice) — route operation calls to mockQuery
            return new Proxy({} as any, { get: () => mockQuery });
          },
        });
        return fn(txMock);
      }),
    } as unknown as PrismaClient;
  });

  it('update debería inyectar companyId en WHERE', async () => {
    // Arrange
    const tenantPrisma = createTenantPrisma(mockPrisma, companyId);
    const handler = (tenantPrisma as any).__extensionHandler;

    const userId = 'user-uuid-123';
    const queryContext = {
      operation: 'update',
      model: 'User',
      args: {
        where: { id: userId },
        data: { name: 'Updated Name' },
      },
      query: mockQuery,
    };

    // Act
    await handler(queryContext);

    // Assert
    expect(mockQuery).toHaveBeenCalledWith({
      where: {
        AND: [{ id: userId }, { companyId }],
      },
      data: { name: 'Updated Name' },
    });
  });

  it('updateMany debería inyectar companyId en WHERE', async () => {
    // Arrange
    const tenantPrisma = createTenantPrisma(mockPrisma, companyId);
    const handler = (tenantPrisma as any).__extensionHandler;

    const queryContext = {
      operation: 'updateMany',
      model: 'User',
      args: {
        where: { role: 'VENDEDOR' },
        data: { isActive: false },
      },
      query: mockQuery,
    };

    // Act
    await handler(queryContext);

    // Assert
    expect(mockQuery).toHaveBeenCalledWith({
      where: {
        AND: [{ role: 'VENDEDOR' }, { companyId }],
      },
      data: { isActive: false },
    });
  });

  it('delete debería inyectar companyId en WHERE', async () => {
    // Arrange
    const tenantPrisma = createTenantPrisma(mockPrisma, companyId);
    const handler = (tenantPrisma as any).__extensionHandler;

    const userId = 'user-uuid-123';
    const queryContext = {
      operation: 'delete',
      model: 'User',
      args: { where: { id: userId } },
      query: mockQuery,
    };

    // Act
    await handler(queryContext);

    // Assert
    expect(mockQuery).toHaveBeenCalledWith({
      where: {
        AND: [{ id: userId }, { companyId }],
      },
    });
  });

  it('deleteMany debería inyectar companyId en WHERE', async () => {
    // Arrange
    const tenantPrisma = createTenantPrisma(mockPrisma, companyId);
    const handler = (tenantPrisma as any).__extensionHandler;

    const queryContext = {
      operation: 'deleteMany',
      model: 'User',
      args: { where: { isActive: false } },
      query: mockQuery,
    };

    // Act
    await handler(queryContext);

    // Assert
    expect(mockQuery).toHaveBeenCalledWith({
      where: {
        AND: [{ isActive: false }, { companyId }],
      },
    });
  });
});

// ============================================================================
// TEST SUITE 5: Modelos SIN Filtro (Company)
// ============================================================================

describe('tenant-extension.ts — Modelos sin Filtro (Company table)', () => {
  let mockPrisma: PrismaClient;
  let mockQuery: ReturnType<typeof vi.fn>;
  const companyId = 'company-a-uuid';

  beforeEach(() => {
    mockQuery = vi.fn(async (args) => args);

    mockPrisma = {
      $extends: vi.fn((extension) => {
        const extendedClient = { ...mockPrisma };
        (extendedClient as any).__extensionHandler = extension.query?.$allModels?.$allOperations;
        return extendedClient;
      }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      $transaction: vi.fn(async (fn: (tx: any) => unknown) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const txMock: any = new Proxy({ $executeRaw: vi.fn().mockResolvedValue(0) } as any, {
          get(target: any, prop: string) {
            if (prop === '$executeRaw') return target.$executeRaw;
            // Model access (e.g. tx.user, tx.invoice) — route operation calls to mockQuery
            return new Proxy({} as any, { get: () => mockQuery });
          },
        });
        return fn(txMock);
      }),
    } as unknown as PrismaClient;
  });

  it('Company.findMany NO debería inyectar companyId (tabla de tenants)', async () => {
    // Arrange
    const tenantPrisma = createTenantPrisma(mockPrisma, companyId);
    const handler = (tenantPrisma as any).__extensionHandler;

    const queryContext = {
      operation: 'findMany',
      model: 'Company',
      args: { where: { isActive: true } },
      query: mockQuery,
    };

    // Act
    await handler(queryContext);

    // Assert
    // NO debe modificar args porque Company NO está en BUSINESS_MODELS
    expect(mockQuery).toHaveBeenCalledWith({
      where: { isActive: true },
    });
  });

  it('Company.create NO debería inyectar companyId', async () => {
    // Arrange
    const tenantPrisma = createTenantPrisma(mockPrisma, companyId);
    const handler = (tenantPrisma as any).__extensionHandler;

    const companyData = {
      legalName: 'Nueva Empresa SA',
      tradeName: 'Nueva Empresa',
      rtn: '0801199000002',
      maxUsers: 10,
    };

    const queryContext = {
      operation: 'create',
      model: 'Company',
      args: { data: companyData },
      query: mockQuery,
    };

    // Act
    await handler(queryContext);

    // Assert
    expect(mockQuery).toHaveBeenCalledWith({
      data: companyData,
    });
  });
});

// ============================================================================
// TEST SUITE 6: Relaciones (include, select)
// ============================================================================

describe('tenant-extension.ts — Relaciones y Proyecciones', () => {
  let mockPrisma: PrismaClient;
  let mockQuery: ReturnType<typeof vi.fn>;
  const companyId = 'company-a-uuid';

  beforeEach(() => {
    mockQuery = vi.fn(async (args) => args);

    mockPrisma = {
      $extends: vi.fn((extension) => {
        const extendedClient = { ...mockPrisma };
        (extendedClient as any).__extensionHandler = extension.query?.$allModels?.$allOperations;
        return extendedClient;
      }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      $transaction: vi.fn(async (fn: (tx: any) => unknown) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const txMock: any = new Proxy({ $executeRaw: vi.fn().mockResolvedValue(0) } as any, {
          get(target: any, prop: string) {
            if (prop === '$executeRaw') return target.$executeRaw;
            // Model access (e.g. tx.user, tx.invoice) — route operation calls to mockQuery
            return new Proxy({} as any, { get: () => mockQuery });
          },
        });
        return fn(txMock);
      }),
    } as unknown as PrismaClient;
  });

  it('debería funcionar con include (relaciones)', async () => {
    // Arrange
    const tenantPrisma = createTenantPrisma(mockPrisma, companyId);
    const handler = (tenantPrisma as any).__extensionHandler;

    const queryContext = {
      operation: 'findMany',
      model: 'User',
      args: {
        where: { isActive: true },
        include: { company: true },
      },
      query: mockQuery,
    };

    // Act
    await handler(queryContext);

    // Assert
    expect(mockQuery).toHaveBeenCalledWith({
      where: {
        AND: [{ isActive: true }, { companyId }],
      },
      include: { company: true },
    });
  });

  it('debería funcionar con select (proyecciones)', async () => {
    // Arrange
    const tenantPrisma = createTenantPrisma(mockPrisma, companyId);
    const handler = (tenantPrisma as any).__extensionHandler;

    const queryContext = {
      operation: 'findMany',
      model: 'User',
      args: {
        select: { id: true, email: true, name: true },
      },
      query: mockQuery,
    };

    // Act
    await handler(queryContext);

    // Assert
    expect(mockQuery).toHaveBeenCalledWith({
      where: { companyId },
      select: { id: true, email: true, name: true },
    });
  });

  it('debería funcionar con relaciones anidadas', async () => {
    // Arrange
    const tenantPrisma = createTenantPrisma(mockPrisma, companyId);
    const handler = (tenantPrisma as any).__extensionHandler;

    const queryContext = {
      operation: 'findFirst',
      model: 'User',
      args: {
        where: { id: 'user-uuid' },
        include: {
          company: {
            select: { legalName: true, rtn: true },
          },
        },
      },
      query: mockQuery,
    };

    // Act
    await handler(queryContext);

    // Assert
    expect(mockQuery).toHaveBeenCalledWith({
      where: {
        AND: [{ id: 'user-uuid' }, { companyId }],
      },
      include: {
        company: {
          select: { legalName: true, rtn: true },
        },
      },
    });
  });
});

// ============================================================================
// TEST SUITE 7: createAdminPrisma (Sin Filtro)
// ============================================================================

describe('tenant-extension.ts — createAdminPrisma (bypass tenant filter)', () => {
  it('debería retornar Prisma sin extensión de filtro', () => {
    // Arrange
    const mockPrisma = {} as PrismaClient;

    // Act
    const adminPrisma = createAdminPrisma(mockPrisma);

    // Assert
    // En Fase 0, createAdminPrisma simplemente retorna el mismo prisma
    expect(adminPrisma).toBe(mockPrisma);
  });
});

// ============================================================================
// TEST SUITE 8: Edge Cases y Comportamientos Especiales
// ============================================================================

describe('tenant-extension.ts — Edge Cases', () => {
  let mockPrisma: PrismaClient;
  let mockQuery: ReturnType<typeof vi.fn>;
  const companyId = 'company-a-uuid';

  beforeEach(() => {
    mockQuery = vi.fn(async (args) => args);

    mockPrisma = {
      $extends: vi.fn((extension) => {
        const extendedClient = { ...mockPrisma };
        (extendedClient as any).__extensionHandler = extension.query?.$allModels?.$allOperations;
        return extendedClient;
      }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      $transaction: vi.fn(async (fn: (tx: any) => unknown) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const txMock: any = new Proxy({ $executeRaw: vi.fn().mockResolvedValue(0) } as any, {
          get(target: any, prop: string) {
            if (prop === '$executeRaw') return target.$executeRaw;
            // Model access (e.g. tx.user, tx.invoice) — route operation calls to mockQuery
            return new Proxy({} as any, { get: () => mockQuery });
          },
        });
        return fn(txMock);
      }),
    } as unknown as PrismaClient;
  });

  it('debería funcionar con queries que no tienen args.where inicialmente', async () => {
    // Arrange
    const tenantPrisma = createTenantPrisma(mockPrisma, companyId);
    const handler = (tenantPrisma as any).__extensionHandler;

    const queryContext = {
      operation: 'findMany',
      model: 'User',
      args: {
        // Sin where, solo select
        select: { id: true, email: true },
      },
      query: mockQuery,
    };

    // Act
    await handler(queryContext);

    // Assert
    expect(mockQuery).toHaveBeenCalledWith({
      where: { companyId },
      select: { id: true, email: true },
    });
  });

  it('debería mantener otros parámetros como orderBy, skip, take', async () => {
    // Arrange
    const tenantPrisma = createTenantPrisma(mockPrisma, companyId);
    const handler = (tenantPrisma as any).__extensionHandler;

    const queryContext = {
      operation: 'findMany',
      model: 'User',
      args: {
        where: { isActive: true },
        orderBy: { createdAt: 'desc' },
        skip: 10,
        take: 20,
      },
      query: mockQuery,
    };

    // Act
    await handler(queryContext);

    // Assert
    expect(mockQuery).toHaveBeenCalledWith({
      where: {
        AND: [{ isActive: true }, { companyId }],
      },
      orderBy: { createdAt: 'desc' },
      skip: 10,
      take: 20,
    });
  });

  it('debería inyectar companyId en findFirstOrThrow y findUniqueOrThrow', async () => {
    // Arrange
    const tenantPrisma = createTenantPrisma(mockPrisma, companyId);
    const handler = (tenantPrisma as any).__extensionHandler;

    const queryContext = {
      operation: 'findFirstOrThrow',
      model: 'User',
      args: { where: { id: 'user-uuid' } },
      query: mockQuery,
    };

    // Act
    await handler(queryContext);

    // Assert
    // findFirstOrThrow ahora está en la lista de operaciones interceptadas
    expect(mockQuery).toHaveBeenCalledWith({
      where: { AND: [{ id: 'user-uuid' }, { companyId }] },
    });
  });

  it('NO debería afectar $executeRaw (queries raw SQL)', async () => {
    // Arrange
    const tenantPrisma = createTenantPrisma(mockPrisma, companyId);

    // Las extensiones NO interceptan $executeRaw / $queryRaw
    // Este test documenta el comportamiento esperado

    // En producción, $executeRaw debe usarse con EXTREMO cuidado
    // y validar companyId manualmente en el SQL

    // Assert
    // Este test simplemente verifica que createTenantPrisma no lanza error
    expect(tenantPrisma).toBeDefined();
  });

  it('debería funcionar con múltiples companyIds (diferentes instancias)', () => {
    // Arrange
    const companyAId = 'company-a-uuid';
    const companyBId = 'company-b-uuid';
    const mockPrisma = {
      $extends: vi.fn((extension) => {
        return { ...mockPrisma, __extension: extension };
      }),
    } as unknown as PrismaClient;

    // Act
    const prismaA = createTenantPrisma(mockPrisma, companyAId);
    const prismaB = createTenantPrisma(mockPrisma, companyBId);

    // Assert
    // $extends retorna objetos diferentes (cada uno con su closure de companyId)
    expect(prismaA).not.toBe(prismaB);
    expect(mockPrisma.$extends).toHaveBeenCalledTimes(2);
  });
});
