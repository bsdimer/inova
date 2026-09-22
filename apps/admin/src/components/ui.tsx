import { AnimatePresence, motion } from 'framer-motion';
import { Check, ChevronDown, X } from './icons';
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/** Initials on glass. Two letters, because Bulgarian names are two words. */
export function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
  return (
    <span
      aria-hidden
      className="flex shrink-0 items-center justify-center rounded-full font-semibold"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.34,
        background: 'var(--glass-avatar)',
        boxShadow: 'inset 0 0 0 1px var(--glass-avatar-edge)',
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
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: 'button' | 'submit';
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="cta px-5 py-2.5 text-sm font-semibold transition-opacity disabled:opacity-45"
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
      className={`glass-control rounded-full px-4 py-2 text-sm font-semibold transition-opacity disabled:opacity-40 ${
        danger ? 'text-status-urgent' : 'text-ink'
      }`}
    >
      {children}
    </button>
  );
}

export function IconButton({
  children,
  onClick,
  disabled = false,
  label,
  active = false,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  label: string;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors disabled:opacity-40 ${
        active ? 'glass-control-active' : 'glass-control text-ink-muted hover:text-ink'
      }`}
    >
      {children}
    </button>
  );
}

/**
 * The light counterpart of `IconButton`: a solid white disc with a dark glyph.
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
      style={{ width: size, height: size }}
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
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap ${
        muted ? 'text-ink-faint' : 'text-ink-soft'
      }`}
      style={{
        background: 'var(--glass-chip)',
        boxShadow: 'inset 0 0 0 1px var(--glass-edge-soft)',
      }}
    >
      {children}
    </span>
  );
}

/** Active-filter pill: says what it filters and how to drop it. */
export function FilterChip({ children, onClear }: { children: ReactNode; onClear: () => void }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full py-1 pr-1.5 pl-3 text-xs font-medium whitespace-nowrap text-ink-soft"
      style={{
        background: 'var(--glass-chip)',
        boxShadow: 'inset 0 0 0 1px var(--glass-edge-soft)',
      }}
    >
      {children}
      <button
        type="button"
        onClick={onClear}
        aria-label="Премахни филтъра"
        className="rounded-full p-0.5 text-ink-muted transition-colors hover:text-ink"
      >
        <X size={12} />
      </button>
    </span>
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
                visibility: box ? 'visible' : 'hidden',
              }}
              className="panel-strong fixed z-50 rounded-2xl p-1.5"
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
          className={`flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-opacity disabled:cursor-not-allowed disabled:opacity-40 ${
            active ? 'glass-control-active' : 'glass-control text-ink'
          }`}
        >
          {label}
          {active && <span className="num text-xs opacity-70">{selected.length}</span>}
          <ChevronDown size={14} className="opacity-70" />
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
                  style={{ boxShadow: checked ? 'none' : 'inset 0 0 0 1px var(--panel-border)' }}
                >
                  {checked && (
                    <Check
                      size={11}
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
      className={`inline-flex items-center gap-2 text-sm whitespace-nowrap ${
        onPanel ? 'text-panel-ink' : 'text-ink-soft'
      }`}
    >
      <span
        aria-hidden
        className="h-2 w-2 shrink-0 rounded-full"
        style={{
          background: color,
          boxShadow: tone === 'muted' ? 'none' : `0 0 8px ${color}`,
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
          <X size={12} />
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
          boxShadow: 'inset 0 0 0 1px var(--glass-edge-soft)',
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

/**
 * Side panel with a pinned header and footer; only the middle scrolls, so the
 * save button never slides under the fold. On a narrow screen it becomes a
 * bottom sheet.
 */
export function Drawer({
  open,
  onClose,
  header,
  footer,
  children,
  label,
}: {
  open: boolean;
  onClose: () => void;
  header: ReactNode;
  footer: ReactNode;
  children: ReactNode;
  label: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-end sm:items-stretch"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          style={{ background: 'rgb(0 0 0 / 0.35)' }}
        >
          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-label={label}
            onClick={(e) => e.stopPropagation()}
            initial={{ x: 0, y: 40, opacity: 0 }}
            animate={{ x: 0, y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ type: 'spring', damping: 30, stiffness: 320 }}
            className="panel flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-3xl sm:h-full sm:max-h-none sm:w-[420px] sm:rounded-none sm:rounded-l-3xl"
          >
            <div className="shrink-0 border-b border-panel-divider px-5 py-4">{header}</div>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
            <div className="shrink-0 border-t border-panel-divider px-5 py-4">{footer}</div>
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
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
            role="dialog"
            aria-modal="true"
            className={`panel max-h-[90vh] w-full ${wide ? 'max-w-2xl' : 'max-w-md'} overflow-y-auto rounded-3xl p-6`}
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ type: 'spring', damping: 28, stiffness: 350 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-semibold">{title}</h2>
              <button
                onClick={onClose}
                className="rounded-full p-1.5 text-panel-ink-muted transition-colors hover:bg-panel-row hover:text-panel-ink"
                aria-label="Затвори"
              >
                <X size={18} />
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

/** Field on glass: a recess in the photograph, never a light chip on top. */
export const inputClass =
  'glass-control w-full rounded-xl px-3.5 py-2.5 text-sm font-medium text-ink outline-none placeholder:text-ink-faint';

/** Field inside a light panel, where the same recess would be invisible. */
export const panelInputClass =
  'w-full rounded-xl bg-panel-row px-3.5 py-2.5 text-sm font-medium text-panel-ink outline-none placeholder:text-panel-ink-faint';

export function ErrorNote({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p
      className="rounded-xl px-3.5 py-2.5 text-sm font-medium"
      style={{
        background: 'var(--glass-chip)',
        boxShadow: 'inset 0 0 0 1px var(--status-urgent)',
        color: 'var(--text-primary)',
      }}
    >
      {message}
    </p>
  );
}
