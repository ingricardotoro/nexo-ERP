/**
 * Next.js Instrumentation Hook
 *
 * Corre una sola vez al arrancar el servidor Next.js, antes de cualquier
 * request. En Amplify Gen 2, las env vars del Console no llegan al SSR
 * Lambda automáticamente — las cargamos desde un archivo escrito durante
 * el build en amplify.yml (.next/env.lambda → /var/task/env.lambda).
 *
 * En desarrollo local este archivo no existe, lo cual es correcto:
 * las vars se cargan desde .env.local como siempre.
 *
 * @see amplify.yml (sección build — escritura de env.lambda)
 */
export async function register() {
  // Saltar en Edge runtime (no tiene acceso al filesystem)
  if (process.env.NEXT_RUNTIME === 'edge') return;

  const { readFileSync, existsSync } = await import('fs');
  const { join } = await import('path');

  const taskRoot = process.env.LAMBDA_TASK_ROOT ?? '';
  const cwd = process.cwd();

  // Buscar en múltiples rutas posibles según cómo Amplify empaqueta el Lambda
  const candidates = [
    join(taskRoot, 'env.lambda'),
    join(cwd, 'env.lambda'),
    join(taskRoot, '.next', 'env.lambda'),
    join(cwd, '.next', 'env.lambda'),
  ].filter(Boolean);

  console.log('[instrumentation] register() called. taskRoot:', taskRoot, 'cwd:', cwd);
  console.log('[instrumentation] Searching env.lambda in:', candidates);

  for (const envFile of candidates) {
    if (!existsSync(envFile)) {
      console.log('[instrumentation] Not found:', envFile);
      continue;
    }

    try {
      const lines = readFileSync(envFile, 'utf-8').split('\n');
      let count = 0;
      for (const line of lines) {
        const eqIdx = line.indexOf('=');
        if (eqIdx <= 0) continue;
        const key = line.slice(0, eqIdx).trim();
        const value = line.slice(eqIdx + 1).trim();
        // Solo setear si la variable no está ya definida (no pisar vars del sistema)
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
