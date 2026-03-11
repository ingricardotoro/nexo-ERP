// prisma/seed/index.ts
// Seed básico para Fase 0 — 2 empresas (demo + test isolation)
//
// Se expandirá en Fase 1 y 2 con:
//   - Roles y permisos predeterminados
//   - Plan de cuentas NIIF Honduras (~200 cuentas)
//   - Monedas (HNL, USD)
//   - Impuestos (ISV 15%, 18%, Exento)
//   - Tipos de documento fiscal
//
// Nota DAR-003: en Fase 0 no hay sincronización con Cognito.
// Los users de prueba se crean con IDs manuales (UUID fake) en el seed de Fase 1.

// eslint-disable-next-line import/order -- dotenv debe cargarse ANTES de @prisma/client para que DATABASE_URL esté disponible
import { config as loadDotenv } from 'dotenv';

// tsx no carga .env.local automáticamente → cargar manualmente
loadDotenv({ path: '.env.local' });

// eslint-disable-next-line import/order -- este import viene después de cargar dotenv por diseño
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando seed de NexoERP...');

  // Empresa demo para desarrollo
  const demoCompany = await prisma.company.upsert({
    where: { rtn: '0801-1990-00001' },
    update: {},
    create: {
      legalName: 'Empresa Demo S.A. de C.V.',
      tradeName: 'Demo NexoERP',
      rtn: '0801-1990-00001',
      email: 'demo@nexoerp.com',
      phone: '+504 2222-3333',
      address: 'Col. Kennedy, Blvd. Morazán',
      city: 'Tegucigalpa',
      department: 'Francisco Morazán',
      baseCurrency: 'HNL',
      maxUsers: 10,
    },
  });

  console.log(`✅ Empresa demo: ${demoCompany.legalName} (${demoCompany.id})`);

  // Segunda empresa para testing de multi-tenant isolation
  const testCompany = await prisma.company.upsert({
    where: { rtn: '0501-2000-00002' },
    update: {},
    create: {
      legalName: 'Empresa Test Aislamiento Ltda.',
      tradeName: 'Test Isolation',
      rtn: '0501-2000-00002',
      email: 'test@nexoerp.com',
      phone: '+504 3333-4444',
      address: 'Bo. El Centro, 3ra Calle',
      city: 'San Pedro Sula',
      department: 'Cortés',
      baseCurrency: 'HNL',
      maxUsers: 5,
    },
  });

  console.log(`✅ Empresa test: ${testCompany.legalName} (${testCompany.id})`);

  console.log('');
  console.log('🌱 Seed completado exitosamente.');
  console.log(`   Companies creadas: 2`);
  console.log(`   Demo ID: ${demoCompany.id}`);
  console.log(`   Test ID: ${testCompany.id}`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('❌ Error en seed:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
