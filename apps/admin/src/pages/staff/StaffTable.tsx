import { motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { SkeletonBar } from '../../components/ui';

const COLUMNS = [
  { label: 'Member', className: '', bar: 'w-3/4' },
  { label: 'Contact', className: 'hidden @4xl:table-cell', bar: 'w-2/3' },
  { label: 'Status', className: '', bar: 'w-1/2' },
  { label: 'Roles', className: '', bar: 'w-3/4' },
  { label: 'Scope', className: 'hidden @4xl:table-cell', bar: 'w-2/3' },
  { label: 'Invite', className: 'hidden @5xl:table-cell', bar: 'w-2/3' },
  { label: 'Since', className: 'hidden @5xl:table-cell', bar: 'w-1/2' },
  { label: 'Actions', className: 'text-right', bar: 'ml-auto w-8' },
] as const;

export const COLUMN_COUNT = COLUMNS.length;

/**
 * Card + header for the staff list. The toolbar and the head stay put in
 * every state; `strip` sits between them and the body, `children` is the body.
 */
export function StaffTable({ strip, children }: { strip?: ReactNode; children: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="@container"
    >
      <div className="rounded-3xl border border-sand/70 bg-white/80 shadow-sm shadow-landmark/5 backdrop-blur">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-sand/80 bg-cream/70 text-xs font-semibold tracking-wider text-landmark uppercase">
              {COLUMNS.map((column) => (
                <th
                  key={column.label}
                  className={`px-4 py-3 first:rounded-tl-3xl last:rounded-tr-3xl ${column.className}`}
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {strip && (
              <tr>
                <td colSpan={COLUMN_COUNT} className="border-b border-sand/60 p-0">
                  {strip}
                </td>
              </tr>
            )}
            {children}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}

export function SkeletonRows({ rows = 3 }: { rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }, (_, i) => (
        <tr key={i} className="border-b border-sand/60 last:border-0">
          {COLUMNS.map((column) => (
            <td key={column.label} className={`px-4 py-5 ${column.className}`}>
              <SkeletonBar className={column.bar} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

export function BodyMessage({ children }: { children: ReactNode }) {
  return (
    <tr>
      <td colSpan={COLUMN_COUNT}>{children}</td>
    </tr>
  );
}
