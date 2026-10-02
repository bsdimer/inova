import { expect, test, type Page } from '@playwright/test';
import { ORG_ADMIN, openSignedIn } from './session';

/**
 * Сгради (945:5108, 402 952:5831, empty 947:5498, states 1519:21142). The
 * seed gives WhiteNova one building, «бл. 3»: active, entrance А, four
 * apartments, four floors. The other cases answer the list route themselves.
 */
const rows = (page: Page) => page.locator('main table tbody tr');
const LIST = '**/v1/buildings';

interface Fake {
  name: string;
  city?: string;
  district?: string;
  address?: string;
  status?: 'draft' | 'active' | 'archived';
  floors?: number;
  entrances?: number;
  apartments?: number;
  garages?: number;
}

function building(fake: Fake, i: number) {
  return {
    id: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
    tenantId: '00000000-0000-4000-8000-000000000000',
    name: fake.name,
    city: fake.city ?? 'София',
    district: fake.district ?? 'Лозенец',
    address: fake.address ?? `ул. Тестова ${i}`,
    floors: fake.floors ?? 6,
    hasElevator: true,
    assessmentBasis: 'per_ideal_part',
    bankAccount: null,
    signatureName: null,
    status: fake.status ?? 'active',
    activatedAt: null,
    createdAt: '2026-10-01T10:00:00.000Z',
    updatedAt: '2026-10-01T10:00:00.000Z',
    entranceCount: fake.entrances ?? 1,
    propertyCounts: {
      apartment: fake.apartments ?? 10,
      garage: fake.garages ?? 0,
      shop: 0,
      storage: 0,
      parking_spot: 0,
    },
  };
}

const PORTFOLIO: Fake[] = [
  {
    name: 'Блок 212',
    district: 'Младост',
    address: 'ж.к. Младост 2',
    entrances: 4,
    apartments: 96,
  },
  {
    name: 'Резиденция Оборище',
    district: 'Оборище',
    address: 'ул. Оборище 12',
    entrances: 3,
    apartments: 170,
    garages: 10,
  },
  { name: 'Сграда „Лозенец Парк“', address: 'бул. Черни връх 45', status: 'draft', apartments: 48 },
  { name: 'Сграда Позитано 3', district: 'Център', status: 'archived', apartments: 24 },
];

async function answerList(page: Page, list: Fake[]) {
  await page.route(LIST, (route) => route.fulfill({ json: list.map(building) }));
}

test('the seeded building is listed with what the list knows about it', async ({ page }) => {
  await openSignedIn(page, ORG_ADMIN, '/buildings');
  await expect(page.getByRole('heading', { level: 1, name: 'Сгради' })).toBeVisible();
  await expect(page.locator('main table thead th')).toHaveText([
    'Сграда',
    'Входове',
    'Имоти',
    'Живущи',
    'Статус',
    'Домоуправител',
    '',
  ]);
  await expect(rows(page)).toHaveCount(1);
  const cells = rows(page).first().locator('td');
  await expect(cells.nth(0)).toContainText('бл. 3');
  await expect(cells.nth(0)).toContainText('ул. Кораб планина 12, София');
  // Name and address may be cut short; the full text is in the tooltip.
  await expect(cells.nth(0).getByText('бл. 3')).toHaveAttribute('title', 'бл. 3');
  await expect(cells.nth(1)).toHaveText('1');
  await expect(cells.nth(2)).toContainText('4');
  await expect(cells.nth(2)).toContainText('4 етажа');
  // Residents and the house manager are not in the list answer yet (WHI-96).
  await expect(cells.nth(3)).toHaveText('—');
  await expect(cells.nth(4)).toHaveText('Активна');
  await expect(cells.nth(5)).toHaveText('—');
  await expect(page.getByText('1 сграда', { exact: true })).toBeVisible();
});

test('while the list loads it shows skeleton rows, never «no buildings yet»', async ({ page }) => {
  let release: () => void = () => undefined;
  const held = new Promise<void>((resolve) => (release = resolve));
  await page.route(LIST, async (route) => {
    await held;
    await route.continue();
  });
  await openSignedIn(page, ORG_ADMIN, '/buildings');
  await expect(page.locator('main table tbody tr .animate-pulse').first()).toBeVisible();
  await expect(page.getByText('Още няма сгради')).toHaveCount(0);
  // The toolbar is there before the rows, so nothing jumps when they come.
  await expect(page.getByRole('searchbox', { name: 'Търсене в сградите' })).toBeVisible();
  release();
  await expect(rows(page)).toHaveCount(1);
});

test.describe('a portfolio of four', () => {
  test.beforeEach(async ({ page }) => {
    await answerList(page, PORTFOLIO);
    await openSignedIn(page, ORG_ADMIN, '/buildings');
    await expect(rows(page)).toHaveCount(4);
  });

  test('the most properties come first, garages and shops counted in', async ({ page }) => {
    await expect(rows(page).locator('td:first-child p:first-child')).toHaveText([
      'Резиденция Оборище',
      'Блок 212',
      'Сграда „Лозенец Парк“',
      'Сграда Позитано 3',
    ]);
    await expect(rows(page).first().locator('td').nth(2)).toContainText('180');
  });

  test('the sort switches to name order', async ({ page }) => {
    await page.getByRole('button', { name: 'Първо най-много имоти' }).click();
    await page.getByRole('option', { name: 'Име А–Я' }).click();
    await expect(rows(page).locator('td:first-child p:first-child')).toHaveText([
      'Блок 212',
      'Резиденция Оборище',
      // Quotes do not count: Лозенец before Позитано.
      'Сграда „Лозенец Парк“',
      'Сграда Позитано 3',
    ]);
  });

  test('a draft and an archived building say so', async ({ page }) => {
    const draft = rows(page).filter({ hasText: 'Лозенец Парк' });
    await expect(draft.locator('td').nth(4)).toHaveText('Чернова');
    const archived = rows(page).filter({ hasText: 'Позитано' });
    await expect(archived.locator('td').nth(4)).toHaveText('Архивирана');
  });

  test('search finds a building by its address', async ({ page }) => {
    await page.getByRole('searchbox', { name: 'Търсене в сградите' }).fill('черни връх');
    await expect(rows(page)).toHaveCount(1);
    await expect(rows(page).first()).toContainText('Лозенец Парк');
    await expect(page.getByText('1 от 4 сгради')).toBeVisible();
  });

  test('the quarter and status facets narrow the list', async ({ page }) => {
    await page.getByRole('button', { name: 'Квартал' }).click();
    await expect(page.getByRole('option')).toHaveText(['Лозенец', 'Младост', 'Оборище', 'Център']);
    await page.getByRole('option', { name: 'Лозенец' }).click();
    await page.keyboard.press('Escape');
    await expect(rows(page)).toHaveCount(1);
    await expect(rows(page).first()).toContainText('Лозенец Парк');
  });

  test('filtering to nothing names the filters and offers to clear them', async ({ page }) => {
    await page.getByRole('button', { name: 'Статус' }).click();
    await page.getByRole('option', { name: 'Чернова' }).click();
    await page.keyboard.press('Escape');
    await page.getByRole('searchbox', { name: 'Търсене в сградите' }).fill('Оборище');
    const table = page.locator('main table');
    await expect(table.getByText('Няма сгради по тези филтри')).toBeVisible();
    await expect(table.getByText(/^Статус е Чернова; търсене „Оборище“\. /)).toBeVisible();
    await page.getByRole('button', { name: 'Изчисти филтрите' }).click();
    await expect(rows(page)).toHaveCount(4);
  });

  test('a single city gets no «Град» filter (1553:33265)', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Град' })).toHaveCount(0);
  });
});

test('several cities add the «Град» filter', async ({ page }) => {
  await answerList(page, [
    { name: 'Блок 212' },
    { name: 'Морска', city: 'Варна', district: 'Чайка' },
  ]);
  await openSignedIn(page, ORG_ADMIN, '/buildings');
  await page.getByRole('button', { name: 'Град' }).click();
  await page.getByRole('option', { name: 'Варна' }).click();
  await page.keyboard.press('Escape');
  await expect(rows(page)).toHaveCount(1);
  await expect(rows(page).first()).toContainText('Морска');
});

test('an organisation without buildings is told how to start', async ({ page }) => {
  await answerList(page, []);
  await openSignedIn(page, ORG_ADMIN, '/buildings');
  await expect(page.getByText('Още няма сгради')).toBeVisible();
  await expect(page.locator('main table')).toHaveCount(0);
  await expect(page.getByRole('searchbox', { name: 'Търсене в сградите' })).toHaveCount(0);
});

test('a failed list says so and loads again on «Опитай отново»', async ({ page }) => {
  let failing = true;
  await page.route(LIST, async (route) => {
    if (failing) await route.fulfill({ status: 500, json: { statusCode: 500 } });
    else await route.continue();
  });
  await openSignedIn(page, ORG_ADMIN, '/buildings');
  // The query retries a server error three times before it gives up.
  const table = page.locator('main table');
  await expect(table.getByText('Списъкът не се зареди')).toBeVisible({ timeout: 15_000 });
  failing = false;
  await table.getByRole('button', { name: 'Опитай отново' }).click();
  await expect(rows(page)).toHaveCount(1);
});

test('a role that cannot read buildings is told which right it needs', async ({ page }) => {
  await page.route(LIST, (route) =>
    route.fulfill({ status: 403, json: { statusCode: 403, message: 'Forbidden' } }),
  );
  await openSignedIn(page, ORG_ADMIN, '/buildings');
  // No retries on a refusal: the message is there at once, not after the back-off.
  const table = page.locator('main table');
  await expect(table.getByText('Ролята ви не може да вижда сгради')).toBeVisible({
    timeout: 3_000,
  });
  await expect(table.getByText(/„Преглед на сгради и имоти“/)).toBeVisible();
});

test.describe('sizes', () => {
  for (const [width, height] of [
    [1728, 1117],
    [1024, 768],
    [1728, 600],
  ] as const) {
    test(`${width} × ${height}: the table, no sideways scroll`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await answerList(page, PORTFOLIO);
      await openSignedIn(page, ORG_ADMIN, '/buildings');
      await expect(rows(page)).toHaveCount(4);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBe(0);
      // With every column shown, the name keeps the drawn share (300 of 1096);
      // below 896 px of table width (@4xl) «Живущи» folds away and the rest widen.
      if (width < 1728) return;
      const share = await page.evaluate(() => {
        const table = document.querySelector('main table') as HTMLElement;
        const first = table.querySelector('thead th') as HTMLElement;
        return first.offsetWidth / table.offsetWidth;
      });
      expect(share).toBeGreaterThan(0.26);
      expect(share).toBeLessThan(0.29);
    });
  }

  test('402: the same buildings as cards, filters in a sheet', async ({ page }) => {
    await page.setViewportSize({ width: 402, height: 874 });
    await answerList(page, PORTFOLIO);
    await openSignedIn(page, ORG_ADMIN, '/buildings');
    const cards = page.getByRole('article');
    await expect(cards).toHaveCount(4);
    await expect(cards.first()).toContainText('Резиденция Оборище');
    await expect(cards.first()).toContainText('3 входа · 180 имота');
    await expect(page.getByText('4 сгради · 348 имота')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Квартал' })).toBeHidden();
    await page.getByRole('button', { name: /^Филтри/ }).click();
    const sheet = page.getByRole('dialog', { name: 'Филтри' });
    await expect(sheet.getByRole('heading', { level: 3 })).toHaveText(['Квартал', 'Статус']);
    await sheet.getByRole('checkbox', { name: 'Чернова' }).click();
    await sheet.getByRole('button', { name: 'Покажи 1' }).click();
    await expect(sheet).toHaveCount(0);
    await expect(cards).toHaveCount(1);
    await expect(page.getByRole('button', { name: 'Филтри · 1' })).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBe(0);
  });
});
