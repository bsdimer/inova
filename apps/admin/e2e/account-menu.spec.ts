import { expect, test, type Page } from '@playwright/test';
import { ORG_ADMIN, PLATFORM_ADMIN, openSignedIn } from './session';

/**
 * The account menu, Figma Screens 2354:286 (desktop popover) and 1763:28546
 * (the sheet at 402): who you are, where you are, which role you hold, what
 * it lets you do, the theme and the way out.
 */

const openMenu = async (page: Page) => {
  await page.getByRole('button', { name: /, акаунт$/ }).click();
  const menu = page.getByRole('dialog', { name: 'Акаунт' });
  await expect(menu).toBeVisible();
  return menu;
};

test.describe('desktop', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('an organisation administrator sees who they are, their organisation, role and access', async ({
    page,
  }) => {
    await openSignedIn(page, ORG_ADMIN, '/');
    await expect(page.getByRole('button', { name: /, акаунт$/ })).toContainText(
      'Администратор · WhiteNova Technology',
    );
    const menu = await openMenu(page);
    // Once the opening scale has run: 386, as drawn.
    await expect
      .poll(async () => Math.round((await menu.locator('..').boundingBox())!.width))
      .toBe(386);

    await expect(menu.getByText('Мария Иванова', { exact: true })).toBeVisible();
    await expect(menu.getByText('maria@inova.bg', { exact: true })).toBeVisible();
    await expect(menu.getByText('WhiteNova Technology', { exact: true })).toBeVisible();

    const roles = menu.getByRole('list', { name: 'Вашите роли' });
    await expect(roles.getByRole('listitem')).toHaveText(['Администратор']);

    const access = menu.getByRole('list', { name: 'Вашият достъп' });
    await expect(access.getByRole('listitem')).toHaveText([
      'Служители, роли и настройки на организацията',
      'Администриране на платформата — няма достъп',
    ]);
  });

  test('«Одитен дневник» leads to the audit page', async ({ page }) => {
    await openSignedIn(page, ORG_ADMIN, '/');
    const menu = await openMenu(page);
    await menu.getByRole('link', { name: 'Одитен дневник' }).click();
    await expect(page).toHaveURL(/\/audit$/);
    await expect(menu).toBeHidden();
  });

  test('without the right to read the audit trail there is no link to it', async ({ page }) => {
    await page.route('**/v1/tenant', async (route) => {
      const response = await route.fetch();
      const body = await response.json();
      body.permissions = body.permissions.filter((key: string) => key !== 'audit.read');
      await route.fulfill({ response, json: body });
    });
    await openSignedIn(page, ORG_ADMIN, '/');
    const menu = await openMenu(page);
    await expect(menu.getByText('Служители, роли и настройки на организацията')).toBeVisible();
    await expect(menu.getByRole('link', { name: 'Одитен дневник' })).toHaveCount(0);
  });

  test('the phone follows the email, in groups', async ({ page }) => {
    await openSignedIn(page, ORG_ADMIN, '/');
    await page.evaluate(() => {
      const session = JSON.parse(localStorage.getItem('inova.session')!);
      session.user.phone = '+359881000001';
      localStorage.setItem('inova.session', JSON.stringify(session));
    });
    await page.reload();
    const menu = await openMenu(page);
    await expect(menu.getByText('maria@inova.bg · +359 88 100 0001')).toBeVisible();
  });

  test('the theme is a choice of three, and choosing one switches the page', async ({ page }) => {
    await openSignedIn(page, ORG_ADMIN, '/');
    const menu = await openMenu(page);
    const theme = menu.getByRole('radiogroup', { name: 'Тема' });
    await expect(theme.getByRole('radio')).toHaveText(['Светла', 'Тъмна', 'Динамична']);
    await expect(theme.getByRole('radio', { name: 'Светла' })).toBeChecked();

    await theme.getByRole('radio', { name: 'Тъмна' }).click();
    await expect(theme.getByRole('radio', { name: 'Тъмна' })).toBeChecked();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  });

  test('«Изход» signs out', async ({ page }) => {
    await openSignedIn(page, ORG_ADMIN, '/');
    const menu = await openMenu(page);
    await menu.getByRole('button', { name: 'Изход' }).click();
    await expect(page).toHaveURL(/\/login$/);
    expect(await page.evaluate(() => localStorage.getItem('inova.session'))).toBeNull();
  });

  test('a platform administrator is named in words, never by a role key', async ({ page }) => {
    await openSignedIn(page, PLATFORM_ADMIN, '/tenants');
    const account = page.getByRole('button', { name: /, акаунт$/ });
    await expect(account).toContainText('Администратор на платформата');
    await expect(page.getByText(/super_admin/)).toHaveCount(0);

    const menu = await openMenu(page);
    await expect(menu.getByRole('list', { name: 'Вашите роли' }).getByRole('listitem')).toHaveText([
      'Администратор на платформата',
    ]);
    await expect(
      menu.getByRole('list', { name: 'Вашият достъп' }).getByRole('listitem'),
    ).toContainText(['Администриране на платформата']);
    await expect(menu.getByText('няма достъп')).toHaveCount(0);
    await expect(page.getByText(/super_admin/)).toHaveCount(0);
  });

  test('on a short screen the menu scrolls inside the window and «Изход» is reachable', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 600 });
    await openSignedIn(page, ORG_ADMIN, '/');
    const menu = await openMenu(page);
    // The popover around the menu is what must stay inside the window.
    const box = (await menu.locator('..').boundingBox())!;
    expect(box.y + box.height).toBeLessThanOrEqual(600);
    const signOut = menu.getByRole('button', { name: 'Изход' });
    await signOut.scrollIntoViewIfNeeded();
    await expect(signOut).toBeInViewport();
  });
});

test.describe('402', () => {
  test.use({ viewport: { width: 402, height: 874 } });

  test('the menu is a sheet from the bottom with «Изход» across its width', async ({ page }) => {
    await openSignedIn(page, ORG_ADMIN, '/');
    const menu = await openMenu(page);
    const signOutButton = menu.getByRole('button', { name: 'Изход' });
    // Measured once the spring has settled at the bottom edge.
    await expect
      .poll(async () => {
        const box = (await menu.boundingBox())!;
        return Math.round(box.y + box.height);
      })
      .toBe(874);
    const sheet = (await menu.boundingBox())!;
    expect(Math.round(sheet.x)).toBe(0);
    expect(Math.round(sheet.width)).toBe(402);
    await expect(signOutButton).toBeInViewport({ ratio: 1 });

    // Pinned in the footer, 20 from each side: in reach without scrolling.
    const signOut = (await signOutButton.boundingBox())!;
    expect(Math.round(signOut.width)).toBe(362);

    await menu.getByRole('button', { name: 'Затвори' }).click();
    await expect(menu).toBeHidden();
  });

  test('choosing an organisation keeps the focus on the choice', async ({ page }) => {
    await openSignedIn(page, ORG_ADMIN, '/');
    // A second membership, so the sheet offers a choice; switching re-renders
    // the whole menu, which is what used to throw the focus back to ×.
    await page.evaluate(() => {
      const session = JSON.parse(localStorage.getItem('inova.session')!);
      session.memberships.push({
        t: '00000000-0000-4000-8000-000000000001',
        r: 'admin',
        tenantKey: 'second',
        tenantName: 'Втора организация',
      });
      localStorage.setItem('inova.session', JSON.stringify(session));
    });
    await page.reload();
    const menu = await openMenu(page);
    const second = menu
      .getByRole('radiogroup', { name: 'Организация' })
      .getByRole('radio', { name: 'Втора организация' });
    await second.focus();
    await page.keyboard.press('Enter');
    await expect(second).toBeChecked();
    await page.waitForTimeout(300);
    await expect(second).toBeFocused();
  });
});

/** A second membership in the stored session, so there is a choice to make. */
const SECOND = '00000000-0000-4000-8000-000000000002';
async function addSecondOrganisation(page: Page) {
  await page.evaluate((id) => {
    const session = JSON.parse(localStorage.getItem('inova.session')!);
    session.memberships.push({ t: id, r: 'manager', tenantKey: 'second', tenantName: 'Втора' });
    localStorage.setItem('inova.session', JSON.stringify(session));
  }, SECOND);
  await page.reload();
}

test.describe('desktop, keyboard and data', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('opening moves the focus into the menu, Esc brings it back to the avatar', async ({
    page,
  }) => {
    await openSignedIn(page, ORG_ADMIN, '/');
    const account = page.getByRole('button', { name: /, акаунт$/ });
    await account.focus();
    await page.keyboard.press('Enter');
    const menu = page.getByRole('dialog', { name: 'Акаунт' });
    await expect(menu.getByRole('heading', { name: 'Акаунт' })).toBeAttached();
    await expect.poll(() => menu.evaluate((el) => el.contains(document.activeElement))).toBe(true);
    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();
    await expect(account).toBeFocused();
  });

  test('the arrows move the theme choice, the selected row is rounded', async ({ page }) => {
    await openSignedIn(page, ORG_ADMIN, '/');
    const menu = await openMenu(page);
    const light = menu.getByRole('radio', { name: 'Светла' });
    const dark = menu.getByRole('radio', { name: 'Тъмна' });
    await expect(light).toHaveAttribute('tabindex', '0');
    await expect(dark).toHaveAttribute('tabindex', '-1');
    // The menu takes the focus a frame after it opens; move on from there.
    await expect.poll(() => menu.evaluate((el) => el === document.activeElement)).toBe(true);
    await light.focus();
    await page.keyboard.press('ArrowDown');
    await expect(dark).toBeChecked();
    await expect(dark).toBeFocused();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    expect(await dark.evaluate((el) => getComputedStyle(el).borderTopLeftRadius)).toBe('12px');
  });

  test('when the organisation cannot be read, the menu does not claim «няма достъп»', async ({
    page,
  }) => {
    await page.route('**/v1/tenant', (route) => route.fulfill({ status: 500, json: {} }));
    await openSignedIn(page, ORG_ADMIN, '/');
    const menu = await openMenu(page);
    // A skeleton while the query retries (three times, with backoff), then the error.
    await expect(menu.getByText('Достъпът не можа да се зареди.')).toBeVisible({
      timeout: 15_000,
    });
    await expect(menu.getByText('Служители, роли и настройки на организацията')).toHaveCount(0);
    await expect(menu.getByText(/няма достъп/)).toHaveCount(0);
  });

  test('choosing another organisation switches the requests, the role and the caption', async ({
    page,
  }) => {
    const asked: (string | null)[] = [];
    await page.route('**/v1/tenant', async (route) => {
      const id = route.request().headers()['x-tenant-id'] ?? null;
      asked.push(id);
      if (id !== SECOND) return route.fallback();
      await route.fulfill({
        json: {
          tenant: { id: SECOND, key: 'second', name: 'Втора', status: 'active' },
          role: 'manager',
          permissions: ['tenant.read', 'staff.read'],
        },
      });
    });
    await openSignedIn(page, ORG_ADMIN, '/');
    await addSecondOrganisation(page);
    const menu = await openMenu(page);
    await menu.getByRole('radio', { name: 'Втора' }).click();

    await expect(page.getByRole('button', { name: /, акаунт$/ })).toContainText(
      'Домоуправител · Втора',
    );
    await expect(menu.getByRole('list', { name: 'Вашите роли' })).toHaveText('Домоуправител');
    expect(asked).toContain(SECOND);
    expect(await page.evaluate(() => localStorage.getItem('inova.tenantId'))).toBe(SECOND);
  });

  test('a custom role is named by /tenant, without asking for the roles list', async ({ page }) => {
    // WHI-101: the role's own name comes with the context, so a role without
    // roles.read is named too, and the menu never needs the roles list.
    let rolesAsked = 0;
    await page.route('**/v1/tenant', async (route) => {
      const response = await route.fetch();
      const body = await response.json();
      await route.fulfill({
        response,
        json: { ...body, role: 'cashier', roleName: 'Касиер', permissions: ['tenant.read'] },
      });
    });
    await page.route('**/v1/tenant/roles', async (route) => {
      rolesAsked += 1;
      await route.fallback();
    });
    await openSignedIn(page, ORG_ADMIN, '/');
    await expect(page.getByRole('button', { name: /, акаунт$/ })).toContainText('Касиер');
    const menu = await openMenu(page);
    await expect(menu.getByRole('list', { name: 'Вашите роли' })).toHaveText('Касиер');
    expect(rolesAsked).toBe(0);
  });

  test('a platform administrator inside an organisation sees it, with its audit trail', async ({
    page,
  }) => {
    await openSignedIn(page, PLATFORM_ADMIN, '/tenants');
    await page.getByRole('button', { name: /Влез/ }).first().click();
    await expect(page.getByRole('button', { name: 'Върни се в платформата' })).toBeVisible();
    const menu = await openMenu(page);
    await expect(menu.getByRole('heading', { name: 'Организация' })).toBeVisible();
    await expect(menu.getByRole('link', { name: 'Одитен дневник' })).toBeVisible();
    await expect(menu.getByRole('list', { name: 'Вашите роли' })).toHaveText(
      'Администратор на платформата',
    );
    await expect(page.getByText(/super_admin/)).toHaveCount(0);
  });
});

test.describe('402, a modal sheet', () => {
  test.use({ viewport: { width: 402, height: 874 } });

  test('focus stays in the sheet, the page under it does not scroll', async ({ page }) => {
    await openSignedIn(page, ORG_ADMIN, '/');
    const menu = await openMenu(page);
    const close = menu.getByRole('button', { name: 'Затвори' });
    await expect(close).toBeFocused();

    // Tab past «Изход» comes back into the sheet, never onto the page.
    for (let i = 0; i < 20; i += 1) {
      await page.keyboard.press('Tab');
      expect(await menu.evaluate((el) => el.contains(document.activeElement))).toBe(true);
    }

    await page.mouse.move(200, 60);
    await page.mouse.wheel(0, 600);
    await page.waitForTimeout(200);
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
  });

  test('Esc and the scrim close the sheet, the focus goes back to the avatar', async ({ page }) => {
    await openSignedIn(page, ORG_ADMIN, '/');
    const account = page.getByRole('button', { name: /, акаунт$/ });
    let menu = await openMenu(page);
    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();
    await expect(account).toBeFocused();

    menu = await openMenu(page);
    await page.mouse.click(200, 20);
    await expect(menu).toBeHidden();
    await expect(account).toBeFocused();
  });
});

/**
 * Crossing 768 with the menu open turns the sheet into the popover or back,
 * and re-mounts the avatar button. Closing must still hand the keyboard to
 * the avatar that is on screen, not to the one that was replaced.
 */
for (const [from, to] of [
  [402, 800],
  [800, 402],
] as const) {
  test(`opened at ${from}, closed at ${to}: the focus returns to the avatar`, async ({ page }) => {
    await page.setViewportSize({ width: from, height: 874 });
    await openSignedIn(page, ORG_ADMIN, '/');
    const menu = await openMenu(page);
    await page.setViewportSize({ width: to, height: 874 });
    await expect(menu).toBeVisible();
    await expect.poll(() => menu.evaluate((el) => el.contains(document.activeElement))).toBe(true);
    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();
    await expect(page.getByRole('button', { name: /, акаунт$/ })).toBeFocused();
  });
}
