import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  Outlet,
  RouterProvider,
  createRootRoute,
  createRoute,
  createRouter,
  redirect,
} from '@tanstack/react-router';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { getSession } from './lib/auth';
import { AppShell } from './pages/AppShell';
import { ComingSoonPage } from './pages/ComingSoon';
import { DashboardPage } from './pages/Dashboard';
import { LoginPage } from './pages/Login';
import { RolesPage } from './pages/Roles';
import { StaffPage } from './pages/Staff';
import { TenantsPage } from './pages/Tenants';
import './styles.css';

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
});

const buildingsRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: '/buildings',
  component: () => <ComingSoonPage title="Buildings" milestone="M2" />,
});

const residentsRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: '/residents',
  component: () => <ComingSoonPage title="Residents" milestone="M2" />,
});

const financeRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: '/finance',
  component: () => <ComingSoonPage title="Finance" milestone="M3–M4" />,
});

const issuesRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: '/issues',
  component: () => <ComingSoonPage title="Issues" milestone="M6" />,
});

const noticesRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: '/notices',
  component: () => <ComingSoonPage title="Notices" milestone="M7" />,
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
    buildingsRoute,
    residentsRoute,
    financeRoute,
    issuesRoute,
    noticesRoute,
    staffRoute,
    rolesRoute,
    tenantsRoute,
  ]),
]);

const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

const queryClient = new QueryClient();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
