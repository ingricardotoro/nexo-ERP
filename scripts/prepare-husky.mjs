import { execSync } from 'node:child_process';

const isCiEnvironment =
  process.env.CI === 'true' ||
  Boolean(process.env.AWS_BRANCH) ||
  Boolean(process.env.AMPLIFY_APP_ID);

// In CI/Amplify, skip husky setup to avoid failing when devDependencies are omitted.
if (isCiEnvironment) {
  process.exit(0);
}

try {
  execSync('npx husky', { stdio: 'inherit' });
} catch {
  // Do not block install if husky is unavailable in this environment.
  process.exit(0);
}
