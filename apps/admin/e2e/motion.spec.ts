import { expect, test, type Page } from '@playwright/test';
import { ORG_ADMIN, openSignedIn } from './session';

/**
 * Motion (design.md → Controls, focus and motion): with «reduce motion» on,
 * everything is instant; an entry animation plays once and never replays
 * when the data refreshes.
 */

/**
 * Records an element's opacity for 25 frames from the moment it is added.
 * Installed before the page loads, so it catches what the first render draws.
 */
async function watchEntries(page: Page, selectors: Record<string, string>) {
  await page.addInitScript((wanted: Record<string, string>) => {
    const timelines: Record<string, number[]> = {};
    (window as unknown as { timelines: typeof timelines }).timelines = timelines;
    new MutationObserver(() => {
      for (const [name, selector] of Object.entries(wanted)) {
        if (timelines[name]) continue;
        const el = document.querySelector(selector);
        if (!el) continue;
        const frames: number[] = (timelines[name] = []);
        const tick = () => {
          frames.push(Number(getComputedStyle(el).opacity));
          if (frames.length < 25) requestAnimationFrame(tick);
        };
        tick();
      }
    }).observe(document, { childList: true, subtree: true });
  }, selectors);
}

/** The opacities an entry passed through, once all 25 frames are in. */
async function entry(page: Page, name: string): Promise<number[]> {
  let frames: number[] = [];
  await expect
    .poll(async () => {
      frames = await page.evaluate(
        (key) =>
          (window as unknown as { timelines: Record<string, number[] | undefined> }).timelines[
            key
          ] ?? [],
        name,
      );
      return frames.length;
    })
    .toBe(25);
  return frames;
}

/** An animation shows the steps between hidden and shown; an instant change does not. */
const between = (frames: number[]) => frames.filter((o) => o > 0 && o < 1);

const SELECTORS = {
  card: 'main article',
  panel: '[role="dialog"][aria-label^="Роли и обхват"]',
  question: '[role="alertdialog"]',
};

async function openPanelAndAsk(page: Page) {
  await openSignedIn(page, ORG_ADMIN, '/staff');
  await page.getByRole('button', { name: 'Роли и обхват — Елена Петрова' }).click();
  const panel = page.getByRole('dialog', { name: /^Роли и обхват/ });
  await panel.getByRole('radio', { name: /^Администратор/ }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('alertdialog')).toBeVisible();
}

test.use({ viewport: { width: 1728, height: 1117 } });

test.describe('with «reduce motion» on', () => {
  test.use({ reducedMotion: 'reduce' });

  test('cards, the side panel and the question appear at once, without movement', async ({
    page,
  }) => {
    await watchEntries(page, SELECTORS);
    await openSignedIn(page, ORG_ADMIN, '/roles');
    const card = await entry(page, 'card');
    await openPanelAndAsk(page);
    const panel = await entry(page, 'panel');
    const question = await entry(page, 'question');
    for (const frames of [card, panel, question]) {
      expect(between(frames)).toEqual([]);
      expect(frames.at(-1)).toBe(1);
    }
  });
});

test('without it, the same cards, panel and question still fade in', async ({ page }) => {
  await watchEntries(page, SELECTORS);
  await openSignedIn(page, ORG_ADMIN, '/roles');
  const card = await entry(page, 'card');
  await openPanelAndAsk(page);
  const panel = await entry(page, 'panel');
  const question = await entry(page, 'question');
  for (const frames of [card, panel, question]) {
    // One step between hidden and shown proves a fade; a slow runner may
    // draw only a few frames in its 350 ms (seen on CI: 2).
    expect(between(frames).length).toBeGreaterThan(0);
  }
});

test('refreshing the roles does not replay their entry', async ({ page }) => {
  await openSignedIn(page, ORG_ADMIN, '/roles');
  const card = page.locator('main article').first();
  await expect.poll(() => card.evaluate((el) => getComputedStyle(el).opacity)).toBe('1');

  const refetched = page.waitForResponse(
    (r) => r.url().endsWith('/v1/tenant/roles') && r.request().method() === 'GET',
  );
  // Coming back to the tab refetches stale queries (TanStack Query's default).
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    window.dispatchEvent(new Event('visibilitychange'));
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    window.dispatchEvent(new Event('visibilitychange'));
  });
  await refetched;
  const samples = await card.evaluate(
    (el) =>
      new Promise<string[]>((resolve) => {
        const out: string[] = [];
        const tick = () => {
          out.push(getComputedStyle(el).opacity);
          if (out.length < 20) requestAnimationFrame(tick);
          else resolve(out);
        };
        tick();
      }),
  );
  expect(new Set(samples)).toEqual(new Set(['1']));
});
