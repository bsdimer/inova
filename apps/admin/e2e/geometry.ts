import type { Locator, Page } from '@playwright/test';

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * The rects of several elements read in one frame. A page sits inside the
 * animated `motion.main`; separate `boundingBox()` calls can each catch a
 * different step of its entry (testing.md → measuring animated elements).
 */
export async function rectsInOneFrame<T extends Locator[]>(
  page: Page,
  targets: [...T],
): Promise<{ [K in keyof T]: Rect }> {
  for (const [i, target] of targets.entries()) {
    await target.evaluate((el, n) => el.setAttribute('data-rect', String(n)), i);
  }
  const rects = await page.evaluate(
    (count) =>
      Array.from({ length: count }, (_, i) => {
        const r = document.querySelector(`[data-rect="${i}"]`)!.getBoundingClientRect();
        return { x: r.x, y: r.y, width: r.width, height: r.height };
      }),
    targets.length,
  );
  // One rect per target, in order: the tuple type only restates that.
  return rects as { [K in keyof T]: Rect };
}
