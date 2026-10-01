import { expect, test, type Page } from '@playwright/test';
import { ORG_ADMIN, openSignedIn } from './session';

/**
 * Silent refresh (M1 → Remaining before pilot): an expired access token is
 * renewed with the refresh token and the request repeated, so staff are not
 * sent to sign in while they work. A refresh token is single-use — using one
 * twice revokes the whole family — so however many requests or tabs meet the
 * expiry at once, it is spent exactly once.
 *
 * The access token lives fifteen minutes in auth-service; the expiry is
 * played by core-api answering 401 to the first requests.
 */

/** Answers 401 to the first request of each GET path matched, then lets them through. */
async function expireOnce(page: Page, pattern: string) {
  const expired = new Set<string>();
  await page.context().route(pattern, async (route) => {
    const key = new URL(route.request().url()).pathname;
    if (route.request().method() === 'GET' && !expired.has(key)) {
      expired.add(key);
      return route.fulfill({ status: 401, json: { message: 'Unauthorized' } });
    }
    return route.fallback();
  });
}

/** Counts calls to auth-service's refresh, from every tab of the context. */
function countRefreshes(page: Page) {
  const calls = { n: 0 };
  page.context().on('request', (req) => {
    if (req.url().endsWith('/auth/refresh') && req.method() === 'POST') calls.n += 1;
  });
  return calls;
}

// The refresh token rotates on every renewal; the access token may not change
// when it is issued within the same second.
const storedRefresh = (page: Page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem('inova.session') ?? '{}').refreshToken);

test.use({ viewport: { width: 1728, height: 1117 } });

test('an expired token is renewed and the page loads where it was', async ({ page }) => {
  await openSignedIn(page, ORG_ADMIN, '/login');
  const before = await storedRefresh(page);
  const refreshes = countRefreshes(page);
  await expireOnce(page, '**/v1/tenant/staff');
  await page.goto('/staff');
  await expect(page.getByRole('button', { name: 'Роли и обхват — Елена Петрова' })).toBeVisible();
  await expect(page).toHaveURL(/\/staff$/);
  expect(refreshes.n).toBe(1);
  expect(await storedRefresh(page)).not.toBe(before);
});

test('requests that expire together renew the session once', async ({ page }) => {
  await openSignedIn(page, ORG_ADMIN, '/login');
  const refreshes = countRefreshes(page);
  // /staff asks for the organisation, its staff and its roles at once.
  await expireOnce(page, '**/v1/tenant**');
  await page.goto('/staff');
  await expect(page.getByRole('button', { name: 'Роли и обхват — Елена Петрова' })).toBeVisible();
  await expect(page).toHaveURL(/\/staff$/);
  expect(refreshes.n).toBe(1);
});

test('two tabs that meet the expiry together renew it once and both stay signed in', async ({
  page,
}) => {
  await openSignedIn(page, ORG_ADMIN, '/login');
  const second = await page.context().newPage();
  const refreshes = countRefreshes(page);
  await expireOnce(page, '**/v1/tenant/**');
  await Promise.all([page.goto('/roles'), second.goto('/staff')]);
  await expect(page.locator('main article').first()).toBeVisible();
  await expect(second.getByRole('button', { name: 'Роли и обхват — Елена Петрова' })).toBeVisible();
  expect(refreshes.n).toBe(1);
  // The renewed session still works: a reload signs nobody out.
  await second.reload();
  await expect(second).toHaveURL(/\/staff$/);
});

test('when the session cannot be renewed, the sign-in page opens', async ({ page }) => {
  await openSignedIn(page, ORG_ADMIN, '/login');
  await page
    .context()
    .route('**/auth/refresh', (route) =>
      route.fulfill({ status: 401, json: { message: 'Invalid refresh token' } }),
    );
  await expireOnce(page, '**/v1/tenant/staff');
  await page.goto('/staff');
  await expect(page).toHaveURL(/\/login$/);
  expect(await page.evaluate(() => localStorage.getItem('inova.session'))).toBeNull();
});

test('when auth-service is briefly down, the session is kept and renewed on the next try', async ({
  page,
}) => {
  await openSignedIn(page, ORG_ADMIN, '/login');
  const refreshes = countRefreshes(page);
  // The token stays expired until a renewal succeeds; the first renewal meets
  // a restarting auth-service (a deploy) and gets 503.
  let renewed = false;
  let down = true;
  await page.context().route('**/auth/refresh', async (route) => {
    if (down) {
      down = false;
      return route.fulfill({ status: 503, body: 'Service Unavailable' });
    }
    const response = await route.fetch();
    renewed = response.ok();
    return route.fulfill({ response });
  });
  await page
    .context()
    .route('**/v1/tenant/staff', (route) =>
      renewed
        ? route.fallback()
        : route.fulfill({ status: 401, json: { message: 'Unauthorized' } }),
    );
  await page.goto('/staff');
  // The query retries on its own; the second try renews and loads the list.
  await expect(page.getByRole('button', { name: 'Роли и обхват — Елена Петрова' })).toBeVisible({
    timeout: 15_000,
  });
  await expect(page).toHaveURL(/\/staff$/);
  expect(refreshes.n).toBe(2);
});
