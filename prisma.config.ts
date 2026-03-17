// prisma.config.ts
// Configuración central de Prisma 6 para NexoERP.
// Reemplaza la sección "prisma" en package.json (deprecated en Prisma 7).
// @see https://pris.ly/prisma-config

import path from 'node:path';

import { config as loadDotenv } from 'dotenv';
import { defineConfig } from 'prisma/config';

// prisma.config.ts no carga .env.local automáticamente → cargar de forma explícita
loadDotenv({ path: '.env.local' });

export default defineConfig({
  schema: path.join('prisma', 'schema'),
  migrations: {
    // Comando de seed (equivale a package.json#prisma.seed)
    seed: 'npx tsx prisma/seed/index.ts',
  },
});
