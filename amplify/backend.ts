import { defineBackend } from '@aws-amplify/backend';

import { auth } from './auth/resource.js';
import { storage } from './storage/resource.js';

/**
 * NexoERP — Backend Definition (Amplify Gen 2)
 *
 * Define todos los recursos de backend:
 * - Auth: Cognito User Pool con 5 roles RBAC
 * - Storage: S3 para documentos de empresas
 *
 * @see https://docs.amplify.aws/gen2/build-a-backend/
 */
const backend = defineBackend({
  auth,
  storage,
});

// === Configuración adicional de CDK (environment tags) ===
const stack = backend.createStack('NexoERPStack');
stack.tags.setTag('Project', 'NexoERP');
stack.tags.setTag('Environment', process.env.AMPLIFY_ENV || 'sandbox');
