import { expect, test, type Page } from '@playwright/test';
import { ORG_ADMIN, openSignedIn } from './session';

/**
 * The phone's head (WHI-37 c982891f, layer «Scrim · шапка», e.g. 952:5831):
 * a shade over the photo under the title, light theme on a phone only; and
 * the general search line only on Табло (818:11596, Helga 02.10).
 */
const shade = (page: Page) => page.locator('.app-head-scrim');

async function open(page: Page, path: string, theme: 'light' | 'dark', width = 402, height = 874) {
  await page.setViewportSize({ width, height });
  await openSignedIn(page, ORG_ADMIN, path);
  await page.evaluate((t) => localStorage.setItem('inova.theme', t), theme);
  await page.reload();
  await expect(page.locator('main h1, main h2').first()).toBeVisible();
}

for (const path of ['/buildings', '/staff']) {
  test(`402, light, ${path}: the shade sits at the top, 300 high, under the content`, async ({
    page,
  }) => {
    await open(page, path, 'light');
    await expect(shade(page)).toBeVisible();
    const box = await shade(page).evaluate((el) => {
      const r = el.getBoundingClientRect();
      return {
        top: r.top,
        height: r.height,
        width: r.width,
        z: getComputedStyle(el.parentElement!).zIndex,
      };
    });
    expect(box.top).toBe(0);
    expect(box.height).toBe(300);
    expect(box.width).toBe(402);
    // It belongs to the fixed background layer, so the page scrolls over it.
    expect(box.z).toBe('0');
  });
}

test('402, dark: no shade', async ({ page }) => {
  await open(page, '/buildings', 'dark');
  await expect(shade(page)).toHaveCount(0);
});

test('1728, light: no shade on the computer', async ({ page }) => {
  await open(page, '/buildings', 'light', 1728, 1117);
  await expect(shade(page)).toBeHidden();
});

test('402, light: the sign-in page has no shade', async ({ page }) => {
  await page.setViewportSize({ width: 402, height: 874 });
  await page.goto('/login');
  await expect(page.getByRole('button', { name: 'Влез' })).toBeVisible();
  await expect(shade(page)).toHaveCount(0);
});

test('402: the general search line is on Табло only', async ({ page }) => {
  const search = page.getByRole('searchbox', { name: 'Общо търсене' });
  await open(page, '/', 'light');
  await expect(search).toBeVisible();
  for (const path of ['/buildings', '/staff', '/roles']) {
    await page.goto(path);
    await expect(page.locator('main h1').first()).toBeVisible();
    await expect(search).toBeHidden();
  }
});
