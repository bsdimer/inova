import { AnimatePresence, motion } from 'framer-motion';
import { ArrowsDownUp, Check, CaretDown, MagnifyingGlass, X } from './icons';
import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type Ref,
  type RefObject,
} from 'react';
import { createPortal } from 'react-dom';
import { rem } from '../lib/rem';

/** Initials on glass. Two letters, because Bulgarian names are two words. */
export function Avatar({
  name,
  size = 36,
  className = '',
  onPanel = false,
}: {
  name: string;
  size?: number;
  className?: string;
  /** On the panel surface (menus, sheets) rather than on glass. */
  onPanel?: boolean;
}) {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
  return (
    <span
      aria-hidden
      className={`flex shrink-0 items-center justify-center rounded-full font-semibold ${className}`}
      style={{
        width: rem(size),
        height: rem(size),
        // V2/Avatar: 40 carries Body/14, 36 and below Label/12.
        fontSize: rem(size >= 40 ? 14 : size * (1 / 3)),
        lineHeight: size >= 40 ? '1.25rem' : '1rem',
        background: onPanel ? 'var(--panel-row-strong)' : 'var(--glass-avatar)',
        boxShadow: `inset 0 0 0 0.0625rem ${onPanel ? 'var(--panel-border)' : 'var(--glass-avatar-edge)'}`,
        color: onPanel ? 'var(--panel-text)' : undefined,
      }}
    >
      {initials}
    </span>
  );
}

/** The one primary action on a page. Dark pill, single glow. */
export function PrimaryButton({
  children,
  onClick,
  disabled = false,
  type = 'button',
  ref,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: 'button' | 'submit';
  ref?: Ref<HTMLButtonElement>;
}) {
  return (
    <button
      ref={ref}
      type={type}
      onClick={onClick}
      disabled={disabled}
      // V2/Button Kind=Primary (846:130): 44 tall, 28 either side.
      className="cta text-body-14 h-11 px-7 font-semibold transition-opacity disabled:opacity-45"
    >
      {children}
    </button>
  );
}

/**
 * `V2/Button Kind=Secondary`: a lifted pill, glass/inner behind a glass/edge
 * hairline. Not `GhostButton`, which is the recessed control fill, and not the
 * solid white disc — the mock-ups use all three for different jobs.
 */
export function SecondaryButton({
  children,
  onClick,
  disabled = false,
  title,
  className = '',
  size = 'md',
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  title?: string;
  className?: string;
  /** `sm`: the 32 px card action (V2/Button Size=S, e.g. «Редактирай» on a role). */
  size?: 'md' | 'sm';
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`glass-blur rounded-full text-ink transition-opacity disabled:opacity-45 ${
        size === 'sm' ? 'h-8 px-3 text-body-13 font-medium' : 'text-body-14 h-11 px-7 font-semibold'
      } ${className}`}
      style={{
        background: 'var(--glass-inner)',
        boxShadow: 'inset 0 0 0 0.0625rem var(--glass-edge)',
      }}
    >
      {children}
    </button>
  );
}

export function GhostButton({
  children,
  onClick,
  disabled = false,
  danger = false,
  type = 'button',
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  danger?: boolean;
  type?: 'button' | 'submit';
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`glass-control text-body-14 rounded-full px-4 py-2 font-semibold transition-opacity disabled:opacity-40 ${
        danger ? 'text-status-urgent' : 'text-ink'
      }`}
    >
      {children}
    </button>
  );
}

/**
 * A solid white disc with a dark glyph, the light counterpart of a glass control.
 * The mock-ups use exactly one per row — the action that opens the drawer —
 * so it stays the loudest thing in the table without being a filled CTA.
 */
export function SolidIconButton({
  children,
  onClick,
  disabled = false,
  label,
  size = 32,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  label: string;
  size?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      style={{ width: rem(size), height: rem(size) }}
      className="glass-solid flex shrink-0 items-center justify-center rounded-full transition-opacity hover:opacity-85 disabled:opacity-40"
    >
      {children}
    </button>
  );
}

/** Neutral pill for a role, a tag or a count. */
export function Chip({ children, muted = false }: { children: ReactNode; muted?: boolean }) {
  return (
    <span
      className={`text-label-12 inline-flex items-center rounded-full px-2.5 py-1 font-semibold whitespace-nowrap ${
        muted ? 'text-ink-soft' : 'text-ink'
      }`}
      style={{
        background: 'var(--glass-inner-strong)',
        boxShadow: 'inset 0 0 0 0.0625rem var(--glass-edge-soft)',
      }}
    >
      {children}
    </span>
  );
}

/** V2/Chip Kind=filter (868:297): says what it filters and how to drop it. */
export function FilterChip({ children, onClear }: { children: ReactNode; onClear: () => void }) {
  return (
    <span className="glass-control-active text-label-12 inline-flex items-center gap-1 rounded-full py-1.5 pr-2 pl-3 font-semibold whitespace-nowrap">
      {children}
      <button
        type="button"
        onClick={onClear}
        aria-label="Премахни филтъра"
        className="rounded-full transition-opacity hover:opacity-70"
      >
        <X size="0.875rem" />
      </button>
    </span>
  );
}

/** V2/Search (846:293): the list search above a table. */
export function SearchField({
  value,
  onChange,
  placeholder,
  label,
  className = '',
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder: string;
  label: string;
  className?: string;
}) {
  return (
    <label className={`glass-field flex h-12 min-w-56 items-center gap-2.5 px-4 ${className}`}>
      <MagnifyingGlass size="1.25rem" className="shrink-0 text-ink-muted" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={label}
        className="text-body-14 w-full min-w-0 bg-transparent text-ink outline-none placeholder:text-ink-muted"
      />
    </label>
  );
}

/** V2/Sort (868:324): the sort preset of a list, one of a few named orders. */
export function SortSelect<T extends string>({
  value,
  options,
  onChange,
  buttonLabels,
}: {
  value: T;
  options: Record<T, string>;
  onChange: (next: T) => void;
  /** Shorter words for the button where it shares a row on a phone (877:2945). */
  buttonLabels?: Record<T, string>;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover
      open={open}
      onClose={() => setOpen(false)}
      align="right"
      anchor={
        <button
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="glass-control text-body-14 flex h-11 items-center gap-2 rounded-full px-3.5 font-medium text-ink"
        >
          <ArrowsDownUp size="1rem" className="shrink-0" />
          <span className="truncate">{buttonLabels?.[value] ?? options[value]}</span>
          <CaretDown size="1rem" className="shrink-0" />
        </button>
      }
    >
      <ul role="listbox" className="min-w-60">
        {(Object.keys(options) as T[]).map((preset) => (
          <li key={preset}>
            <button
              type="button"
              role="option"
              aria-selected={value === preset}
              onClick={() => {
                onChange(preset);
                setOpen(false);
              }}
              className={`w-full rounded-xl px-3 py-2 text-left text-sm text-panel-ink transition-colors hover:bg-panel-row ${
                value === preset ? 'font-semibold' : 'font-medium'
              }`}
            >
              {options[preset]}
            </button>
          </li>
        ))}
      </ul>
    </Popover>
  );
}

/**
 * Anchored popover on the light panel surface, rendered through a portal so a
 * scrolling card never clips it. Hugs whichever edge of the anchor keeps it
 * inside the viewport.
 */
export function Popover({
  open,
  onClose,
  anchor,
  children,
  align = 'auto',
}: {
  open: boolean;
  onClose: () => void;
  anchor: ReactNode;
  children: ReactNode;
  align?: 'left' | 'right' | 'auto';
}) {
  const anchorRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<{ top: number; left?: number; right?: number } | null>(null);
  // A tall menu on a short window scrolls inside itself instead of running
  // off the bottom edge.
  const maxHeight = box ? `calc(100dvh - ${box.top + 8}px)` : undefined;

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (anchorRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  useLayoutEffect(() => {
    if (!open) {
      setBox(null);
      return;
    }
    const place = () => {
      const a = anchorRef.current?.getBoundingClientRect();
      if (!a) return;
      const width = menuRef.current?.offsetWidth ?? 0;
      const fitsLeft = a.left + width <= window.innerWidth - 8;
      const fitsRight = a.right - width >= 8;
      const side = align === 'auto' ? (fitsLeft || !fitsRight ? 'left' : 'right') : align;
      const top = a.bottom + 8;
      setBox(
        side === 'right' ? { top, right: window.innerWidth - a.right } : { top, left: a.left },
      );
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open, align]);

  return (
    <>
      <div ref={anchorRef} className="inline-block">
        {anchor}
      </div>
      {createPortal(
        <AnimatePresence>
          {open && (
            <motion.div
              ref={menuRef}
              initial={{ opacity: 0, y: -4, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.98 }}
              transition={{ duration: 0.15 }}
              style={{
                top: box?.top ?? 0,
                left: box?.left,
                right: box?.right,
                maxHeight,
                visibility: box ? 'visible' : 'hidden',
              }}
              className="panel-strong fixed z-50 overflow-y-auto overscroll-contain rounded-2xl p-1.5"
            >
              {children}
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </>
  );
}

export interface FacetOption {
  value: string;
  label: string;
}

/** Multi-select facet: OR inside the facet, the caller ANDs facets together. */
export function Facet({
  label,
  options,
  selected,
  onChange,
  disabled = false,
  disabledHint,
}: {
  label: string;
  options: FacetOption[];
  selected: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
  disabledHint?: string;
}) {
  const [open, setOpen] = useState(false);
  const active = selected.length > 0;
  const toggle = (value: string) =>
    onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value]);

  return (
    <Popover
      open={open}
      onClose={() => setOpen(false)}
      anchor={
        <button
          type="button"
          disabled={disabled}
          title={disabled ? disabledHint : undefined}
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          // V2/Facet (867:338): 44 tall, the edge drawn inside; active turns
          // light and names nothing more — the chips below say what is chosen.
          className={`text-body-14 flex h-11 items-center gap-1.5 rounded-full pr-3.5 pl-4 font-medium whitespace-nowrap transition-opacity disabled:cursor-not-allowed disabled:opacity-40 ${
            active ? 'glass-control-active' : 'glass-control text-ink'
          }`}
        >
          {label}
          <CaretDown size="1rem" className="shrink-0" />
        </button>
      }
    >
      <ul role="listbox" aria-multiselectable className="min-w-52">
        {options.map((option) => {
          const checked = selected.includes(option.value);
          return (
            <li key={option.value}>
              <button
                type="button"
                role="option"
                aria-selected={checked}
                onClick={() => toggle(option.value)}
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm font-medium text-panel-ink transition-colors hover:bg-panel-row"
              >
                <span
                  className={`flex h-4 w-4 shrink-0 items-center justify-center rounded ${
                    checked ? 'bg-panel-ink text-panel-ink-inverse' : 'bg-panel-row-strong'
                  }`}
                  style={{
                    boxShadow: checked ? 'none' : 'inset 0 0 0 0.0625rem var(--panel-border)',
                  }}
                >
                  {checked && (
                    <Check
                      size="0.6875rem"
                      strokeWidth={3}
                      style={{ color: 'var(--panel-text-inverse)' }}
                    />
                  )}
                </span>
                {option.label}
              </button>
            </li>
          );
        })}
      </ul>
    </Popover>
  );
}

export type StatusTone = 'pending' | 'planned' | 'urgent' | 'resolved' | 'muted';

const DOT_COLOR: Record<StatusTone, string> = {
  pending: 'var(--status-pending)',
  planned: 'var(--status-planned)',
  urgent: 'var(--status-urgent)',
  resolved: 'var(--status-resolved)',
  muted: 'var(--text-faint)',
};

/**
 * Status dot plus label. The glow lives in the dot, never in the text: the
 * status colours do not carry enough contrast on a photograph to be read as
 * coloured words. A muted state has no glow at all.
 */
export function StatusDot({
  tone,
  children,
  onPanel = false,
}: {
  tone: StatusTone;
  children: ReactNode;
  onPanel?: boolean;
}) {
  const color = onPanel && tone !== 'muted' ? `var(--panel-status-${tone})` : DOT_COLOR[tone];
  return (
    <span
      className={`text-body-14 inline-flex items-center gap-2 font-medium whitespace-nowrap ${
        onPanel ? 'text-panel-ink' : 'text-ink'
      }`}
    >
      <span
        aria-hidden
        className="h-2 w-2 shrink-0 rounded-full"
        style={{
          background: color,
          boxShadow: tone === 'muted' ? 'none' : `0 0 0.5rem ${color}`,
        }}
      />
      {children}
    </span>
  );
}

export type StripTone = 'info' | 'success' | 'danger' | 'muted' | 'busy';

const STRIP_ICON_COLOR: Record<StripTone, string> = {
  info: 'var(--text-secondary)',
  success: 'var(--status-resolved)',
  danger: 'var(--status-urgent)',
  muted: 'var(--text-muted)',
  busy: 'var(--text-secondary)',
};

/** Full-width message strip between a table head and its rows. */
export function TableStrip({
  tone,
  icon,
  children,
  action,
  onDismiss,
}: {
  tone: StripTone;
  icon: ReactNode;
  children: ReactNode;
  action?: ReactNode;
  onDismiss?: () => void;
}) {
  return (
    <div
      role="status"
      className="flex items-center gap-3 px-5 py-2.5 text-xs font-medium text-ink-soft"
      style={{ background: 'var(--glass-inner-soft)' }}
    >
      <span
        className={`shrink-0 ${tone === 'busy' ? 'animate-spin' : ''}`}
        style={{ color: STRIP_ICON_COLOR[tone] }}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">{children}</span>
      {action}
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Затвори"
          className="rounded-full p-1 text-ink-muted transition-colors hover:text-ink"
        >
          <X size="0.75rem" />
        </button>
      )}
    </div>
  );
}

export function SkeletonBar({ className = '' }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={`block h-2.5 animate-pulse rounded-full ${className}`}
      style={{ background: 'var(--glass-inner-strong)' }}
    />
  );
}

/** Centered message for an empty, filtered-out or denied data view. */
export function EmptyState({
  icon,
  title,
  children,
  action,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center px-6 py-14 text-center">
      <span
        className="flex h-13 w-13 items-center justify-center rounded-2xl text-ink-soft"
        style={{
          background: 'var(--glass-inner)',
          boxShadow: 'inset 0 0 0 0.0625rem var(--glass-edge-soft)',
        }}
      >
        {icon}
      </span>
      <h2 className="mt-4 text-base font-semibold">{title}</h2>
      <p className="mt-2 text-sm text-ink-muted">{children}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/** Row action menu item; a disabled item explains itself instead of vanishing. */
export function MenuItem({
  icon,
  children,
  onClick,
  disabled = false,
  danger = false,
  trailing,
}: {
  icon: ReactNode;
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  danger?: boolean;
  trailing?: ReactNode;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      disabled={disabled}
      className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
        danger ? 'text-panel-status-urgent hover:bg-panel-row' : 'text-panel-ink hover:bg-panel-row'
      }`}
    >
      <span className="shrink-0">{icon}</span>
      <span className="flex-1">{children}</span>
      {trailing}
    </button>
  );
}

/** The dialogs open right now, the one on top last. */
const openDialogs: HTMLElement[] = [];
/** Where the keyboard returns once the last dialog has gone. */
let focusAfterDialogs: HTMLElement | null = null;
/** The page's own overflow, taken once when the first dialog opens. */
let pageOverflow = '';

/** `:disabled` also covers a control inside a disabled <fieldset>. */
function tabbableIn(root: HTMLElement): HTMLElement[] {
  return [
    ...root.querySelectorAll<HTMLElement>(
      'button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    ),
  ].filter((el) => !el.matches(':disabled') && el.tabIndex >= 0);
}

/**
 * What every dialog does (design.md → Windows and navigation): the page
 * behind is inert and does not scroll, Tab runs round the dialog, Esc calls
 * `onClose`, the focus goes in on opening — to `[data-autofocus]`, else the
 * first control that is not the × — and back to the opener on closing.
 * Dialogs stack: a question over a form hears the keyboard alone, and the
 * page turns inert once, for the first of them.
 */
function useDialog<T extends HTMLElement>(open: boolean, onClose: () => void): RefObject<T | null> {
  const dialog = useRef<T>(null);
  // Read through a ref: a caller hands a new onClose on every render, and a
  // re-render must not move the focus.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;
    const el = dialog.current;
    if (!el) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const html = document.documentElement;
    const app = document.getElementById('root');
    // One snapshot for the whole stack: a dialog that closes last must not
    // put back the 'hidden' it saw when it opened over another one.
    if (openDialogs.length === 0) {
      pageOverflow = html.style.overflow;
      app?.setAttribute('inert', '');
      html.style.overflow = 'hidden';
    }
    openDialogs.push(el);

    const stops = tabbableIn(el);
    (
      el.querySelector<HTMLElement>('[data-autofocus]') ??
      stops.find((stop) => !stop.hasAttribute('data-dialog-close')) ??
      stops[0] ??
      el
    ).focus();

    const onKey = (e: KeyboardEvent) => {
      if (openDialogs[openDialogs.length - 1] !== el) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab') return;
      const current = tabbableIn(el);
      const first = current[0];
      const last = current[current.length - 1];
      if (!first || !last) return;
      if (!el.contains(document.activeElement)) {
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

    return () => {
      document.removeEventListener('keydown', onKey);
      const index = openDialogs.indexOf(el);
      if (index >= 0) openDialogs.splice(index, 1);
      const target = opener?.isConnected ? opener : null;
      const insideOpenDialog = target && openDialogs.some((other) => other.contains(target));
      if (openDialogs.length > 0) {
        // A question closed over its form: back to the button that asked.
        // The form closed under its question: the page is still inert, so
        // its opener waits for the question to go.
        if (insideOpenDialog) target.focus();
        else focusAfterDialogs = target ?? focusAfterDialogs;
        return;
      }
      app?.removeAttribute('inert');
      html.style.overflow = pageOverflow;
      (focusAfterDialogs ?? target)?.focus();
      focusAfterDialogs = null;
    };
  }, [open]);

  return dialog;
}

/**
 * Side panel (design.md → Windows and navigation, WHI-105): only the header
 * is pinned; the body scrolls with the action buttons at its end, so the
 * user sees every option before saving, and when the form is short the
 * buttons rest at the panel's bottom. While there is more below, a thin
 * scrollbar and a 48px fade at the bottom edge say so; the fade is a mask,
 * so it holds in both themes. On a narrow screen it becomes a bottom sheet
 * with the browser's own scrollbar.
 */
export function Drawer({
  open,
  onClose,
  header,
  footer,
  children,
  label,
  pinFooter = false,
  phoneHeight = 'max-h-[92vh]',
  phoneFullScreen = false,
}: {
  open: boolean;
  onClose: () => void;
  header: ReactNode;
  footer: ReactNode;
  children: ReactNode;
  label: string;
  /**
   * Keep the footer out of the scrolling body, under the fade — only where
   * design.md pins the buttons (the filter sheet, a long table's action).
   */
  pinFooter?: boolean;
  /** The sheet's height (or cap) on a phone, as a Tailwind class written out in full. */
  phoneHeight?: string;
  /**
   * A form on a phone (design.md: «full screen, × top right»): the panel
   * covers the screen; its buttons still end the content. Beside the page
   * nothing changes.
   */
  phoneFullScreen?: boolean;
}) {
  const dialog = useDialog<HTMLElement>(open, onClose);
  const body = useRef<HTMLDivElement>(null);
  const [moreBelow, setMoreBelow] = useState(false);

  useEffect(() => {
    if (!open) return;
    const el = body.current;
    if (!el) return;
    const measure = () => setMoreBelow(el.scrollTop + el.clientHeight < el.scrollHeight - 1);
    measure();
    el.addEventListener('scroll', measure, { passive: true });
    // The content grows and shrinks (a band appears, a block unfolds).
    const sizes = new ResizeObserver(measure);
    sizes.observe(el);
    if (el.firstElementChild) sizes.observe(el.firstElementChild);
    return () => {
      el.removeEventListener('scroll', measure);
      sizes.disconnect();
    };
  }, [open]);

  const fade = 'linear-gradient(to bottom, black calc(100% - 3rem), transparent)';

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          // Beside the page the panel floats: 12 from the right, 11 from the
          // top, 21 from the bottom (875:2088, 929:3895, 1489:29877).
          className="fixed inset-0 z-50 flex items-end justify-end sm:items-stretch sm:pt-[0.6875rem] sm:pr-3 sm:pb-[1.3125rem]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          style={{ background: 'rgb(0 0 0 / 0.35)' }}
        >
          <motion.aside
            ref={dialog}
            role="dialog"
            aria-modal="true"
            aria-label={label}
            tabIndex={-1}
            onClick={(e) => e.stopPropagation()}
            initial={{ x: 0, y: 40, opacity: 0 }}
            animate={{ x: 0, y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ type: 'spring', damping: 30, stiffness: 320 }}
            // 520 wide, as the panel is drawn (1607:36771): its footer holds
            // the note, «Отказ» and «Запази промените» side by side. The
            // sheet's top corners are 28, its bottom ones straight (1764:28895);
            // the floating panel is 28 round on every corner.
            className={`panel flex w-full flex-col overflow-hidden sm:h-full sm:max-h-none sm:w-[32.5rem] sm:rounded-[1.75rem] ${
              phoneFullScreen ? 'h-dvh' : `${phoneHeight} rounded-t-[1.75rem]`
            }`}
          >
            <div className="shrink-0 border-b border-panel-divider px-5 py-4">{header}</div>
            <div
              ref={body}
              data-drawer-body
              className="min-h-0 flex-1 overflow-y-auto sm:[scrollbar-width:thin]"
              style={moreBelow ? { maskImage: fade, WebkitMaskImage: fade } : { maskImage: 'none' }}
            >
              <div className="flex min-h-full flex-col">
                <div className="px-5 py-4">{children}</div>
                {!pinFooter && (
                  <div
                    data-drawer-footer
                    // Full screen, the end of the form meets the iPhone home indicator.
                    className={`mt-auto border-t border-panel-divider px-5 ${
                      phoneFullScreen
                        ? 'pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:pb-4'
                        : 'py-4'
                    }`}
                  >
                    {footer}
                  </div>
                )}
              </div>
            </div>
            {pinFooter && (
              <div data-drawer-footer className="shrink-0 border-t border-panel-divider px-5 py-4">
                {footer}
              </div>
            )}
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

export interface FilterGroup<K extends string> {
  key: K;
  title: string;
  options: FacetOption[];
}

/** The ticked values per facet; a facet with nothing ticked filters nothing. */
export type FilterChoice<K extends string> = Record<K, string[]>;

/** `choice` with `value` ticked in `key` if it was not, and unticked if it was. */
export function toggleChoice<K extends string>(
  choice: FilterChoice<K>,
  key: K,
  value: string,
): FilterChoice<K> {
  const current = choice[key];
  const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
  return { ...choice, [key]: next };
}

/**
 * Phone filters (Служители, Сгради): the facets of the toolbar as checkbox
 * groups in a bottom sheet; pinned header and footer, the groups scroll.
 * The sheet stages (design.md → Windows and navigation): ticks build a
 * draft, «Покажи …» previews and applies it, closing (×, Escape, the
 * backdrop) drops it, «Изчисти» clears the draft only.
 */
export function FilterSheet<K extends string>({
  open,
  onClose,
  groups,
  applied,
  onApply,
  preview,
  countWith,
}: {
  open: boolean;
  onClose: () => void;
  groups: FilterGroup<K>[];
  applied: FilterChoice<K>;
  onApply: (choice: FilterChoice<K>) => void;
  /** What the draft would leave, as the button says it: «7 сгради». */
  preview: (draft: FilterChoice<K>) => string;
  /**
   * How many rows a choice leaves, for the number beside each option. Only
   * true while the list is loaded whole; a paged list must not pass it.
   */
  countWith: (choice: FilterChoice<K>) => number;
}) {
  const [draft, setDraft] = useState(applied);
  const [wasOpen, setWasOpen] = useState(open);
  // Every opening starts from what the list shows now (set during render,
  // not in an effect, so the first frame already has it).
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setDraft(applied);
  }
  const clear = () => {
    const cleared = { ...draft };
    for (const group of groups) cleared[group.key] = [];
    setDraft(cleared);
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      label="Филтри"
      pinFooter
      // 1126:10849: the sheet starts 132 below the top of the screen.
      phoneHeight="max-h-[calc(100dvh-8.25rem)]"
      header={
        // 1126:10849: × beside the title, the actions at the foot.
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-base font-medium">Филтри</h2>
          <button
            type="button"
            onClick={onClose}
            data-dialog-close
            aria-label="Затвори"
            // A 44 touch target around the drawn 32 disc.
            className="group -my-1.5 -mr-1.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-panel-row text-panel-ink-muted transition-colors group-hover:text-panel-ink">
              <X size="1.125rem" />
            </span>
          </button>
        </div>
      }
      footer={
        <div className="flex gap-3">
          <button
            type="button"
            onClick={clear}
            className="h-11 rounded-full border border-panel-border px-5 text-sm font-medium text-panel-ink"
          >
            Изчисти
          </button>
          <button
            type="button"
            onClick={() => {
              onApply(draft);
              onClose();
            }}
            className="h-11 flex-1 rounded-full bg-panel-ink px-5 text-sm font-semibold text-panel-ink-inverse"
          >
            Покажи {preview(draft)}
          </button>
        </div>
      }
    >
      <p className="mb-5 text-xs text-panel-ink">
        При избор на филтри в повече от една група се показват само резултатите, които отговарят на
        всички избрани условия.
      </p>
      <div className="space-y-6">
        {groups.map((group) => (
          <section key={group.key}>
            <h3 className="mb-2 text-xs font-semibold tracking-wider text-panel-ink-faint uppercase">
              {group.title}
            </h3>
            <div className="space-y-0.5">
              {group.options.map((option) => {
                const checked = draft[group.key].includes(option.value);
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="checkbox"
                    aria-checked={checked}
                    onClick={() => setDraft(toggleChoice(draft, group.key, option.value))}
                    className="flex min-h-11 w-full items-center gap-3 text-left text-panel-ink"
                  >
                    <span
                      className={`flex h-[1.375rem] w-[1.375rem] shrink-0 items-center justify-center rounded-md ${
                        checked ? 'bg-panel-ink' : ''
                      }`}
                      style={{
                        boxShadow: checked ? 'none' : 'inset 0 0 0 0.0625rem var(--panel-border)',
                      }}
                    >
                      {checked && (
                        <Check
                          size="0.75rem"
                          strokeWidth={3}
                          style={{ color: 'var(--panel-text-inverse)' }}
                        />
                      )}
                    </span>
                    <span className="text-body-15-tight min-w-0 flex-1 truncate">
                      {option.label}
                    </span>
                    {/* Facet count: the option alone in its group, the rest of the draft as it is. */}
                    <span className="num text-body-14 shrink-0 text-panel-ink-muted">
                      {countWith({ ...draft, [group.key]: [option.value] })}
                    </span>
                  </button>
                );
              })}
              {group.options.length === 0 && (
                <p className="text-sm text-panel-ink-faint">Няма налични стойности.</p>
              )}
            </div>
          </section>
        ))}
      </div>
    </Drawer>
  );
}

/** Centered dialog on the light panel surface. */
export function Modal({
  open,
  title,
  onClose,
  children,
  wide = false,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  const dialog = useDialog<HTMLDivElement>(open, onClose);
  const titleId = useId();

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          style={{ background: 'rgb(0 0 0 / 0.35)' }}
        >
          <motion.div
            ref={dialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            tabIndex={-1}
            className={`panel max-h-[90vh] w-full ${wide ? 'max-w-2xl' : 'max-w-md'} overflow-y-auto rounded-3xl p-6`}
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ type: 'spring', damping: 28, stiffness: 350 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-5 flex items-center justify-between">
              <h2 id={titleId} className="text-lg font-semibold">
                {title}
              </h2>
              <button
                type="button"
                onClick={onClose}
                data-dialog-close
                className="rounded-full p-1.5 text-panel-ink-muted transition-colors hover:bg-panel-row hover:text-panel-ink"
                aria-label="Затвори"
              >
                <X size="1.125rem" />
              </button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

/**
 * A question over a form (design.md → Windows and navigation; 1925:2,
 * 1925:86): a small window with its own scrim and two answers — the primary
 * one (focused first) and the danger one. Esc, the scrim and its × dismiss
 * it and return to the form. On a phone the answers stack, the primary on
 * top. Above the form's own dialog, so it stacks on a drawer as well as on
 * a modal.
 */
export function ConfirmDialog({
  open,
  title,
  children,
  primary,
  danger,
  onDismiss,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  /** The safe answer, e.g. «Запази». */
  primary: { label: string; onClick: () => void };
  /** The answer that loses something, e.g. «Не запазвай». */
  danger: { label: string; onClick: () => void };
  onDismiss: () => void;
}) {
  const dialog = useDialog<HTMLDivElement>(open, onDismiss);
  const titleId = useId();
  const textId = useId();

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          // On a phone 40 from each side: 322 wide at 402 (1925:86).
          className="fixed inset-0 z-[60] flex items-center justify-center px-10 py-4 sm:p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onDismiss}
          style={{ background: 'rgb(0 0 0 / 0.35)' }}
        >
          <motion.div
            ref={dialog}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={textId}
            tabIndex={-1}
            // 1925:78: 400 wide, radius 24, padding 25 (24 inside the 1 px
            // edge); title 16/22 beside a 32 close, centred; text 13; the
            // answers 44 tall, 12 apart, 8 apart when stacked (1925:129).
            className="panel-strong w-full max-w-[25rem] rounded-3xl p-[1.5625rem]"
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ type: 'spring', damping: 28, stiffness: 350 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3">
              <h2 id={titleId} className="text-title-16-tight font-semibold">
                {title}
              </h2>
              <button
                type="button"
                onClick={onDismiss}
                data-dialog-close
                aria-label="Затвори"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-panel-ink-muted transition-colors hover:bg-panel-row hover:text-panel-ink"
              >
                <X size="1.125rem" />
              </button>
            </div>
            <p id={textId} className="text-body-13 mt-2 text-panel-ink-muted">
              {children}
            </p>
            <div className="mt-6 flex flex-col gap-2 sm:flex-row-reverse sm:gap-3">
              <button
                type="button"
                data-autofocus
                onClick={primary.onClick}
                className="text-body-14 h-11 w-full rounded-full bg-panel-ink px-6 font-semibold text-panel-ink-inverse transition-opacity hover:opacity-85 sm:w-auto sm:flex-1"
              >
                {primary.label}
              </button>
              <button
                type="button"
                onClick={danger.onClick}
                className="text-body-14 h-11 w-full rounded-full border border-panel-status-urgent px-6 font-semibold text-panel-status-urgent transition-colors hover:bg-panel-row sm:w-auto sm:flex-1"
              >
                {danger.label}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold tracking-wider uppercase opacity-70">
        {label}
      </span>
      {children}
      {hint && <span className="mt-1 block text-xs opacity-60">{hint}</span>}
    </label>
  );
}

/** Field inside a light panel, where the same recess would be invisible. */
export const panelInputClass =
  'w-full rounded-xl bg-panel-row px-3.5 py-2.5 text-sm font-medium text-panel-ink outline-none placeholder:text-panel-ink-faint';

export function ErrorNote({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p
      role="alert"
      className="rounded-xl px-3.5 py-2.5 text-sm font-medium"
      style={{
        background: 'var(--glass-chip)',
        boxShadow: 'inset 0 0 0 0.0625rem var(--status-urgent)',
        color: 'var(--text-primary)',
      }}
    >
      {message}
    </p>
  );
}
