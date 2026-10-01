import { expect, test, type Locator, type Page } from '@playwright/test';
import { ORG_ADMIN, openSignedIn } from './session';

/**
 * «Роли и обхват» against its frames, as the design acceptance of #54 measured
 * it (01.10): the floating panel (875:2088, 929:3895, 1489:29877), the type
 * scale inside it, the footer buttons (V2/Drawer · Footer) and the
 * «Да се запазят ли промените?» window (1925:2, 1925:86).
 */

const panel = (page: Page) => page.getByRole('dialog', { name: /^Роли и обхват — Елена/ });
const question = (page: Page) =>
  page.getByRole('alertdialog', { name: 'Да се запазят ли промените?' });

async function openPanel(page: Page): Promise<Locator> {
  await openSignedIn(page, ORG_ADMIN, '/staff');
  await page.getByRole('button', { name: 'Роли и обхват — Елена Петрова' }).click();
  await expect(panel(page)).toBeVisible();
  return panel(page);
}

/** Asks the unsaved-change question: pick another role, then press Esc. */
async function ask(page: Page, drawer: Locator): Promise<Locator> {
  await drawer.getByRole('radio', { name: /^Администратор/ }).click();
  await page.keyboard.press('Escape');
  await expect(question(page)).toBeVisible();
  return question(page);
}

async function settledBox(target: Locator) {
  // The panel and the window spring in; measure once they stand still.
  let last = '';
  await expect
    .poll(async () => {
      const box = JSON.stringify(await target.boundingBox());
      const same = box === last;
      last = box;
      return same;
    })
    .toBe(true);
  return (await target.boundingBox())!;
}

function type(el: Locator) {
  return el.evaluate((node) => {
    const style = getComputedStyle(node);
    return `${style.fontSize}/${style.lineHeight} ${style.fontWeight}`;
  });
}

test.describe('at 1728', () => {
  for (const height of [1117, 700]) {
    test(`the panel floats 12 from the right, 11 from the top, 21 from the bottom, 28 round, ${height} tall`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: 1728, height });
      const drawer = await openPanel(page);
      const box = await settledBox(drawer);
      expect(box).toEqual({ x: 1196, y: 11, width: 520, height: height - 32 });
      const radii = await drawer.evaluate((el) => {
        const s = getComputedStyle(el);
        return [
          s.borderTopLeftRadius,
          s.borderTopRightRadius,
          s.borderBottomRightRadius,
          s.borderBottomLeftRadius,
        ];
      });
      expect(radii).toEqual(['28px', '28px', '28px', '28px']);
    });
  }

  test('the panel text uses the drawn sizes and weights', async ({ page }) => {
    await page.setViewportSize({ width: 1728, height: 1117 });
    const drawer = await openPanel(page);
    await expect(drawer.getByText('Елена Петрова', { exact: true })).toBeVisible();
    // Name 16 Medium, the phone and every second line 13/16, «Поканен» 13 Regular.
    expect(await type(drawer.getByText('Елена Петрова', { exact: true }))).toBe('16px/24px 500');
    expect(await type(drawer.getByText('+359881000001'))).toBe('13px/16px 400');
    expect(await type(drawer.getByText('Поканен', { exact: true }))).toBe('13px/16px 400');
    expect(await type(drawer.getByText(/^· Член от/))).toBe('13px/16px 400');
    expect(await type(drawer.getByText(/^Акаунтът има една роля/))).toBe('13px/16px 400');
    expect(await type(drawer.getByText(/^Къде важат ролите/))).toBe('13px/16px 400');
    // Role and scope names 14 Semibold, their descriptions 13/16.
    const admin = drawer.getByRole('radio', { name: /^Администратор/ });
    expect(await type(admin.locator('span.block').first())).toBe('14px/20px 600');
    expect(await type(admin.locator('span.block').nth(1))).toBe('13px/16px 400');
    expect(await type(drawer.getByText('Всички сгради в организацията'))).toBe('14px/20px 600');
    expect(await type(drawer.getByText(/^Избор на отделни сгради/))).toBe('13px/16px 400');
    expect(await type(drawer.getByText('Няма промени'))).toBe('13px/16px 400');
  });

  test('«Отказ» and «Запази промените» are both 44 tall', async ({ page }) => {
    await page.setViewportSize({ width: 1728, height: 1117 });
    const drawer = await openPanel(page);
    const footer = drawer.locator('[data-drawer-footer]');
    for (const name of ['Отказ', 'Запази промените']) {
      const box = await footer.getByRole('button', { name }).boundingBox();
      expect(box!.height).toBe(44);
    }
  });

  test('the close buttons of the panel and of the question are 32, as drawn', async ({ page }) => {
    await page.setViewportSize({ width: 1728, height: 1117 });
    const drawer = await openPanel(page);
    // The layout size, not the box on screen: the window springs in from a
    // 0.98 scale, and a slow runner can measure it mid-way (31.36).
    const size = (el: Locator) =>
      el.evaluate((node: HTMLElement) => [node.offsetWidth, node.offsetHeight]);
    expect(await size(drawer.getByLabel('Затвори'))).toEqual([32, 32]);
    const window = await ask(page, drawer);
    expect(await size(window.getByLabel('Затвори'))).toEqual([32, 32]);
  });
});

test('at 402 the question is 322 wide, 40 from each side, its title on two lines', async ({
  page,
}) => {
  await page.setViewportSize({ width: 402, height: 874 });
  const drawer = await openPanel(page);
  const window = await ask(page, drawer);
  // Layout values: the window springs in from a 0.98 scale.
  expect(await window.evaluate((el: HTMLElement) => [el.offsetLeft, el.offsetWidth])).toEqual([
    40, 322,
  ]);
  const title = await window.getByRole('heading', { name: 'Да се запазят ли промените?' });
  const lines = await title.evaluate(
    (el: HTMLElement) => el.offsetHeight / parseFloat(getComputedStyle(el).lineHeight),
  );
  expect(Math.round(lines)).toBe(2);
});

test('the question stands as drawn: 176 tall at 1728, 240 at 402', async ({ page }) => {
  for (const [width, height, tall] of [
    [1728, 1117, 176],
    [402, 874, 240],
  ] as const) {
    await page.setViewportSize({ width, height });
    const drawer = await openPanel(page);
    const window = await ask(page, drawer);
    expect(await window.evaluate((el: HTMLElement) => el.offsetHeight)).toBe(tall);
  }
});
