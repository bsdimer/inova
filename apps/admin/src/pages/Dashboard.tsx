import { Link } from '@tanstack/react-router';
import { motion } from 'framer-motion';
import { useState, type ReactNode } from 'react';
import { BalanceBubbles } from '../components/BalanceBubbles';
import {
  ArrowRight,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  Clock,
  FileMagnifyingGlass,
  Plus,
  TriangleAlert,
  UploadSimple,
} from '../components/icons';
import { SecondaryButton } from '../components/ui';

/**
 * Табло, laid out as drawn in Figma Screens 859:1073 — a wide Баланс above a
 * narrow Документи card and the signals card, with Календар and Преглед на
 * сгради down the right.
 *
 * Every figure on that mock-up belongs to a milestone that has not shipped:
 * the balance to M3–M4, the signals to M6, the calendar's events to M11, the
 * buildings to M2. None of them is invented here — each slot shows «—», and the
 * card names its milestone on hover. The month grid is the one thing this page
 * can compute honestly, so it is real.
 */
export function DashboardPage() {
  return (
    // Grid 1136 = 696 + 20 + 420, and the left column 696 = 320 + 20 + 356.
    // Both columns run to the foot of the screen, as the frame does: the second
    // row on the left and Календар on the right take up what is left.
    <div className="grid grid-cols-1 gap-x-5 gap-y-4 xl:h-full xl:grid-cols-[696fr_420fr]">
      <div className="flex flex-col gap-4">
        <BalanceCard />
        <div className="grid flex-1 grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-[320fr_356fr]">
          <DocumentsCard />
          <SignalsCard />
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <CalendarCard />
        <BuildingsCard />
      </div>
    </div>
  );
}

/**
 * A dashboard card: glass, 24 of padding inside a 1 px edge (25 to the
 * content, as the frames measure it). `milestone` is what fills it.
 */
function Card({
  milestone,
  children,
  delay = 0,
  className = '',
}: {
  milestone: string;
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay }}
      title={`Данните идват с ${milestone}.`}
      className={`glass flex flex-col p-[25px] ${className}`}
    >
      {children}
    </motion.section>
  );
}

/** The value a milestone has not produced yet. */
function Blank({ className = '' }: { className?: string }) {
  return <span className={`text-ink-faint ${className}`}>—</span>;
}

/** V2/Button · Circle (846:142): the 32 px disc that leads to a card's section. */
function SectionArrow({ to, label }: { to: string; label: string }) {
  return (
    <Link
      to={to}
      aria-label={label}
      className="glass-solid flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
    >
      <ArrowRight size={16} />
    </Link>
  );
}

/** V2/Toggle (846:240). One option is real today; the other waits for its section. */
function Toggle({ options, selected }: { options: readonly string[]; selected: string }) {
  return (
    <span
      className="inline-flex shrink-0 items-center gap-0.5 rounded-full p-1"
      style={{
        background: 'var(--glass-inner-soft)',
        boxShadow: 'inset 0 0 0 1px var(--glass-edge)',
      }}
    >
      {options.map((option) => (
        <span
          key={option}
          aria-current={option === selected ? 'true' : undefined}
          className={`text-label-12 rounded-full px-2.5 py-1 font-semibold ${
            option === selected ? 'bg-glass-segment text-ink-solid' : 'text-ink-soft'
          }`}
        >
          {option}
        </span>
      ))}
    </span>
  );
}

/** V2/Label/12 Semibold · overline, as the list headings draw it. */
function Overline({ children }: { children: ReactNode }) {
  return (
    <p className="text-overline-12 pb-0.5 font-semibold text-ink-muted uppercase">{children}</p>
  );
}

const MONTHS = [
  'януари',
  'февруари',
  'март',
  'април',
  'май',
  'юни',
  'юли',
  'август',
  'септември',
  'октомври',
  'ноември',
  'декември',
];

function BalanceCard() {
  const month = MONTHS[new Date().getMonth()];
  return (
    <Card milestone="M3–M4" className="gap-2.5">
      <header className="flex items-center gap-3">
        <h2 className="text-title-16 flex-1 font-medium text-ink-soft">Баланс</h2>
        <p className="num text-body-13-tight whitespace-nowrap text-ink-muted">
          Портфолио · <Blank /> сгради · {month}
        </p>
      </header>

      {/* The hero sum sits where the frame puts it: 129 in from the card's content edge. */}
      <p className="num text-display-52 flex h-[52px] items-end font-medium sm:pl-[129px]">
        <Blank />
      </p>

      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-4">
        <BalanceBubbles
          left={<Stat label="Платили" />}
          centre={<CollectedRing />}
          right={<Stat label="Задължения" />}
        />
        <div className="flex w-[200px] flex-col gap-2.5">
          <SecondaryButton disabled title="Начисленията и касата идват с M3–M4." className="w-full">
            Виж детайли
          </SecondaryButton>
          <button
            type="button"
            disabled
            title="Известията за задължения идват с M7."
            className="cta text-body-14 h-11 w-full px-7 font-semibold disabled:opacity-45"
          >
            Изпрати известия
          </button>
        </div>
      </div>
    </Card>
  );
}

function Stat({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center gap-[3px] whitespace-nowrap">
      <p className="text-body-15-tight text-ink-soft">{label}</p>
      <p className="num text-number-18 font-light">
        <Blank />
      </p>
    </div>
  );
}

/**
 * V2/Progress ring (849:214), with the track only. The arc and its glowing dot
 * are left out on purpose: an arc at any angle reads as a measured share.
 */
function CollectedRing() {
  return (
    <div
      className="flex h-[117px] w-[117px] flex-col items-center justify-center gap-0.5 rounded-full"
      style={{ boxShadow: 'inset 0 0 0 1.75px var(--ring-track)' }}
    >
      <span className="num text-number-30">
        <Blank />
      </span>
      <span className="text-body-14 text-ink-soft">събрани</span>
    </div>
  );
}

function DocumentsCard() {
  return (
    <Card milestone="M4" delay={0.05} className="items-center justify-center gap-5">
      <DocumentBlock
        glyph={<UploadSimple size={28} />}
        title="Качи документ"
        body="Фактури за плащане, документи за сгради и други."
        action="Избери файл"
        why="Хранилището на документи идва с M4."
      />
      <hr className="w-full border-glass-divider" />
      <DocumentBlock
        glyph={<FileMagnifyingGlass size={28} />}
        title="Всичко важно в една справка"
        body="Преглед на данни, експорт в PDF и печат."
        action="Направи справка"
        why="Справките идват с M4."
      />
    </Card>
  );
}

function DocumentBlock({
  glyph,
  title,
  body,
  action,
  why,
}: {
  glyph: ReactNode;
  title: string;
  body: string;
  action: string;
  why: string;
}) {
  return (
    <div className="flex w-full flex-col items-center gap-3 text-center">
      <GlowDisc>{glyph}</GlowDisc>
      <div className="flex w-full flex-col items-center gap-2">
        <h2 className="text-title-22 font-medium">{title}</h2>
        <p className="text-body-14 text-ink-muted">{body}</p>
        <SecondaryButton disabled title={why} className="min-w-[152px]">
          {action}
        </SecondaryButton>
      </div>
    </div>
  );
}

/** The 64 px white disc with the CTA glow: Документи's blocks and «Добави». */
function GlowDisc({ children }: { children: ReactNode }) {
  return (
    <span
      className="glass-solid flex h-16 w-16 shrink-0 items-center justify-center rounded-full"
      style={{ boxShadow: 'var(--glow-cta)' }}
    >
      {children}
    </span>
  );
}

/** V2/Tag (846:218), unselected: the status lives in the icon's colour, never the text's. */
const SIGNAL_TAGS = [
  { label: 'Чакащи', icon: Clock, tone: 'text-status-pending' },
  { label: 'Планирани', icon: CalendarDays, tone: 'text-status-planned' },
  { label: 'Спешни', icon: TriangleAlert, tone: 'text-status-urgent' },
  { label: 'Решени', icon: CircleCheck, tone: 'text-status-resolved' },
] as const;

function SignalsCard() {
  return (
    <Card milestone="M6" delay={0.1} className="gap-[25px]">
      <header className="flex h-8 items-center justify-between">
        <Toggle options={['Сигнали', 'Анкети']} selected="Сигнали" />
        <SectionArrow to="/issues" label="Към сигналите" />
      </header>

      <div className="flex flex-col items-center gap-0.5 pb-1.5 text-center">
        <p className="num text-display-72 font-light">
          <Blank />
        </p>
        <p className="text-body-14 text-ink-soft">отворени сигнала</p>
      </div>

      <div className="grid grid-cols-2 gap-x-3 gap-y-[11px]">
        {SIGNAL_TAGS.map(({ label, icon: Icon, tone }) => (
          <span
            key={label}
            className="glass-blur flex h-11 min-w-0 items-center gap-1.5 rounded-full p-3"
            style={{
              background: 'var(--glass-inner-strong)',
              boxShadow: 'inset 0 0 0 1px var(--glass-edge-soft)',
            }}
          >
            <Icon size={20} className={`shrink-0 ${tone}`} />
            <span className="text-body-14 truncate font-medium">{label}</span>
            <Blank className="num text-number-16 ml-auto font-medium" />
          </span>
        ))}
      </div>

      <div className="flex flex-col gap-2 pt-8">
        <Overline>Спешни сега</Overline>
        <p className="text-body-14 text-ink-muted">
          Спешните сигнали на жителите се появяват тук с M6.
        </p>
      </div>
    </Card>
  );
}

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'];

/**
 * The weeks of a month from Monday, as many as it spans — the mock-up's
 * September 2026 needs five. Days either side of the month are shown faint.
 */
function monthGrid(
  year: number,
  month: number,
  today: Date,
): { day: number; inMonth: boolean; isToday: boolean }[] {
  const first = new Date(year, month, 1);
  const offset = (first.getDay() + 6) % 7; // Sunday is 0 in JS, Monday leads here.
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = Math.ceil((offset + daysInMonth) / 7) * 7;

  return Array.from({ length: cells }, (_, i) => {
    const date = new Date(year, month, 1 - offset + i);
    return {
      day: date.getDate(),
      inMonth: date.getMonth() === month,
      isToday: date.toDateString() === today.toDateString(),
    };
  });
}

function CalendarCard() {
  const today = new Date();
  const [shown, setShown] = useState({ year: today.getFullYear(), month: today.getMonth() });
  const days = monthGrid(shown.year, shown.month, today);
  const step = (by: number) =>
    setShown(({ year, month }) => {
      const next = new Date(year, month + by, 1);
      return { year: next.getFullYear(), month: next.getMonth() };
    });
  const title = MONTHS[shown.month] ?? '';

  return (
    <Card milestone="M11" delay={0.15} className="flex-1 gap-1.5">
      <header className="flex h-8 items-center gap-2">
        <h2 className="text-title-16 flex-1 font-medium text-ink-soft">Календар</h2>
        <Toggle options={['Ден', 'Месец']} selected="Месец" />
      </header>

      <div className="flex h-11 items-center gap-1.5">
        <button
          type="button"
          onClick={() => step(-1)}
          aria-label="Предишен месец"
          className="flex h-8 w-8 items-center justify-center rounded-full text-ink"
        >
          <ChevronLeft size={18} />
        </button>
        <p className="text-body-14 flex-1 text-center font-semibold">
          {title.charAt(0).toUpperCase() + title.slice(1)} <span className="num">{shown.year}</span>
        </p>
        <button
          type="button"
          onClick={() => step(1)}
          aria-label="Следващ месец"
          className="flex h-8 w-8 items-center justify-center rounded-full text-ink"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      <div className="grid grid-cols-7">
        {WEEKDAYS.map((d) => (
          <span
            key={d}
            className="text-label-12 flex h-[26px] items-center justify-center font-medium text-ink-muted"
          >
            {d}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-y-1.5">
        {days.map((d, i) => (
          <span
            key={i}
            aria-current={d.isToday ? 'date' : undefined}
            className="flex h-10 flex-col items-center justify-center gap-[3px]"
          >
            <span
              className={`num text-label-12 ${
                d.isToday
                  ? 'font-semibold text-[color:var(--light-source)]'
                  : d.inMonth
                    ? 'text-ink'
                    : 'text-ink-faint'
              }`}
            >
              {d.day}
            </span>
            {d.isToday && <span className="today-underline h-0.5 w-[18px] rounded-[1px]" />}
          </span>
        ))}
      </div>

      <div className="flex flex-col gap-2 pt-2.5">
        <Overline>Предстоящи</Overline>
        <p className="text-body-14 text-ink-muted">
          Общи събрания, отчети и задачи на екипа се появяват тук с M11.
        </p>
      </div>
    </Card>
  );
}

function BuildingsCard() {
  return (
    <Card milestone="M2" delay={0.2} className="gap-4">
      <header className="flex items-center gap-2.5">
        <div className="min-w-0 flex-1">
          <h2 className="text-title-16 font-medium text-ink-soft">Преглед на сгради</h2>
          <p className="num text-body-13-tight text-ink-muted">
            <Blank /> сгради · <Blank /> апартамента
          </p>
        </div>
        <SectionArrow to="/buildings" label="Към сградите" />
      </header>

      {/*
        Four slots across, as drawn: «Добави» first, then one per building.
        TODO(M2): the buildings, and «Добави» opening the add-building flow.
      */}
      <div className="grid grid-cols-4">
        <span className="flex flex-col items-center gap-2 text-center">
          <GlowDisc>
            <Plus size={24} />
          </GlowDisc>
          <span className="text-body-14 font-semibold">Добави</span>
          <span className="text-label-12 text-ink-muted">нова сграда</span>
        </span>
      </div>
    </Card>
  );
}
