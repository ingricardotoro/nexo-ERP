/**
 * Validación de variables de entorno del servidor con Zod
 * @module lib/env
 *
 * Este archivo valida las variables de entorno al inicio de la aplicación (fail-fast).
 * Solo está disponible en el servidor (SSR, API Routes, Server Actions).
 *
 * Para variables del cliente (browser), usar `lib/env-client.ts`.
 */

import { z } from 'zod';

/**
 * Schema de validación para variables de entorno del servidor
 */
const envSchema = z.object({
  // ============ Database ============
  DATABASE_URL: z
    .string()
    .url()
    .startsWith('postgresql://', 'DATABASE_URL debe ser una URL PostgreSQL válida'),
  DIRECT_URL: z
    .string()
    .url()
    .startsWith('postgresql://', 'DIRECT_URL debe ser una URL PostgreSQL válida'),

  // ============ App ============
  NEXT_PUBLIC_APP_URL: z.string().url(),
  NEXT_PUBLIC_APP_NAME: z.string().default('NexoERP'),
  NEXT_PUBLIC_APP_ENV: z.enum(['development', 'staging', 'production']).default('development'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // ============ AWS ============
  AWS_REGION: z.string().default('us-east-1'),

  // ============ Email ============
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z
    .string()
    .transform((val) => parseInt(val, 10))
    .optional(),
  SES_FROM_EMAIL: z.string().email().optional(),

  // ============ Storage (S3) ============
  S3_BUCKET_DOCUMENTS: z.string().optional(),

  // ============ Monitoring ============
  SENTRY_DSN: z.string().url().optional().or(z.literal('')),
  NEXT_PUBLIC_SENTRY_DSN: z.string().url().optional().or(z.literal('')),

  // ============ Feature Flags ============
  NEXT_PUBLIC_ENABLE_DEBUG: z
    .string()
    .transform((val) => val === 'true')
    .default('false'),
});

/**
 * Valida las variables de entorno al importar este módulo.
 * Si hay errores, lanza una excepción y termina el proceso.
 *
 * @throws {Error} Si las variables de entorno son inválidas
 * @returns {Env} Variables de entorno validadas y tipadas
 */
function validateEnv() {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    console.error('❌ Variables de entorno inválidas:');
    console.error(JSON.stringify(parsed.error.flatten().fieldErrors, null, 2));
    throw new Error(
      'Variables de entorno inválidas. Revisar .env.local y comparar con .env.example',
    );
  }

  return parsed.data;
}

/**
 * Variables de entorno validadas del servidor.
 * Importar en código del servidor (API Routes, Server Components, etc.).
 *
 * @example
 * ```ts
 * import { env } from '@/lib/env';
 *
 * const dbUrl = env.DATABASE_URL;
 * const appEnv = env.NEXT_PUBLIC_APP_ENV;
 * ```
 */
export const env = validateEnv();

/**
 * Tipo TypeScript para las variables de entorno del servidor.
 * Generado automáticamente desde el schema Zod.
 */
export type Env = z.infer<typeof envSchema>;
