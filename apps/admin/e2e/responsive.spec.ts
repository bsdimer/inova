import { expect, test, type Locator, type Page } from '@playwright/test';
import { ORG_ADMIN, openSignedIn } from './session';

/**
 * The responsive ladder, V2 · Адаптив (Табло) 1074:9754: where the menu
 * stands and how the dashboard is composed at each window the design draws.
 * The positions are the frames' own, in CSS pixels.
 */
const box = async (locator: Locator) => {
  const b = await locator.boundingBox();
  if (!b) throw new Error('not rendered');
  return {
    x: Math.round(b.x),
    y: Math.round(b.y),
    w: Math.round(b.width),
    h: Math.round(b.height),
  };
};

const card = (page: Page, heading: string) =>
  page.locator('main section').filter({ has: page.getByText(heading, { exact: true }) });

async function openAt(page: Page, width: number, height: number) {
  await page.setViewportSize({ width, height });
  await openSignedIn(page, ORG_ADMIN, '/?fixture=design');
  await expect(card(page, 'Баланс')).toContainText('37 609');
  await page.waitForTimeout(500); // the cards' entry animations run for 350 ms
}

/** An overlay slides in; measure it once it has come to rest. */
const settledBox = (locator: Locator) =>
  expect.poll(() => box(locator), { intervals: [100, 100, 200, 400] });

test('1280 × 800: the 72 rail and the 1136 page, 24 aside (815:1161)', async ({ page }) => {
  await openAt(page, 1280, 800);
  expect(await box(page.locator('aside'))).toMatchObject({ x: 24, y: 24, w: 72 });
  expect(await box(page.getByRole('banner'))).toMatchObject({ x: 120, w: 1136 });
  expect(await box(card(page, 'Баланс'))).toMatchObject({ x: 120, w: 696, h: 300 });
  expect(await box(card(page, 'Предстоящи'))).toMatchObject({ x: 836, w: 420, h: 687 });
  // The rail keeps the unread count as a dot and names the item on hover.
  const notices = page.locator('aside').getByRole('link', { name: 'Известия, 3 непрочетени' });
  await expect(notices).toBeVisible();
  await notices.hover();
  await expect(notices.locator('.rail-tip')).toHaveText('Известия · 3');
  await expect(notices.locator('.rail-tip')).toHaveCSS('opacity', '1');
});

test('1280: the brand opens the sidebar over the page; Esc and a tap outside close it', async ({
  page,
}) => {
  await openAt(page, 1280, 800);
  await page.getByRole('button', { name: 'Отвори менюто' }).click();
  const menu = page.getByRole('dialog', { name: 'Меню' });
  await settledBox(menu).toMatchObject({ x: 24, y: 24, w: 232, h: 752 });
  await expect(menu.getByRole('link', { name: /Известия/ })).toContainText('3');
  await page.keyboard.press('Escape');
  await expect(menu).toHaveCount(0);

  await page.getByRole('button', { name: 'Отвори менюто' }).click();
  await page.mouse.click(900, 500);
  await expect(menu).toHaveCount(0);
});

test('1536 × 780: the rail opens in place and pushes the page to 1104 (821:1456)', async ({
  page,
}) => {
  await openAt(page, 1536, 780);
  const rail = page.locator('aside');
  expect(await box(rail)).toMatchObject({ x: 152, w: 72, h: 732 });
  expect(await box(page.getByRole('banner'))).toMatchObject({ x: 248, w: 1136 });

  // A click on the rail's empty space pins it open.
  await rail.click({ position: { x: 36, y: 600 } });
  expect(await box(rail)).toMatchObject({ x: 152, w: 232 });
  expect(await box(page.getByRole('banner'))).toMatchObject({ x: 408, w: 1104 });
  expect(await box(card(page, 'Баланс'))).toMatchObject({ w: 664 });
  expect(await box(card(page, 'Предстоящи'))).toMatchObject({ w: 420 });
  expect(await box(card(page, 'Спешни сега'))).toMatchObject({ w: 356 });

  await page.getByRole('button', { name: 'Свий менюто' }).click();
  await page.mouse.move(900, 400);
  expect(await box(rail)).toMatchObject({ x: 152, w: 72 });
});

test('1180 × 820: Баланс across, three columns, Сгради across, three events (816:11473)', async ({
  page,
}) => {
  await openAt(page, 1180, 820);
  expect(await box(card(page, 'Баланс'))).toMatchObject({ x: 120, w: 1036, h: 300 });
  expect(await box(card(page, 'Качи документ'))).toMatchObject({ x: 120, w: 296, h: 621 });
  expect(await box(card(page, 'Спешни сега'))).toMatchObject({ x: 436, w: 364, h: 621 });
  expect(await box(card(page, 'Предстоящи'))).toMatchObject({ x: 820, w: 336, h: 621 });
  expect(await box(card(page, 'Преглед на сгради'))).toMatchObject({ x: 120, w: 1036, h: 214 });
  await expect(card(page, 'Предстоящи').getByText('Проверка на асансьор')).toBeHidden();
});

test('820 × 1180: the top bar with the menu button, two 376 columns (818:1379)', async ({
  page,
}) => {
  await openAt(page, 820, 1180);
  await expect(page.locator('aside')).toHaveCount(0);
  expect(await box(card(page, 'Баланс'))).toMatchObject({ x: 24, w: 772, h: 300 });
  expect(await box(card(page, 'Спешни сега'))).toMatchObject({ x: 24, w: 376, h: 601 });
  expect(await box(card(page, 'Предстоящи'))).toMatchObject({ x: 420, w: 376 });
  expect(await box(card(page, 'Преглед на сгради'))).toMatchObject({ x: 420, w: 376, h: 230 });

  // The drawer: × closes it and hands the focus back to the menu button.
  const button = page.getByRole('button', { name: 'Отвори менюто' });
  await button.click();
  const drawer = page.getByRole('dialog', { name: 'Меню' });
  await expect(drawer).toBeVisible();
  await expect(page.getByRole('button', { name: 'Затвори менюто' })).toBeFocused();
  await page.getByRole('button', { name: 'Затвори менюто' }).click();
  await expect(drawer).toHaveCount(0);
  await expect(button).toBeFocused();
});

test('402 × 874: one column in the phone order, the drawer closes on a swipe (818:11596)', async ({
  page,
}) => {
  await openAt(page, 402, 874);
  const search = page.locator('label', {
    has: page.getByRole('searchbox', { name: 'Общо търсене' }),
  });
  expect(await box(search)).toMatchObject({
    x: 16,
    y: 84,
    w: 370,
    h: 48,
  });
  const order = ['Баланс', 'Спешни сега', 'Предстоящи', 'Преглед на сгради', 'Качи документ'];
  const tops = await Promise.all(order.map(async (h) => (await box(card(page, h))).y));
  expect(tops).toEqual([...tops].sort((a, b) => a - b));
  expect(await box(card(page, 'Баланс'))).toMatchObject({ x: 16, y: 144, w: 370 });
  await expect(card(page, 'Баланс').getByRole('button', { name: 'Виж детайли' })).toHaveCSS(
    'width',
    '336px',
  );

  await page.getByRole('button', { name: 'Отвори менюто' }).click();
  const drawer = page.getByRole('dialog', { name: 'Меню' });
  await expect(drawer).toBeVisible();
  await settledBox(drawer).toMatchObject({ x: 12, y: 12, w: 300, h: 850 });
  // On the empty space under the items: a link would start a drag of its own.
  await page.mouse.move(250, 700);
  await page.mouse.down();
  await page.mouse.move(150, 700, { steps: 6 });
  await page.mouse.up();
  await expect(drawer).toHaveCount(0);
});

test('1920 × 980: a short window closes the gaps and lists three events (815:1546)', async ({
  page,
}) => {
  await openAt(page, 1920, 980);
  expect(await box(page.locator('aside'))).toMatchObject({ x: 264, y: 16, w: 232, h: 948 });
  expect(await box(card(page, 'Спешни сега'))).toMatchObject({ h: 560 });
  expect(await box(card(page, 'Предстоящи'))).toMatchObject({ h: 646 });
  await expect(card(page, 'Предстоящи').getByText('Проверка на асансьор')).toBeHidden();
  expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBe(980);
});

test('2560 × 1340: the 1728 composition ×1.25, without a scroll (824:1609)', async ({ page }) => {
  await openAt(page, 2560, 1340);
  expect(await box(page.locator('aside'))).toMatchObject({ x: 410, w: 290, h: 1236 });
  expect(await box(page.getByRole('banner'))).toMatchObject({ x: 730, w: 1420 });
  expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBe(1340);
});
