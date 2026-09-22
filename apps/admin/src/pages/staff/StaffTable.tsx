import { motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { SkeletonBar } from '../../components/ui';

/**
 * Column widths are the Figma contract for Main 1136 (inner width 1094):
 * 208/160/112/196/112/184/72/52. They are expressed as percentages so the
 * table keeps the drawn rhythm at any container width, and the less important
 * columns fold into the row's detail panel as the container narrows.
 */
const COLUMNS = [
  { label: 'Служител', width: '19.0%', className: '', bar: 'w-3/4' },
  { label: 'Контакт', width: '14.6%', className: 'hidden @4xl:table-cell', bar: 'w-2/3' },
  { label: 'Статус', width: '10.2%', className: '', bar: 'w-1/2' },
  { label: 'Роли', width: '17.9%', className: '', bar: 'w-3/4' },
  { label: 'Обхват', width: '10.2%', className: 'hidden @4xl:table-cell', bar: 'w-2/3' },
  { label: 'Покана', width: '16.8%', className: 'hidden @5xl:table-cell', bar: 'w-2/3' },
  { label: 'От', width: '6.6%', className: 'hidden @5xl:table-cell', bar: 'w-1/2' },
  { label: '', width: '4.7%', className: '', bar: 'ml-auto w-8' },
] as const;

export const COLUMN_COUNT = COLUMNS.length;

/**
 * The staff list card. The toolbar and the header stay put in every state;
 * `strip` sits between the header and the body, `children` is the body.
 */
export function StaffTable({ strip, children }: { strip?: ReactNode; children: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="glass-data @container overflow-hidden"
    >
      <table className="w-full table-fixed text-left text-sm">
        <colgroup>
          {COLUMNS.map((column, i) => (
            <col key={i} style={{ width: column.width }} />
          ))}
        </colgroup>
        <thead>
          <tr className="text-xs font-semibold tracking-wider text-ink-faint uppercase">
            {COLUMNS.map((column, i) => (
              <th
                key={i}
                scope="col"
                className={`px-3 pt-5 pb-3 first:pl-6 last:pr-6 ${column.className}`}
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {strip && (
            <tr>
              <td colSpan={COLUMN_COUNT} className="p-0">
                {strip}
              </td>
            </tr>
          )}
          {children}
        </tbody>
      </table>
    </motion.div>
  );
}

export function SkeletonRows({ rows = 3 }: { rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }, (_, i) => (
        <tr key={i} className="border-t border-glass-divider">
          {COLUMNS.map((column, c) => (
            <td key={c} className={`h-16 px-3 first:pl-6 last:pr-6 ${column.className}`}>
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
      <td colSpan={COLUMN_COUNT} className="border-t border-glass-divider p-0">
        {children}
      </td>
    </tr>
  );
}

/** Card list that replaces the table on a phone. */
export function StaffCards({ strip, children }: { strip?: ReactNode; children: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="space-y-2.5"
    >
      {strip && <div className="glass-data overflow-hidden">{strip}</div>}
      {children}
    </motion.div>
  );
}
