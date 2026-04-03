// tests/e2e/helpers/auth.ts
// Playwright auth helper for NexoERP E2E tests.
//
// Authenticates against AWS Cognito using test credentials from environment variables:
//   E2E_TEST_EMAIL    - test user email (must exist in Cognito staging pool)
//   E2E_TEST_PASSWORD - test user password
//
// The Cognito idToken is stored as the 'amplify-id-token' cookie, matching
// the extractTokenFromRequest() logic in src/lib/auth/cognito-jwt.ts.
//
// Usage in tests:
//   import { test } from './helpers/auth';
//   test('my test', async ({ authenticatedPage }) => { ... });
//
// The storageState is generated once by the global setup (global-setup.ts)
// and reused across all tests in a session.

import { test as base, type BrowserContext } from '@playwright/test';
import path from 'path';

export const STORAGE_STATE_PATH = path.join(process.cwd(), '.playwright', 'auth.json');

// ─── Fixture type ─────────────────────────────────────────────────────────────

type AuthFixtures = {
  /** A page pre-authenticated with the E2E test user */
  authenticatedPage: Awaited<ReturnType<BrowserContext['newPage']>>;
};

// ─── Extended test with auth fixture ─────────────────────────────────────────

export const test = base.extend<AuthFixtures>({
  authenticatedPage: async ({ browser }, use) => {
    // Load persisted auth state if available
    const context = await browser.newContext({
      storageState: STORAGE_STATE_PATH,
    });
    const page = await context.newPage();
    await use(page);
    await context.close();
  },
});

export { expect } from '@playwright/test';
