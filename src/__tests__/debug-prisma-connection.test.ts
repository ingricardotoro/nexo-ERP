import { describe, it, expect } from 'vitest';
import prisma from '../lib/db/prisma';

// Test diagnóstico solo para desarrollo local (skip en CI)
describe.skipIf(!!process.env.CI)('Prisma Connection Debug', () => {
  it('debe mostrar qué usuario de BD está usando', async () => {
    // Query especial de PostgreSQL para obtener el usuario actual
    const result = await prisma.$queryRaw<Array<{ current_user: string }>>`SELECT current_user`;

    console.log('✅ Current PostgreSQL user:', result[0]?.current_user);

    expect(result[0]?.current_user).toBeDefined();
    // Acepta cualquier usuario válido (app_user, nexoerp, nexoerp_test, postgres, etc.)
    expect(result[0]?.current_user).toBeTruthy();
  });
});
