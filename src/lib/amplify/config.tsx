'use client';

import { Amplify, type ResourcesConfig } from 'aws-amplify';
import { type ReactNode } from 'react';

/**
 * Configuración del cliente Amplify para el frontend.
 * Se ejecuta una sola vez al cargar el módulo (no en useEffect).
 *
 * amplify_outputs.json es generado por `npx ampx sandbox` o `npx ampx generate outputs`
 * y está en .gitignore (es diferente por ambiente).
 *
 * Error Handling: Si amplify_outputs.json no existe (ej: primera vez ejecutando el proyecto),
 * muestra un mensaje amigable al usuario con instrucciones de setup.
 */

let amplifyOutputs: ResourcesConfig | null = null;
let configError: string | null = null;

// Cargar y configurar Amplify al nivel del módulo (una sola vez, sin useEffect)
try {
   
  amplifyOutputs = require('../../amplify_outputs.json');
  Amplify.configure(amplifyOutputs!, {
    ssr: true, // Habilitar SSR support para Next.js App Router
  });
} catch {
  configError = 'amplify-not-configured';
  console.warn(
    '⚠️  amplify_outputs.json no encontrado. Ejecuta `npx ampx sandbox` para generar la configuración de Amplify.',
  );
}

export default function AmplifyConfigProvider({ children }: { children: ReactNode }) {
  // Permitir bypass del error en tests E2E mediante variable de entorno
  const bypassError =
    process.env.NEXT_PUBLIC_BYPASS_AMPLIFY_ERROR === 'true' || process.env.NODE_ENV === 'test';

  // Mostrar error de configuración solo en desarrollo (no en tests ni producción)
  if (configError && process.env.NODE_ENV === 'development' && !bypassError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
        <div className="w-full max-w-md rounded-lg border border-orange-200 bg-orange-50 p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <svg
              className="h-6 w-6 text-orange-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <h2 className="text-lg font-semibold text-orange-900">
              Configuración de AWS Amplify requerida
            </h2>
          </div>

          <div className="space-y-3 text-sm text-orange-800">
            <p>
              El archivo{' '}
              <code className="rounded bg-orange-100 px-1 py-0.5">amplify_outputs.json</code> no
              está presente.
            </p>

            <div className="rounded-md bg-orange-100 p-3">
              <p className="mb-2 font-medium">Para inicializar Amplify Gen 2:</p>
              <ol className="ml-4 list-decimal space-y-1">
                <li>Verifica que tengas AWS CLI configurado</li>
                <li>
                  Ejecuta: <code className="font-mono text-xs">npx ampx sandbox</code>
                </li>
                <li>Espera a que se genere amplify_outputs.json</li>
                <li>Recarga esta página</li>
              </ol>
            </div>

            <p className="text-xs">
              Este error solo se muestra en desarrollo. En producción, Amplify se configura
              automáticamente durante el deploy.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // En producción, si no está configurado, renderizar de todas formas
  // (puede haber rutas públicas que no requieren Amplify)
  return <>{children}</>;
}
