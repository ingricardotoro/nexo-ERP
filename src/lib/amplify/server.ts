import { createServerRunner } from '@aws-amplify/adapter-nextjs';

/**
 * Server-side Amplify utilities para:
 * - Server Components
 * - API Route Handlers
 * - Middleware
 *
 * Este módulo debe importarse solo desde código del servidor (Server Components,
 * Route Handlers, Middleware). NO usar en Client Components.
 *
 * Error Handling: Si amplify_outputs.json no existe, runWithAmplifyServerContext
 * lanzará error. El llamador debe manejar esto gracefully.
 */

let amplifyOutputs = null;

try {
  amplifyOutputs = require('../../amplify_outputs.json');
} catch {
  console.warn(
    '⚠️  [Server] amplify_outputs.json no encontrado. Las funciones de servidor que requieran Amplify fallarán.',
  );
}

export const { runWithAmplifyServerContext } = createServerRunner({
  config: amplifyOutputs || {
    // Config mínimo de fallback para evitar crashes
    Auth: {
      Cognito: {
        userPoolId: 'dummy',
        userPoolClientId: 'dummy',
      },
    },
  },
});
