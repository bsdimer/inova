/**
 * The admin portal's pages and who may open them. Every page but /login sits
 * behind the session check in the shell route; the guards redirect before
 * anything renders.
 */
import {
  Outlet,
  createRootRoute,
  createRoute,
  createRouter,
  redirect,
} from '@tanstack/react-router';
import { getSession } from './lib/auth';
import { getSelectedTenantId } from './lib/tenant';
import { AppShell } from './pages/AppShell';
import { ComingSoonPage } from './pages/ComingSoon';
import { DashboardPage } from './pages/Dashboard';
import { LoginPage } from './pages/Login';
import { RolesPage } from './pages/Roles';
import { StaffPage } from './pages/Staff';
import { TenantsPage } from './pages/Tenants';

const rootRoute = createRootRoute({
  component: Outlet,
});

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  component: LoginPage,
});

const shellRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'shell',
  component: AppShell,
  beforeLoad: () => {
    if (!getSession()) {
      throw redirect({ to: '/login' });
    }
  },
});

const dashboardRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: '/',
  component: DashboardPage,
  // A platform administrator who has not entered an organization has no
  // dashboard to show: every query on it is tenant-scoped.
  beforeLoad: () => {
    const session = getSession();
    if (session?.user.platformRole === 'super_admin' && !getSelectedTenantId()) {
      throw redirect({ to: '/tenants' });
    }
  },
});

const tasksRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: '/tasks',
  // The section arrives with M11; the placeholder does not name it.
  component: () => <ComingSoonPage title="Задачи" />,
});

const buildingsRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: '/buildings',
  // The section arrives with M2; the placeholder does not name it.
  component: () => <ComingSoonPage title="Сгради" />,
});

const residentsRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: '/residents',
  // The section arrives with M2; the placeholder does not name it.
  component: () => <ComingSoonPage title="Жители" />,
});

const financeRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: '/finance',
  // The section arrives with M3–M4; the placeholder does not name it.
  component: () => <ComingSoonPage title="Финанси" />,
});

const issuesRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: '/issues',
  // The section arrives with M6; the placeholder does not name it.
  component: () => <ComingSoonPage title="Сигнали" />,
});

const noticesRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: '/notices',
  // The section arrives with M7; the placeholder does not name it.
  component: () => <ComingSoonPage title="Известия" />,
});

const staffRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: '/staff',
  component: StaffPage,
});

const rolesRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: '/roles',
  component: RolesPage,
});

const platformOverviewRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: '/platform',
  // The section arrives with P1; the placeholder does not name it.
  component: () => <ComingSoonPage title="Общ преглед" />,
  beforeLoad: () => {
    if (getSession()?.user.platformRole !== 'super_admin') {
      throw redirect({ to: '/' });
    }
  },
});

const auditRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: '/audit',
  // Both scopes: the platform sees every organisation, an organisation's
  // administrator their own, entered from the account menu (WHI-82).
  // TODO(M1): the placeholder checks nothing; the WHI-82 screen must answer a
  // missing audit.read itself, as Служители and Роли do. No data is here yet.
  // The section arrives with P1; the placeholder does not name it.
  component: () => <ComingSoonPage title="Одитен дневник" />,
});

const tenantsRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: '/tenants',
  component: TenantsPage,
  beforeLoad: () => {
    if (getSession()?.user.platformRole !== 'super_admin') {
      throw redirect({ to: '/' });
    }
  },
});

const routeTree = rootRoute.addChildren([
  loginRoute,
  shellRoute.addChildren([
    dashboardRoute,
    tasksRoute,
    buildingsRoute,
    residentsRoute,
    financeRoute,
    issuesRoute,
    noticesRoute,
    staffRoute,
    rolesRoute,
    platformOverviewRoute,
    auditRoute,
    tenantsRoute,
  ]),
]);

export const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
