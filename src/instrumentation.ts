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
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  const { readFileSync } = await import('fs');
  const { join } = await import('path');

  const taskRoot = process.env.LAMBDA_TASK_ROOT ?? process.cwd();
  const envFile = join(taskRoot, 'env.lambda');

  try {
    const lines = readFileSync(envFile, 'utf-8').split('\n');

    for (const line of lines) {
      const eqIdx = line.indexOf('=');
      if (eqIdx <= 0) continue;

      const key = line.slice(0, eqIdx).trim();
      const value = line.slice(eqIdx + 1).trim();

      // Solo setear si la variable no está ya definida (no pisar vars del sistema)
      if (key && value && !process.env[key]) {
        process.env[key] = value;
      }
    }

    console.log('[instrumentation] Runtime env loaded from env.lambda');
  } catch {
    // Archivo no existe en desarrollo — comportamiento esperado
  }
}
