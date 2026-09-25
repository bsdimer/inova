import { defineConfig, devices } from '@playwright/test';
import { ADMIN_PORT, API_PORT, API_URL, AUTH_PORT, AUTH_URL } from './e2e/ports';

/**
 * End-to-end checks of the admin against the real services (docs/plan/
 * testing-release.md → End-to-end (web)). Playwright starts auth-service, core
 * api and a production build of the admin on ports of their own, so a run
 * never collides with the dev servers on 4000 / 4001 / 5173. The database is
 * the migrated and seeded local one (CI: a fresh Postgres service).
 *
 * The services must be built first — `pnpm test:e2e` at the root does that.
 */
const CI = Boolean(process.env.CI);

export default defineConfig({
  testDir: './e2e',
  // The flows share one seeded database and only read it, but sign-in
  // attempts share the auth-service throttle; one worker keeps runs repeatable.
  workers: 1,
  fullyParallel: false,
  forbidOnly: CI,
  retries: CI ? 1 : 0,
  reporter: CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: `http://localhost:${ADMIN_PORT}`,
    // The frames are drawn at 1728 × 1117 (16" MacBook Pro); so are the checks.
    viewport: { width: 1728, height: 1117 },
    locale: 'bg-BG',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1728, height: 1117 } },
    },
  ],
  webServer: [
    {
      command: 'node dist/main.js',
      cwd: '../auth-service',
      url: `${AUTH_URL}/health`,
      env: {
        AUTH_SERVICE_PORT: String(AUTH_PORT),
        // Sign-in is tried many times in a run; the 429 path is checked by
        // answering the request in the browser, not by exhausting the limit.
        AUTH_THROTTLE_STRICT: '1000',
      },
      reuseExistingServer: !CI,
      timeout: 60_000,
    },
    {
      command: 'node dist/main.js',
      cwd: '../api',
      url: `http://localhost:${API_PORT}/v1/health`,
      env: {
        API_PORT: String(API_PORT),
        AUTH_JWKS_URL: `http://localhost:${AUTH_PORT}/.well-known/jwks.json`,
      },
      reuseExistingServer: !CI,
      timeout: 60_000,
    },
    {
      // Its own output folder: this build carries the «design data» preview
      // (VITE_DESIGN_FIXTURES) and must never land in dist/, which deploys.
      command: `pnpm exec vite build --outDir dist-e2e && pnpm exec vite preview --outDir dist-e2e --port ${ADMIN_PORT} --strictPort`,
      url: `http://localhost:${ADMIN_PORT}`,
      env: {
        VITE_AUTH_URL: AUTH_URL,
        VITE_DESIGN_FIXTURES: '1',
        VITE_API_URL: API_URL,
      },
      reuseExistingServer: !CI,
      timeout: 120_000,
    },
  ],
});
