/**
 * Test diagnóstico: Verificar si Prisma respeta SET LOCAL dentro de transacciones
 */

import { describe, it, expect, beforeAll } from 'vitest';

import { prismaOwner } from './multi-tenant-isolation.test';

describe('Diagnóstico Prisma + RLS', () => {
  const COMPANY_1 = '00000000-0000-0000-0000-000000000001';
  const COMPANY_2 = '00000000-0000-0000-0000-000000000002';

  beforeAll(async () => {
    // Limpiar
    await prismaOwner.$executeRawUnsafe(`TRUNCATE TABLE users CASCADE`);
    await prismaOwner.$executeRawUnsafe(`TRUNCATE TABLE companies CASCADE`);

    // Crear companies
    await prismaOwner.company.create({
      data: {
        id: COMPANY_1,
        legalName: 'Company 1',
        tradeName: 'Company 1',
        rtn: '000000000001',
        maxUsers: 5,
      },
    });
    await prismaOwner.company.create({
      data: {
        id: COMPANY_2,
        legalName: 'Company 2',
        tradeName: 'Company 2',
        rtn: '000000000002',
        maxUsers: 5,
      },
    });

    // Crear users con RAW SQL (sabemos que funciona)
    await prismaOwner.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL app.current_company_id TO '${COMPANY_1}'`);
      await tx.$executeRawUnsafe(`
        INSERT INTO users (id, company_id, cognito_sub, email, full_name, role, is_active, created_at, updated_at)
        VALUES ('user-1', '${COMPANY_1}', 'sub1', 'user1@test.com', 'User 1', 'ADMIN', true, NOW(), NOW())
      `);
    });

    await prismaOwner.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL app.current_company_id TO '${COMPANY_2}'`);
      await tx.$executeRawUnsafe(`
        INSERT INTO users (id, company_id, cognito_sub, email, full_name, role, is_active, created_at, updated_at)
        VALUES ('user-2', '${COMPANY_2}', 'sub2', 'user2@test.com', 'User 2', 'ADMIN', true, NOW(), NOW())
      `);
    });
  });

  it('SELECT con raw SQL respeta RLS dentro de transacción Prisma', async () => {
    const result = await prismaOwner.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL app.current_company_id TO '${COMPANY_1}'`);
      const users = await tx.$queryRawUnsafe<Array<{ count: string }>>(` SELECT count(*) FROM users
      `);
      return parseInt(users[0]?.count || '0');
    });

    console.log(`[Raw SQL] SELECT count con company=${COMPANY_1}: ${result}`);
    expect(result).toBe(1);
  });

  it('SELECT con Prisma ORM respeta RLS dentro de transacción Prisma', async () => {
    const result = await prismaOwner.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL app.current_company_id TO '${COMPANY_1}'`);

      // Verificar que la variable está configurada
      const check = await tx.$queryRawUnsafe<[{ current_setting: string }]>(
        `SELECT current_setting('app.current_company_id', true) as current_setting`,
      );
      console.log(`[Prisma ORM] current_setting antes de findMany: ${check[0]?.current_setting}`);

      const users = await tx.user.findMany();
      console.log(`[Prisma ORM] findMany retornó ${users.length} usuarios`);
      console.log(`[Prisma ORM] IDs: ${users.map((u) => u.id).join(', ')}`);
      return users.length;
    });

    expect(result).toBe(1);
  });
});
