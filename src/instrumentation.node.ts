/**
 * Lógica de carga de env vars para el runtime Node.js del SSR Lambda.
 * Separado de instrumentation.ts para que Turbopack no intente
 * evaluar imports de 'fs'/'path' en el contexto del Edge Runtime.
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export function loadRuntimeEnv(): void {
  const taskRoot = process.env.LAMBDA_TASK_ROOT;

  // Locally LAMBDA_TASK_ROOT is never set — env vars come from .env.local via Next.js.
  if (!taskRoot) {
    return;
  }

  const cwd = process.cwd();

  const candidates = [
    join(taskRoot, 'env.lambda'),
    join(cwd, 'env.lambda'),
    join(taskRoot, '.next', 'env.lambda'),
    join(cwd, '.next', 'env.lambda'),
  ];

  for (const envFile of candidates) {
    if (!existsSync(envFile)) continue;

    try {
      const lines = readFileSync(envFile, 'utf-8').split('\n');
      let count = 0;

      for (const line of lines) {
        const eqIdx = line.indexOf('=');
        if (eqIdx <= 0) continue;

        const key = line.slice(0, eqIdx).trim();
        const value = line.slice(eqIdx + 1).trim();

        if (key && value && !process.env[key]) {
          process.env[key] = value;
          count++;
        }
      }

      console.log(`[instrumentation] ✅ Loaded ${count} env vars from: ${envFile}`);
      return;
    } catch (err) {
      console.error('[instrumentation] Error reading', envFile, err);
    }
  }

  console.error('[instrumentation] ❌ env.lambda not found in any candidate path');
}
