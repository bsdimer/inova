import { expect, test, type Locator, type Page, type Route } from '@playwright/test';
import { ORG_ADMIN, openSignedIn } from './session';

/**
 * Служители (872:1710) on the seed: WhiteNova has Мария Иванова (active
 * administrator) and Елена Петрова (invited, the seed's «Жител» role).
 */
const rows = (page: Page) => page.locator('main table tbody tr');

test('while the list loads it shows skeleton rows, never «no staff yet»', async ({ page }) => {
  // Regression: the empty state was decided before loading and flashed on
  // every visit. Hold the list back and look at what stands in for it.
  let release: () => void = () => undefined;
  const held = new Promise<void>((resolve) => (release = resolve));
  await page.route('**/v1/tenant/staff', async (route) => {
    await held;
    await route.continue();
  });
  await openSignedIn(page, ORG_ADMIN, '/staff');

  await expect(page.locator('main table tbody tr .animate-pulse').first()).toBeVisible();
  await expect(page.getByText('Още няма служители')).toHaveCount(0);

  release();
  await expect(rows(page)).toHaveCount(2);
});

test('a role that only reads sees the read-only strip, as drawn', async ({ page }) => {
  await page.route('**/v1/tenant', async (route) => {
    const response = await route.fetch();
    const context = await response.json();
    await route.fulfill({
      response,
      json: { ...context, permissions: ['tenant.read', 'staff.read', 'roles.read'] },
    });
  });
  await openSignedIn(page, ORG_ADMIN, '/staff');
  // The strip is a row of the table too, above the two members.
  await expect(rows(page)).toHaveCount(3);
  await expect(page.locator('main table').getByRole('status')).toHaveText(
    'Само за четене — ролята ви може да вижда акаунти, но не и да кани, спира или сменя роли.',
  );
  await expect(page.getByRole('button', { name: /^Покани/ })).toHaveCount(0);
});

test.describe('with the list loaded', () => {
  test.beforeEach(async ({ page }) => {
    await openSignedIn(page, ORG_ADMIN, '/staff');
    await expect(rows(page)).toHaveCount(2);
  });

  test('every column of the table is shown at the drawn width', async ({ page }) => {
    // Regression: the folding columns' <col> classes were never generated, so
    // four columns were hidden at every width.
    const headers = page.locator('main table thead th');
    await expect(headers).toHaveText([
      'Служител',
      'Контакт',
      'Статус',
      'Роли',
      'Обхват',
      'Покана',
      'От',
      '',
    ]);
    const widths = await headers.evaluateAll((ths) =>
      ths.map((th) => Math.round(th.getBoundingClientRect().width)),
    );
    expect(widths).toEqual([224, 152, 112, 180, 100, 196, 80, 52]);
  });

  test('the status facet filters, names itself in a chip, and clears', async ({ page }) => {
    await expect(rows(page)).toHaveCount(2);

    await page.getByRole('button', { name: 'Статус' }).click();
    await page.getByRole('option', { name: 'Поканен' }).click();
    await page.keyboard.press('Escape');

    await expect(rows(page)).toHaveCount(1);
    await expect(rows(page).first()).toContainText('Елена Петрова');
    await expect(page.getByText('1 от 2 служители')).toBeVisible();
    await expect(page.getByText('Статус: Поканен')).toBeVisible();

    await page.getByRole('button', { name: 'Изчисти' }).click();
    await expect(rows(page)).toHaveCount(2);
    await expect(page.getByText('Статус: Поканен')).toHaveCount(0);
  });

  test('filters that match nobody are named in a sentence, as drawn', async ({ page }) => {
    await page.getByRole('button', { name: 'Статус' }).click();
    await page.getByRole('option', { name: 'Спрян' }).click();
    await page.keyboard.press('Escape');

    await expect(
      page.getByRole('heading', { name: 'Няма служители по тези филтри' }),
    ).toBeVisible();
    await expect(page.locator('main table')).toContainText(
      'Филтриране по статус е „Спрян“. Разширете опциите във филтрите или ги изчистете, за да видите другите 2 акаунта.',
    );
  });

  test('search narrows the list by name', async ({ page }) => {
    await page.getByPlaceholder('Търси по име, имейл или телефон').fill('Мария');
    await expect(rows(page)).toHaveCount(1);
    await expect(rows(page).first()).toContainText('Мария Иванова');
  });

  test('a cut name has the full text in a tooltip', async ({ page }) => {
    await expect(page.locator('main table').getByText('Мария Иванова')).toHaveAttribute(
      'title',
      'Мария Иванова',
    );
  });

  test('«Изчисти филтрите» keeps the chosen sort', async ({ page }) => {
    await page.getByRole('button', { name: 'Първо нуждаещите се от внимание' }).click();
    await page.getByRole('option', { name: 'Име А–Я' }).click();
    await page.getByPlaceholder('Търси по име, имейл или телефон').fill('никой');
    await page.getByRole('button', { name: 'Изчисти филтрите' }).click();
    await expect(rows(page)).toHaveCount(2);
    await expect(page.getByRole('button', { name: 'Име А–Я' })).toBeVisible();
  });

  test('the sort preset reorders the list', async ({ page }) => {
    await page.getByRole('button', { name: 'Първо нуждаещите се от внимание' }).click();
    await page.getByRole('option', { name: 'Име А–Я' }).click();

    await expect(rows(page).nth(0)).toContainText('Елена Петрова');
    await expect(rows(page).nth(1)).toContainText('Мария Иванова');
  });

  test('«Покани служител» is a dialog with a name, the focus inside and Esc to leave', async ({
    page,
  }) => {
    const open = page.getByRole('button', { name: 'Покани служител' });
    await open.click();
    const dialog = page.getByRole('dialog', { name: 'Покани служител' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByPlaceholder('Никол Петрова')).toBeFocused();

    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(open).toBeFocused();
  });
});

/**
 * The «Роли и обхват» panel (1607:36771, five states approved 25.09) on
 * Елена Петрова, the seed's invited «Жител». The save itself is answered
 * here, in the browser: the route's own rules are covered by the core-api
 * integration tests, and the seed is not to be changed by a flow.
 */
test.describe('the «Роли и обхват» panel', () => {
  const panel = (page: Page) => page.getByRole('dialog', { name: /^Роли и обхват — Елена/ });
  const radio = (drawer: Locator, name: string) =>
    drawer.getByRole('radio', { name: new RegExp(`^${name}`) });

  async function openPanel(page: Page): Promise<Locator> {
    await openSignedIn(page, ORG_ADMIN, '/staff');
    await page.getByRole('button', { name: 'Роли и обхват — Елена Петрова' }).click();
    await expect(panel(page)).toBeVisible();
    return panel(page);
  }

  /** Answers the PATCH itself; `calls` counts how many times it was asked. */
  async function answerSave(
    page: Page,
    answer: (route: Route, calls: number) => Promise<void>,
  ): Promise<{ calls: number }> {
    const count = { calls: 0 };
    await page.route('**/v1/tenant/staff/*', async (route) => {
      if (route.request().method() !== 'PATCH') return route.fallback();
      count.calls += 1;
      await answer(route, count.calls);
    });
    return count;
  }

  test('names the words of the approved frame', async ({ page }) => {
    const drawer = await openPanel(page);
    await expect(drawer.getByRole('button', { name: 'Изтрий достъпа' })).toBeVisible();
    await expect(
      drawer.getByText('Спирането е обратимо. Изтриването прекратява достъпа завинаги.'),
    ).toBeVisible();
    await expect(drawer.getByText('Няма промени')).toBeVisible();
    await expect(drawer.getByRole('button', { name: 'Запази промените' })).toBeDisabled();
    await expect(radio(drawer, 'Жител')).toHaveAttribute('aria-checked', 'true');
  });

  test('choosing another role says which rights come and go, before anything is saved', async ({
    page,
  }) => {
    const drawer = await openPanel(page);
    await expect(drawer.getByText('Какво се променя при запис')).toHaveCount(0);

    // Жител holds only «Преглед на организацията»; Домоуправител adds eight
    // rights, listed by area (Имоти, Жители, Служители, Настройки, Одит) and drops none.
    await radio(drawer, 'Домоуправител').click();

    await expect(drawer.getByText('Какво се променя при запис')).toBeVisible();
    await expect(drawer.getByRole('list', { name: 'Получава' }).getByRole('listitem')).toHaveText([
      'Преглед на сгради и имоти',
      'Управление на сгради и имоти',
      'Заявка за премахване на имот или жител',
      'Преглед на жителите',
      'Преглед на служителите',
      'Покани и управление на служители',
      'Преглед на ролите',
      'Одитен дневник',
    ]);
    await expect(drawer.getByRole('list', { name: 'Губи' }).getByRole('listitem')).toHaveText([
      'нищо',
    ]);
    await expect(drawer.getByText('1 незапазена промяна')).toBeVisible();
    await expect(drawer.getByRole('button', { name: 'Запази промените' })).toBeEnabled();

    // Back to the role the account has: nothing changes, nothing to save.
    await radio(drawer, 'Жител').click();
    await expect(drawer.getByText('Какво се променя при запис')).toHaveCount(0);
    await expect(drawer.getByText('Няма промени')).toBeVisible();
  });

  test('while the save runs the form is locked; once saved it says so and offers to close', async ({
    page,
  }) => {
    let release: () => void = () => undefined;
    const held = new Promise<void>((resolve) => (release = resolve));
    await answerSave(page, async (route) => {
      await held;
      await route.fulfill({ status: 200, json: { ok: true } });
    });
    const drawer = await openPanel(page);
    await radio(drawer, 'Администратор').click();
    await drawer.getByRole('button', { name: 'Запази промените' }).click();

    await expect(drawer.getByText('Прилагане на 1 промяна…')).toBeVisible();
    await expect(drawer.getByRole('button', { name: 'Запазване…' })).toBeDisabled();
    await expect(radio(drawer, 'Домоуправител')).toBeDisabled();
    await expect(drawer.getByRole('button', { name: 'Отказ' })).toBeDisabled();
    // The × is the only control left; Tab stays on it instead of leaving the panel.
    await drawer.getByLabel('Затвори').focus();
    await page.keyboard.press('Tab');
    await expect(drawer.getByLabel('Затвори')).toBeFocused();

    release();
    await expect(
      drawer.getByText('Запазено. Елена Петрова е Администратор във всички сгради.'),
    ).toBeVisible();
    await expect(drawer.getByText('Няма промени')).toBeVisible();
    await expect(drawer.getByText('Какво се променя при запис')).toHaveCount(0);
    // The footer's «Затвори», not the × (which has the same name).
    await drawer.getByText('Затвори', { exact: true }).click();
    await expect(panel(page)).toHaveCount(0);
  });

  test('a failed save keeps the choice, says why, and «Опитай отново» sends it again', async ({
    page,
  }) => {
    const saves = await answerSave(page, (route, calls) =>
      calls === 1
        ? route.fulfill({
            status: 400,
            json: { message: 'At least one active administrator is required' },
          })
        : route.fulfill({ status: 200, json: { ok: true } }),
    );
    const drawer = await openPanel(page);
    await radio(drawer, 'Администратор').click();
    await drawer.getByRole('button', { name: 'Запази промените' }).click();

    await expect(
      drawer.getByText('Не се запази — At least one active administrator is required'),
    ).toBeVisible();
    await expect(radio(drawer, 'Администратор')).toHaveAttribute('aria-checked', 'true');
    await expect(radio(drawer, 'Администратор')).toBeEnabled();

    await drawer.getByRole('button', { name: 'Опитай отново' }).click();
    await expect(drawer.getByText(/^Запазено\./)).toBeVisible();
    expect(saves.calls).toBe(2);
  });

  test('the buttons sit at the end of the content: at the bottom of a tall panel, below the fold of a short one', async ({
    page,
  }) => {
    const drawer = await openPanel(page);
    const save = drawer.getByRole('button', { name: 'Запази промените' });
    // 1117 high: the form is shorter than the panel, the buttons rest at its bottom.
    const [footer, aside] = await Promise.all([
      save.evaluate((el) => el.closest('[data-drawer-footer]')!.getBoundingClientRect().bottom),
      drawer.evaluate((el) => el.getBoundingClientRect().bottom),
    ]);
    expect(Math.abs(footer - aside)).toBeLessThanOrEqual(1);

    // 700 high, with the change block unfolded: the buttons wait below the
    // fold, the fade says so, the body scrolls to them.
    await radio(drawer, 'Домоуправител').click();
    await page.setViewportSize({ width: 1728, height: 700 });
    await expect(save).not.toBeInViewport();
    const body = drawer.locator('[data-drawer-body]');
    await expect(body).toHaveCSS('mask-image', /gradient/);
    await save.scrollIntoViewIfNeeded();
    await expect(save).toBeInViewport();
    await expect(body).toHaveCSS('mask-image', 'none');
  });

  test('closing with an unsaved change asks «Да се запазят ли промените?»; without one it just closes', async ({
    page,
  }) => {
    const saves = await answerSave(page, (route) => route.fulfill({ status: 200, json: {} }));
    const drawer = await openPanel(page);
    await page.keyboard.press('Escape');
    await expect(panel(page)).toHaveCount(0);

    await page.getByRole('button', { name: 'Роли и обхват — Елена Петрова' }).click();
    await radio(drawer, 'Администратор').click();
    await page.keyboard.press('Escape');

    const question = page.getByRole('alertdialog', { name: 'Да се запазят ли промените?' });
    await expect(question).toBeVisible();
    await expect(question.getByText('Промените още не са запазени.')).toBeVisible();
    await expect(question.getByRole('button', { name: 'Запази' })).toBeFocused();

    // Esc, the question's × and its scrim return to the form with the edit intact.
    await page.keyboard.press('Escape');
    await expect(question).toHaveCount(0);
    await expect(radio(drawer, 'Администратор')).toHaveAttribute('aria-checked', 'true');
    await drawer.getByLabel('Затвори').click();
    await question.getByLabel('Затвори').click();
    await expect(question).toHaveCount(0);
    await expect(drawer).toBeVisible();

    await drawer.getByRole('button', { name: 'Отказ' }).click();
    await question.getByRole('button', { name: 'Не запазвай' }).click();
    await expect(question).toHaveCount(0);
    await expect(panel(page)).toHaveCount(0);
    expect(saves.calls).toBe(0);
    // Both closed at once: the page under them scrolls and hears the keyboard again.
    await expect
      .poll(() =>
        page.evaluate(() => [
          document.documentElement.style.overflow,
          document.getElementById('root')?.hasAttribute('inert') ?? null,
        ]),
      )
      .toEqual(['', false]);
    await expect(page.getByRole('button', { name: 'Роли и обхват — Елена Петрова' })).toBeFocused();
  });

  test('«Запази» in the question saves and closes; a failed save closes the question and the panel says why', async ({
    page,
  }) => {
    const saves = await answerSave(page, (route, calls) =>
      calls === 1
        ? route.fulfill({ status: 400, json: { message: 'Membership not found' } })
        : route.fulfill({ status: 200, json: {} }),
    );
    const drawer = await openPanel(page);
    await radio(drawer, 'Администратор').click();
    await drawer.getByLabel('Затвори').click();
    const question = page.getByRole('alertdialog', { name: 'Да се запазят ли промените?' });
    await question.getByRole('button', { name: 'Запази' }).click();

    await expect(question).toHaveCount(0);
    await expect(drawer.getByText('Не се запази — Membership not found')).toBeVisible();
    await expect(radio(drawer, 'Администратор')).toHaveAttribute('aria-checked', 'true');

    await drawer.getByLabel('Затвори').click();
    await question.getByRole('button', { name: 'Запази' }).click();
    await expect(panel(page)).toHaveCount(0);
    expect(saves.calls).toBe(2);
  });
});

test('402: the filter sheet stages the choice and applies it only on «Покажи»', async ({
  page,
}) => {
  await page.setViewportSize({ width: 402, height: 874 });
  await openSignedIn(page, ORG_ADMIN, '/staff');
  const filters = page.getByRole('button', { name: /^Филтри/ });
  const sheet = page.getByRole('dialog', { name: 'Филтри' });
  const invited = sheet.getByRole('checkbox', { name: 'Поканен' });

  await filters.click();
  await expect(sheet.getByRole('heading', { level: 3 })).toHaveText(['Статус', 'Роля', 'Покана']);
  await invited.click();
  await expect(invited).toHaveAttribute('aria-checked', 'true');
  // The button previews the result; the list behind it has not changed.
  await expect(sheet.getByRole('button', { name: 'Покажи 1 служител' })).toBeVisible();
  await expect(page.getByText('2 служители', { exact: true })).toBeAttached();
  await sheet.getByRole('button', { name: 'Изчисти' }).click();
  await expect(invited).toHaveAttribute('aria-checked', 'false');
  await expect(sheet.getByRole('button', { name: 'Покажи 2 служители' })).toBeVisible();

  // Closing drops the choice — by Escape and by × (1126:10849).
  await invited.click();
  await page.keyboard.press('Escape');
  await expect(sheet).toHaveCount(0);
  await filters.click();
  await invited.click();
  await sheet.getByRole('button', { name: 'Затвори' }).click();
  await expect(sheet).toHaveCount(0);
  await expect(page.getByText('2 служители', { exact: true })).toBeVisible();
  await filters.click();
  await expect(invited).toHaveAttribute('aria-checked', 'false');

  await invited.click();
  await sheet.getByRole('button', { name: 'Покажи 1 служител' }).click();
  await expect(sheet).toHaveCount(0);
  await expect(page.getByText('1 от 2 служители')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Филтри · 1' })).toBeVisible();
});

test('a role that cannot see staff is told at once, without retries', async ({ page }) => {
  await page.route('**/v1/tenant/staff', (route) =>
    route.fulfill({ status: 403, json: { statusCode: 403, message: 'Forbidden' } }),
  );
  await openSignedIn(page, ORG_ADMIN, '/staff');
  await expect(
    page.locator('main table').getByText('Ролята ви не може да вижда служители'),
  ).toBeVisible({ timeout: 3_000 });
});

test('«Опитай пак» shows the list loading at once, then the rows', async ({ page }) => {
  let failing = true;
  let release: () => void = () => undefined;
  const held = new Promise<void>((resolve) => (release = resolve));
  await page.route('**/v1/tenant/staff', async (route) => {
    if (failing) return route.fulfill({ status: 500, json: { statusCode: 500 } });
    await held;
    await route.continue();
  });
  await openSignedIn(page, ORG_ADMIN, '/staff');
  const table = page.locator('main table');
  await expect(table.getByText(/^Списъкът не можа да се зареди/)).toBeVisible({ timeout: 15_000 });
  failing = false;
  await table.getByRole('button', { name: 'Опитай пак' }).click();
  // With no rows yet, the retry goes straight back to the skeleton.
  await expect(table.locator('.animate-pulse').first()).toBeVisible();
  await expect(table.getByText(/^Списъкът не можа да се зареди/)).toHaveCount(0);
  release();
  await expect(rows(page)).toHaveCount(2);
});

test('402: search across, then «Филтри» 44 high and the short sort, then the count (877:2945)', async ({
  page,
}) => {
  await page.setViewportSize({ width: 402, height: 874 });
  await openSignedIn(page, ORG_ADMIN, '/staff');
  await expect(page.getByText('2 служители', { exact: true })).toBeVisible();
  const search = page.getByRole('searchbox', { name: 'Търсене в служителите' });
  const filters = page.getByRole('button', { name: /^Филтри/ });
  const sort = page.getByRole('button', { name: 'За внимание' });
  const count = page.getByText('2 служители', { exact: true });
  const box = async (l: typeof search) => (await l.boundingBox())!;
  const [s, f, o, c] = [await box(search), await box(filters), await box(sort), await box(count)];
  expect(f.y).toBeGreaterThan(s.y + s.height);
  expect(Math.abs(o.y - f.y)).toBeLessThanOrEqual(1);
  expect(c.y).toBeGreaterThan(f.y + f.height);
  expect(await filters.evaluate((el) => (el as HTMLElement).offsetHeight)).toBe(44);
});

test('402: «Покани» beside the title, the short line under it (877:2945)', async ({ page }) => {
  await page.setViewportSize({ width: 402, height: 874 });
  await openSignedIn(page, ORG_ADMIN, '/staff');
  await expect(page.getByText('2 акаунта · 1 сграда', { exact: true })).toBeVisible();
  const title = (await page.getByRole('heading', { level: 1, name: 'Служители' }).boundingBox())!;
  const invite = (await page.getByRole('button', { name: /^Покани/ }).boundingBox())!;
  // Same row: the button's middle is within the title's band.
  expect(invite.y).toBeLessThan(title.y + title.height);
  expect(invite.x).toBeGreaterThan(title.x + title.width);
});

test('402: without the right to see buildings the line counts accounts only', async ({ page }) => {
  // The role has no `property.read`: the buildings are never asked for.
  let asked = 0;
  await page.route('**/v1/buildings', (route) => {
    asked += 1;
    return route.fulfill({ status: 403, json: { statusCode: 403 } });
  });
  await page.route('**/v1/tenant', async (route) => {
    const response = await route.fetch();
    const context = await response.json();
    await route.fulfill({
      response,
      json: {
        ...context,
        permissions: context.permissions.filter((p: string) => p !== 'property.read'),
      },
    });
  });
  await page.setViewportSize({ width: 402, height: 874 });
  await openSignedIn(page, ORG_ADMIN, '/staff');
  await expect(page.getByText('2 акаунта', { exact: true })).toBeVisible();
  await page.waitForTimeout(500);
  await expect(page.getByText(/^2 акаунта/)).toHaveText('2 акаунта');
  expect(asked).toBe(0);
});

test('402: a refused buildings answer is not retried and leaves the accounts alone', async ({
  page,
}) => {
  let asked = 0;
  await page.route('**/v1/buildings', (route) => {
    asked += 1;
    return route.fulfill({ status: 403, json: { statusCode: 403 } });
  });
  await page.setViewportSize({ width: 402, height: 874 });
  const answered = page.waitForResponse('**/v1/buildings');
  await openSignedIn(page, ORG_ADMIN, '/staff');
  await answered;
  await expect(page.getByText('2 акаунта', { exact: true })).toBeVisible();
  await page.waitForTimeout(1500); // a retry would come within the first back-off
  await expect(page.getByText(/^2 акаунта/)).toHaveText('2 акаунта');
  expect(asked).toBe(1);
});
