// src/__tests__/multi-tenant-isolation.test.ts
/**
 * Tests de Aislamiento Multi-Tenant (RLS + Prisma)
 *
 * Verifican que las políticas RLS previenen el acceso cross-tenant
 * en la capa de base de datos PostgreSQL.
 *
 * ARQUITECTURA RLS (DAR-DBA-001 Revisión Final):
 *   - FORCE ROW LEVEL SECURITY habilitado (aplicado incluso al owner)
 *   - Variable de sesión: app.current_company_id (UUID)
 *   - 4 políticas por tabla: SELECT, INSERT, UPDATE, DELETE
 *   - Configuración de sesión OBLIGATORIA en TODAS las transacciones
 *
 * ESTRATEGIA DE TEST:
 *   1. Owner crea fixtures usando withAdminContext (configura RLS session)
 *   2. Cada test usa withRLSContext para configurar company_id en transacción
 *   3. Verificar que queries respeten el aislamiento multi-tenant
 *   4. Cleanup con withAdminContext
 *
 * Referencia: DAR-005, RS-SEC-02 (REQUIREMENTS.md §11.3)
 */

import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  TENANT_A,
  TENANT_B,
  expectNoDataLeakage,
  expectTenantIsolation,
} from './helpers/multi-tenant';
import { withRLSContext, withAdminContext } from './helpers/rls-session';

// Crear instancias separadas de Prisma para simular diferentes sesiones de usuario
export const prismaOwner = new PrismaClient(); // Usuario owner (operaciones admin) - exportado para diagnostic test
const prismaAppA = new PrismaClient(); // Sesión de Empresa A
const prismaAppB = new PrismaClient(); // Sesión de Empresa B

describe('Multi-Tenant Isolation — Row Level Security', () => {
  let companyAId: string;
  let companyBId: string;
  let userAId: string;
  let userBId: string;

  beforeAll(async () => {
    console.log('[beforeAll] Iniciando cleanup...');

    // Cleanup robusto: Intentar eliminar registros específicos primero, luego TRUNCATE
    try {
      // Método 1: DELETE específico de test records (más seguro en CI)
      // IMPORTANTE: Primero users, luego companies (por FK constraint)
      await prismaOwner.$executeRawUnsafe(
        `DELETE FROM users WHERE id IN ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1')`,
      );
      await prismaOwner.$executeRawUnsafe(
        `DELETE FROM companies WHERE id IN ('${TENANT_A.id}', '${TENANT_B.id}')`,
      );
      console.log('[beforeAll] DELETE de test records completado');
    } catch {
      console.log('[beforeAll] DELETE falló, intentando TRUNCATE...');

      // Método 2 (fallback): TRUNCATE si tenemos permisos
      try {
        await prismaOwner.$executeRawUnsafe(`TRUNCATE TABLE users CASCADE`);
        await prismaOwner.$executeRawUnsafe(`TRUNCATE TABLE companies CASCADE`);
        console.log('[beforeAll] TRUNCATE fallback completado');
      } catch {
        console.log('[beforeAll] TRUNCATE también falló (OK si BD está vacía)');
      }
    }

    // Crear las dos empresas de test usando upsert para idempotencia
    console.log('[beforeAll] Creando Company A...');
    const companyA = await prismaOwner.company.upsert({
      where: { id: TENANT_A.id },
      create: {
        id: TENANT_A.id,
        legalName: TENANT_A.name,
        tradeName: TENANT_A.name,
        rtn: TENANT_A.rtn,
        maxUsers: 5,
      },
      update: {}, // Si ya existe, no hacer nada
    });
    companyAId = companyA.id;
    console.log(`[beforeAll] Company A lista: ${companyAId}`);

    console.log('[beforeAll] Creando Company B...');
    const companyB = await prismaOwner.company.upsert({
      where: { id: TENANT_B.id },
      create: {
        id: TENANT_B.id,
        legalName: TENANT_B.name,
        tradeName: TENANT_B.name,
        rtn: TENANT_B.rtn,
        maxUsers: 5,
      },
      update: {}, // Si ya existe, no hacer nada
    });
    companyBId = companyB.id;
    console.log(`[beforeAll] Company B lista: ${companyBId}`);

    // Crear usuarios con companyId explícito usando upsert
    console.log('[beforeAll] Creando User A...');
    const userA = await withRLSContext(prismaOwner, companyAId, async (tx) => {
      return tx.user.upsert({
        where: { id: '00000000-0000-0000-0000-0000000000a1' },
        create: {
          id: '00000000-0000-0000-0000-0000000000a1',
          email: 'usera@test.nexoerp.com',
          fullName: 'User A',
          cognitoSub: 'cognito-sub-a',
          companyId: companyAId,
          role: 'ADMIN',
        },
        update: {}, // Si ya existe, no hacer nada
      });
    });
    userAId = userA.id;
    console.log(`[beforeAll] User A listo: ${userAId}`);

    console.log('[beforeAll] Creando User B...');
    const userB = await withRLSContext(prismaOwner, companyBId, async (tx) => {
      return tx.user.upsert({
        where: { id: '00000000-0000-0000-0000-0000000000b1' },
        create: {
          id: '00000000-0000-0000-0000-0000000000b1',
          email: 'userb@test.nexoerp.com',
          fullName: 'User B',
          cognitoSub: 'cognito-sub-b',
          companyId: companyBId,
          role: 'ADMIN',
        },
        update: {}, // Si ya existe, no hacer nada
      });
    });
    userBId = userB.id;
    console.log(`[beforeAll] User B listo: ${userBId}`);
    console.log('[beforeAll] Setup completo!');
  });

  afterAll(async () => {
    // Limpiar datos de test con admin context (sin filtro de tenant)
    await withAdminContext(prismaOwner, async (tx) => {
      if (userAId || userBId) {
        await tx.user.deleteMany({
          where: { id: { in: [userAId, userBId].filter(Boolean) as string[] } },
        });
      }
      // Companies NO tiene RLS
      if (companyAId && companyBId) {
        await tx.company.deleteMany({
          where: { id: { in: [companyAId, companyBId] } },
        });
      }
    });

    await prismaOwner.$disconnect();
    await prismaAppA.$disconnect();
    await prismaAppB.$disconnect();
  });

  describe('RLS — Aislamiento de Lectura (SELECT)', () => {
    it('Empresa A solo debe ver sus propios usuarios', async () => {
      const users = await withRLSContext(prismaAppA, companyAId, async (tx) => {
        return tx.user.findMany();
      });

      expect(users).toHaveLength(1);
      expectTenantIsolation(users, companyAId);
      expect(users[0]?.id).toBe(userAId);
    });

    it('Empresa B solo debe ver sus propios usuarios', async () => {
      const users = await withRLSContext(prismaAppB, companyBId, async (tx) => {
        return tx.user.findMany();
      });

      expect(users).toHaveLength(1);
      expectTenantIsolation(users, companyBId);
      expect(users[0]?.id).toBe(userBId);
    });

    it('NO debe haber filtración de datos entre empresas', async () => {
      const usersA = await withRLSContext(prismaAppA, companyAId, async (tx) => {
        return tx.user.findMany();
      });

      const usersB = await withRLSContext(prismaAppB, companyBId, async (tx) => {
        return tx.user.findMany();
      });

      expectNoDataLeakage(usersA, usersB);
    });
  });

  describe('RLS — Aislamiento de Escritura (INSERT)', () => {
    it('Empresa A NO puede insertar usuarios en Empresa B', async () => {
      // El test intenta insertar con companyId de Empresa B, pero la extensión
      // de tenant SOBRESCRIBE companyId con el del contexto (Empresa A)
      const newUser = await withRLSContext(prismaAppA, companyAId, async (tx) => {
        return tx.user.create({
          data: {
            id: '00000000-0000-0000-0000-0000000000xx',
            email: 'hacker@test.nexoerp.com',
            fullName: 'Hacker Cross-Tenant',
            cognitoSub: 'cognito-sub-hacker',
            companyId: companyBId, // ← Intentar empresa B (malicioso)
            role: 'ADMIN',
          },
        });
      });

      // La extensión sobrescribe companyId con el del tenant context
      // El usuario se crea en Company A, NO en Company B (protección exitosa)
      expect(newUser.companyId).toBe(companyAId);
      expect(newUser.companyId).not.toBe(companyBId);

      // Cleanup
      await withAdminContext(prismaOwner, async (tx) => {
        await tx.user.delete({ where: { id: newUser.id } });
      });
    });

    it('Empresa A SÍ puede insertar usuarios en su propia empresa', async () => {
      const newUser = await withRLSContext(prismaAppA, companyAId, async (tx) => {
        return tx.user.create({
          data: {
            id: '00000000-0000-0000-0000-0000000000a2',
            email: 'usera2@test.nexoerp.com',
            fullName: 'User A2',
            cognitoSub: 'cognito-sub-a2',
            companyId: companyAId, // ← Propia empresa
            role: 'SALESPERSON',
          },
        });
      });

      expect(newUser.companyId).toBe(companyAId);

      // Cleanup
      await withAdminContext(prismaOwner, async (tx) => {
        await tx.user.delete({ where: { id: newUser.id } });
      });
    });
  });

  describe('RLS — Aislamiento de Actualización (UPDATE)', () => {
    it('Empresa A NO puede actualizar usuarios de Empresa B', async () => {
      const result = await withRLSContext(prismaAppA, companyAId, async (tx) => {
        return tx.user.updateMany({
          where: { id: userBId }, // ← Usuario de Empresa B
          data: { fullName: 'Hacked Name' },
        });
      });

      // RLS previene la actualización (count = 0)
      expect(result.count).toBe(0);

      // Verificar que el usuario B NO fue modificado (admin context sin filtro)
      const userB = await withAdminContext(prismaOwner, async (tx) => {
        return tx.user.findUnique({ where: { id: userBId } });
      });
      expect(userB?.fullName).toBe('User B'); // Sin cambios
    });
  });

  describe('RLS — Aislamiento de Eliminación (DELETE)', () => {
    it('Empresa A NO puede eliminar usuarios de Empresa B', async () => {
      const result = await withRLSContext(prismaAppA, companyAId, async (tx) => {
        return tx.user.deleteMany({
          where: { id: userBId }, // ← Usuario de Empresa B
        });
      });

      // RLS previene la eliminación (count = 0)
      expect(result.count).toBe(0);

      // Verificar que el usuario B sigue existiendo (admin context sin filtro)
      const userB = await withAdminContext(prismaOwner, async (tx) => {
        return tx.user.findUnique({ where: { id: userBId } });
      });
      expect(userB).not.toBeNull();
    });
  });

  describe('RLS — Operaciones Owner con Admin Context', () => {
    it('Owner puede ver usuarios de TODAS las empresas con admin context', async () => {
      // Admin context sin filtro puede ver todos los usuarios
      const allUsers = await withAdminContext(prismaOwner, async (tx) => {
        return tx.user.findMany({ where: { id: { in: [userAId, userBId] } } });
      });

      expect(allUsers).toHaveLength(2);

      // Verificar que ambos usuarios están presentes
      const userIds = allUsers.map((u) => u.id).sort();
      expect(userIds).toEqual([userAId, userBId].sort());

      // Verificar que pertenecen a empresas diferentes
      const companyIds = allUsers.map((u) => u.companyId).sort();
      expect(companyIds).toEqual([companyAId, companyBId].sort());
    });
  });
});
