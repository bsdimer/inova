import { motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { Building2, FileMagnifyingGlass, Plus, UploadSimple } from '../components/icons';
import { Chip, SolidIconButton } from '../components/ui';

/**
 * Табло, laid out as drawn in Figma Screens 859:1073 — a wide Баланс над a
 * narrow column of two document cards and the signals card, with Календар and
 * Преглед на сгради down the right.
 *
 * Every figure on that mock-up belongs to a milestone that has not shipped:
 * the balance to M3–M4, the signals to M6, the calendar's events to M11, the
 * buildings to M2. None of them is invented here — each slot shows «—» and
 * says which milestone fills it. The month grid is the one thing this page can
 * compute honestly, so it is real.
 */
export function DashboardPage() {
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
      <div className="space-y-4 xl:col-span-2">
        <BalanceCard />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-4">
            <UploadCard />
            <ReportCard />
          </div>
          <SignalsCard />
        </div>
      </div>

      <div className="space-y-4">
        <CalendarCard />
        <BuildingsCard />
      </div>
    </div>
  );
}

/** A dashboard card: the glass, the entrance, and the milestone marker. */
function Card({
  children,
  delay = 0,
  className = '',
  milestone,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
  milestone: string;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay }}
      className={`glass relative flex flex-col p-6 ${className}`}
    >
      <span className="absolute top-5 right-5 z-10">
        <Chip muted>{milestone}</Chip>
      </span>
      {children}
    </motion.section>
  );
}

/** The value a milestone has not produced yet. */
function Blank({ className = '' }: { className?: string }) {
  return <span className={`text-ink-faint ${className}`}>—</span>;
}

function BalanceCard() {
  return (
    <Card milestone="M3–M4">
      <div className="flex flex-wrap items-baseline justify-between gap-2 pr-16">
        <h2 className="text-base font-semibold">Баланс</h2>
        <p className="text-xs text-ink-muted">Портфолио</p>
      </div>

      <p className="num mt-2 text-5xl font-semibold tracking-tight">
        <Blank />
      </p>

      <div className="mt-6 flex flex-wrap items-center gap-x-8 gap-y-6">
        <div className="flex items-center gap-5">
          <Figure label="Платили" />
          <CollectedRing />
          <Figure label="Задължения" />
        </div>
        <div className="ml-auto flex flex-col gap-2">
          <button
            type="button"
            disabled
            title="Начисленията и касата идват с M3–M4."
            className="glass-solid rounded-full px-5 py-2.5 text-sm font-semibold disabled:opacity-45"
          >
            Виж детайли
          </button>
          <button
            type="button"
            disabled
            title="Известията за задължения идват с M7."
            className="cta px-5 py-2.5 text-sm font-semibold disabled:opacity-45"
          >
            Изпрати известия
          </button>
        </div>
      </div>
    </Card>
  );
}

function Figure({ label }: { label: string }) {
  return (
    <div>
      <p className="text-xs text-ink-muted">{label}</p>
      <p className="num mt-0.5 text-sm font-semibold">
        <Blank />
      </p>
    </div>
  );
}

/**
 * The collected share. The ring is drawn at zero rather than at a plausible
 * angle: an arc at 71% would read as a measured number.
 */
function CollectedRing() {
  return (
    <div
      className="flex h-24 w-24 shrink-0 flex-col items-center justify-center rounded-full"
      style={{
        background: 'var(--glass-inner-soft)',
        boxShadow: 'inset 0 0 0 2px var(--ring-track)',
      }}
    >
      <span className="num text-lg font-semibold">
        <Blank />
      </span>
      <span className="text-[11px] text-ink-muted">събрани</span>
    </div>
  );
}

function UploadCard() {
  return (
    <Card milestone="M4" delay={0.05} className="items-center text-center">
      <RoundGlyph>
        <UploadSimple size={22} />
      </RoundGlyph>
      <h2 className="mt-4 text-base font-semibold">Качи документ</h2>
      <p className="mt-1.5 text-sm text-ink-muted">
        Фактури за плащане, документи за сгради и други.
      </p>
      <span className="mt-4">
        <button
          type="button"
          disabled
          title="Хранилището на документи идва с M4."
          className="glass-control rounded-full px-4 py-2 text-sm font-semibold text-ink disabled:opacity-40"
        >
          Избери файл
        </button>
      </span>
    </Card>
  );
}

function ReportCard() {
  return (
    <Card milestone="M4" delay={0.1} className="items-center text-center">
      <RoundGlyph>
        <FileMagnifyingGlass size={22} />
      </RoundGlyph>
      <h2 className="mt-4 text-base font-semibold">Всичко важно в една справка</h2>
      <p className="mt-1.5 text-sm text-ink-muted">Преглед на данни, експорт в PDF и печат.</p>
      <span className="mt-4">
        <button
          type="button"
          disabled
          title="Справките идват с M4."
          className="glass-control rounded-full px-4 py-2 text-sm font-semibold text-ink disabled:opacity-40"
        >
          Направи справка
        </button>
      </span>
    </Card>
  );
}

function RoundGlyph({ children }: { children: ReactNode }) {
  return (
    <span
      className="flex h-14 w-14 items-center justify-center rounded-full text-ink-soft"
      style={{
        background: 'var(--glass-inner)',
        boxShadow: 'inset 0 0 0 1px var(--glass-edge-soft)',
      }}
    >
      {children}
    </span>
  );
}

const SIGNAL_FACETS = ['Чакащи', 'Планирани', 'Спешни', 'Решени'] as const;

function SignalsCard() {
  return (
    <Card milestone="M6" delay={0.15}>
      <div className="flex items-center gap-3 pr-16">
        <Segmented options={['Сигнали', 'Анкети']} selected="Сигнали" />
      </div>

      <p className="num mt-6 text-center text-6xl font-semibold tracking-tight">
        <Blank />
      </p>
      <p className="mt-1 text-center text-sm text-ink-muted">отворени нередности</p>

      <div className="mt-5 grid grid-cols-2 gap-2">
        {SIGNAL_FACETS.map((facet) => (
          <span
            key={facet}
            className="glass-control flex items-center justify-between rounded-full px-3.5 py-2 text-sm text-ink-soft"
          >
            {facet}
            <Blank className="num" />
          </span>
        ))}
      </div>

      <p className="mt-6 text-xs font-semibold tracking-wider text-ink-faint uppercase">
        Спешни сега
      </p>
      <p className="mt-2 text-sm text-ink-muted">
        Сигналите на жителите идват с раздела «Нередности» (M6).
      </p>
    </Card>
  );
}

/** The Ден / Месец and Сигнали / Анкети switches: one option is real today. */
function Segmented({ options, selected }: { options: readonly string[]; selected: string }) {
  return (
    <span className="glass-control inline-flex rounded-full p-1">
      {options.map((option) => (
        <span
          key={option}
          aria-current={option === selected ? 'true' : undefined}
          className={`rounded-full px-3 py-1 text-xs font-medium ${
            option === selected ? 'glass-control-active' : 'text-ink-faint'
          }`}
        >
          {option}
        </span>
      ))}
    </span>
  );
}

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'];
const MONTHS = [
  'Януари',
  'Февруари',
  'Март',
  'Април',
  'Май',
  'Юни',
  'Юли',
  'Август',
  'Септември',
  'Октомври',
  'Ноември',
  'Декември',
];

/**
 * Six weeks from Monday, the way the mock-up draws them. The days either side
 * of the month are dimmed rather than hidden, so the grid never reflows.
 */
function monthGrid(today: Date): { day: number; inMonth: boolean; isToday: boolean }[] {
  const first = new Date(today.getFullYear(), today.getMonth(), 1);
  const offset = (first.getDay() + 6) % 7; // Sunday is 0 in JS, Monday leads here.
  const start = new Date(first);
  start.setDate(1 - offset);

  return Array.from({ length: 42 }, (_, i) => {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    return {
      day: date.getDate(),
      inMonth: date.getMonth() === today.getMonth(),
      isToday: date.toDateString() === today.toDateString(),
    };
  });
}

function CalendarCard() {
  const today = new Date();
  const days = monthGrid(today);

  return (
    <Card milestone="M11" delay={0.2}>
      <div className="flex items-center gap-3 pr-16">
        <h2 className="text-base font-semibold">Календар</h2>
      </div>
      <div className="mt-3">
        <Segmented options={['Ден', 'Месец']} selected="Месец" />
      </div>

      <p className="mt-5 text-center text-sm font-medium">
        {MONTHS[today.getMonth()]} <span className="num">{today.getFullYear()}</span>
      </p>

      <div className="mt-3 grid grid-cols-7 gap-y-1 text-center">
        {WEEKDAYS.map((d) => (
          <span key={d} className="pb-1 text-[11px] text-ink-faint">
            {d}
          </span>
        ))}
        {days.map((d, i) => (
          <span
            key={i}
            className={`num mx-auto flex h-8 w-8 items-center justify-center rounded-full text-sm ${
              d.inMonth ? 'text-ink-soft' : 'text-ink-faint opacity-50'
            }`}
            style={
              d.isToday
                ? { background: 'var(--selected-day)', color: 'var(--text-on-solid)' }
                : undefined
            }
            aria-current={d.isToday ? 'date' : undefined}
          >
            {d.day}
          </span>
        ))}
      </div>

      <p className="mt-5 text-xs font-semibold tracking-wider text-ink-faint uppercase">
        Предстоящи
      </p>
      <p className="mt-2 text-sm text-ink-muted">
        Общи събрания, отчети и задачи на екипа се появяват тук с раздела «Задачи» (M11).
      </p>
    </Card>
  );
}

function BuildingsCard() {
  return (
    <Card milestone="M2" delay={0.25}>
      <div className="flex items-start gap-3 pr-16">
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold">Преглед на сгради</h2>
          <p className="num mt-0.5 text-xs text-ink-muted">
            <Blank /> сгради · <Blank /> апартамента
          </p>
        </div>
      </div>

      <div className="mt-5 flex items-start gap-4">
        <Tile label="Добави" caption="нова сграда" disabled>
          <Plus size={22} />
        </Tile>
        <Tile label="Сгради" caption="идват с M2" disabled>
          <Building2 size={22} />
        </Tile>
      </div>
    </Card>
  );
}

function Tile({
  children,
  label,
  caption,
  disabled,
}: {
  children: ReactNode;
  label: string;
  caption: string;
  disabled: boolean;
}) {
  return (
    <span className={`flex w-20 flex-col items-center text-center ${disabled ? 'opacity-55' : ''}`}>
      <SolidIconButton label={label} disabled={disabled} size={56}>
        {children}
      </SolidIconButton>
      <span className="mt-2 text-xs font-medium">{label}</span>
      <span className="text-[11px] text-ink-faint">{caption}</span>
    </span>
  );
}
