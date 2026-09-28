import { expect, test, type Page } from '@playwright/test';
import { PLATFORM_ADMIN, openSignedIn } from './session';

/**
 * Организации (1150:11454) in the platform scope, on the seed: WhiteNova
 * Technology (active) and Demo Blok Management (trial).
 */
const rows = (page: Page) => page.locator('main table tbody tr');

test.beforeEach(async ({ page }) => {
  await openSignedIn(page, PLATFORM_ADMIN, '/tenants');
  await expect(page.getByRole('heading', { name: 'Организации' })).toBeVisible();
  await expect(rows(page)).toHaveCount(2);
});

test('search and the status facet narrow the list', async ({ page }) => {
  await page.getByPlaceholder('Търси организация по име или ключ').fill('demo');
  await expect(rows(page)).toHaveCount(1);
  await expect(rows(page).first()).toContainText('Demo Blok Management');

  await page.getByPlaceholder('Търси организация по име или ключ').fill('');
  await page.getByRole('button', { name: 'Статус' }).click();
  await page.getByRole('option', { name: 'Активна' }).click();
  await page.keyboard.press('Escape');
  await expect(rows(page)).toHaveCount(1);
  await expect(rows(page).first()).toContainText('WhiteNova Technology');
});

test('the sort preset reorders the list', async ({ page }) => {
  await page.getByRole('button', { name: 'Първо последно създадените' }).click();
  await page.getByRole('option', { name: 'Име А–Я' }).click();

  await expect(rows(page).nth(0)).toContainText('Demo Blok Management');
  await expect(rows(page).nth(1)).toContainText('WhiteNova Technology');
});

test('«Влез» enters an organization as an audited visit, and the way back out works', async ({
  page,
}) => {
  await rows(page)
    .filter({ hasText: 'WhiteNova Technology' })
    .getByRole('button', { name: 'Влез' })
    .click();

  await expect(page).toHaveURL('/');
  await expect(page.getByText('Платформа → WhiteNova Technology')).toBeVisible();
  await expect(page.locator('aside nav a').first()).toHaveText('Табло');

  await page.getByRole('button', { name: 'Върни се в платформата' }).click();
  await expect(page).toHaveURL('/tenants');
  await expect(page.locator('aside nav a')).toHaveText([
    'Общ преглед',
    'Организации',
    'Одитен дневник',
  ]);
});

test('the card edge ends the table: no divider under the last row', async ({ page }) => {
  const border = (row: ReturnType<typeof rows>) =>
    row
      .locator('td')
      .first()
      .evaluate((cell) => getComputedStyle(cell).borderBottomWidth);
  expect(await border(rows(page).first())).not.toBe('0px');
  expect(await border(rows(page).last())).toBe('0px');
});
