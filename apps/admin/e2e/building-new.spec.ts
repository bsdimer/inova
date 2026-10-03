import { expect, test, type Page } from '@playwright/test';
import type { BuildingDetail, BuildingListItem } from '@inova/shared';
import { rectsInOneFrame } from './geometry';
import { ORG_ADMIN, openSignedIn } from './session';

/**
 * «Нова сграда» (2564:2, 402 2566:2). The create route is answered here, so
 * the seeded database keeps its one building for every other spec; the list
 * after a create is the seeded answer plus what was created.
 */
const LIST = '**/v1/buildings';
const panel = (page: Page) => page.getByRole('dialog', { name: 'Нова сграда' });

const LOZENETS: BuildingDetail = {
  id: '00000000-0000-4000-8000-000000000154',
  name: 'Резиденция Лозенец',
  city: 'София',
  district: 'Лозенец',
  address: 'ул. Черни връх 45',
  floors: 8,
  hasElevator: true,
  assessmentBasis: 'per_ideal_part',
  bankAccount: null,
  signatureName: null,
  status: 'draft',
  activatedAt: null,
  createdAt: '2026-10-03T10:00:00.000Z',
  updatedAt: '2026-10-03T10:00:00.000Z',
  entrances: [
    { id: '00000000-0000-4000-8000-0000000001a1', name: 'А', propertyCount: 0 },
    { id: '00000000-0000-4000-8000-0000000001b1', name: 'Б', propertyCount: 0 },
  ],
  propertyCounts: { apartment: 0, garage: 0, shop: 0, storage: 0, parking_spot: 0 },
};

function asListItem(detail: BuildingDetail): BuildingListItem {
  const { entrances, ...rest } = detail;
  return { ...rest, entranceCount: entrances.length };
}

/**
 * Answers `POST /buildings` with `status` and records the bodies it was sent;
 * after a 201 the list carries the new building.
 */
async function answerCreate(page: Page, status: 201 | 400 | 500) {
  const sent: unknown[] = [];
  let created = false;
  await page.route(LIST, async (route) => {
    if (route.request().method() === 'POST') {
      sent.push(route.request().postDataJSON());
      created = status === 201;
      await route.fulfill({ status, json: status === 201 ? LOZENETS : { statusCode: status } });
      return;
    }
    const response = await route.fetch();
    const seeded = (await response.json()) as BuildingListItem[];
    await route.fulfill({ response, json: created ? [...seeded, asListItem(LOZENETS)] : seeded });
  });
  return sent;
}

async function fillLozenets(page: Page) {
  const form = panel(page);
  await form.getByLabel('Име', { exact: true }).fill('Резиденция Лозенец');
  await form.getByLabel('Адрес').fill('ул. Черни връх 45');
  await form.getByLabel('Град').fill('София');
  await form.getByLabel('Квартал').fill('Лозенец');
  await form.getByRole('button', { name: 'Добави вход' }).click();
  await form.getByLabel('Име на входа').fill('Б');
  await form.getByLabel('Име на входа').press('Enter');
  await form.getByLabel('Етажи').fill('8');
  await form.getByText('Има асансьор').click();
  await form.getByLabel('Разпределение на таксите').selectOption({ label: 'По идеални части' });
}

test('«Добави сграда» creates a draft and the list shows it', async ({ page }) => {
  const sent = await answerCreate(page, 201);
  await openSignedIn(page, ORG_ADMIN, '/buildings');
  await page.getByRole('button', { name: 'Добави сграда' }).click();

  const form = panel(page);
  await expect(form.getByRole('heading', { name: 'Нова сграда' })).toBeVisible();
  await expect(
    form.getByText('Сградата се създава като чернова. Активирате я, щом има поне един имот.'),
  ).toBeVisible();
  // The name field takes the first keystroke.
  await expect(form.getByLabel('Име', { exact: true })).toBeFocused();
  // One entrance to start with; most buildings have one.
  await expect(form.getByRole('list', { name: 'Входове' }).getByRole('listitem')).toHaveText([
    'Вход А',
    'Добави вход',
  ]);

  await fillLozenets(page);
  await form.getByRole('button', { name: 'Създай' }).click();

  await expect(form).toHaveCount(0);
  expect(sent).toEqual([
    {
      name: 'Резиденция Лозенец',
      address: 'ул. Черни връх 45',
      city: 'София',
      district: 'Лозенец',
      entrances: ['А', 'Б'],
      floors: 8,
      hasElevator: true,
      assessmentBasis: 'per_ideal_part',
    },
  ]);
  const row = page.locator('main table tbody tr').filter({ hasText: 'Резиденция Лозенец' });
  await expect(row.locator('td').nth(1)).toHaveText('2');
  await expect(row.locator('td').nth(4)).toHaveText('Чернова');
});

test('the city and the quarter offer the ones already used', async ({ page }) => {
  await openSignedIn(page, ORG_ADMIN, '/buildings');
  await page.getByRole('button', { name: 'Добави сграда' }).click();
  const form = panel(page);
  // The seeded «бл. 3» is in Лозенец, София (D24: free strings, suggested).
  const list = async (label: string) =>
    form
      .getByLabel(label)
      .evaluate((input) =>
        [...((input as HTMLInputElement).list?.options ?? [])].map((o) => o.value),
      );
  expect(await list('Град')).toEqual(['София']);
  expect(await list('Квартал')).toEqual(['Лозенец']);
});

test('empty fields are named and nothing is sent', async ({ page }) => {
  const sent = await answerCreate(page, 201);
  await openSignedIn(page, ORG_ADMIN, '/buildings');
  await page.getByRole('button', { name: 'Добави сграда' }).click();
  const form = panel(page);
  await form.getByRole('button', { name: 'Създай' }).click();

  // The first wrong field takes the focus, so it is on screen however far down «Създай» was.
  await expect(form.getByLabel('Име', { exact: true })).toBeFocused();
  // One announcement for all of them.
  await expect(form.getByRole('alert')).toHaveText('Проверете 6 полета.');
  const named: [string, string][] = [
    ['Име', 'Въведете името на сградата.'],
    ['Адрес', 'Въведете адреса.'],
    ['Град', 'Въведете града.'],
    ['Квартал', 'Въведете квартала.'],
    ['Етажи', 'От 1 до 200.'],
    ['Разпределение на таксите', 'Изберете как се разпределят таксите.'],
  ];
  for (const [label, message] of named) {
    const field = form.getByLabel(label, { exact: true });
    await expect(field).toHaveAttribute('aria-invalid', 'true');
    await expect(field).toHaveAccessibleDescription(message);
  }
  await form.getByLabel('Етажи').fill('201');
  await expect(form.getByLabel('Етажи')).toHaveAccessibleDescription('От 1 до 200.');
  // The name is right now, so the next «Създай» moves to the address.
  await form.getByLabel('Име', { exact: true }).fill('Резиденция Лозенец');
  await form.getByRole('button', { name: 'Създай' }).click();
  await expect(form.getByLabel('Адрес')).toBeFocused();
  await expect(form.getByRole('alert')).toHaveText('Проверете 5 полета.');
  // The server's limits are the fields' own.
  await expect(form.getByLabel('Адрес')).toHaveAttribute('maxlength', '200');
  expect(sent).toEqual([]);
  await expect(form).toBeVisible();
});

test('a refused create says so in the panel and keeps what was typed', async ({ page }) => {
  await answerCreate(page, 500);
  await openSignedIn(page, ORG_ADMIN, '/buildings');
  await page.getByRole('button', { name: 'Добави сграда' }).click();
  await fillLozenets(page);
  const form = panel(page);
  await form.getByRole('button', { name: 'Създай' }).click();

  await expect(form.getByRole('alert')).toHaveText(
    'Сградата не беше създадена. Проверете връзката и опитайте отново.',
  );
  await expect(form.getByLabel('Име', { exact: true })).toHaveValue('Резиденция Лозенец');
  await expect(form.getByRole('list', { name: 'Входове' })).toContainText('Вход Б');
});

test('a create the server refuses as invalid points to the fields, not the connection', async ({
  page,
}) => {
  await answerCreate(page, 400);
  await openSignedIn(page, ORG_ADMIN, '/buildings');
  await page.getByRole('button', { name: 'Добави сграда' }).click();
  await fillLozenets(page);
  const form = panel(page);
  await form.getByRole('button', { name: 'Създай' }).click();
  await expect(form.getByRole('alert')).toHaveText(
    'Сървърът не прие данните. Проверете полетата и опитайте отново.',
  );
});

test('an entrance named twice is refused, and «Вход» is not doubled', async ({ page }) => {
  await openSignedIn(page, ORG_ADMIN, '/buildings');
  await page.getByRole('button', { name: 'Добави сграда' }).click();
  const form = panel(page);
  const entrances = form.getByRole('list', { name: 'Входове' });

  await form.getByRole('button', { name: 'Добави вход' }).click();
  await form.getByLabel('Име на входа').fill('вход Б');
  await form.getByLabel('Име на входа').press('Enter');
  await expect(entrances.getByRole('listitem').nth(1)).toHaveText('Вход Б');

  await form.getByLabel('Име на входа').fill('а');
  await form.getByLabel('Име на входа').press('Enter');
  await expect(form.getByRole('alert')).toHaveText('Вход а вече е добавен.');

  // Esc closes the small field, not the panel, and asks nothing.
  await form.getByLabel('Име на входа').press('Escape');
  await expect(form.getByLabel('Име на входа')).toHaveCount(0);
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
  await expect(form).toBeVisible();

  await entrances.getByRole('button', { name: 'Премахни вход А' }).click();
  await expect(entrances.getByRole('listitem')).toHaveText(['Вход Б', 'Добави вход']);
});

test('× asks before it drops what was typed; untouched, it just closes', async ({ page }) => {
  await openSignedIn(page, ORG_ADMIN, '/buildings');
  const open = page.getByRole('button', { name: 'Добави сграда' });

  await open.click();
  await panel(page).getByRole('button', { name: 'Затвори' }).click();
  await expect(panel(page)).toHaveCount(0);

  await open.click();
  await panel(page).getByLabel('Име', { exact: true }).fill('Резиденция Лозенец');
  await panel(page).getByRole('button', { name: 'Затвори' }).click();
  const question = page.getByRole('alertdialog', { name: 'Да се запазят ли промените?' });
  await expect(question).toBeVisible();
  // «Запази» with empty fields: the question goes and the form names them.
  await question.getByRole('button', { name: 'Запази' }).click();
  await expect(question).toHaveCount(0);
  await expect(panel(page).getByLabel('Адрес')).toHaveAccessibleDescription('Въведете адреса.');

  await panel(page).getByRole('button', { name: 'Затвори' }).click();
  await page
    .getByRole('alertdialog', { name: 'Да се запазят ли промените?' })
    .getByRole('button', { name: 'Не запазвай' })
    .click();
  await expect(panel(page)).toHaveCount(0);
  // Opened again, the form starts clean.
  await open.click();
  await expect(panel(page).getByLabel('Име', { exact: true })).toHaveValue('');
});

test('a role that cannot create buildings has no «Добави сграда»', async ({ page }) => {
  await page.route('**/v1/tenant', async (route) => {
    const response = await route.fetch();
    const context = await response.json();
    await route.fulfill({
      response,
      json: {
        ...context,
        permissions: context.permissions.filter((p: string) => p !== 'property.write'),
      },
    });
  });
  await openSignedIn(page, ORG_ADMIN, '/buildings');
  await expect(page.locator('main table tbody tr')).toHaveCount(1);
  await expect(page.getByRole('button', { name: /^Добави/ })).toHaveCount(0);
});

test('an organisation without buildings starts from «Добави сграда»', async ({ page }) => {
  let created = false;
  await page.route(LIST, async (route) => {
    if (route.request().method() === 'POST') {
      created = true;
      return route.fulfill({ status: 201, json: LOZENETS });
    }
    return route.fulfill({ json: created ? [asListItem(LOZENETS)] : [] });
  });
  await openSignedIn(page, ORG_ADMIN, '/buildings');
  await expect(page.getByText('Още няма сгради')).toBeVisible();
  await page.getByRole('button', { name: 'Добави сграда' }).click();
  await fillLozenets(page);
  await panel(page).getByRole('button', { name: 'Създай' }).click();
  await expect(page.locator('main table tbody tr')).toHaveCount(1);
  // The empty list's button went with it; the head's takes the focus.
  await expect(page.getByRole('button', { name: 'Добави сграда' })).toBeFocused();
});

test('402: «Добави» beside the title opens the form over the whole screen', async ({ page }) => {
  await page.setViewportSize({ width: 402, height: 874 });
  await openSignedIn(page, ORG_ADMIN, '/buildings');
  const add = page.getByRole('button', { name: 'Добави', exact: true });
  const [title, button] = await rectsInOneFrame(page, [
    page.getByRole('heading', { level: 1, name: 'Сгради' }),
    add,
  ]);
  expect(Math.abs(title!.y - button!.y)).toBeLessThan(12);

  await add.click();
  await expect(panel(page)).toBeVisible();
  // Measured once the entry spring has settled: a full screen, square corners.
  await expect
    .poll(() =>
      panel(page).evaluate((el) => {
        const r = el.getBoundingClientRect();
        return [r.x, r.y, r.width, r.height, getComputedStyle(el).borderTopLeftRadius];
      }),
    )
    .toEqual([0, 0, 402, 874, '0px']);
});

test('402 × 600: the buttons end the form, under a fade while more is below (design.md)', async ({
  page,
}) => {
  await page.setViewportSize({ width: 402, height: 600 });
  await openSignedIn(page, ORG_ADMIN, '/buildings');
  await page.getByRole('button', { name: 'Добави', exact: true }).click();
  const form = panel(page);
  const create = form.getByRole('button', { name: 'Създай' });
  const body = form.locator('[data-drawer-body]');
  const mask = () => body.evaluate((el) => getComputedStyle(el).maskImage);

  // Inside the scrolling body, after the last field: not pinned.
  await expect(form.locator('[data-drawer-body] [data-drawer-footer]')).toHaveCount(1);
  await expect(create).not.toBeInViewport();
  await expect.poll(mask).toContain('linear-gradient');

  await body.evaluate((el) => el.scrollTo(0, el.scrollHeight));
  await expect(create).toBeInViewport();
  await expect(form.getByRole('button', { name: 'Отказ' })).toBeInViewport();
  await expect.poll(mask).toBe('none');
});

test('beside the page the buttons end the form, as design.md has it', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 600 });
  await openSignedIn(page, ORG_ADMIN, '/buildings');
  await page.getByRole('button', { name: 'Добави сграда' }).click();
  const form = panel(page);
  // Inside the scrolling body, after the last field.
  await expect(form.locator('[data-drawer-body] [data-drawer-footer]')).toHaveCount(1);
  await expect(form.getByRole('button', { name: 'Създай' })).not.toBeInViewport();
});
