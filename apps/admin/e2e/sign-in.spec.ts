import { expect, test, type Page } from '@playwright/test';
import { ORG_ADMIN } from './session';

/**
 * Вход (Figma 911:3793 / 920:3885) — the checks agreed with the design
 * session on 24.09: errors on submit, a rejected pair marks both fields and
 * speaks once under the e-mail, notices about the server leave the fields
 * alone.
 */
const email = (page: Page) => page.getByPlaceholder('name@company.bg');
const password = (page: Page) => page.getByPlaceholder('••••••••••');
// By the field's own caption: the e-mail's error text also says «паролата».
const pill = (page: Page, label: string) =>
  page
    .locator('label')
    .filter({ has: page.getByText(label, { exact: true }) })
    .locator('.glass-field');
const submit = (page: Page) => page.getByRole('button', { name: 'Влез' });

test.beforeEach(async ({ page }) => {
  await page.goto('/login');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test('empty fields are named under each field and focus goes to the first', async ({ page }) => {
  await submit(page).click();

  await expect(page.getByRole('alert')).toHaveText([
    'Въведете имейл адреса си.',
    'Въведете паролата си.',
  ]);
  await expect(pill(page, 'Имейл')).toHaveAttribute('data-invalid', 'true');
  await expect(pill(page, 'Парола')).toHaveAttribute('data-invalid', 'true');
  await expect(email(page)).toBeFocused();
});

test('a field error goes as soon as the field is right', async ({ page }) => {
  await email(page).fill('maria');
  await submit(page).click();
  await expect(page.getByRole('alert').first()).toHaveText(
    'Въведете валиден имейл адрес, например name@company.bg.',
  );

  await email(page).fill('maria@inova.bg');
  await expect(pill(page, 'Имейл')).not.toHaveAttribute('data-invalid', 'true');
  await expect(page.getByRole('alert')).toHaveText(['Въведете паролата си.']);
});

test('a rejected pair marks both fields, speaks once, and clears on any edit', async ({ page }) => {
  await email(page).fill(ORG_ADMIN.email);
  await password(page).fill('not-the-password');
  await submit(page).click();

  await expect(page.getByRole('alert')).toHaveText(['Имейлът или паролата не съвпадат.']);
  await expect(pill(page, 'Имейл')).toHaveAttribute('data-invalid', 'true');
  await expect(pill(page, 'Парола')).toHaveAttribute('data-invalid', 'true');

  await password(page).fill('not-the-password!');
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(pill(page, 'Парола')).not.toHaveAttribute('data-invalid', 'true');
});

test('too many attempts is a notice, not a field error', async ({ page }) => {
  await page.route('**/auth/login', (route) =>
    route.fulfill({ status: 429, contentType: 'application/json', body: '{}' }),
  );
  await email(page).fill(ORG_ADMIN.email);
  await password(page).fill(ORG_ADMIN.password);
  await submit(page).click();

  await expect(page.getByRole('alert')).toHaveText([
    'Твърде много опити. Опитайте отново след минута.',
  ]);
  await expect(pill(page, 'Имейл')).not.toHaveAttribute('data-invalid', 'true');
  await expect(pill(page, 'Парола')).not.toHaveAttribute('data-invalid', 'true');
  await expect(submit(page)).toBeEnabled();
});

test('no connection is a notice, not a field error', async ({ page }) => {
  await page.route('**/auth/login', (route) => route.abort('connectionrefused'));
  await email(page).fill(ORG_ADMIN.email);
  await password(page).fill(ORG_ADMIN.password);
  await submit(page).click();

  await expect(page.getByRole('alert')).toHaveText(['Няма връзка със сървъра. Опитайте отново.']);
  await expect(pill(page, 'Имейл')).not.toHaveAttribute('data-invalid', 'true');
});

test('a field shows its focus once, on the pill', async ({ page }) => {
  // Regression: the input also drew the global focus ring inside the pill's.
  await email(page).focus();
  await expect(email(page)).toHaveCSS('box-shadow', 'none');
  await expect(pill(page, 'Имейл')).not.toHaveCSS('box-shadow', 'none');
});

test('signing in opens Табло with the menu in its settled order', async ({ page }) => {
  await email(page).fill(ORG_ADMIN.email);
  await password(page).fill(ORG_ADMIN.password);
  await submit(page).click();

  await expect(page).toHaveURL('/');
  await expect(page.getByRole('heading', { name: 'Баланс' })).toBeVisible();
  // WHI-24: Финанси fourth, «Нередности» renamed «Сигнали».
  await expect(page.locator('aside nav a')).toHaveText([
    'Табло',
    'Задачи',
    'Известия',
    'Финанси',
    'Сгради',
    'Жители',
    'Сигнали',
    'Служители',
    'Роли',
  ]);
});
