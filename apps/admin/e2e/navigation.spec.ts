import { expect, test, type Page } from '@playwright/test';
import { ORG_ADMIN, openSignedIn } from './session';

/**
 * The menu (V2/Sidebar 859:1466, V2/Rail 850:305): four groups in the order
 * of D23, a line between groups, unbuilt modules hidden; the list scrolls on a
 * short window; hover grows the one item under the pointer.
 */

/** The menu's children in order: an item's name, or «—» for a group line. */
const menuSequence = (page: Page) =>
  page
    .locator('aside nav')
    .first()
    .evaluate((nav) =>
      [...nav.children].map((child) =>
        child.tagName === 'HR' ? '—' : (child.textContent ?? '').replace(/\d+$/, '').trim(),
      ),
    );

const growth = (page: Page, name: string) =>
  page
    .locator('aside nav a', { hasText: name })
    .locator('.nav-grow')
    .first()
    .evaluate((el) => getComputedStyle(el).transform);

test('the sidebar shows four groups with a line between them and no unbuilt module', async ({
  page,
}) => {
  await openSignedIn(page, ORG_ADMIN, '/');
  expect(await menuSequence(page)).toEqual([
    'Табло',
    'Задачи',
    'Известия',
    '—',
    'Финанси',
    '—',
    'Сгради',
    'Жители',
    'Сигнали',
    '—',
    'Служители',
    'Роли',
  ]);
  for (const hidden of ['Документи', 'Справки', 'Анкети', 'Общност']) {
    await expect(page.getByRole('link', { name: hidden })).toHaveCount(0);
  }

  // 2 between items, 3 + 1 + 3 around a line, as drawn.
  const gaps = await page
    .locator('aside nav')
    .first()
    .evaluate((nav) => {
      const box = (i: number) => nav.children.item(i)!.getBoundingClientRect();
      return {
        betweenItems: box(2).top - box(1).bottom,
        rule: box(3).height,
        acrossRule: box(4).top - box(2).bottom,
      };
    });
  expect(gaps).toEqual({ betweenItems: 2, rule: 1, acrossRule: 11 });
});

test('the rail draws the same group lines, 32 wide', async ({ page }) => {
  await page.setViewportSize({ width: 1536, height: 1000 });
  await openSignedIn(page, ORG_ADMIN, '/');
  const rules = page.locator('aside nav hr');
  await expect(rules).toHaveCount(3);
  expect((await rules.first().boundingBox())?.width).toBe(32);
});

test('on a short window the list scrolls to the open section; brand and account stay', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1728, height: 560 });
  await openSignedIn(page, ORG_ADMIN, '/roles');
  const nav = page.locator('aside nav').first();
  const roles = nav.getByRole('link', { name: 'Роли' });
  const account = page.locator('aside').getByText('Мария Иванова');

  expect(await nav.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true);
  const [navBox, rolesBox, accountBox] = await Promise.all([
    nav.boundingBox(),
    roles.boundingBox(),
    account.boundingBox(),
  ]);
  expect(rolesBox!.y + rolesBox!.height).toBeLessThanOrEqual(navBox!.y + navBox!.height);
  expect(accountBox!.y + accountBox!.height).toBeLessThanOrEqual(560);
  // The open item stays 8 clear of the rule above the account, as drawn.
  const ruleBox = await page.locator('aside > hr').last().boundingBox();
  expect(ruleBox!.y - (rolesBox!.y + rolesBox!.height)).toBeGreaterThanOrEqual(8);
  await expect(page.locator('aside > *').first()).toBeInViewport();
});

test('hover grows only the item under the pointer, never the open one', async ({ page }) => {
  await openSignedIn(page, ORG_ADMIN, '/');
  await page.locator('aside nav a', { hasText: 'Задачи' }).hover();
  await expect.poll(() => growth(page, 'Задачи')).toBe('matrix(1.06, 0, 0, 1.06, 0, 0)');
  expect(await growth(page, 'Известия')).toBe('none');

  await page.locator('aside nav a', { hasText: 'Табло' }).hover();
  await expect.poll(() => growth(page, 'Задачи')).toBe('none');
  expect(await growth(page, 'Табло')).toBe('none');
});

test('with reduced motion hover shows only the plate', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openSignedIn(page, ORG_ADMIN, '/');
  const tasks = page.locator('aside nav a', { hasText: 'Задачи' });
  await tasks.hover();
  await expect(tasks).not.toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  expect(await growth(page, 'Задачи')).toBe('none');
});
