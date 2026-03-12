/**
 * Validación de variables de entorno del cliente con Zod
 * @module lib/env-client
 *
 * Este archivo valida solo las variables NEXT_PUBLIC_* que están expuestas al navegador.
 * Se importa en código del cliente (Client Components, hooks, etc.).
 *
 * Para variables del servidor, usar `lib/env.ts`.
 */

import { z } from 'zod';

/**
 * Schema de validación para variables de entorno del cliente.
 * Solo incluye variables con prefijo NEXT_PUBLIC_* que están expuestas al navegador.
 */
const clientEnvSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url(),
  NEXT_PUBLIC_APP_NAME: z.string().default('NexoERP'),
  NEXT_PUBLIC_APP_ENV: z.enum(['development', 'staging', 'production']).default('development'),
  NEXT_PUBLIC_ENABLE_DEBUG: z
    .string()
    .transform((val) => val === 'true')
    .default('false'),
  NEXT_PUBLIC_SENTRY_DSN: z.string().url().optional().or(z.literal('')),
});

/**
 * Valida las variables de entorno del cliente.
 * Solo valida variables con prefijo NEXT_PUBLIC_*.
 *
 * @throws {Error} Si las variables son inválidas
 */
function validateClientEnv() {
  const parsed = clientEnvSchema.safeParse({
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME,
    NEXT_PUBLIC_APP_ENV: process.env.NEXT_PUBLIC_APP_ENV,
    NEXT_PUBLIC_ENABLE_DEBUG: process.env.NEXT_PUBLIC_ENABLE_DEBUG,
    NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
  });

  if (!parsed.success) {
    console.error('❌ Variables de entorno del cliente inválidas:');
    console.error(JSON.stringify(parsed.error.flatten().fieldErrors, null, 2));
    throw new Error('Variables de entorno del cliente inválidas. Revisar NEXT_PUBLIC_* en .env');
  }

  return parsed.data;
}

/**
 * Variables de entorno validadas del cliente.
 * Importar en Client Components, hooks, etc.
 *
 * @example
 * ```tsx
 * 'use client';
 * import { clientEnv } from '@/lib/env-client';
 *
 * export function MyComponent() {
 *   const appUrl = clientEnv.NEXT_PUBLIC_APP_URL;
 *   const isDebug = clientEnv.NEXT_PUBLIC_ENABLE_DEBUG;
 *   return <div>App URL: {appUrl}</div>;
 * }
 * ```
 */
export const clientEnv = validateClientEnv();

/**
 * Tipo TypeScript para las variables de entorno del cliente.
 * Generado automáticamente desde el schema Zod.
 */
export type ClientEnv = z.infer<typeof clientEnvSchema>;
