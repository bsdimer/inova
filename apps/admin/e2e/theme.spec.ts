import { expect, test, type Page } from '@playwright/test';
import { ORG_ADMIN, openSignedIn } from './session';

/**
 * «Тема» (WHI-86): «Динамична» is light by day and dark in the evening by the
 * sun in the browser's time zone, never the device setting; it is the
 * default. The browser here lives in Sofia; its clock is set per test.
 * Sofia on 21 June: sunrise ≈ 05:50, sunset ≈ 21:10 (EEST, UTC+3).
 */
test.use({ timezoneId: 'Europe/Sofia', viewport: { width: 1440, height: 900 } });

const html = (page: Page) => page.locator('html');

/** Signs in at a Sofia time, with the stored choice as given (null = none). */
async function openAt(page: Page, sofiaTime: string, stored: string | null) {
  await page.clock.install({ time: new Date(`2026-06-21T${sofiaTime}:00+03:00`) });
  await openSignedIn(page, ORG_ADMIN, '/');
  await page.evaluate((value) => {
    if (value === null) localStorage.removeItem('inova.theme');
    else localStorage.setItem('inova.theme', value);
  }, stored);
  await page.reload();
}

const themeGroup = async (page: Page) => {
  await page.getByRole('button', { name: /, акаунт$/ }).click();
  return page.getByRole('dialog', { name: 'Акаунт' }).getByRole('radiogroup', { name: 'Тема' });
};

test('«Динамична» comes first, is the default, and each choice says what it does', async ({
  page,
}) => {
  await openAt(page, '12:00', null);
  const theme = await themeGroup(page);
  await expect(theme.getByRole('radio')).toHaveText([
    'Динамична — светла денем, тъмна вечер',
    'Светла — винаги светла',
    'Тъмна — винаги тъмна',
  ]);
  await expect(theme.getByRole('radio', { name: /^Динамична/ })).toBeChecked();
});

test('by day «Динамична» is light, even on a device that prefers dark', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await openAt(page, '12:00', null);
  await expect(html(page)).toHaveAttribute('data-theme', 'light');
});

test('in the evening «Динамична» is dark, even on a device that prefers light', async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await openAt(page, '23:00', null);
  await expect(html(page)).toHaveAttribute('data-theme', 'dark');
});

test('a choice stored as «follow the device» is now «Динамична»', async ({ page }) => {
  await openAt(page, '23:00', 'system');
  await expect(html(page)).toHaveAttribute('data-theme', 'dark');
  const theme = await themeGroup(page);
  await expect(theme.getByRole('radio', { name: /^Динамична/ })).toBeChecked();
});

test('left open across sunset, the page turns dark by itself', async ({ page }) => {
  await openAt(page, '21:00', 'dynamic');
  await expect(html(page)).toHaveAttribute('data-theme', 'light');
  await page.clock.runFor(20 * 60_000);
  await expect(html(page)).toHaveAttribute('data-theme', 'dark');
});

test('«Светла» stays light in the evening', async ({ page }) => {
  await openAt(page, '23:00', 'light');
  await expect(html(page)).toHaveAttribute('data-theme', 'light');
});

test('«Тъмна» stays dark by day', async ({ page }) => {
  await openAt(page, '12:00', 'dark');
  await expect(html(page)).toHaveAttribute('data-theme', 'dark');
});
