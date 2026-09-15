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
import { InovaMark, InovaWordmark } from '../components/Logo';
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
    <div className="flex min-h-full flex-col bg-foam lg:flex-row">
      {/* Sidebar */}
      <aside className="relative flex shrink-0 flex-col overflow-hidden bg-gold-black p-4 text-white shadow-2xl shadow-gold-black/20 lg:min-h-screen lg:w-64 lg:p-5">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-28 -left-24 h-64 w-64 rounded-full bg-orange/18 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute right-0 bottom-20 h-44 w-44 translate-x-1/2 rounded-full bg-landmark/20 blur-3xl"
        />
        <div className="relative mb-4 flex items-center justify-between gap-3 px-1 lg:mb-7 lg:justify-start lg:px-2">
          <div className="flex items-center gap-3">
            <InovaMark size={40} />
            <InovaWordmark size={16} />
          </div>
          <Link
            to="/login"
            onClick={() => {
              clearSession();
              clearSelectedTenantId();
            }}
            className="rounded-xl p-2.5 text-white/60 transition-colors hover:bg-white/7 hover:text-white lg:hidden"
            aria-label="Sign out"
          >
            <LogOut size={18} />
          </Link>
        </div>

        <div className="relative">
          <TenantSwitcher />
        </div>

        <nav className="relative -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 lg:mx-0 lg:flex-1 lg:flex-col lg:overflow-visible lg:px-0 lg:pb-0">
          {nav.map(({ to, label, icon: Icon }) => {
            const active = pathname === to;
            return (
              <Link
                key={to}
                to={to}
                className={`relative flex shrink-0 items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition-colors lg:gap-3 lg:px-4 lg:py-3 ${
                  active ? 'text-white' : 'text-white/55 hover:bg-white/7 hover:text-white/90'
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="nav-pill"
                    className="absolute inset-0 rounded-xl bg-gradient-to-r from-orange-bright to-orange shadow-lg shadow-orange/20"
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
          className="relative hidden items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold text-white/55 transition-colors hover:bg-white/7 hover:text-white/90 lg:flex"
        >
          <LogOut size={18} />
          Sign out
        </Link>
      </aside>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center justify-between gap-4 border-b border-sand/80 bg-cream/80 px-4 py-3 backdrop-blur-xl sm:px-6 lg:px-8 lg:py-4">
          <div className="hidden w-full max-w-md items-center gap-3 rounded-full border border-sand/80 bg-white/70 px-4 py-2.5 shadow-sm sm:flex">
            <Search size={17} className="text-landmark" />
            <input
              placeholder="Search buildings, residents, payments…"
              className="w-full bg-transparent text-sm font-medium outline-none placeholder:text-stone"
            />
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-sm font-bold">{session?.user.fullName ?? 'Signed out'}</p>
              <p className="text-xs text-landmark">
                {session?.user.platformRole ??
                  session?.memberships[0]?.tenantName ??
                  'no membership'}
              </p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-[35%] bg-gradient-to-br from-orange-bright to-orange font-bold text-white shadow-md shadow-orange/20">
              {(session?.user.fullName ?? 'S').slice(0, 1).toUpperCase()}
            </div>
          </div>
        </header>

        <main className="relative flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
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
