import { expect, test, type Page } from '@playwright/test';
import { ORG_ADMIN, openSignedIn } from './session';

/**
 * The menu (V2/Sidebar 859:1466, V2/Rail 850:305): four groups in the order
 * of D23, a line between groups, unbuilt modules hidden; the list scrolls on a
 * short window; hover grows the one item under the pointer.
 */

/** The menu's groups in order, each as its items' names, with «—» for a line. */
const menuSequence = (page: Page) =>
  page
    .locator('aside nav')
    .first()
    .evaluate((nav) =>
      [...nav.children].map((child) =>
        child.tagName === 'HR'
          ? '—'
          : [...child.querySelectorAll('a')].map((a) =>
              (a.textContent ?? '').replace(/\d+$/, '').trim(),
            ),
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
    ['Табло', 'Задачи', 'Известия'],
    '—',
    ['Финанси'],
    '—',
    ['Сгради', 'Жители', 'Сигнали'],
    '—',
    ['Служители', 'Роли'],
  ]);
  for (const hidden of ['Документи', 'Справки', 'Анкети', 'Общност']) {
    await expect(page.getByRole('link', { name: hidden })).toHaveCount(0);
  }

  // 2 between items, 3 + 1 + 3 around a line, as drawn.
  const gaps = await page
    .locator('aside nav')
    .first()
    .evaluate((nav) => {
      const link = (name: string) =>
        [...nav.querySelectorAll('a')]
          .find((a) => a.textContent?.startsWith(name))!
          .getBoundingClientRect();
      return {
        betweenItems: link('Известия').top - link('Задачи').bottom,
        rule: nav.querySelector('hr')!.getBoundingClientRect().height,
        acrossRule: link('Финанси').top - link('Известия').bottom,
      };
    });
  expect(gaps).toEqual({ betweenItems: 2, rule: 1, acrossRule: 11 });
});

test('a screen reader hears a named menu of four lists and the open section', async ({ page }) => {
  await openSignedIn(page, ORG_ADMIN, '/staff');
  const menu = page.getByRole('navigation', { name: 'Основно меню' });
  const lists = menu.getByRole('list');
  await expect(lists).toHaveCount(4);
  const counts = await lists.evaluateAll((all) =>
    all.map((list) => list.querySelectorAll(':scope > li').length),
  );
  expect(counts).toEqual([3, 1, 3, 2]);
  await expect(menu.getByRole('link', { name: 'Служители' })).toHaveAttribute(
    'aria-current',
    'page',
  );
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

// A 13″ laptop leaves about 600 px of window at rail widths (review on #41).
for (const width of [1280, 1536]) {
  test(`${width} × 600: the rail scrolls, Роли is reachable, the tooltip is not cut`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 600 });
    await openSignedIn(page, ORG_ADMIN, '/roles');
    const rail = page.locator('aside').first();
    const nav = rail.getByRole('navigation', { name: 'Основно меню' });
    const roles = nav.getByRole('link', { name: 'Роли' });
    const account = rail.locator(':scope > :last-child');

    // Роли and the account stand wholly inside the rail's glass and the window.
    const railBox = (await rail.boundingBox())!;
    for (const part of [roles, account]) {
      await expect(part).toBeInViewport({ ratio: 1 });
      const b = (await part.boundingBox())!;
      expect(b.y + b.height).toBeLessThanOrEqual(railBox.y + railBox.height);
    }
    await roles.click({ trial: true });

    // Every item keeps the 44 px target.
    for (const h of await nav
      .getByRole('link')
      .evaluateAll((links) => links.map((l) => l.getBoundingClientRect().height))) {
      expect(h).toBeGreaterThanOrEqual(44);
    }

    // The last item's tooltip shows on hover, beside the item, and nothing cuts it.
    await roles.hover();
    const tip = roles.locator('.rail-tip');
    await expect(tip).toBeVisible();
    await expect(tip).toBeInViewport({ ratio: 1 });
    const t = (await tip.boundingBox())!;
    // 8 to the right of the item, as drawn in V2/Tooltip · panel (1784:39369).
    const r = (await roles.boundingBox())!;
    expect(t.x - (r.x + r.width)).toBeCloseTo(8, 0);
    // Nothing paints over it: the topmost element at its centre is the tooltip
    // (pointer-events are switched on for the probe, the tooltip ignores them).
    const onTop = await tip.evaluate((el) => {
      const b = el.getBoundingClientRect();
      (el as HTMLElement).style.pointerEvents = 'auto';
      const hit = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2);
      (el as HTMLElement).style.pointerEvents = '';
      return hit === el;
    });
    expect(onTop).toBe(true);
  });
}

test('rail tooltips: on keyboard focus at once, following focus as the rail scrolls', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 600 });
  await openSignedIn(page, ORG_ADMIN, '/roles');
  const nav = page.locator('aside').first().getByRole('navigation', { name: 'Основно меню' });
  await nav.getByRole('link', { name: 'Роли' }).focus();
  // Walking up scrolls the rail under the focus; the focused item keeps its tooltip.
  for (const name of ['Служители', 'Сигнали', 'Жители', 'Сгради', 'Финанси', 'Известия']) {
    await page.keyboard.press('Shift+Tab');
    const item = nav.getByRole('link', { name: new RegExp(`^${name}`) });
    await expect(item).toBeFocused();
    await expect(item.locator('.rail-tip')).toBeVisible();
    await expect(item.locator('.rail-tip')).toBeInViewport({ ratio: 1 });
  }
});

test('rail tooltips: gone when the pointer leaves or the rail scrolls under it', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 600 });
  await openSignedIn(page, ORG_ADMIN, '/');
  const nav = page.locator('aside').first().getByRole('navigation', { name: 'Основно меню' });
  const tasks = nav.getByRole('link', { name: 'Задачи' });
  await tasks.hover();
  await expect(tasks.locator('.rail-tip')).toBeVisible();
  await page.mouse.move(700, 300);
  await expect(tasks.locator('.rail-tip')).toBeHidden();

  await tasks.hover();
  await expect(tasks.locator('.rail-tip')).toBeVisible();
  await nav.evaluate((el) => el.scrollBy(0, 40));
  await expect(tasks.locator('.rail-tip')).toBeHidden();
});
