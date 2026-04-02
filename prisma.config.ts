// prisma.config.ts
// Configuración central de Prisma 6 para NexoERP.
// Reemplaza la sección "prisma" en package.json (deprecated en Prisma 7).
// @see https://pris.ly/prisma-config

import path from 'node:path';
import { createRequire } from 'node:module';

import { defineConfig } from 'prisma/config';

const require = createRequire(import.meta.url);

// En CI/Amplify, las variables llegan por entorno y dotenv puede no estar instalado.
const shouldLoadDotenv = !process.env.CI && !process.env.AWS_BRANCH && !process.env.AMPLIFY_APP_ID;

if (shouldLoadDotenv) {
  try {
    const { config: loadDotenv } = require('dotenv');
    loadDotenv({ path: '.env.local' });
  } catch {
    // No bloquear prisma generate si dotenv no está disponible.
  }
}

export default defineConfig({
  schema: path.join('prisma', 'schema'),
  migrations: {
    // Comando de seed (equivale a package.json#prisma.seed)
    seed: 'npx tsx prisma/seed/index.ts',
  },
});
