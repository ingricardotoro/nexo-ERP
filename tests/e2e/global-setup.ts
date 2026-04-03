// tests/e2e/global-setup.ts
// Playwright global setup — authenticates against Cognito and saves storageState.
//
// Required environment variables (CI: set as secrets, local: .env.test.local):
//   E2E_TEST_EMAIL        - test user email
//   E2E_TEST_PASSWORD     - test user password
//   COGNITO_USER_POOL_ID  - Cognito User Pool ID (e.g. us-east-1_XXXXXXXXX)
//   COGNITO_CLIENT_ID     - Cognito App Client ID
//   AWS_REGION            - AWS region (default: us-east-1)
//
// If credentials are not set, the setup is skipped and tests run without auth
// (suitable for local dev with NEXT_PUBLIC_BYPASS_AMPLIFY_ERROR=true).

import { chromium, type FullConfig } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { STORAGE_STATE_PATH } from './helpers/auth';

async function cognitoAuthenticate(
  email: string,
  password: string,
  userPoolId: string,
  clientId: string,
  region: string,
): Promise<{ idToken: string; accessToken: string }> {
  // Using Cognito USER_PASSWORD_AUTH flow via the public API
  const endpoint = `https://cognito-idp.${region}.amazonaws.com/`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-amz-json-1.1',
      'X-Amz-Target': 'AWSCognitoIdentityProviderService.InitiateAuth',
    },
    body: JSON.stringify({
      AuthFlow: 'USER_PASSWORD_AUTH',
      ClientId: clientId,
      AuthParameters: {
        USERNAME: email,
        PASSWORD: password,
      },
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Cognito auth failed: ${response.status} ${body}`);
  }

  const data = (await response.json()) as {
    AuthenticationResult?: { IdToken: string; AccessToken: string };
    ChallengeName?: string;
  };

  if (data.ChallengeName) {
    throw new Error(
      `Cognito challenge not supported in E2E setup: ${data.ChallengeName}. ` +
        'Use a test user without MFA or password-change challenge.',
    );
  }

  if (!data.AuthenticationResult?.IdToken) {
    throw new Error('Cognito did not return IdToken');
  }

  return {
    idToken: data.AuthenticationResult.IdToken,
    accessToken: data.AuthenticationResult.AccessToken,
  };
}

export default async function globalSetup(_config: FullConfig) {
  const email = process.env.E2E_TEST_EMAIL;
  const password = process.env.E2E_TEST_PASSWORD;
  const userPoolId = process.env.COGNITO_USER_POOL_ID;
  const clientId = process.env.COGNITO_CLIENT_ID ?? process.env.COGNITO_USER_POOL_CLIENT_ID;
  const region = process.env.AWS_REGION ?? 'us-east-1';

  // If credentials are not provided, skip auth setup (local dev bypass mode)
  if (!email || !password || !userPoolId || !clientId) {
    console.log('[E2E global-setup] No E2E credentials found — skipping auth setup.');
    console.log(
      '[E2E global-setup] Set E2E_TEST_EMAIL, E2E_TEST_PASSWORD, COGNITO_USER_POOL_ID, COGNITO_CLIENT_ID to enable.',
    );
    // Write empty storage state so storageState loading doesn't fail
    const dir = path.dirname(STORAGE_STATE_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(STORAGE_STATE_PATH, JSON.stringify({ cookies: [], origins: [] }));
    return;
  }

  console.log(`[E2E global-setup] Authenticating ${email} against Cognito...`);

  try {
    const { idToken, accessToken } = await cognitoAuthenticate(
      email,
      password,
      userPoolId,
      clientId,
      region,
    );

    // Persist tokens as cookies using a real browser context
    // so Playwright storageState picks up the exact cookie format
    const browser = await chromium.launch();
    const context = await browser.newContext();
    const page = await context.newPage();

    // Navigate to the app so cookies are set on the correct origin
    await page.goto('http://localhost:3000');

    await context.addCookies([
      {
        name: 'amplify-id-token',
        value: idToken,
        domain: 'localhost',
        path: '/',
        httpOnly: false,
        secure: false,
        sameSite: 'Lax',
      },
      {
        name: 'amplify-access-token',
        value: accessToken,
        domain: 'localhost',
        path: '/',
        httpOnly: false,
        secure: false,
        sameSite: 'Lax',
      },
    ]);

    const dir = path.dirname(STORAGE_STATE_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    await context.storageState({ path: STORAGE_STATE_PATH });
    await browser.close();

    console.log(`[E2E global-setup] Auth state saved to ${STORAGE_STATE_PATH}`);
  } catch (err) {
    console.error('[E2E global-setup] Authentication failed:', err);
    throw err;
  }
}
