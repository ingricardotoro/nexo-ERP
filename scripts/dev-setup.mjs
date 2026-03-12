#!/usr/bin/env node

/**
 * Script de setup para entorno de desarrollo local de NexoERP.
 * Ejecutar: npm run dev:setup
 *
 * Realiza:
 * 1. Verifica y crea .env.local desde .env.example (si no existe)
 * 2. Verifica que Docker esté corriendo
 * 3. Levanta contenedores (PostgreSQL, pgAdmin, MailHog)
 * 4. Espera a que PostgreSQL esté listo
 * 5. Ejecuta migraciones Prisma
 * 6. Ejecuta seed de base de datos
 */

import { execSync } from 'child_process';
import { existsSync, copyFileSync } from 'fs';

/**
 * Ejecuta un comando shell y retorna true si fue exitoso
 * @param {string} cmd - Comando a ejecutar
 * @param {object} opts - Opciones para execSync
 * @returns {boolean} True si exitoso, false si falló
 */
const run = (cmd, opts = {}) => {
  console.log(`\n▶ ${cmd}`);
  try {
    execSync(cmd, { stdio: 'inherit', ...opts });
    return true;
  } catch {
    return false;
  }
};

/**
 * Imprime un separador con el nombre del paso
 * @param {string} name - Nombre del paso
 */
const step = (name) => console.log(`\n${'='.repeat(60)}\n🔧 ${name}\n${'='.repeat(60)}`);

/**
 * Espera un número de segundos
 * @param {number} seconds - Segundos a esperar
 * @returns {Promise<void>}
 */
const sleep = (seconds) => new Promise((resolve) => setTimeout(resolve, seconds * 1000));

async function main() {
  console.log('\n🚀 NexoERP — Dev Environment Setup\n');

  // 1. Verificar .env.local
  step('1/6 — Verificar .env.local');
  if (!existsSync('.env.local')) {
    console.log('📋 Creando .env.local desde .env.example...');
    copyFileSync('.env.example', '.env.local');
    console.log('✅ .env.local creado. Revisa los valores si es necesario.');
  } else {
    console.log('✅ .env.local ya existe.');
  }

  // 2. Verificar Docker
  step('2/6 — Verificar Docker');
  if (!run('docker info', { stdio: 'pipe' })) {
    console.error(
      '❌ Docker no está corriendo. Inicia Docker Desktop y ejecuta este script nuevamente.',
    );
    process.exit(1);
  }
  console.log('✅ Docker está corriendo.');

  // 3. Levantar contenedores
  step('3/6 — Levantar contenedores Docker');
  run('docker compose up -d');

  // 4. Esperar a PostgreSQL
  step('4/6 — Esperar a PostgreSQL');
  let retries = 15;
  let postgresReady = false;

  while (retries > 0 && !postgresReady) {
    try {
      // Nota: container name es nexoerp-postgres según docker-compose.yml
      postgresReady = run('docker exec nexoerp-postgres pg_isready -U nexoerp', { stdio: 'pipe' });
      if (postgresReady) {
        console.log('✅ PostgreSQL listo.');
        break;
      }
    } catch {
      // Ignorar error, reintentar
    }

    retries--;
    console.log(`⏳ Esperando PostgreSQL... (${retries} intentos restantes)`);
    await sleep(2);
  }

  if (!postgresReady) {
    console.error(
      '❌ PostgreSQL no respondió a tiempo. Verifica los logs con: docker compose logs postgres',
    );
    process.exit(1);
  }

  // Dar tiempo extra para asegurar que la BD esté completamente lista
  console.log('⏳ Esperando 2 segundos adicionales para asegurar estabilidad...');
  await sleep(2);

  // 5. Migraciones Prisma
  step('5/6 — Aplicar migraciones Prisma');
  const migrateSuccess = run('npx prisma migrate deploy');
  if (!migrateSuccess) {
    console.error('❌ Las migraciones fallaron. Verifica la conexión a la base de datos.');
    process.exit(1);
  }

  // 6. Seed de base de datos
  step('6/6 — Ejecutar seed de base de datos');
  const seedSuccess = run('npx prisma db seed');
  if (!seedSuccess) {
    console.warn(
      '⚠️  El seed falló o no hay datos para insertar. Esto puede ser normal si ya se ejecutó.',
    );
  }

  // Resumen final
  console.log('\n' + '='.repeat(60));
  console.log('✅ Entorno de desarrollo listo!');
  console.log('='.repeat(60));
  console.log('\n📋 Servicios disponibles:');
  console.log('   App:     http://localhost:3000');
  console.log('   pgAdmin: http://localhost:5050 (admin@nexoerp.com / admin123)');
  console.log('   MailHog: http://localhost:8025');
  console.log('\n🚀 Ejecuta: npm run dev');
  console.log('');
}

main().catch((error) => {
  console.error('\n❌ Error durante el setup:', error.message);
  process.exit(1);
});
