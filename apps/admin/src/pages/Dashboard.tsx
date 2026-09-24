import { Link } from '@tanstack/react-router';
import { motion } from 'framer-motion';
import { useState, type ReactNode } from 'react';
import { collectedPercent, counted, moneyParts, paidLine, signalAge } from '@inova/shared';
import { BalanceBubbles } from '../components/BalanceBubbles';
import {
  ArrowRight,
  Building2,
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
import { useDashboardData, type DashboardData } from './dashboard/data';

/**
 * Табло, laid out as drawn in Figma Screens 859:1073 — a wide Баланс above a
 * narrow Документи card and the signals card, with Календар and Преглед на
 * сгради down the right.
 *
 * Every card takes its data from `useDashboardData()`. Until a card's
 * milestone ships its slot is `null` and shows «—» — the balance M3–M4, the
 * signals M6, the calendar's events M11, the buildings M2. The «design data»
 * preview (`?fixture=design`, dev and test builds only) fills them with the
 * frame's own numbers so the layout can be checked against it.
 */
export function DashboardPage() {
  const data = useDashboardData();
  return (
    // Grid 1136 = 696 + 20 + 420, and the left column 696 = 320 + 20 + 356.
    // Both columns run to the foot of the screen, as the frame does: the second
    // row on the left and Календар on the right take up what is left.
    <div className="grid grid-cols-1 gap-x-5 gap-y-4 xl:h-full xl:grid-cols-[696fr_420fr]">
      <div className="flex flex-col gap-4">
        <BalanceCard balance={data.balance} today={data.today} />
        <div className="grid flex-1 grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-[320fr_356fr]">
          <DocumentsCard />
          <SignalsCard signals={data.signals} today={data.today} />
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <CalendarCard calendar={data.calendar} today={data.today} />
        <BuildingsCard buildings={data.buildings} />
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

/**
 * V2/Money (846:383): the whole part large and the cents with the currency
 * raised beside it, top-aligned. `hero` is Display 52 + 26, `stat` Number
 * 18 + 13 Light.
 */
function Money({
  minor,
  currency,
  size,
}: {
  minor: bigint;
  currency: string;
  size: 'hero' | 'stat';
}) {
  const { whole, cents } = moneyParts(minor, currency);
  return size === 'hero' ? (
    <span className="num flex items-start gap-1.5 font-medium tracking-[-1.5px]">
      <span className="text-display-52">{whole}</span>
      <span className="text-display-26">{cents}</span>
    </span>
  ) : (
    <span className="num flex items-start gap-px font-light tracking-[-1px]">
      <span className="text-number-18">{whole}</span>
      <span className="text-number-13">{cents}</span>
    </span>
  );
}

function BalanceCard({ balance, today }: { balance: DashboardData['balance']; today: Date }) {
  const month = MONTHS[today.getMonth()];
  return (
    <Card milestone="M3–M4" className="gap-2.5">
      <header className="flex items-center gap-3">
        <h2 className="text-title-16 flex-1 font-medium text-ink-soft">Баланс</h2>
        <p className="num text-body-13-tight whitespace-nowrap text-ink-muted">
          Портфолио ·{' '}
          {balance ? (
            counted(balance.buildingCount, 'сграда', 'сгради')
          ) : (
            <>
              <Blank /> сгради
            </>
          )}{' '}
          · {month}
        </p>
      </header>

      {/* The hero sum sits where the frame puts it: 129 in from the card's content edge. */}
      <div className="flex h-[52px] items-end sm:pl-[129px]">
        {balance ? (
          <Money minor={balance.charged} currency={balance.currency} size="hero" />
        ) : (
          <p className="num text-display-52 font-medium">
            <Blank />
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-4">
        <BalanceBubbles
          left={<Stat label="Платили" minor={balance?.collected} currency={balance?.currency} />}
          centre={
            <CollectedRing
              percent={balance ? collectedPercent(balance.collected, balance.charged) : null}
            />
          }
          right={
            <Stat label="Задължения" minor={balance?.outstanding} currency={balance?.currency} />
          }
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

function Stat({ label, minor, currency }: { label: string; minor?: bigint; currency?: string }) {
  return (
    <div className="flex flex-col items-center gap-[3px] whitespace-nowrap">
      <p className="text-body-15-tight text-ink-soft">{label}</p>
      {minor !== undefined && currency ? (
        <Money minor={minor} currency={currency} size="stat" />
      ) : (
        <p className="num text-number-18 font-light">
          <Blank />
        </p>
      )}
    </div>
  );
}

/**
 * V2/Progress ring (849:214), 136 across: the track, and — once there is a
 * share to show — the arc from the top clockwise with its glow and the lit
 * dot at its end. The light is the ring/* variables, white by day and warm
 * by night. Without data only the track is drawn: an arc at any angle reads
 * as a measured share.
 */
const RING = { size: 135.88, r: 57.605 };

function CollectedRing({ percent }: { percent: number | null }) {
  const c = RING.size / 2;
  const length = 2 * Math.PI * RING.r;
  const angle = ((percent ?? 0) / 100) * 2 * Math.PI;
  const dot = { x: c + RING.r * Math.sin(angle), y: c - RING.r * Math.cos(angle) };
  const arc = {
    cx: c,
    cy: c,
    r: RING.r,
    fill: 'none',
    strokeLinecap: 'round' as const,
    strokeDasharray: `${(length * (percent ?? 0)) / 100} ${length}`,
    transform: `rotate(-90 ${c} ${c})`,
  };
  return (
    <div className="relative h-[136px] w-[136px]">
      <svg
        aria-hidden
        viewBox={`0 0 ${RING.size} ${RING.size}`}
        className="absolute inset-0 h-full w-full overflow-visible"
      >
        <defs>
          <filter id="ring-soft" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2" />
          </filter>
          <filter id="ring-dot-soft" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="4" />
          </filter>
        </defs>
        <circle
          cx={c}
          cy={c}
          r={RING.r}
          fill="none"
          stroke="var(--ring-track)"
          strokeWidth={1.75}
        />
        {percent !== null && percent > 0 && (
          <>
            <circle
              {...arc}
              stroke="var(--ring-halo-near)"
              strokeWidth={6}
              opacity={0.8}
              filter="url(#ring-soft)"
              style={{ filter: 'drop-shadow(0 0 24px var(--ring-halo-far))' }}
            />
            <circle {...arc} stroke="var(--ring-core)" strokeWidth={1.75} />
            <circle
              cx={dot.x}
              cy={dot.y}
              r={11}
              fill="var(--ring-halo-near)"
              opacity={0.85}
              filter="url(#ring-dot-soft)"
            />
            <circle
              cx={dot.x}
              cy={dot.y}
              r={4}
              fill="var(--ring-core)"
              style={{ filter: 'drop-shadow(0 0 3px var(--glow-dot-near))' }}
            />
          </>
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5">
        <span className="num text-number-30">{percent === null ? <Blank /> : `${percent}%`}</span>
        <span className="text-body-14 text-ink-soft">събрани</span>
      </div>
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
  { key: 'pending', label: 'Чакащи', icon: Clock, tone: 'text-status-pending' },
  { key: 'planned', label: 'Планирани', icon: CalendarDays, tone: 'text-status-planned' },
  { key: 'urgent', label: 'Спешни', icon: TriangleAlert, tone: 'text-status-urgent' },
  { key: 'resolved', label: 'Решени', icon: CircleCheck, tone: 'text-status-resolved' },
] as const;

function SignalsCard({ signals, today }: { signals: DashboardData['signals']; today: Date }) {
  return (
    <Card milestone="M6" delay={0.1} className="gap-[25px]">
      <header className="flex h-8 items-center justify-between">
        <Toggle options={['Сигнали', 'Анкети']} selected="Сигнали" />
        <SectionArrow to="/issues" label="Към сигналите" />
      </header>

      <div className="flex flex-col items-center gap-0.5 pb-1.5 text-center">
        <p className="num text-display-72 font-light">{signals ? signals.openCount : <Blank />}</p>
        <p className="text-body-14 text-ink-soft">
          {signals
            ? `отворени ${signals.openCount === 1 ? 'сигнал' : 'сигнала'} в ${counted(
                signals.buildingCount,
                'сграда',
                'сгради',
              )}`
            : 'отворени сигнала'}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-x-3 gap-y-[11px]">
        {SIGNAL_TAGS.map(({ key, label, icon: Icon, tone }) => (
          <span
            key={key}
            className="glass-blur flex h-11 min-w-0 items-center gap-1.5 rounded-full p-3"
            style={{
              background: 'var(--glass-inner-strong)',
              boxShadow: 'inset 0 0 0 1px var(--glass-edge-soft)',
            }}
          >
            <Icon size={20} className={`shrink-0 ${tone}`} />
            <span className="text-body-14 truncate font-medium">{label}</span>
            <span className="num text-number-16 ml-auto font-medium">
              {signals ? signals.counters[key] : <Blank />}
            </span>
          </span>
        ))}
      </div>

      <div className="flex flex-col gap-2 pt-8">
        <Overline>Спешни сега</Overline>
        {signals ? (
          signals.urgent.map((signal) => (
            // V2/Signal (846:358): the colour is the dot's, the text stays white.
            <div
              key={signal.id}
              className="flex h-14 items-center gap-2.5 rounded-[var(--radius-signal)] px-3 py-2.5"
              style={{ background: 'var(--glass-inner)' }}
            >
              <span
                aria-hidden
                className="h-[7px] w-[7px] shrink-0 rounded-full"
                style={{
                  background: 'var(--status-urgent)',
                  boxShadow: '0 0 5px 0.5px var(--status-urgent)',
                }}
              />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-body-14 truncate font-medium">{signal.title}</span>
                <span className="text-body-13-tight truncate text-ink-muted">{signal.place}</span>
              </span>
              <span className="text-body-13-tight shrink-0 text-ink-muted">
                {signalAge(signal.createdAt, today)}
              </span>
            </div>
          ))
        ) : (
          <p className="text-body-14 text-ink-muted">
            Спешните сигнали на жителите се появяват тук с M6.
          </p>
        )}
      </div>
    </Card>
  );
}

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'];

const isoDay = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/**
 * The weeks of a month from Monday, as many as it spans — the mock-up's
 * September 2026 needs five. Days either side of the month are shown faint.
 */
function monthGrid(
  year: number,
  month: number,
  today: Date,
): { day: number; iso: string; inMonth: boolean; isToday: boolean }[] {
  const first = new Date(year, month, 1);
  const offset = (first.getDay() + 6) % 7; // Sunday is 0 in JS, Monday leads here.
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = Math.ceil((offset + daysInMonth) / 7) * 7;

  return Array.from({ length: cells }, (_, i) => {
    const date = new Date(year, month, 1 - offset + i);
    return {
      day: date.getDate(),
      iso: isoDay(date),
      inMonth: date.getMonth() === month,
      isToday: date.toDateString() === today.toDateString(),
    };
  });
}

function CalendarCard({ calendar, today }: { calendar: DashboardData['calendar']; today: Date }) {
  const [shown, setShown] = useState({ year: today.getFullYear(), month: today.getMonth() });
  const days = monthGrid(shown.year, shown.month, today);
  const eventDays = new Set(calendar?.eventDays ?? []);
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
        {days.map((d) => (
          <span
            key={d.iso}
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
            {d.isToday ? (
              <span className="today-underline h-0.5 w-[18px] rounded-[1px]" />
            ) : (
              d.inMonth &&
              eventDays.has(d.iso) && (
                // V2/Calendar · Day Event=true: a lit dot under the date.
                <span
                  aria-label="има задачи"
                  className="h-[5px] w-[5px] rounded-full"
                  style={{
                    background: 'var(--light-source)',
                    boxShadow: '0 0 7px 0.5px var(--glow-dot-near)',
                  }}
                />
              )
            )}
          </span>
        ))}
      </div>

      <div className="flex flex-col gap-2 pt-2.5">
        <Overline>Предстоящи</Overline>
        {calendar ? (
          calendar.upcoming.map((event) => (
            // V2/Event (846:344): the day in its own small square, then what and where.
            <div
              key={event.id}
              className="flex h-14 items-center gap-2.5 rounded-[var(--radius-row)] py-2.5 pr-3 pl-2.5"
              style={{ background: 'var(--glass-inner)' }}
            >
              <span
                className="num text-label-12 flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-lg font-semibold"
                style={{ background: 'var(--glass-inner)' }}
              >
                {Number(event.date.slice(8))}
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-body-14 truncate font-medium">{event.title}</span>
                <span className="text-body-13-tight truncate text-ink-muted">{event.place}</span>
              </span>
            </div>
          ))
        ) : (
          <p className="text-body-14 text-ink-muted">
            Общи събрания, отчети и задачи на екипа се появяват тук с M11.
          </p>
        )}
      </div>
    </Card>
  );
}

function BuildingsCard({ buildings }: { buildings: DashboardData['buildings'] }) {
  return (
    // The frame's card is 214 tall: its tiles run 8 into the bottom padding.
    <Card milestone="M2" delay={0.2} className="gap-4 pb-[17px]">
      <header className="flex items-center gap-2.5">
        <div className="min-w-0 flex-1">
          <h2 className="text-title-16 font-medium text-ink-soft">Преглед на сгради</h2>
          <p className="num text-body-13-tight text-ink-muted">
            {buildings ? (
              <>
                {counted(buildings.buildingCount, 'сграда', 'сгради')} ·{' '}
                {counted(buildings.apartmentCount, 'апартамент', 'апартамента')}
              </>
            ) : (
              <>
                <Blank /> сгради · <Blank /> апартамента
              </>
            )}
          </p>
        </div>
        <SectionArrow to="/buildings" label="Към сградите" />
      </header>

      {/*
        Four slots across, as drawn: «Добави» first, then one per building.
        TODO(M2): «Добави» opening the add-building flow.
      */}
      <div className="grid grid-cols-4">
        <Tile
          disc={
            <GlowDisc>
              <Plus size={24} />
            </GlowDisc>
          }
          name="Добави"
          caption="нова сграда"
        />
        {buildings?.buildings.slice(0, 3).map((building) => (
          <Tile
            key={building.id}
            disc={
              // V2/Building tile (846:360): a lifted glass disc, the building in it.
              <span
                className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full"
                style={{
                  background: 'var(--glass-inner-strong)',
                  boxShadow: 'inset 0 0 0 1px var(--glass-inner-strong)',
                }}
              >
                <Building2 size={30} />
              </span>
            }
            name={building.name}
            caption={paidLine(building.paid, building.charged)}
          />
        ))}
      </div>
    </Card>
  );
}

function Tile({ disc, name, caption }: { disc: ReactNode; name: string; caption: string }) {
  return (
    <span className="flex min-w-0 flex-col items-center gap-2 text-center">
      {disc}
      <span className="text-body-14 max-w-full truncate font-semibold">{name}</span>
      <span className="text-label-12 max-w-full truncate text-ink-muted">{caption}</span>
    </span>
  );
}
