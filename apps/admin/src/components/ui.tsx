import { AnimatePresence, motion } from 'framer-motion';
import { Check, ChevronDown, X } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';

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
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-gold-black/45 p-4 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className={`max-h-[90vh] w-full ${wide ? 'max-w-2xl' : 'max-w-md'} overflow-y-auto rounded-3xl border border-sand/70 bg-cream p-6 shadow-2xl shadow-gold-black/20`}
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ type: 'spring', damping: 28, stiffness: 350 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-extrabold tracking-tight">{title}</h2>
              <button
                onClick={onClose}
                className="rounded-full p-1.5 text-landmark transition-colors hover:bg-sand/60 hover:text-gold-black"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

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
      className="rounded-full bg-gradient-to-r from-orange-bright to-orange px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-orange/25 transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-orange/30 disabled:translate-y-0 disabled:opacity-50 disabled:shadow-none"
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
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-full border px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-40 ${
        danger
          ? 'border-danger/25 text-danger hover:bg-danger/5'
          : 'border-stone/35 text-gold-black hover:border-orange/35 hover:bg-orange/5'
      }`}
    >
      {children}
    </button>
  );
}

const STATUS_STYLES: Record<string, string> = {
  active: 'bg-success/10 text-success',
  invited: 'bg-orange/10 text-ember',
  suspended: 'bg-warning/10 text-warning',
  revoked: 'bg-danger/10 text-danger',
  trial: 'bg-landmark/10 text-landmark',
  offboarded: 'bg-stone/15 text-landmark',
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-1 text-xs font-bold capitalize ${
        STATUS_STYLES[status] ?? 'bg-stone/15 text-landmark'
      }`}
    >
      {status}
    </span>
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
      <span className="mb-1.5 block text-sm font-semibold">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-landmark">{hint}</span>}
    </label>
  );
}

export const inputClass =
  'w-full rounded-xl border border-sand bg-white/75 px-3.5 py-2.5 text-sm font-medium text-gold-black shadow-sm outline-none transition-all placeholder:text-stone focus:border-orange focus:ring-4 focus:ring-orange/10';

export function ErrorNote({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p className="rounded-xl border border-danger/15 bg-danger/5 px-3.5 py-2.5 text-sm font-medium text-danger">
      {message}
    </p>
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
      className={`flex h-8 w-8 items-center justify-center rounded-full border transition-colors disabled:opacity-40 ${
        active
          ? 'border-orange/35 bg-orange/8 text-ember'
          : 'border-stone/35 text-landmark hover:border-orange/35 hover:bg-orange/5 hover:text-gold-black'
      }`}
    >
      {children}
    </button>
  );
}

/** Small neutral pill for a role, a tag or a count. */
export function Chip({ children, muted = false }: { children: ReactNode; muted?: boolean }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${
        muted ? 'bg-sand/45 text-landmark' : 'bg-sand/70 text-gold-black'
      }`}
    >
      {children}
    </span>
  );
}

/** Active-filter pill with a clear affordance. */
export function FilterChip({ children, onClear }: { children: ReactNode; onClear: () => void }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-orange/10 py-1 pr-1.5 pl-2.5 text-xs font-semibold text-ember">
      {children}
      <button
        type="button"
        onClick={onClear}
        aria-label="Clear filter"
        className="rounded-full p-0.5 transition-colors hover:bg-orange/15"
      >
        <X size={12} />
      </button>
    </span>
  );
}

/**
 * Anchored popover; closes on outside click and Escape. With `align: 'auto'`
 * (the default) it measures itself after opening and hugs whichever edge of
 * the anchor keeps it inside the viewport, so a facet at the page edge never
 * causes horizontal scroll.
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
  const ref = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [side, setSide] = useState<'left' | 'right'>(align === 'right' ? 'right' : 'left');

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
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
    if (!open || align !== 'auto' || !ref.current || !menuRef.current) return;
    const anchorBox = ref.current.getBoundingClientRect();
    const width = menuRef.current.offsetWidth;
    const fitsLeft = anchorBox.left + width <= window.innerWidth;
    const fitsRight = anchorBox.right - width >= 0;
    setSide(fitsLeft || !fitsRight ? 'left' : 'right');
  }, [open, align]);

  return (
    <div ref={ref} className="relative">
      {anchor}
      <AnimatePresence>
        {open && (
          <motion.div
            ref={menuRef}
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className={`absolute top-full z-30 mt-1.5 min-w-full rounded-2xl border border-sand/80 bg-white p-1.5 shadow-xl shadow-gold-black/10 ${
              side === 'right' ? 'right-0' : 'left-0'
            }`}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
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
          className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
            active
              ? 'border-orange/35 bg-orange/8 text-ember'
              : 'border-stone/35 bg-white/70 text-gold-black hover:border-orange/35'
          }`}
        >
          {label}
          {active && <span className="text-xs">{selected.length}</span>}
          <ChevronDown size={14} />
        </button>
      }
    >
      <ul role="listbox" aria-multiselectable className="min-w-48">
        {options.map((option) => {
          const checked = selected.includes(option.value);
          return (
            <li key={option.value}>
              <button
                type="button"
                role="option"
                aria-selected={checked}
                onClick={() => toggle(option.value)}
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm font-medium transition-colors hover:bg-orange/6"
              >
                <span
                  className={`flex h-4 w-4 items-center justify-center rounded border ${
                    checked ? 'border-orange bg-orange text-white' : 'border-stone/60 bg-white'
                  }`}
                >
                  {checked && <Check size={11} strokeWidth={3} />}
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

export type StripTone = 'info' | 'success' | 'danger' | 'muted' | 'busy';

const STRIP_STYLES: Record<StripTone, string> = {
  info: 'bg-orange/8 text-ember',
  success: 'bg-success/10 text-success',
  danger: 'bg-danger/8 text-danger',
  muted: 'bg-cream/80 text-landmark',
  busy: 'bg-cream/80 text-landmark',
};

/** Full-width message strip that sits between a table head and its rows. */
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
      className={`flex items-center gap-3 px-4 py-2 text-xs font-semibold ${STRIP_STYLES[tone]}`}
    >
      <span className={`shrink-0 ${tone === 'busy' ? 'animate-spin' : ''}`}>{icon}</span>
      <span className="min-w-0 flex-1">{children}</span>
      {action}
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="rounded-full p-1 transition-colors hover:bg-gold-black/6"
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
      className={`block h-2.5 animate-pulse rounded-full bg-sand/80 ${className}`}
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
    <div className="mx-auto flex max-w-md flex-col items-center px-6 py-12 text-center">
      <span className="flex h-13 w-13 items-center justify-center rounded-2xl bg-cream text-landmark">
        {icon}
      </span>
      <h2 className="mt-4 text-base font-extrabold tracking-tight">{title}</h2>
      <p className="mt-2 text-sm text-landmark">{children}</p>
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
        danger ? 'text-danger hover:bg-danger/6' : 'text-gold-black hover:bg-orange/6'
      }`}
    >
      <span className="shrink-0">{icon}</span>
      <span className="flex-1">{children}</span>
      {trailing}
    </button>
  );
}
