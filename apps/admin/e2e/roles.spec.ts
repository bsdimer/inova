import { expect, test, type Page } from '@playwright/test';
import { ORG_ADMIN, openSignedIn } from './session';

/**
 * Роли (Figma 1091:10390, WHI-40): the organisation's roles and what each may
 * do, every right by its Bulgarian name. On the seed WhiteNova has the
 * administrator, the house manager and the resident.
 */

const card = (page: Page, name: string) =>
  page.locator('main article').filter({ has: page.getByRole('heading', { name, exact: true }) });

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1728, height: 1117 });
  await openSignedIn(page, ORG_ADMIN, '/roles');
  await expect(page.locator('main article')).toHaveCount(3);
});

test('no code of a right or a role is on the page', async ({ page }) => {
  // The catalogue comes by its own request; read the page once it is there.
  await expect(page.getByRole('region', { name: 'Каталог на правата' })).toBeVisible();
  const text = await page.locator('main').innerText();
  expect(text).not.toMatch(/\b[a-z]+\.[a-z]+(\.[a-z]+)?\b/);
  expect(text).not.toMatch(/\b(admin|manager|resident)\b/);
});

test('each role shows its kind, its people and its rights in words', async ({ page }) => {
  const admin = card(page, 'Администратор');
  await expect(admin.getByText('системна', { exact: true })).toBeVisible();
  await expect(admin.getByText('заключена', { exact: true })).toBeVisible();
  await expect(admin.getByRole('list', { name: 'Права' }).getByRole('listitem')).toHaveText([
    'всички права',
  ]);
  await expect(admin.getByText('Системна роля — правата не се променят')).toBeVisible();

  const manager = card(page, 'Домоуправител');
  await expect(
    manager.getByText('Ежедневните операции за сградите, в които е назначен.'),
  ).toBeVisible();
  await expect(manager.getByRole('list', { name: 'Права' }).getByRole('listitem')).toHaveText([
    // In the catalogue's order: Служители, Настройки, Одит.
    'Преглед на служителите',
    'Покани и управление на служители',
    'Преглед на организацията',
    'Преглед на ролите',
    'Одитен дневник',
  ]);
  await expect(manager.getByRole('button', { name: 'Редактирай' })).toBeVisible();

  await expect(card(page, 'Жител').getByText('Собственият имот.')).toBeVisible();
});

test('the catalogue groups the rights by area, in words', async ({ page }) => {
  const catalogue = page.getByRole('region', { name: 'Каталог на правата' });
  const groups = catalogue.getByRole('list');
  await expect(groups.first()).toBeVisible();
  const read = [];
  for (const group of await groups.all()) {
    read.push([
      await group.getAttribute('aria-label'),
      ...(await group.getByRole('listitem').allTextContents()),
    ]);
  }
  expect(read).toEqual([
    ['Служители', 'Преглед на служителите', 'Покани и управление на служители'],
    [
      'Настройки',
      'Преглед на организацията',
      'Настройки на организацията',
      'Преглед на ролите',
      'Роли и права',
    ],
    ['Одит', 'Одитен дневник'],
  ]);
});

test('the role editor names each right, its code small beneath', async ({ page }) => {
  await card(page, 'Домоуправител').getByRole('button', { name: 'Редактирай' }).click();
  const dialog = page.getByRole('dialog');
  const right = dialog.getByRole('checkbox', { name: /Преглед на служителите/ });
  await expect(right).toBeChecked();
  await expect(dialog.getByText('staff.read', { exact: true })).toBeVisible();
  const [name, code] = await Promise.all([
    dialog
      .getByText('Преглед на служителите', { exact: true })
      .evaluate((el) => parseFloat(getComputedStyle(el).fontSize)),
    dialog
      .getByText('staff.read', { exact: true })
      .evaluate((el) => parseFloat(getComputedStyle(el).fontSize)),
  ]);
  expect(code).toBeLessThan(name);
});

test('two columns, each card as tall as its content', async ({ page }) => {
  const boxes = await page
    .locator('main article')
    .evaluateAll((els) =>
      els.map((el) => el.getBoundingClientRect()).map((r) => ({ x: r.x, h: r.height })),
    );
  expect(new Set(boxes.map((b) => Math.round(b.x))).size).toBe(2);
  expect(new Set(boxes.map((b) => Math.round(b.h))).size).toBeGreaterThan(1);
});

test('a system role is edited under its Bulgarian name, never the stored English one', async ({
  page,
}) => {
  await card(page, 'Домоуправител').getByRole('button', { name: 'Редактирай' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: 'Редактиране на Домоуправител' })).toBeVisible();
  await expect(dialog.getByText(/House manager/)).toHaveCount(0);
  await expect(dialog.getByLabel('Име')).toHaveCount(0);
});

test('below 1024 the roles stand in one column in the order they come', async ({ page }) => {
  await page.setViewportSize({ width: 402, height: 874 });
  await expect(page.locator('main article h2')).toHaveText([
    'Администратор',
    'Домоуправител',
    'Жител',
  ]);
  const xs = await page
    .locator('main article')
    .evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().x)));
  expect(new Set(xs).size).toBe(1);
});

test('a right the list does not know, with an empty description, shows its code', async ({
  page,
}) => {
  await page.route('**/v1/tenant/permissions', async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    await route.fulfill({ response, json: [...body, { key: 'future.thing', description: '' }] });
  });
  await page.reload();
  const catalogue = page.getByRole('region', { name: 'Каталог на правата' });
  await expect(catalogue.getByRole('listitem').filter({ hasText: 'future.thing' })).toBeVisible();
  const empty = await catalogue
    .getByRole('listitem')
    .evaluateAll((items) => items.filter((li) => !li.textContent?.trim()).length);
  expect(empty).toBe(0);
});
