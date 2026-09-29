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
