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

/** The responsive ladder (1074:9754), with the design's data, light. */
const WIDTHS = [
  { name: '1280', width: 1280, height: 800 },
  { name: '1180', width: 1180, height: 820 },
  { name: '820', width: 820, height: 1180 },
  { name: '402', width: 402, height: 874 },
] as const;

for (const { name, width, height } of WIDTHS) {
  test(`Табло at ${name}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await openSignedIn(page, ORG_ADMIN, '/?fixture=design');
    await expect(page.getByText('37 609', { exact: false })).toBeVisible();
    await settled(page);
    await page.screenshot({ ...shot(`tablo-${name}`), fullPage: true });

    // The menu at this width: the rail's tooltip, or the sidebar over the page, or the drawer.
    if (width >= 1280) {
      await page.locator('aside').getByRole('link', { name: 'Сгради' }).hover();
      await page.waitForTimeout(600);
    } else {
      await page.getByRole('button', { name: 'Отвори менюто' }).click();
      await page.waitForTimeout(600);
    }
    await page.screenshot(shot(`tablo-${name}-menu`));
  });
}

test('Табло at 1536 with the rail opened in place', async ({ page }) => {
  await page.setViewportSize({ width: 1536, height: 780 });
  await openSignedIn(page, ORG_ADMIN, '/?fixture=design');
  await expect(page.getByText('37 609', { exact: false })).toBeVisible();
  await settled(page);
  // Opened by a click on its empty space; the pointer stays on it, since
  // leaving closes it.
  await page.locator('aside').click({ position: { x: 36, y: 620 } });
  await page.waitForTimeout(300);
  await page.screenshot(shot('tablo-1536-rail-open'));
});

/** The account menu (2354:286 on desktop, the sheet 1763:28546 at 402). */
for (const { name, width, height, theme } of [
  { name: '1728-light', width: 1728, height: 1117, theme: 'light' },
  { name: '1728-dark', width: 1728, height: 1117, theme: 'dark' },
  { name: '402', width: 402, height: 874, theme: 'light' },
] as const) {
  test(`Меню на акаунта, ${name}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await openSignedIn(page, ORG_ADMIN, '/staff');
    await page.evaluate((t) => localStorage.setItem('inova.theme', t), theme);
    await page.reload();
    await settled(page);
    await page.getByRole('button', { name: /, акаунт$/ }).click();
    await expect(page.getByRole('dialog', { name: 'Акаунт' })).toBeVisible();
    await page.waitForTimeout(600); // the sheet's spring
    await page.screenshot(shot(`akaunt-${name}`));
  });
}

test('A section that is not built yet', async ({ page }) => {
  await openSignedIn(page, ORG_ADMIN, '/buildings');
  await expect(page.getByText('Разделът още не е наличен.')).toBeVisible();
  await settled(page);
  await page.screenshot(shot('razdel-predstoi'));
});

test('Роли и обхват', async ({ page }) => {
  await openSignedIn(page, ORG_ADMIN, '/staff');
  await page
    .getByRole('button', { name: /^Роли и обхват — / })
    .first()
    .click();
  await expect(page.getByText('Всички сгради в организацията')).toBeVisible();
  await settled(page);
  await page.screenshot(shot('roli-i-obhvat'));
});

for (const theme of ['light', 'dark'] as const) {
  test(`Роли, ${theme}`, async ({ page }) => {
    await page.setViewportSize({ width: 1728, height: 1117 });
    await openSignedIn(page, ORG_ADMIN, '/roles');
    await page.evaluate((t) => localStorage.setItem('inova.theme', t), theme);
    await page.reload();
    await expect(page.locator('main article')).toHaveCount(3);
    await settled(page);
    await page.screenshot({ ...shot(`roli-${theme}`), fullPage: true });
  });
}

test('Роли — the role editor', async ({ page }) => {
  await page.setViewportSize({ width: 1728, height: 1117 });
  await openSignedIn(page, ORG_ADMIN, '/roles');
  await page
    .locator('main article')
    .filter({ hasText: 'Домоуправител' })
    .getByRole('button', { name: 'Редактирай' })
    .click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await settled(page);
  await page.screenshot(shot('roli-redaktor'));
});
