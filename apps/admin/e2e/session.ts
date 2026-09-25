import { expect, type Page } from '@playwright/test';
import { AUTH_URL } from './ports';

/** Seeded accounts (db/seed.mjs). */
export const ORG_ADMIN = { email: 'maria@inova.bg', password: 'inova-owner' };
export const PLATFORM_ADMIN = { email: 'admin@inova.bg', password: 'inova-admin' };

/**
 * Signs in through auth-service and stores the session the way the login
 * page does, then opens `path`. The sign-in screen itself is covered by
 * sign-in.spec.ts; the other specs start signed in.
 */
export async function openSignedIn(
  page: Page,
  account: { email: string; password: string },
  path: string,
): Promise<void> {
  const res = await page.request.post(`${AUTH_URL}/auth/login`, { data: account });
  expect(res.status(), `sign-in as ${account.email}`).toBe(200);
  const session = await res.json();
  await page.goto('/login');
  await page.evaluate((value) => {
    localStorage.clear();
    localStorage.setItem('inova.session', value);
    localStorage.setItem('inova.theme', 'light');
  }, JSON.stringify(session));
  await page.goto(path);
}
