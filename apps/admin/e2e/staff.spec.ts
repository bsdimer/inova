import { expect, test, type Page } from '@playwright/test';
import { ORG_ADMIN, openSignedIn } from './session';

/**
 * Служители (872:1710) on the seed: WhiteNova has Мария Иванова (active
 * administrator) and Елена Петрова (invited manager).
 */
const rows = (page: Page) => page.locator('main table tbody tr');

test('while the list loads it shows skeleton rows, never «no staff yet»', async ({ page }) => {
  // Regression: the empty state was decided before loading and flashed on
  // every visit. Hold the list back and look at what stands in for it.
  let release: () => void = () => undefined;
  const held = new Promise<void>((resolve) => (release = resolve));
  await page.route('**/v1/tenant/staff', async (route) => {
    await held;
    await route.continue();
  });
  await openSignedIn(page, ORG_ADMIN, '/staff');

  await expect(page.locator('main table tbody tr .animate-pulse').first()).toBeVisible();
  await expect(page.getByText('Още няма акаунти на служители')).toHaveCount(0);

  release();
  await expect(rows(page)).toHaveCount(2);
});

test.describe('with the list loaded', () => {
  test.beforeEach(async ({ page }) => {
    await openSignedIn(page, ORG_ADMIN, '/staff');
    await expect(rows(page)).toHaveCount(2);
  });

  test('every column of the table is shown at the drawn width', async ({ page }) => {
    // Regression: the folding columns' <col> classes were never generated, so
    // four columns were hidden at every width.
    const headers = page.locator('main table thead th');
    await expect(headers).toHaveText([
      'Служител',
      'Контакт',
      'Статус',
      'Роли',
      'Обхват',
      'Покана',
      'От',
      '',
    ]);
    const widths = await headers.evaluateAll((ths) =>
      ths.map((th) => Math.round(th.getBoundingClientRect().width)),
    );
    expect(widths).toEqual([224, 152, 112, 180, 100, 196, 80, 52]);
  });

  test('the status facet filters, names itself in a chip, and clears', async ({ page }) => {
    await expect(rows(page)).toHaveCount(2);

    await page.getByRole('button', { name: 'Статус' }).click();
    await page.getByRole('option', { name: 'Поканен' }).click();
    await page.keyboard.press('Escape');

    await expect(rows(page)).toHaveCount(1);
    await expect(rows(page).first()).toContainText('Елена Петрова');
    await expect(page.getByText('1 от 2 служители')).toBeVisible();
    await expect(page.getByText('Статус: Поканен')).toBeVisible();

    await page.getByRole('button', { name: 'Изчисти' }).click();
    await expect(rows(page)).toHaveCount(2);
    await expect(page.getByText('Статус: Поканен')).toHaveCount(0);
  });

  test('search narrows the list by name', async ({ page }) => {
    await page.getByPlaceholder('Търси по име, имейл или телефон').fill('Мария');
    await expect(rows(page)).toHaveCount(1);
    await expect(rows(page).first()).toContainText('Мария Иванова');
  });

  test('the sort preset reorders the list', async ({ page }) => {
    await page.getByRole('button', { name: 'Първо нуждаещите се от внимание' }).click();
    await page.getByRole('option', { name: 'Име А–Я' }).click();

    await expect(rows(page).nth(0)).toContainText('Елена Петрова');
    await expect(rows(page).nth(1)).toContainText('Мария Иванова');
  });
});
