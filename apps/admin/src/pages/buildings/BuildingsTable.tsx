import { motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { Buildings } from '../../components/icons';
import { SkeletonBar, StatusDot } from '../../components/ui';
import type { Building } from '../../lib/api';
import { STATUS_LABELS, STATUS_TONES, addressLine, counted, propertyTotal } from './model';

/**
 * Column widths are the Figma contract of `V2/Table · Header · Сгради`
 * (945:5497) for inner width 1096: 300/100/116/200/120/208/52, as
 * percentages so the rhythm holds at any width. «Живущи» folds away below
 * 896 px of table width (`@4xl`).
 */
const COLUMNS = [
  { label: 'Сграда', width: '27.37%', className: '', col: '', bar: 'w-3/4' },
  { label: 'Входове', width: '9.12%', className: 'text-right', col: '', bar: 'ml-auto w-8' },
  { label: 'Имоти', width: '10.58%', className: 'text-right', col: '', bar: 'ml-auto w-10' },
  {
    label: 'Живущи',
    width: '18.25%',
    className: 'hidden @4xl:table-cell',
    col: 'hidden @4xl:table-column',
    bar: 'w-2/3',
  },
  { label: 'Статус', width: '10.95%', className: '', col: '', bar: 'w-2/3' },
  { label: 'Домоуправител', width: '18.98%', className: '', col: '', bar: 'w-2/3' },
  { label: '', width: '4.75%', className: '', col: '', bar: 'hidden' },
] as const;

const COLUMN_COUNT = COLUMNS.length;

/** The buildings card: the header stays in every state, `children` is the body. */
export function BuildingsTable({ children }: { children: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="glass-data table-card @container overflow-hidden"
    >
      <table className="w-full table-fixed text-left">
        <colgroup>
          {COLUMNS.map((column, i) => (
            // A hidden cell still leaves its <col> holding the width; the
            // class is spelled out so Tailwind generates it.
            <col key={i} className={column.col} style={{ width: column.width }} />
          ))}
        </colgroup>
        <thead>
          <tr className="text-overline-12 font-semibold text-ink-soft uppercase">
            {COLUMNS.map((column, i) => (
              <th
                key={i}
                scope="col"
                className={`h-[2.5625rem] px-3 font-semibold ${column.className}`}
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </motion.div>
  );
}

export function SkeletonRows({ rows = 3 }: { rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }, (_, i) => (
        <tr key={i}>
          {COLUMNS.map((column, c) => (
            <td key={c} className={`h-[4.0625rem] px-3 ${column.className}`}>
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
      <td colSpan={COLUMN_COUNT} className="p-0">
        {children}
      </td>
    </tr>
  );
}

function Tile() {
  return (
    <span
      aria-hidden
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink-soft"
      style={{
        background: 'var(--glass-inner)',
        boxShadow: 'inset 0 0 0 0.0625rem var(--glass-edge-soft)',
      }}
    >
      <Buildings size="1.375rem" />
    </span>
  );
}

const CELL = 'px-3 align-middle';

// TODO(M2): residents by account status, entrance names and the house manager
// once `GET /buildings` carries them (asked in WHI-96); «—» until then.
const UNKNOWN = <span className="text-body-14 text-ink-soft">—</span>;

export function BuildingRow({ building }: { building: Building }) {
  return (
    <tr className="h-[4.0625rem] transition-colors hover:bg-glass-inner-soft">
      <td className={CELL}>
        <div className="flex items-center gap-3">
          <Tile />
          <div className="min-w-0">
            <p className="text-body-14 truncate font-semibold" title={building.name}>
              {building.name}
            </p>
            <p className="text-body-13-tight truncate text-ink-soft" title={addressLine(building)}>
              {addressLine(building)}
            </p>
          </div>
        </div>
      </td>
      <td className={`${CELL} num text-right`}>
        <p className="text-title-16 font-medium">{building.entranceCount}</p>
      </td>
      <td className={`${CELL} num text-right`}>
        <p className="text-title-16 font-medium">{propertyTotal(building)}</p>
        <p className="text-body-13-tight text-ink-soft">
          {counted(building.floors, 'етаж', 'етажа')}
        </p>
      </td>
      <td className={`${CELL} hidden @4xl:table-cell`}>{UNKNOWN}</td>
      <td className={CELL}>
        <StatusDot tone={STATUS_TONES[building.status]}>{STATUS_LABELS[building.status]}</StatusDot>
      </td>
      <td className={CELL}>{UNKNOWN}</td>
      {/* TODO(M2): the row menu (1262:15816) comes with the building page. */}
      <td className={CELL} />
    </tr>
  );
}

/** Phone layout (952:5831): one card per building. */
export function BuildingCard({ building }: { building: Building }) {
  return (
    <article className="glass-data p-4" aria-label={building.name}>
      <div className="flex items-center gap-3">
        <Tile />
        <div className="min-w-0">
          <p className="text-body-14 truncate font-semibold" title={building.name}>
            {building.name}
          </p>
          <p className="text-body-13-tight truncate text-ink-soft" title={addressLine(building)}>
            {addressLine(building)}
          </p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">
        <StatusDot tone={STATUS_TONES[building.status]}>{STATUS_LABELS[building.status]}</StatusDot>
        <span className="num text-body-13-tight text-ink-soft">
          {counted(building.entranceCount, 'вход', 'входа')} ·{' '}
          {counted(propertyTotal(building), 'имот', 'имота')}
        </span>
      </div>
    </article>
  );
}

/** Card list that replaces the table on a phone. */
export function BuildingCards({ children }: { children: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="space-y-2.5"
    >
      {children}
    </motion.div>
  );
}
