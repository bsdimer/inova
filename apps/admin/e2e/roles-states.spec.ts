import { expect, test, type Page } from '@playwright/test';
import { ORG_ADMIN, openSignedIn } from './session';

/**
 * Роли when the data is not the seed's: a failed request, a custom role
 * someone holds and one nobody holds, a role without rights.
 */

const card = (page: Page, name: string) =>
  page.locator('main article').filter({ has: page.getByRole('heading', { name, exact: true }) });

/** Adds custom roles to the seed's answer. */
async function withRoles(page: Page, extra: object[]) {
  await page.route('**/v1/tenant/roles', async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    const response = await route.fetch();
    await route.fulfill({ response, json: [...(await response.json()), ...extra] });
  });
}

test.use({ viewport: { width: 1728, height: 1117 } });

test('when the roles cannot be read, the page says so instead of showing none', async ({
  page,
}) => {
  await page.route('**/v1/tenant/roles', (route) => route.fulfill({ status: 500, json: {} }));
  await openSignedIn(page, ORG_ADMIN, '/roles');
  // The query retries three times with backoff before it gives up.
  await expect(page.getByText('Ролите не се заредиха.')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole('region', { name: 'Каталог на правата' })).toHaveCount(0);
});

test('when the catalogue cannot be read, the page says so and no role is created blind', async ({
  page,
}) => {
  await page.route('**/v1/tenant/permissions', (route) => route.fulfill({ status: 500, json: {} }));
  await openSignedIn(page, ORG_ADMIN, '/roles');
  await expect(page.getByText('Каталогът на правата не се зареди.')).toBeVisible({
    timeout: 15_000,
  });
  await page.getByRole('button', { name: 'Нова роля' }).click();
  await expect(
    page.getByRole('dialog').getByRole('button', { name: 'Създай роля' }),
  ).toBeDisabled();
});

test('a custom role can be deleted only while nobody holds it', async ({ page }) => {
  await withRoles(page, [
    { key: 'cashier', name: 'Касиер', isSystem: false, permissions: ['staff.read'], members: 1 },
    { key: 'auditor', name: 'Одитор', isSystem: false, permissions: ['audit.read'], members: 0 },
  ]);
  await openSignedIn(page, ORG_ADMIN, '/roles');
  await expect(card(page, 'Касиер').getByText('собствена', { exact: true })).toBeVisible();
  await expect(card(page, 'Касиер').getByRole('button', { name: 'Изтрий' })).toHaveCount(0);
  await expect(card(page, 'Одитор').getByRole('button', { name: 'Изтрий' })).toBeVisible();
  await expect(card(page, 'Домоуправител').getByRole('button', { name: 'Изтрий' })).toHaveCount(0);
});

test('a role without rights says so, with no empty list', async ({ page }) => {
  await withRoles(page, [
    { key: 'guest', name: 'Гост', isSystem: false, permissions: [], members: 0 },
  ]);
  await openSignedIn(page, ORG_ADMIN, '/roles');
  const guest = card(page, 'Гост');
  await expect(guest.getByText('Без права')).toBeVisible();
  await expect(guest.getByRole('list')).toHaveCount(0);
});
