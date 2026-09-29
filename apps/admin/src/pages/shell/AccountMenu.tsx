import { Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from 'react';
import { createPortal } from 'react-dom';
import {
  CaretDown,
  CaretRight,
  CheckCircle,
  ShieldCheck,
  X,
  XCircle,
} from '../../components/icons';
import { Avatar, Popover, SkeletonBar } from '../../components/ui';
import { api, type Role } from '../../lib/api';
import { clearSession, type Session } from '../../lib/auth';
import { setTheme, useThemeChoice, type ThemeChoice } from '../../lib/theme';
import {
  clearSelectedTenantId,
  setSelectedTenantId,
  usePlatformScope,
  useSelectedTenantId,
  useTenantContext,
  useTenantOptions,
} from '../../lib/tenant';
import { ROLE_NAMES } from '../staff/model';

const PLATFORM_ROLE = 'Администратор на платформата';

/**
 * What a role lets you do, one line per area, from the permission keys the
 * organisation gave it. An area counts as granted when the role holds any of
 * its keys.
 * TODO(M2): «Сгради, имоти и жители» (property.read, residents.read) and
 * TODO(M3): «Финанси: преглед и въвеждане на плащания» (billing.read,
 * payments.record) join the list when their keys exist; until then a line
 * would say «няма достъп» to everyone, which is not true.
 */
const ACCESS: { label: string; keys: string[] }[] = [
  {
    label: 'Служители, роли и настройки на организацията',
    keys: ['staff.read', 'roles.read', 'tenant.manage'],
  },
];

/**
 * TODO(M1): «Динамична» follows the time of day (design.md, Glass); until
 * that lands it keeps following the device, which is what 'system' does.
 */
const THEMES: { value: ThemeChoice; label: string }[] = [
  { value: 'light', label: 'Светла' },
  { value: 'dark', label: 'Тъмна' },
  { value: 'system', label: 'Динамична' },
];

/**
 * The role in words: the seeded names, a custom role's own name. A custom
 * role read without roles.read still shows its key: /tenant carries the key
 * only (see the PR's Remains).
 */
export function useRoleName(session: Session | null): string {
  const tenantId = useSelectedTenantId();
  const context = useTenantContext();
  const key = context.data?.role ?? session?.memberships.find((m) => m.t === tenantId)?.r ?? null;
  const custom = Boolean(key && !ROLE_NAMES[key]);
  const roles = useQuery({
    queryKey: ['roles', tenantId],
    queryFn: () => api<Role[]>('/tenant/roles', { tenantId: tenantId! }),
    enabled: custom && Boolean(context.data?.permissions.includes('roles.read')),
  });
  if (session?.user.platformRole === 'super_admin') return PLATFORM_ROLE;
  if (!key) return '—';
  return ROLE_NAMES[key] ?? roles.data?.find((r) => r.key === key)?.name ?? key;
}

/** A phone as it is read aloud: +359 88 100 0001. Other shapes stay as stored. */
function formatPhone(phone: string): string {
  const bg = /^\+359(\d{2})(\d{3})(\d{4})$/.exec(phone);
  return bg ? `+359 ${bg[1]} ${bg[2]} ${bg[3]}` : phone;
}

const narrowQuery = '(max-width: 47.9375rem)';

/** Below md the menu is a sheet from the bottom (Figma 1763:28546). */
function useNarrow(): boolean {
  return useSyncExternalStore(
    (fn) => {
      const list = window.matchMedia(narrowQuery);
      list.addEventListener('change', fn);
      return () => list.removeEventListener('change', fn);
    },
    () => window.matchMedia(narrowQuery).matches,
    () => false,
  );
}

/**
 * The account menu: Figma Screens 2354:286 on desktop, the sheet 1763:28546
 * at 402. Who you are, where you are, which role you hold and what it lets
 * you do, the theme, and the way out.
 */
export function AccountMenu({
  session,
  compact = false,
}: {
  session: Session | null;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const narrow = useNarrow();
  const anchorRef = useRef<HTMLButtonElement>(null);
  const platform = usePlatformScope();
  const context = useTenantContext();
  const role = useRoleName(session);
  const name = session?.user.fullName ?? '—';
  const organisation = platform ? null : (context.data?.tenant.name ?? null);
  const close = () => setOpen(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  // The avatar on screen when the menu closes — read then, not when it
  // opened: crossing 768 re-mounts the button, and the one from the opening
  // is gone by the time the focus comes back.
  const focusAnchor = useCallback(() => anchorRef.current?.focus(), []);

  // The popover is not modal, but the keyboard still starts inside it and
  // comes back to the avatar when it closes — unless the user clicked away
  // to something else, which keeps the focus.
  useEffect(() => {
    if (!open || narrow) return;
    const frame = requestAnimationFrame(() => dialogRef.current?.focus());
    const dialog = dialogRef.current;
    return () => {
      cancelAnimationFrame(frame);
      const active = document.activeElement;
      if (!active || active === document.body || dialog?.contains(active)) focusAnchor();
    };
  }, [open, narrow, focusAnchor]);

  const anchor = (
    <button
      ref={anchorRef}
      type="button"
      aria-haspopup="dialog"
      aria-expanded={open}
      onClick={() => setOpen((v) => !v)}
      aria-label={`${name}, акаунт`}
      className={`flex items-center gap-3 rounded-full text-left text-ink ${compact ? '' : 'py-1 pr-1'}`}
    >
      <Avatar name={name} size={36} className="glass-blur" />
      {/* On a tablet and a phone the bar keeps the avatar alone. */}
      {!compact && (
        <>
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-body-14 font-semibold">{name}</span>
            <span className="truncate text-body-13-tight text-ink-muted">
              {organisation && role !== PLATFORM_ROLE ? `${role} · ${organisation}` : role}
            </span>
          </span>
          <CaretDown size="1.125rem" className="shrink-0" />
        </>
      )}
    </button>
  );

  const body = <AccountBody session={session} role={role} onNavigate={close} />;

  if (narrow) {
    return (
      <>
        {anchor}
        <Sheet open={open} onClose={close} returnFocus={anchorRef}>
          {body}
        </Sheet>
      </>
    );
  }

  return (
    <Popover open={open} onClose={close} align="right" anchor={anchor}>
      {/* 386 wide with the popover's own 6 px padding, 12 from the edge in all. */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-labelledby="account-menu-title"
        tabIndex={-1}
        className="flex w-[23.375rem] max-w-[calc(100vw-2.75rem)] flex-col gap-4 px-1.5 pt-2.5 pb-1.5 focus-visible:shadow-none"
      >
        <h2 id="account-menu-title" className="sr-only">
          Акаунт
        </h2>
        {body}
        <hr className="border-panel-divider" />
        <SignOutButton className="w-40 self-center" />
      </div>
    </Popover>
  );
}

function AccountBody({
  session,
  role,
  onNavigate,
}: {
  session: Session | null;
  role: string;
  onNavigate: () => void;
}) {
  const platform = usePlatformScope();
  const superAdmin = session?.user.platformRole === 'super_admin';
  const context = useTenantContext();
  const selectedTenantId = useSelectedTenantId();
  const { options } = useTenantOptions();
  const themeChoice = useThemeChoice();
  const name = session?.user.fullName ?? '—';
  const contacts = [session?.user.email, session?.user.phone && formatPhone(session.user.phone)]
    .filter(Boolean)
    .join(' · ');
  const permissions = context.data?.permissions ?? [];
  // A member of several organisations switches here; a platform
  // administrator enters one from «Организации».
  const switchable = !superAdmin && options.length > 1;

  // Until /tenant answers, and when it fails, the permissions are unknown —
  // not empty: the menu must not tell anyone they have no access.
  const unknown = !platform && !context.data;
  const access = [
    ...(platform
      ? []
      : ACCESS.map(({ label, keys }) => ({
          label,
          granted: keys.some((key) => permissions.includes(key)),
        }))),
    { label: 'Администриране на платформата', granted: superAdmin },
  ];

  return (
    <>
      <div className="flex items-center gap-3">
        <Avatar name={name} size={40} onPanel />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <p className="text-body-15-tight text-panel-ink">{name}</p>
          {contacts && <p className="text-label-12 text-panel-ink-muted">{contacts}</p>}
        </div>
      </div>

      {!platform && (
        <Group title="Организация">
          {switchable ? (
            <RadioGroup
              label="Организация"
              options={options.map((option) => ({ value: option.id, label: option.name }))}
              value={selectedTenantId}
              onChange={setSelectedTenantId}
            />
          ) : (
            <p className="text-body-15-tight text-panel-ink">{context.data?.tenant.name ?? '—'}</p>
          )}
          {permissions.includes('audit.read') && (
            <Link
              to="/audit"
              onClick={onNavigate}
              className="flex items-center gap-2.5 rounded-lg py-2.5 text-body-15-tight text-panel-ink"
            >
              <ShieldCheck size="1.125rem" className="shrink-0" />
              <span className="flex-1">Одитен дневник</span>
              <CaretRight size="1.125rem" className="shrink-0" />
            </Link>
          )}
        </Group>
      )}

      <Group title="Вашите роли">
        <ul aria-label="Вашите роли" className="flex flex-wrap gap-2">
          <li className="rounded-full bg-panel-row py-1.5 pr-2 pl-3 text-label-12 font-semibold text-panel-ink">
            {role}
          </li>
        </ul>
        {!superAdmin && (
          <p className="text-label-12 text-panel-ink-muted">
            Ролята се сменя от администратор, не оттук.
          </p>
        )}
      </Group>

      <hr className="border-panel-divider" />

      <Group title="Вашият достъп">
        {unknown ? (
          context.isError ? (
            <p className="py-1 text-body-15-tight text-panel-ink-muted">
              Достъпът не можа да се зареди.
            </p>
          ) : (
            <div aria-hidden className="flex flex-col gap-3 py-1">
              <SkeletonBar className="h-4 w-4/5" />
              <SkeletonBar className="h-4 w-3/5" />
            </div>
          )
        ) : (
          <ul aria-label="Вашият достъп" className="flex flex-col gap-1.5">
            {access.map(({ label, granted }) => (
              <li
                key={label}
                className={`flex items-center gap-2.5 py-1 text-body-15-tight text-panel-ink ${granted ? '' : 'opacity-50'}`}
              >
                {granted ? (
                  <CheckCircle size="1.125rem" className="shrink-0" />
                ) : (
                  <XCircle size="1.125rem" className="shrink-0" />
                )}
                <span className="flex-1">{granted ? label : `${label} — няма достъп`}</span>
              </li>
            ))}
          </ul>
        )}
      </Group>

      <hr className="border-panel-divider" />

      <Group title="Тема">
        <RadioGroup label="Тема" options={THEMES} value={themeChoice} onChange={setTheme} />
      </Group>
    </>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-1.5">
      <h3 className="text-overline-12 font-semibold text-panel-ink-muted uppercase">{title}</h3>
      {children}
    </section>
  );
}

/**
 * V2/Popover row · panel as a radio group: an 18 px radio, the selected row
 * on panel/row. One tab stop; the arrows move the choice (WAI-ARIA radio
 * group), Home and End go to the ends.
 */
function RadioGroup<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T | null;
  onChange: (value: T) => void;
}) {
  const rows = useRef<(HTMLButtonElement | null)[]>([]);
  const current = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );

  const move = (index: number) => {
    const next = (index + options.length) % options.length;
    onChange(options[next]!.value);
    rows.current[next]?.focus();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
    if (step) move(current + step);
    else if (e.key === 'Home') move(0);
    else if (e.key === 'End') move(options.length - 1);
    else return;
    e.preventDefault();
  };

  return (
    <div
      role="radiogroup"
      aria-label={label}
      onKeyDown={onKeyDown}
      className="flex flex-col gap-1.5"
    >
      {options.map((option, index) => {
        const checked = option.value === value;
        return (
          <button
            key={option.value}
            ref={(el) => {
              rows.current[index] = el;
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={index === current ? 0 : -1}
            onClick={() => onChange(option.value)}
            className={`flex w-full items-center gap-2.5 rounded-[var(--radius-row)] px-2.5 py-2 text-left text-body-14 font-medium text-panel-ink transition-colors ${
              checked ? 'bg-panel-row' : 'hover:bg-panel-row'
            }`}
          >
            <span
              aria-hidden
              className={`flex size-[1.125rem] shrink-0 items-center justify-center rounded-full ${
                checked ? 'bg-panel-ink' : 'border border-panel-border bg-panel-control'
              }`}
            >
              {checked && <span className="size-1.5 rounded-full bg-panel-ink-inverse" />}
            </span>
            <span className="flex-1">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function SignOutButton({ className = '' }: { className?: string }) {
  const signOut = () => {
    clearSession();
    clearSelectedTenantId();
    window.location.assign('/login');
  };
  return (
    <button
      type="button"
      onClick={signOut}
      className={`rounded-full bg-panel-ink px-6 py-3 text-body-14 font-semibold text-panel-ink-inverse ${className}`}
    >
      Изход
    </button>
  );
}

/**
 * The sheet at 402: slides up over a scrim, the body scrolls, «Изход» stays
 * in the footer within reach. Closed by ×, the scrim or Esc; focus goes to ×
 * on opening and back to the avatar on closing.
 */
function Sheet({
  open,
  onClose,
  returnFocus,
  children,
}: {
  open: boolean;
  onClose: () => void;
  returnFocus: RefObject<HTMLButtonElement | null>;
  children: ReactNode;
}) {
  const closeButton = useRef<HTMLButtonElement>(null);
  // Read through a ref: the menu hands a new onClose on every render, and a
  // re-render (choosing an organisation, a refetch) must not move the focus.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  const sheet = useRef<HTMLDivElement>(null);

  // Modal for real: the app behind is inert and does not scroll, and Tab
  // runs round the sheet instead of leaving it.
  useEffect(() => {
    if (!open) return;
    const app = document.getElementById('root');
    const html = document.documentElement;
    const overflow = html.style.overflow;
    app?.setAttribute('inert', '');
    html.style.overflow = 'hidden';
    closeButton.current?.focus();
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current();
      if (e.key !== 'Tab' || !sheet.current) return;
      const stops = [
        ...sheet.current.querySelectorAll<HTMLElement>('button, a[href], [tabindex="0"]'),
      ].filter((el) => !el.hasAttribute('disabled') && el.tabIndex >= 0);
      const first = stops[0];
      const last = stops[stops.length - 1];
      if (!first || !last) return;
      if (!sheet.current.contains(document.activeElement)) {
        e.preventDefault();
        first.focus();
      } else if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    const anchor = returnFocus.current;
    return () => {
      document.removeEventListener('keydown', onKey);
      app?.removeAttribute('inert');
      html.style.overflow = overflow;
      anchor?.focus();
    };
  }, [open, returnFocus]);

  return createPortal(
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
          <motion.div
            ref={sheet}
            role="dialog"
            aria-modal="true"
            aria-label="Акаунт"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 34, stiffness: 340 }}
            className="panel absolute inset-x-0 bottom-0 flex max-h-[calc(100dvh-2rem)] flex-col overflow-hidden rounded-t-[1.75rem]"
          >
            <div className="flex items-center gap-3 px-5 pt-[1.125rem] pb-3.5">
              <h2 className="flex-1 text-title-16 font-medium text-panel-ink">Акаунт</h2>
              <button
                ref={closeButton}
                type="button"
                onClick={onClose}
                aria-label="Затвори"
                className="flex size-8 items-center justify-center rounded-full bg-panel-row text-panel-ink"
              >
                <X size="1.125rem" />
              </button>
            </div>
            <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain px-5 pt-1 pb-2">
              {children}
            </div>
            <div className="bg-panel-footer px-5 pt-3.5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
              <SignOutButton className="w-full" />
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
