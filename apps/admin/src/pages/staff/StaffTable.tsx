import { motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { SkeletonBar } from '../../components/ui';

/**
 * Column widths are the Figma contract of `V2/Table · Header · Служители`
 * (868:344) for inner width 1096: 224/152/112/180/100/196/80/52. They are
 * expressed as percentages so the table keeps the drawn rhythm at any
 * container width, and the less important columns fold away as it narrows.
 */
const COLUMNS = [
  { label: 'Служител', width: '20.44%', className: '', bar: 'w-3/4' },
  { label: 'Контакт', width: '13.87%', className: 'hidden @4xl:table-cell', bar: 'w-2/3' },
  { label: 'Статус', width: '10.22%', className: '', bar: 'w-1/2' },
  { label: 'Роли', width: '16.42%', className: '', bar: 'w-3/4' },
  { label: 'Обхват', width: '9.12%', className: 'hidden @4xl:table-cell', bar: 'w-2/3' },
  { label: 'Покана', width: '17.88%', className: 'hidden @5xl:table-cell', bar: 'w-2/3' },
  { label: 'От', width: '7.30%', className: 'hidden @5xl:table-cell', bar: 'w-1/2' },
  { label: '', width: '4.75%', className: '', bar: 'ml-auto w-8' },
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
      <table className="mx-5 w-[calc(100%-2.5rem)] table-fixed text-left">
        <colgroup>
          {COLUMNS.map((column, i) => (
            <col key={i} style={{ width: column.width }} />
          ))}
        </colgroup>
        <thead>
          <tr className="text-overline-12 font-semibold text-ink-soft uppercase">
            {COLUMNS.map((column, i) => (
              <th
                key={i}
                scope="col"
                className={`px-3 pt-5 pb-3 font-semibold ${column.className}`}
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
