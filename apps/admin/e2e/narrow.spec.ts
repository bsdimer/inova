import { expect, test, type Page } from '@playwright/test';
import { ORG_ADMIN, PLATFORM_ADMIN, openSignedIn } from './session';

/**
 * Табло and the shell on narrow screens, as the stakeholder met them on a
 * phone (WHI-80): cards end with their content, the platform-visit banner
 * keeps readable lines.
 */
const card = (page: Page, heading: string) =>
  page.locator('main section').filter({ has: page.getByText(heading, { exact: true }) });

/** Space between the card's last child and its bottom edge, less its padding. */
const emptyBelow = (page: Page, heading: string) =>
  card(page, heading).evaluate((el) => {
    const pad = parseFloat(getComputedStyle(el).paddingBottom);
    const last = el.lastElementChild!.getBoundingClientRect().bottom;
    return Math.round(el.getBoundingClientRect().bottom - pad - last);
  });

test('375: Сигнали and Календар end with their content', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await openSignedIn(page, ORG_ADMIN, '/');
  for (const heading of ['Спешни сега', 'Предстоящи']) {
    await expect(card(page, heading)).toBeVisible();
    expect(await emptyBelow(page, heading)).toBeLessThanOrEqual(2);
  }
});

test('820: the two-column composition keeps the drawn heights', async ({ page }) => {
  await page.setViewportSize({ width: 820, height: 1180 });
  await openSignedIn(page, ORG_ADMIN, '/');
  const signals = (await card(page, 'Спешни сега').boundingBox())!;
  expect(signals.height).toBeGreaterThanOrEqual(601);
});

test('375: the platform-visit banner keeps its title and puts the way back below', async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await openSignedIn(page, PLATFORM_ADMIN, '/tenants');
  await page.getByRole('button', { name: /Влез/ }).first().click();
  const back = page.getByRole('button', { name: 'Върни се в платформата' });
  await expect(back).toBeVisible();
  const title = page.getByText(/^Платформа → /);
  expect(await title.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
  const text = page.getByText(/^Влязохте в организацията/);
  const [t, b] = [(await text.boundingBox())!, (await back.boundingBox())!];
  expect(b.y).toBeGreaterThanOrEqual(t.y + t.height);
  // Normal lines: the text runs about as wide as the banner, not one word per line.
  expect(t.width).toBeGreaterThan(250);
});

// The Сигнали tags are filters; a filter's name is never cut. Two columns
// where they fit (1180, 402), one column on a narrower card (1024, 375).
for (const [width, columns] of [
  [375, 1],
  [402, 2],
  [1024, 1],
  [1280, 2],
] as const) {
  test(`${width}: the Сигнали tags keep their names, ${columns} per row`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await openSignedIn(page, ORG_ADMIN, '/');
    const tags = card(page, 'Спешни сега').locator('.glass-blur');
    await expect(tags).toHaveCount(4);
    const boxes = await tags.evaluateAll((all) =>
      all.map((tag) => {
        const label = tag.querySelector('span.text-body-14')!;
        return {
          cut: label.scrollWidth > label.clientWidth,
          top: Math.round(tag.getBoundingClientRect().top),
        };
      }),
    );
    expect(boxes.filter((b) => b.cut)).toEqual([]);
    expect(new Set(boxes.map((b) => b.top)).size).toBe(4 / columns);
  });
}
