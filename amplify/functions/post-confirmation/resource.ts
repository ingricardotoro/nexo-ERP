import { defineFunction } from '@aws-amplify/backend';

/**
 * Lambda Function Resource — PostConfirmation Trigger
 *
 * Configuración de la Lambda que sincroniza usuarios de Cognito a Prisma.
 *
 * Timeout: 10 segundos (suficiente para INSERT en PostgreSQL via RDS Proxy)
 * Memory: 512 MB (Prisma Client + connection pooling)
 * Env vars: DATABASE_URL (via Secrets Manager)
 */
export const postConfirmation = defineFunction({
  name: 'post-confirmation',
  entry: './handler.ts',
  timeoutSeconds: 10,
  memoryMB: 512,
  environment: {
    // DATABASE_URL se configura en Amplify Console (Secrets Manager ARN)
    // Apunta a RDS Proxy (connection pooling)
    DATABASE_URL: process.env.DATABASE_URL || '',
  },
});
