import { Link, Outlet, useNavigate, useRouterState } from '@tanstack/react-router';
import { AnimatePresence, animate, motion, useMotionValue } from 'framer-motion';
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
  Monitor,
  Moon,
  Search,
  Shield,
  ShieldCheck,
  Sun,
  UserCog,
  Users,
  Wallet,
  X,
} from '../components/icons';
import {
  useEffect,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
  type RefObject,
} from 'react';
import { useQuery } from '@tanstack/react-query';
import { AppBackground } from '../components/AppBackground';
import { InovaWordmark } from '../components/Logo';
import { Avatar, MenuItem, Popover } from '../components/ui';
import { api, type TenantContext } from '../lib/api';
import { clearSession, getSession } from '../lib/auth';
import { designFixtureOn } from '../lib/designFixture';
import { type NavMode, useNavMode } from '../lib/navMode';
import { useUnreadCount } from '../lib/notices';
import { rem } from '../lib/rem';
import { setTheme, useThemeChoice, type ThemeChoice } from '../lib/theme';
import {
  clearSelectedTenantId,
  setSelectedTenantId,
  useSelectedTenantId,
  useTenantOptions,
} from '../lib/tenant';

/**
 * Order as drawn in V2/Sidebar (859:1466), settled after 22.09 in WHI-24:
 * «Финанси» moved up to fourth, and «Нередности» became «Сигнали» everywhere.
 * Sections that do not exist yet lead to the placeholder rather than hiding.
 */
const NAV = [
  { to: '/', label: 'Табло', icon: LayoutGrid },
  { to: '/tasks', label: 'Задачи', icon: CircleCheck },
  { to: '/notices', label: 'Известия', icon: Bell },
  { to: '/finance', label: 'Финанси', icon: Wallet },
  { to: '/buildings', label: 'Сгради', icon: Building2 },
  { to: '/residents', label: 'Жители', icon: Users },
  { to: '/issues', label: 'Сигнали', icon: CircleAlert },
  { to: '/staff', label: 'Служители', icon: UserCog },
  { to: '/roles', label: 'Роли', icon: ShieldCheck },
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
  const platform = usePlatformScope();
  const nav = platform ? [...PLATFORM_NAV] : [...NAV];
  const mode = useNavMode();

  // The menu over the page — the modal sidebar or the drawer. A tap on an item
  // or a change of width must not leave it standing open.
  const [overlay, setOverlay] = useState(false);
  useEffect(() => setOverlay(false), [pathname, mode]);

  // The rail opened in place (1536–1727): only a click opens it — on its
  // empty space, where the col-resize cursor says it widens, or on its brand.
  // A second click there, the wordmark, Esc or a click outside closes it.
  // Hover does nothing: the page would shift under a passing pointer.
  const [railOpen, setRailOpen] = useState(false);
  const pushRail = useRef<HTMLElement>(null);
  useEffect(() => setRailOpen(false), [mode]);
  useEffect(() => {
    if (!railOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setRailOpen(false);
    const onDown = (e: PointerEvent) => {
      if (!pushRail.current?.contains(e.target as Node)) setRailOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onDown);
    };
  }, [railOpen]);
  const pushed = mode === 'push' && railOpen;
  // Anything that is not an item or a button is the rail's empty space.
  const toggleRail = (e: MouseEvent) => {
    if ((e.target as Element).closest('a, button')) return;
    setRailOpen((open) => !open);
  };

  const menuButton = useRef<HTMLButtonElement>(null);
  const shared = { nav, pathname, session, platform };

  return (
    <>
      <AppBackground />
      {/*
        The page's margins, per 1074:9754 and the design README (Адаптив):
        16 on a phone, 24 on a tablet; from 1024 the column is centred — the
        72 rail + 24 + 1136 from 1280 (24 aside at 1280, 152 at 1536), the
        232 sidebar + 24 + 1136 from 1728. Above and below: 24 when the page
        does not fit the window, up to 64 when it does, the page centred in
        between (the dashboard is 989 tall from 1280, 1239 at 1024–1279);
        16 in a window the dashboard fits only compressed (`tight`). All in
        rem, so from 2400, where the root is 20px, the same rule draws the
        2560 × 1340 frame: 52 above and below. The rail opened in place keeps
        its left edge and pushes the page until the right margin is 24.
      */}
      <div
        className={`app-content flex min-h-full gap-6 px-4 py-[var(--pad-y)] [--pad-y:1rem] md:px-6 md:[--pad-y:1.5rem] lg:[--pad-y:clamp(1.5rem,calc((100dvh-77.4375rem)/2),4rem)] xl:mx-auto xl:max-w-[77rem] xl:px-0 xl:[--pad-y:clamp(1.5rem,calc((100dvh-61.8125rem)/2),4rem)] 3xl:max-w-[87rem] tight:[--pad-y:1rem] ${
          pushed ? 'xl:mr-6 xl:ml-[calc((100%-77rem)/2)] xl:max-w-none' : ''
        }`}
      >
        {mode === 'full' && (
          <aside className={`${stickyBox} w-58 p-[1.3125rem]`}>
            <SidebarBody {...shared} brand={<Brand />} />
          </aside>
        )}

        {mode === 'push' && (
          // Over its empty space the cursor is col-resize, the sign that the
          // rail widens; over the icons and items it stays a pointer.
          <aside
            ref={pushRail}
            onClick={toggleRail}
            className={`${stickyBox} z-20 cursor-col-resize ${
              pushed ? 'w-58 p-[1.3125rem]' : 'w-[4.5rem] items-center py-[0.8125rem]'
            }`}
          >
            {pushed ? (
              <SidebarBody
                {...shared}
                brand={<Brand label="Свий менюто" onClick={() => setRailOpen(false)} />}
              />
            ) : (
              <RailBody
                {...shared}
                onBrand={() => setRailOpen(true)}
                expanded={false}
                brandLabel="Отвори менюто"
              />
            )}
          </aside>
        )}

        {mode === 'modal' && (
          <ModalRail
            {...shared}
            open={overlay}
            onOpen={() => setOverlay(true)}
            onClose={() => setOverlay(false)}
          />
        )}

        <div className="flex min-w-0 flex-1 flex-col gap-3 md:gap-4 xl:max-w-[71rem]">
          <Topbar
            mode={mode}
            menuButton={menuButton}
            menuOpen={overlay}
            onOpenNav={() => setOverlay(true)}
            session={session}
          />
          {mode === 'drawer' && <GlobalSearch className="md:hidden" />}
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

      {/* Literal guard, folded at build time — see lib/designFixture.ts. */}
      {(import.meta.env.DEV || import.meta.env.VITE_DESIGN_FIXTURES === '1') && designFixtureOn && (
        <DesignDataNote />
      )}

      {mode === 'drawer' && (
        <Drawer
          {...shared}
          open={overlay}
          onClose={() => setOverlay(false)}
          returnFocus={menuButton}
        />
      )}
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
      <Lock size="1.0625rem" className="shrink-0 text-ink-muted" />
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
type Shared = { nav: NavItems; pathname: string; session: Session; platform: boolean };

const isActive = (to: string, pathname: string) =>
  to === '/' ? pathname === '/' : pathname.startsWith(to);

function NavList({ nav, pathname }: { nav: NavItems; pathname: string }) {
  const unread = useUnreadCount();
  return (
    <nav className="flex flex-col gap-1">
      {nav.map(({ to, label, icon: Icon }) => {
        const active = isActive(to, pathname);
        return (
          <Link
            key={to}
            to={to}
            data-active={active || undefined}
            // The active item's 1 px edge is a real border in Figma, so it stands
            // 46 tall where the others are 44 (11 + 22 + 11). The others are
            // rounded 14, the active one 16.
            className={`nav-item relative flex items-center gap-3 px-3.5 text-body-14 ${
              active
                ? 'rounded-[var(--radius-nav)] py-3 font-semibold text-ink [--nav-radius:1rem]'
                : 'rounded-[var(--radius-signal)] py-[0.6875rem] font-medium text-ink-soft'
            }`}
          >
            {active && (
              // V2/NavItem Active=true: glass/inner with the full edge and a soft top light.
              <motion.span
                layoutId="nav-pill"
                className="nav-active absolute inset-0 rounded-[var(--radius-nav)]"
                transition={{ type: 'spring', damping: 30, stiffness: 340 }}
              />
            )}
            <Icon size="1.375rem" className="relative shrink-0" />
            <span className="relative flex-1 truncate">{label}</span>
            {to === '/notices' && unread ? (
              // V2/Badge (846:244): the unread count on Известия.
              <span className="num text-label-12 relative rounded-full bg-[var(--badge-fill)] px-[0.4375rem] py-0.5 font-semibold text-[color:var(--badge-text)]">
                {unread}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}

/** The sidebar's foot: a 100 px rule, then who is signed in. */
function SidebarFooter({ session }: { session: Session }) {
  const platform = usePlatformScope();
  const name = session?.user.fullName ?? '—';
  return (
    <>
      <hr className="w-25 border-glass-divider" />
      <div className="flex items-center gap-3 pt-2 pl-1.5">
        <Avatar name={name} size={40} className="glass-blur" />
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="truncate text-body-14 font-semibold">{name}</span>
          {/* The sidebar names the role alone; the top bar adds the organization. */}
          <span className="truncate text-body-13-tight text-ink-muted">
            {roleLabel(session, platform).split(' · ')[0]}
          </span>
        </span>
      </div>
    </>
  );
}

/** The badge that tells a platform administrator which scope the rail is. */
function PlatformBadge() {
  return (
    <div className="px-1.5 pb-5">
      <span
        className="inline-flex rounded-[0.625rem] px-2.5 py-[0.3125rem] text-[0.6875rem] font-semibold tracking-[0.05rem] text-ink-soft uppercase"
        style={{
          background: 'var(--glass-chip)',
          boxShadow: 'inset 0 0 0 0.0625rem var(--glass-edge-soft)',
        }}
      >
        Платформа
      </span>
      <p className="mt-1.5 text-xs text-ink-faint">всички организации</p>
    </div>
  );
}

/**
 * The wordmark at the head of the sidebar. Where the sidebar is the rail
 * opened up, the wordmark is also what folds it back.
 */
function Brand({ label, onClick }: { label?: string; onClick?: () => void }) {
  const mark = <InovaWordmark size={22} />;
  return onClick ? (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="self-start rounded-[var(--radius-row)] pt-2 pb-3 pl-2 text-left text-ink"
    >
      {mark}
    </button>
  ) : (
    <div className="pt-2 pb-3 pl-2 text-ink">{mark}</div>
  );
}

/** V2/Sidebar (850:260): the wordmark, the items, then who is signed in. */
function SidebarBody({ nav, pathname, session, platform, brand }: Shared & { brand: ReactNode }) {
  return (
    <>
      {brand}
      {platform && <PlatformBadge />}
      <NavList nav={nav} pathname={pathname} />
      <div className="flex-1" />
      <SidebarFooter session={session} />
    </>
  );
}

/**
 * V2/Rail (850:305): the brand disc, one 48 cell per item 4 apart (V2/Rail
 * item, 1784:39362), and the account at the foot. Each icon names itself in a
 * V2/Tooltip · panel on hover and on keyboard focus.
 */
function RailBody({
  nav,
  pathname,
  session,
  onBrand,
  expanded,
  brandLabel,
}: Shared & { onBrand: () => void; expanded: boolean; brandLabel: string }) {
  const unread = useUnreadCount();
  return (
    <>
      <div className="pt-1 pb-3">
        <button
          type="button"
          onClick={onBrand}
          aria-label={brandLabel}
          aria-expanded={expanded}
          className="text-title-22 flex h-10 w-10 items-center justify-center rounded-full font-medium text-ink"
          style={{
            background: 'var(--glass-inner)',
            boxShadow: 'inset 0 0 0 0.0625rem var(--glass-edge)',
          }}
        >
          i
        </button>
      </div>
      <nav className="flex flex-col gap-1">
        {nav.map(({ to, label, icon: Icon }) => {
          const active = isActive(to, pathname);
          const badge = to === '/notices' && unread ? unread : 0;
          return (
            <Link
              key={to}
              to={to}
              data-active={active || undefined}
              aria-label={badge ? `${label}, ${badge} непрочетени` : label}
              className={`nav-item relative flex h-12 w-12 cursor-pointer items-center justify-center text-ink ${
                active ? 'nav-active rounded-[1rem] [--nav-radius:1rem]' : 'rounded-[0.875rem]'
              }`}
            >
              <Icon size="1.375rem" />
              {badge ? (
                // In the rail the count becomes a lit dot on the bell (Rail item «Точка»).
                <span
                  aria-hidden
                  className="absolute top-[0.5625rem] left-[1.875rem] h-2 w-2 rounded-full"
                  style={{
                    background: 'var(--light-source)',
                    boxShadow: '0 0 0.375rem 0.0625rem var(--glow-dot-near)',
                  }}
                />
              ) : null}
              <span aria-hidden className="rail-tip text-body-13 font-medium">
                {badge ? `${label} · ${badge}` : label}
              </span>
            </Link>
          );
        })}
      </nav>
      <div className="flex-1" />
      <hr className="w-8 border-glass-divider" />
      <div className="px-1 pt-1">
        <Avatar name={session?.user.fullName ?? '—'} size={40} className="glass-blur" />
      </div>
    </>
  );
}

/** The sidebar and the rail stand still while the page scrolls, as tall as the window less its margins. */
const stickyBox =
  'glass sticky top-[var(--pad-y)] flex h-[calc(100dvh-2*var(--pad-y))] shrink-0 flex-col gap-2 self-start';

const railBox = `${stickyBox} z-20 w-[4.5rem] items-center py-[0.8125rem]`;

/**
 * 1024–1535: no room to push the page (827:1572), so the brand disc opens the
 * sidebar over it — on the rail's place, the page under a scrim and inert.
 * A tap outside, Esc, or the wordmark again closes it.
 */
function ModalRail({
  open,
  onOpen,
  onClose,
  ...shared
}: Shared & { open: boolean; onOpen: () => void; onClose: () => void }) {
  const rail = useRef<HTMLElement>(null);
  const [box, setBox] = useState<DOMRect | null>(null);

  useEffect(() => {
    if (!open) return;
    setBox(rail.current?.getBoundingClientRect() ?? null);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <>
      <aside ref={rail} className={railBox}>
        <RailBody {...shared} onBrand={onOpen} expanded={open} brandLabel="Отвори менюто" />
      </aside>
      <AnimatePresence>
        {open && box && (
          <div className="fixed inset-0 z-50">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              onClick={onClose}
              className="absolute inset-0 bg-glass-scrim"
            />
            <motion.aside
              role="dialog"
              aria-modal="true"
              aria-label="Меню"
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.15 }}
              className="glass nav-overlay absolute flex w-58 flex-col gap-2 p-[1.3125rem]"
              style={{ left: box.left, top: box.top, height: box.height }}
            >
              <SidebarBody {...shared} brand={<Brand label="Затвори менюто" onClick={onClose} />} />
            </motion.aside>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}

/**
 * Below 1024 the menu is a drawer over the page (821:1901): 300 wide, 12 from
 * the edges, closed by ×, a tap on the scrim, a swipe to the left or Esc.
 * Focus goes to × on opening and back to the menu button on closing.
 */
function Drawer({
  open,
  onClose,
  returnFocus,
  ...shared
}: Shared & {
  open: boolean;
  onClose: () => void;
  returnFocus: RefObject<HTMLButtonElement | null>;
}) {
  const close = useRef<HTMLButtonElement>(null);
  // The drawer follows a finger dragging it left. Released far or fast enough
  // it closes; otherwise it slides back. No drag constraints: their snap-back
  // would fight the closing slide and leave the drawer standing.
  const x = useMotionValue(-320);

  useEffect(() => {
    if (!open) return;
    close.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const button = returnFocus.current;
    return () => {
      document.removeEventListener('keydown', onKey);
      button?.focus();
    };
  }, [open, onClose, returnFocus]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-glass-scrim"
          />
          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-label="Меню"
            style={{ x }}
            animate={{ x: 0 }}
            exit={{ x: -320 }}
            transition={{ type: 'spring', damping: 32, stiffness: 320 }}
            drag="x"
            dragMomentum={false}
            dragElastic={0}
            onDrag={() => x.get() > 0 && x.set(0)}
            onDragEnd={(_, info) => {
              if (info.offset.x < -60 || info.velocity.x < -400) onClose();
              else void animate(x, 0, { type: 'spring', damping: 32, stiffness: 320 });
            }}
            className="glass nav-overlay absolute top-3 bottom-3 left-3 flex w-[18.75rem] flex-col gap-2 p-[1.3125rem]"
          >
            <SidebarBody {...shared} brand={<Brand />} />
            <button
              ref={close}
              type="button"
              onClick={onClose}
              aria-label="Затвори менюто"
              className="absolute top-4 right-4 flex h-11 w-11 items-center justify-center rounded-full text-ink"
            >
              <X size="1.25rem" />
            </button>
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
}

/** V2/Search (846:293), 48 tall. TODO(M2b): unified search over buildings, apartments and residents. */
function GlobalSearch({ className = '' }: { className?: string }) {
  return (
    <label className={`glass-field flex h-12 min-w-0 items-center gap-2.5 px-4 ${className}`}>
      <Search size="1.25rem" className="shrink-0 text-ink-muted" />
      <input
        type="search"
        disabled
        placeholder="Сграда, имот, жител или телефон"
        aria-label="Общо търсене"
        className="w-full min-w-0 bg-transparent text-body-14 text-ink outline-none placeholder:text-ink-muted disabled:cursor-not-allowed"
      />
    </label>
  );
}

/** Icon/menu from V2/Topbar: three 18 × 1.5 bars in a 22 box. */
function MenuBars() {
  return (
    <span aria-hidden className="relative h-[1.375rem] w-[1.375rem]">
      {[4, 10.25, 16.5].map((top) => (
        <span
          key={top}
          className="absolute left-0.5 h-[0.09375rem] w-[1.125rem] rounded-[0.0625rem] bg-current"
          style={{ top: rem(top) }}
        />
      ))}
    </span>
  );
}

function Topbar({
  mode,
  menuButton,
  menuOpen,
  onOpenNav,
  session,
}: {
  mode: NavMode;
  menuButton: RefObject<HTMLButtonElement | null>;
  menuOpen: boolean;
  onOpenNav: () => void;
  session: Session;
}) {
  const compact = mode === 'drawer';
  return compact ? (
    // V2/Topbar tablet (850:360) and phone (850:382): the menu button and the
    // wordmark lead; on a tablet the search fills the middle, on a phone it
    // drops to its own row under the bar.
    <header className="flex h-14 items-center gap-3 md:gap-5">
      <button
        ref={menuButton}
        type="button"
        onClick={onOpenNav}
        aria-label="Отвори менюто"
        aria-expanded={menuOpen}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink"
      >
        <MenuBars />
      </button>
      <span className="shrink-0 text-ink">
        <InovaWordmark size={22} />
      </span>
      <GlobalSearch className="hidden flex-1 md:flex" />
      <span className="flex-1 md:hidden" />
      <NoticesBell />
      <AccountMenu session={session} compact />
    </header>
  ) : (
    // V2/Topbar (850:312): search 380 wide, a spacer, the bell and the account, 20 apart.
    <header className="flex h-14 items-center gap-5">
      <GlobalSearch className="flex-1 max-w-[23.75rem]" />
      <div className="ml-auto flex shrink-0 items-center gap-5">
        <NoticesBell />
        <AccountMenu session={session} />
      </div>
    </header>
  );
}

function NoticesBell() {
  const unread = useUnreadCount();
  return (
    // TODO(M7): the unread count comes with the notification feed (lib/notices.ts).
    <Link
      to="/notices"
      aria-label={unread ? `Известия, ${unread} непрочетени` : 'Известия'}
      className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink"
    >
      <Bell size="1.375rem" />
      {unread ? (
        // The frame's lit dot: a soft halo and a bright core on the bell's shoulder.
        <>
          <span
            aria-hidden
            className="absolute top-0.5 left-5 h-[1.375rem] w-[1.375rem] rounded-full"
            style={{
              background: 'radial-gradient(circle, var(--glow-dot-near) 0%, transparent 70%)',
              opacity: 0.6,
            }}
          />
          <span
            aria-hidden
            className="absolute top-[0.5625rem] left-[1.6875rem] h-2 w-2 rounded-full"
            style={{
              background: 'var(--light-source)',
              boxShadow: '0 0 0.375rem 0.0625rem var(--glow-dot-near)',
            }}
          />
        </>
      ) : null}
    </Link>
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

function AccountMenu({ session, compact = false }: { session: Session; compact?: boolean }) {
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
          aria-label={compact ? `${name}, профил` : undefined}
          className={`flex items-center gap-3 rounded-full text-left text-ink ${compact ? '' : 'py-1 pr-1'}`}
        >
          <Avatar name={name} size={36} className="glass-blur" />
          {/* On a tablet and a phone the bar keeps the avatar alone. */}
          {!compact && (
            <>
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-body-14 font-semibold">{name}</span>
                <span className="truncate text-body-13-tight text-ink-muted">
                  {roleLabel(session, platform)}
                </span>
              </span>
              <ChevronDown size="1.125rem" className="shrink-0" />
            </>
          )}
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
                icon={<Building2 size="0.9375rem" />}
                onClick={() => {
                  setSelectedTenantId(option.id);
                  setOpen(false);
                }}
                trailing={
                  option.id === selectedTenantId ? (
                    <Check size="0.875rem" className="opacity-70" />
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
            icon={<Icon size="0.9375rem" />}
            onClick={() => setTheme(value)}
            trailing={
              value === themeChoice ? <Check size="0.875rem" className="opacity-70" /> : undefined
            }
          >
            {label}
          </MenuItem>
        ))}

        <hr className="my-1.5 border-panel-divider" />
        <MenuItem icon={<LogOut size="0.9375rem" />} onClick={signOut}>
          Изход
        </MenuItem>
      </div>
    </Popover>
  );
}

/**
 * Says, on every screen, that the numbers are the design's and not real:
 * the «design data» preview must never pass for the portal.
 */
function DesignDataNote() {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-3 z-40 flex justify-center">
      <span className="glass-control-active text-label-12 rounded-full px-3 py-1.5 font-semibold">
        Данни от макета 859:1073 — не са реални
      </span>
    </div>
  );
}
