import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';

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
