import { Link, Outlet, useRouterState } from '@tanstack/react-router';
import { motion } from 'framer-motion';
import {
  Banknote,
  Bell,
  Building2,
  Globe,
  LayoutDashboard,
  LogOut,
  Search,
  ShieldCheck,
  UserCog,
  Users,
  Wrench,
} from 'lucide-react';
import { SosedoMark, SosedoWordmark } from '../components/Logo';
import { TenantSwitcher } from '../components/TenantSwitcher';
import { clearSession, getSession } from '../lib/auth';
import { clearSelectedTenantId } from '../lib/tenant';

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/buildings', label: 'Buildings', icon: Building2 },
  { to: '/residents', label: 'Residents', icon: Users },
  { to: '/finance', label: 'Finance', icon: Banknote },
  { to: '/issues', label: 'Issues', icon: Wrench },
  { to: '/notices', label: 'Notices', icon: Bell },
  { to: '/staff', label: 'Staff', icon: UserCog },
  { to: '/roles', label: 'Roles', icon: ShieldCheck },
] as const;

const PLATFORM_NAV = [{ to: '/tenants', label: 'Tenants', icon: Globe }] as const;

export function AppShell() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const session = getSession();
  const nav = session?.user.platformRole === 'super_admin' ? [...NAV, ...PLATFORM_NAV] : [...NAV];

  return (
    <div className="flex min-h-full">
      {/* Sidebar */}
      <aside className="flex w-64 shrink-0 flex-col bg-navy p-5 text-white">
        <div className="mb-6 flex items-center gap-3 px-2">
          <SosedoMark size={40} />
          <SosedoWordmark size={16} />
        </div>

        <TenantSwitcher />

        <nav className="flex flex-1 flex-col gap-1.5">
          {nav.map(({ to, label, icon: Icon }) => {
            const active = pathname === to;
            return (
              <Link
                key={to}
                to={to}
                className={`relative flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition-colors ${
                  active ? 'text-white' : 'text-white/55 hover:bg-white/5 hover:text-white/85'
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="nav-pill"
                    className="absolute inset-0 rounded-xl bg-gradient-to-r from-brand-blue/90 to-brand-green/80"
                    transition={{ type: 'spring', damping: 26, stiffness: 300 }}
                  />
                )}
                <Icon size={18} className="relative" />
                <span className="relative">{label}</span>
              </Link>
            );
          })}
        </nav>

        <Link
          to="/login"
          onClick={() => {
            clearSession();
            clearSelectedTenantId();
          }}
          className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold text-white/55 transition-colors hover:bg-white/5 hover:text-white/85"
        >
          <LogOut size={18} />
          Sign out
        </Link>
      </aside>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-4 border-b border-navy/8 bg-white/70 px-8 py-4 backdrop-blur">
          <div className="flex w-full max-w-md items-center gap-3 rounded-full bg-mist px-4 py-2.5">
            <Search size={17} className="text-ink-secondary" />
            <input
              placeholder="Search buildings, residents, payments…"
              className="w-full bg-transparent text-sm font-medium outline-none placeholder:text-ink-secondary/60"
            />
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-sm font-bold">{session?.user.fullName ?? 'Signed out'}</p>
              <p className="text-xs text-ink-secondary">
                {session?.user.platformRole ??
                  session?.memberships[0]?.tenantName ??
                  'no membership'}
              </p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-brand-blue to-brand-green font-bold text-white">
              {(session?.user.fullName ?? 'S').slice(0, 1).toUpperCase()}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-8">
          <motion.div
            key={pathname}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <Outlet />
          </motion.div>
        </main>
      </div>
    </div>
  );
}
