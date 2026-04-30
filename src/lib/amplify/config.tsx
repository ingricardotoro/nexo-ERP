'use client';

import { Amplify } from 'aws-amplify';
import { cognitoUserPoolsTokenProvider } from 'aws-amplify/auth/cognito';
import { CookieStorage } from 'aws-amplify/utils';
import { type ReactNode } from 'react';

/**
 * Configuración del cliente Amplify para el frontend.
 *
 * Usa variables de entorno NEXT_PUBLIC_* en lugar de amplify_outputs.json
 * para garantizar que webpack las inline correctamente en el bundle del browser.
 *
 * El enfoque eval('require') no funciona en el browser porque webpack no puede
 * analizar estáticamente la llamada y no incluye el JSON en el bundle.
 */

const region = process.env.NEXT_PUBLIC_AWS_REGION ?? 'us-east-1';
const userPoolId = process.env.NEXT_PUBLIC_USER_POOL_ID ?? 'us-east-1_KQacyXXAQ';
const userPoolClientId = process.env.NEXT_PUBLIC_USER_POOL_CLIENT_ID ?? '1im63gh94r2h52gah31da3tv5';
const identityPoolId =
  process.env.NEXT_PUBLIC_IDENTITY_POOL_ID ?? 'us-east-1:570cd34a-b3e3-4f69-88d5-6e3d2b9d72d5';
const storageBucket =
  process.env.NEXT_PUBLIC_S3_BUCKET ??
  'amplify-nexoerp-marvin-sa-nexoerpdocumentsbucketb8-bimtcqkqm8s3';

Amplify.configure(
  {
    Auth: {
      Cognito: {
        userPoolId,
        userPoolClientId,
        identityPoolId,
        loginWith: { email: true },
        mfa: { status: 'optional', totpEnabled: true },
        userAttributes: { email: { required: true } },
        passwordFormat: {
          minLength: 8,
          requireLowercase: true,
          requireNumbers: true,
          requireSpecialCharacters: true,
          requireUppercase: true,
        },
      },
    },
    Storage: {
      S3: {
        bucket: storageBucket,
        region,
      },
    },
  },
  { ssr: true },
);

// Amplify v6 stores tokens in localStorage by default even with `ssr: true`.
// The Edge middleware (proxy.ts) runs server-side and cannot access localStorage,
// so tokens must be in cookies. Configuring CookieStorage here ensures that
// signIn/confirmSignIn persist tokens as cookies that the middleware can read.
if (typeof window !== 'undefined') {
  cognitoUserPoolsTokenProvider.setKeyValueStorage(
    new CookieStorage({
      secure: window.location.protocol === 'https:',
      sameSite: 'strict',
    }),
  );
}

export default function AmplifyConfigProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
