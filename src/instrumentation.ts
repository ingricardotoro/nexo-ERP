/**
 * Next.js Instrumentation Hook
 *
 * Corre una sola vez al arrancar el servidor Next.js, antes de cualquier
 * request. En Amplify Gen 2, las env vars del Console no llegan al SSR
 * Lambda automáticamente — las cargamos desde un archivo escrito durante
 * el build en amplify.yml (.next/env.lambda → /var/task/env.lambda).
 *
 * La lógica Node.js (fs, path) está en instrumentation.node.ts para que
 * Turbopack no la evalúe en el contexto del Edge Runtime.
 *
 * @see amplify.yml (sección build — escritura de env.lambda)
 * @see src/instrumentation.node.ts
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { loadRuntimeEnv } = await import('./instrumentation.node');
    loadRuntimeEnv();
  }
}
