import { expect, test, type Page } from '@playwright/test';
import { ORG_ADMIN, PLATFORM_ADMIN, openSignedIn } from './session';

/**
 * Pictures of the changed screens for the pull request (AGENTS.md → Testing:
 * a changed admin screen carries a screenshot). They are kept in
 * `e2e-screens/` and CI attaches that folder to the run. Not compared with
 * anything yet: baselines come once the screens stop moving.
 */
const shot = (name: string) => ({ path: `e2e-screens/${name}.png` });

/** The glass blurs only once the photograph has decoded; wait for it. */
async function settled(page: Page) {
  await expect(page.locator('html')).toHaveAttribute('data-bg-ready', 'true');
  await page.waitForTimeout(400); // entry animations run for 350 ms
}

test('Вход — a rejected pair', async ({ page }) => {
  await page.goto('/login');
  await page.getByPlaceholder('name@company.bg').fill(ORG_ADMIN.email);
  await page.getByPlaceholder('••••••••••').fill('not-the-password');
  await page.getByRole('button', { name: 'Влез' }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await page.locator('body').click({ position: { x: 5, y: 5 } });
  await settled(page);
  await page.screenshot(shot('vhod-oshibka'));
});

test('Табло', async ({ page }) => {
  await openSignedIn(page, ORG_ADMIN, '/');
  await expect(page.getByRole('heading', { name: 'Баланс' })).toBeVisible();
  await settled(page);
  await page.screenshot(shot('tablo'));
});

test('Служители', async ({ page }) => {
  await openSignedIn(page, ORG_ADMIN, '/staff');
  await expect(page.locator('main table tbody tr')).toHaveCount(2);
  await settled(page);
  await page.screenshot(shot('sluzhiteli'));
});

test('Организации', async ({ page }) => {
  await openSignedIn(page, PLATFORM_ADMIN, '/tenants');
  await expect(page.locator('main table tbody tr')).toHaveCount(2);
  await settled(page);
  await page.screenshot(shot('organizacii'));
});

for (const theme of ['light', 'dark'] as const) {
  test(`Табло with the design's data, ${theme}`, async ({ page }) => {
    await openSignedIn(page, ORG_ADMIN, '/?fixture=design');
    await page.evaluate((t) => localStorage.setItem('inova.theme', t), theme);
    await page.reload();
    await expect(page.getByText('37 609', { exact: false })).toBeVisible();
    await settled(page);
    await page.screenshot(shot(`tablo-maket-${theme}`));
  });
}
