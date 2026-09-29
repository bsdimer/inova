import { expect, test, type Page } from '@playwright/test';
import { ORG_ADMIN, openSignedIn } from './session';

/**
 * Табло (859:1073). Without its data every card shows «—» and no invented
 * number (docs/features/admin-dashboard.md); the «design data» preview fills
 * the cards with the frame's own numbers so the layout can be checked.
 */
const card = (page: Page, heading: string) =>
  page.locator('main section').filter({ has: page.getByText(heading, { exact: true }) });

test('without data every card shows dashes and no invented number', async ({ page }) => {
  await openSignedIn(page, ORG_ADMIN, '/?fixture=off');

  const balance = card(page, 'Баланс');
  await expect(balance).toContainText('—');
  await expect(balance).not.toContainText('%');
  await expect(balance).not.toContainText('€');
  await expect(card(page, 'Спешни сега')).toContainText(
    'Спешните сигнали на жителите ще се появяват тук.',
  );
  await expect(card(page, 'Предстоящи')).toContainText('Общи събрания, отчети и задачи');
  await expect(card(page, 'Преглед на сгради')).not.toContainText('платили');
  await expect(page.getByText('Данни от макета')).toHaveCount(0);
  await expect(page.locator('aside nav a', { hasText: 'Известия' })).toHaveText('Известия');
});

test('the design data fills every card with the frame’s numbers', async ({ page }) => {
  await openSignedIn(page, ORG_ADMIN, '/?fixture=design');
  await expect(page.getByText('Данни от макета 859:1073 — не са реални')).toBeVisible();

  const balance = card(page, 'Баланс');
  await expect(balance).toContainText('Портфолио · 3 сгради · септември');
  await expect(balance).toContainText('37 609,61 €');
  await expect(balance).toContainText('71%');
  await expect(balance).toContainText('26 709,89 €');
  await expect(balance).toContainText('10 899,72 €');

  const signals = card(page, 'Спешни сега');
  await expect(signals).toContainText('24');
  await expect(signals).toContainText('отворени сигнала в 3 сгради');
  await expect(signals.getByText('Теч в мазето')).toBeVisible();
  await expect(signals).toContainText('2 ч.');
  await expect(signals).toContainText('1 д.');

  const calendar = card(page, 'Предстоящи');
  await expect(calendar).toContainText('Септември 2026');
  await expect(calendar.locator('[aria-current=date]')).toHaveText('17');
  await expect(calendar.getByLabel('има задачи')).toHaveCount(3);
  await expect(calendar.getByText('Проверка на асансьор')).toBeVisible();

  const buildings = card(page, 'Преглед на сгради');
  await expect(buildings).toContainText('3 сгради · 150 апартамента');
  await expect(buildings).toContainText('платили 25/60');
  await expect(page.locator('aside nav a', { hasText: 'Известия' })).toContainText('3');
});

test('the glass blurs in the built portal, in Chrome too', async ({ page }) => {
  // Regression: the minifier kept only the -webkit- declaration, which Chrome
  // ignores, so the deployed cards had no blur behind them.
  await openSignedIn(page, ORG_ADMIN, '/');
  await expect(page.locator('html')).toHaveAttribute('data-bg-ready', 'true');
  await expect(card(page, 'Баланс')).toHaveCSS('backdrop-filter', 'blur(14px)');
  await expect(page.getByRole('searchbox', { name: 'Общо търсене' }).locator('..')).toHaveCSS(
    'backdrop-filter',
    'blur(8px)',
  );
});

test('no plan code reaches the words on the page or its tooltips', async ({ page }) => {
  // design.md → Words: plan codes (M6, B9, D16) never appear in UI sentences.
  await openSignedIn(page, ORG_ADMIN, '/?fixture=off');
  await expect(card(page, 'Баланс')).toBeVisible();
  const words = await page
    .locator('main')
    .evaluate((main) => [
      (main as HTMLElement).innerText,
      ...[...main.querySelectorAll('[title]')].map((el) => el.getAttribute('title') ?? ''),
    ]);
  for (const text of words) expect(text).not.toMatch(/\b(M\d+b?|P1|[BD]\d+)\b/);
});

test('the Баланс bubbles darken under their text and the labels are text/primary', async ({
  page,
}) => {
  // WHI-83: V2/Balance · Bubbles (849:252) — a Ø112 shade in each bubble,
  // centred on its content, so the labels keep AA over the bright photo.
  await openSignedIn(page, ORG_ADMIN, '/?fixture=design');
  const balance = card(page, 'Баланс');
  for (const label of ['Платили', 'Задължения']) {
    await expect(balance.getByText(label, { exact: true })).toHaveCSS(
      'color',
      'rgb(255, 255, 255)',
    );
  }
  const shades = await balance
    .locator('svg circle[data-shade]')
    .evaluateAll((circles) =>
      circles.map((c) => [c.getAttribute('cx'), c.getAttribute('cy'), c.getAttribute('r')]),
    );
  expect(shades).toEqual([
    ['65', '81', '56'],
    ['212', '81', '56'],
    ['359.5', '81', '56'],
  ]);
});
