import { expect, test, type Page } from '@playwright/test';
import { ORG_ADMIN, PLATFORM_ADMIN, openSignedIn } from './session';

/**
 * design.md → Words: plan codes (M6, B9, D16, P1) never appear in what a
 * user reads — the text on the page, its tooltips or its accessible names.
 * The whole body is read, so portals (drawers, popovers) count too.
 */
const PLAN_CODE = /\b(M\d+[a-z]?|P\d+|[BD]\d+)\b/;

async function words(page: Page): Promise<string[]> {
  return page
    .locator('body')
    .evaluate((body) => [
      (body as HTMLElement).innerText,
      ...[...body.querySelectorAll('[title], [aria-label]')].flatMap((el) => [
        el.getAttribute('title') ?? '',
        el.getAttribute('aria-label') ?? '',
      ]),
    ]);
}

async function expectNoPlanCode(page: Page) {
  for (const text of await words(page)) expect(text).not.toMatch(PLAN_CODE);
}

for (const path of [
  '/?fixture=off',
  '/tasks',
  '/notices',
  '/finance',
  '/buildings',
  '/residents',
  '/issues',
  '/staff',
  '/roles',
  '/audit',
]) {
  test(`no plan code on ${path}`, async ({ page }) => {
    await openSignedIn(page, ORG_ADMIN, path);
    await expect(page.locator('main h1, main h2').first()).toBeVisible();
    await expectNoPlanCode(page);
  });
}

for (const path of ['/platform', '/tenants', '/audit']) {
  test(`no plan code on ${path} in the platform scope`, async ({ page }) => {
    await openSignedIn(page, PLATFORM_ADMIN, path);
    await expect(page.locator('main h1, main h2').first()).toBeVisible();
    await expectNoPlanCode(page);
  });
}

test('no plan code in the «Роли и обхват» panel', async ({ page }) => {
  await openSignedIn(page, ORG_ADMIN, '/staff');
  await page
    .getByRole('button', { name: /^Роли и обхват — / })
    .first()
    .click();
  await expect(page.getByText('Всички сгради в организацията')).toBeVisible();
  await expectNoPlanCode(page);
});
