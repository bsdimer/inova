import { expect, test } from '@playwright/test';
import { ORG_ADMIN, PLATFORM_ADMIN, openSignedIn } from './session';

/**
 * Who may open which page: the route guards, typed into the address bar.
 * Every page but /login sits behind the session check; the platform's pages
 * are for its administrator; Табло needs an organisation.
 */

const SHELL_PAGES = [
  '/',
  '/tasks',
  '/notices',
  '/finance',
  '/buildings',
  '/residents',
  '/issues',
  '/staff',
  '/roles',
  '/audit',
  '/platform',
  '/tenants',
];

for (const path of SHELL_PAGES) {
  test(`without a session ${path} leads to the sign-in page`, async ({ page }) => {
    await page.goto(path);
    await expect(page).toHaveURL('/login');
  });
}

for (const path of ['/platform', '/tenants']) {
  test(`organisation staff opening ${path} land on Табло`, async ({ page }) => {
    await openSignedIn(page, ORG_ADMIN, path);
    await expect(page).toHaveURL('/');
  });
}

test('a platform administrator without an organisation opening Табло lands on «Организации»', async ({
  page,
}) => {
  await openSignedIn(page, PLATFORM_ADMIN, '/');
  await expect(page).toHaveURL('/tenants');
});

for (const path of SHELL_PAGES.filter((p) => !['/platform', '/tenants'].includes(p))) {
  test(`organisation staff open ${path}`, async ({ page }) => {
    await openSignedIn(page, ORG_ADMIN, path);
    await expect(page).toHaveURL(path);
  });
}

for (const path of ['/platform', '/tenants', '/audit']) {
  test(`a platform administrator opens ${path}`, async ({ page }) => {
    await openSignedIn(page, PLATFORM_ADMIN, path);
    await expect(page).toHaveURL(path);
  });
}
