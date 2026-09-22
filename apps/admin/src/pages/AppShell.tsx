import { Link, Outlet, useNavigate, useRouterState } from '@tanstack/react-router';
import { motion } from 'framer-motion';
import {
  Bell,
  Building2,
  Check,
  ChevronDown,
  CircleAlert,
  CircleCheck,
  Globe,
  LayoutGrid,
  Lock,
  LogOut,
  Menu,
  Monitor,
  Moon,
  Search,
  Shield,
  Sun,
  UserCog,
  Users,
  Wallet,
  X,
} from '../components/icons';
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AppBackground } from '../components/AppBackground';
import { InovaWordmark } from '../components/Logo';
import { Avatar, MenuItem, Popover } from '../components/ui';
import { api, type TenantContext } from '../lib/api';
import { clearSession, getSession } from '../lib/auth';
import { setTheme, useThemeChoice, type ThemeChoice } from '../lib/theme';
import {
  clearSelectedTenantId,
  setSelectedTenantId,
  useSelectedTenantId,
  useTenantOptions,
} from '../lib/tenant';

/**
 * Order confirmed by the stakeholder on 2026-09-22. "Задачи" comes before
 * "Известия"; the section behind it is M11 and does not exist yet, so the item
 * leads to the placeholder rather than being hidden.
 */
const NAV = [
  { to: '/', label: 'Табло', icon: LayoutGrid },
  { to: '/tasks', label: 'Задачи', icon: CircleCheck },
  { to: '/notices', label: 'Известия', icon: Bell },
  { to: '/buildings', label: 'Сгради', icon: Building2 },
  { to: '/residents', label: 'Жители', icon: Users },
  { to: '/finance', label: 'Финанси', icon: Wallet },
  { to: '/issues', label: 'Нередности', icon: CircleAlert },
  { to: '/staff', label: 'Служители', icon: UserCog },
  { to: '/roles', label: 'Роли', icon: Shield },
] as const;

/**
 * The platform scope has a rail of its own — it is not the tenant rail with an
 * extra item. «Общ преглед» and «Одитен дневник» have no screens before P1, so
 * both lead to the placeholder.
 */
const PLATFORM_NAV = [
  { to: '/platform', label: 'Общ преглед', icon: Globe },
  { to: '/tenants', label: 'Организации', icon: Building2 },
  { to: '/audit', label: 'Одитен дневник', icon: Shield },
] as const;


export function AppShell() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const session = getSession();
  const [navOpen, setNavOpen] = useState(false);
  const platform = usePlatformScope();
  const nav = platform ? [...PLATFORM_NAV] : [...NAV];

  // A tap on a nav item should not leave the mobile drawer standing open.
  useEffect(() => setNavOpen(false), [pathname]);

  return (
    <>
      <AppBackground />
      <div className="app-content mx-auto flex min-h-full max-w-[1392px] gap-6 px-4 py-4 lg:px-0 lg:py-16">
        <Rail nav={nav} pathname={pathname} session={session} platform={platform} />

        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <Topbar onOpenNav={() => setNavOpen(true)} session={session} />
          {!platform && <PlatformVisitNote session={session} />}
          <motion.main
            key={pathname}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="min-w-0 flex-1"
          >
            <Outlet />
          </motion.main>
        </div>
      </div>

      <MobileNav
        open={navOpen}
        onClose={() => setNavOpen(false)}
        nav={nav}
        pathname={pathname}
        session={session}
        platform={platform}
      />
    </>
  );
}

/**
 * A super_admin is in the platform scope until they enter an organization, and
 * back in it the moment they leave — «Върни се в платформата» clears the
 * selection. Everyone else is always in a tenant.
 */
function usePlatformScope(): boolean {
  const session = getSession();
  const tenantId = useSelectedTenantId();
  return session?.user.platformRole === 'super_admin' && !tenantId;
}

/**
 * A platform administrator inside a tenant is a visitor, and core-api writes
 * every write they make to that tenant's audit trail
 * (`AuditService.record`, actorType 'platform'). The banner says so, and
 * carries the way back out.
 */
function PlatformVisitNote({ session }: { session: Session }) {
  const navigate = useNavigate();
  const tenantId = useSelectedTenantId();
  const context = useQuery({
    queryKey: ['tenant', tenantId],
    queryFn: () => api<TenantContext>('/tenant', { tenantId: tenantId! }),
    enabled: Boolean(tenantId),
    staleTime: 60_000,
  });

  if (session?.user.platformRole !== 'super_admin') return null;

  const name = context.data?.tenant.name ?? 'организацията';
  return (
    <div className="glass flex flex-wrap items-center gap-x-4 gap-y-3 px-5 py-3.5">
      <Lock size={17} className="shrink-0 text-ink-muted" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">Платформа → {name}</p>
        <p className="text-xs text-ink-muted">
          Влязохте в организацията от платформен обхват. Всяко действие тук се записва в одитния ѝ
          дневник.
        </p>
      </div>
      <button
        type="button"
        onClick={() => {
          clearSelectedTenantId();
          void navigate({ to: '/tenants' });
        }}
        className="glass-solid shrink-0 rounded-full px-4 py-2 text-sm font-medium"
      >
        Върни се в платформата
      </button>
    </div>
  );
}

type NavItems = readonly { to: string; label: string; icon: typeof Bell }[];
type Session = ReturnType<typeof getSession>;

function NavList({ nav, pathname }: { nav: NavItems; pathname: string }) {
  return (
    <nav className="flex flex-col gap-1">
      {nav.map(({ to, label, icon: Icon }) => {
        const active = to === '/' ? pathname === '/' : pathname.startsWith(to);
        return (
          <Link
            key={to}
            to={to}
            className={`relative flex items-center gap-3 rounded-2xl px-3.5 py-2.5 text-sm transition-colors ${
              active ? 'font-semibold text-ink' : 'font-medium text-ink-muted hover:text-ink'
            }`}
          >
            {active && (
              <motion.span
                layoutId="nav-pill"
                className="absolute inset-0 rounded-2xl"
                style={{
                  background: 'var(--glass-inner)',
                  boxShadow: 'inset 0 0 0 1px var(--glass-edge-soft)',
                }}
                transition={{ type: 'spring', damping: 30, stiffness: 340 }}
              />
            )}
            <Icon size={18} className="relative shrink-0 opacity-90" />
            <span className="relative truncate">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function AccountBlock({ session }: { session: Session }) {
  const platform = usePlatformScope();
  const name = session?.user.fullName ?? '—';
  return (
    <div className="flex items-center gap-3 px-1.5">
      <Avatar name={name} size={40} />
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold">{name}</span>
        <span className="block truncate text-xs text-ink-muted">{roleLabel(session, platform)}</span>
      </span>
    </div>
  );
}

/** The badge that tells a platform administrator which scope the rail is. */
function PlatformBadge() {
  return (
    <div className="px-1.5 pb-5">
      <span
        className="inline-flex rounded-md px-2 py-1 text-[10px] font-semibold tracking-[0.14em] uppercase"
        style={{ background: 'var(--badge-fill)', color: 'var(--badge-text)' }}
      >
        Платформа
      </span>
      <p className="mt-1.5 text-xs text-ink-faint">всички организации</p>
    </div>
  );
}

function Rail({
  nav,
  pathname,
  session,
  platform,
}: {
  nav: NavItems;
  pathname: string;
  session: Session;
  platform: boolean;
}) {
  return (
    <aside className="glass hidden w-58 shrink-0 flex-col p-5 lg:flex">
      <div className={`px-1.5 pt-1 text-ink ${platform ? 'pb-4' : 'pb-6'}`}>
        <InovaWordmark size={22} />
      </div>
      {platform && <PlatformBadge />}
      <NavList nav={nav} pathname={pathname} />
      <div className="flex-1" />
      <div className="mt-6 border-t border-glass-divider pt-4">
        <AccountBlock session={session} />
      </div>
    </aside>
  );
}

function MobileNav({
  open,
  onClose,
  nav,
  pathname,
  session,
  platform,
}: {
  open: boolean;
  onClose: () => void;
  nav: NavItems;
  pathname: string;
  session: Session;
  platform: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 lg:hidden" style={{ background: 'rgb(0 0 0 / 0.45)' }}>
      <div className="absolute inset-0" onClick={onClose} />
      <motion.aside
        initial={{ x: -40, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ type: 'spring', damping: 30, stiffness: 320 }}
        className="glass absolute top-3 bottom-3 left-3 flex w-64 flex-col p-5"
      >
        <div className="flex items-start justify-between pb-6">
          <span className="px-1.5 pt-1 text-ink">
            <InovaWordmark size={22} />
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Затвори менюто"
            className="rounded-full p-1.5 text-ink-muted hover:text-ink"
          >
            <X size={18} />
          </button>
        </div>
        {platform && <PlatformBadge />}
        <NavList nav={nav} pathname={pathname} />
        <div className="flex-1" />
        <div className="mt-6 border-t border-glass-divider pt-4">
          <AccountBlock session={session} />
        </div>
      </motion.aside>
    </div>
  );
}

function Topbar({ onOpenNav, session }: { onOpenNav: () => void; session: Session }) {
  return (
    <header className="flex items-center gap-3">
      <button
        type="button"
        onClick={onOpenNav}
        aria-label="Отвори менюто"
        className="glass-control flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink lg:hidden"
      >
        <Menu size={18} />
      </button>

      {/* TODO(M2b): unified search over buildings, apartments and residents. */}
      <label className="glass-control flex h-12 min-w-0 flex-1 items-center gap-3 rounded-full px-5 sm:max-w-xl">
        <Search size={17} className="shrink-0 text-ink-faint" />
        <input
          type="search"
          disabled
          placeholder="Търсене — сграда, апартамент, жител"
          aria-label="Общо търсене"
          className="w-full bg-transparent text-sm font-medium text-ink outline-none placeholder:text-ink-faint disabled:cursor-not-allowed"
        />
      </label>

      <div className="ml-auto flex shrink-0 items-center gap-2">
        {/* TODO(M7): unread notice count; the mock-up shows a badge, the API has no counter yet. */}
        <Link
          to="/notices"
          aria-label="Известия"
          className="glass-control flex h-11 w-11 items-center justify-center rounded-full text-ink"
        >
          <Bell size={18} />
        </Link>
        <AccountMenu session={session} />
      </div>
    </header>
  );
}

function roleLabel(session: Session, platform: boolean): string {
  if (session?.user.platformRole === 'super_admin') {
    return platform ? 'super_admin · платформа' : 'super_admin · в организация';
  }
  const membership = session?.memberships[0];
  if (!membership) return '—';
  return `${ROLE_NAMES[membership.r] ?? membership.r} · ${membership.tenantKey}`;
}

/** Display names for the seeded role keys; custom roles fall back to the key. */
const ROLE_NAMES: Record<string, string> = {
  admin: 'Администратор',
  manager: 'Домоуправител',
  accountant: 'Счетоводител',
  resident: 'Жител',
};

function AccountMenu({ session }: { session: Session }) {
  const [open, setOpen] = useState(false);
  const themeChoice = useThemeChoice();
  const platform = usePlatformScope();
  const selectedTenantId = useSelectedTenantId();
  const { options } = useTenantOptions();
  const name = session?.user.fullName ?? '—';

  const signOut = () => {
    clearSession();
    clearSelectedTenantId();
    window.location.assign('/login');
  };

  return (
    <Popover
      open={open}
      onClose={() => setOpen(false)}
      align="right"
      anchor={
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="glass-control flex h-11 items-center gap-2.5 rounded-full py-1 pr-3 pl-1.5 text-left text-ink"
        >
          <Avatar name={name} size={34} />
          <span className="hidden min-w-0 sm:block">
            <span className="block truncate text-sm font-semibold">{name}</span>
            <span className="block truncate text-xs text-ink-muted">{roleLabel(session, platform)}</span>
          </span>
          <ChevronDown size={14} className="shrink-0 opacity-70" />
        </button>
      }
    >
      <div role="menu" className="w-64">
        {options.length > 1 && (
          <>
            <p className="px-3 pt-1.5 pb-1 text-xs font-semibold tracking-wider text-panel-ink-faint uppercase">
              Организация
            </p>
            {options.map((option) => (
              <MenuItem
                key={option.id}
                icon={<Building2 size={15} />}
                onClick={() => {
                  setSelectedTenantId(option.id);
                  setOpen(false);
                }}
                trailing={
                  option.id === selectedTenantId ? (
                    <Check size={14} className="opacity-70" />
                  ) : undefined
                }
              >
                {option.name}
              </MenuItem>
            ))}
            <hr className="my-1.5 border-panel-divider" />
          </>
        )}

        <p className="px-3 pt-1.5 pb-1 text-xs font-semibold tracking-wider text-panel-ink-faint uppercase">
          Изглед
        </p>
        {(
          [
            { value: 'light', label: 'Светъл', icon: Sun },
            { value: 'dark', label: 'Тъмен', icon: Moon },
            { value: 'system', label: 'Както в системата', icon: Monitor },
          ] as { value: ThemeChoice; label: string; icon: typeof Sun }[]
        ).map(({ value, label, icon: Icon }) => (
          <MenuItem
            key={value}
            icon={<Icon size={15} />}
            onClick={() => setTheme(value)}
            trailing={
              value === themeChoice ? <Check size={14} className="opacity-70" /> : undefined
            }
          >
            {label}
          </MenuItem>
        ))}

        <hr className="my-1.5 border-panel-divider" />
        <MenuItem icon={<LogOut size={15} />} onClick={signOut}>
          Изход
        </MenuItem>
      </div>
    </Popover>
  );
}
