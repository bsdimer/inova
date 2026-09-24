import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Check, Sparkles } from '../components/icons';
import { useMemo, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import {
  Facet,
  Field,
  Modal,
  PrimaryButton,
  SearchField,
  SkeletonBar,
  SortSelect,
  StatusDot,
  panelInputClass,
  type FacetOption,
  type StatusTone,
} from '../components/ui';
import { api, ApiError, type ProvisionResult, type TenantSummary } from '../lib/api';
import { setSelectedTenantId } from '../lib/tenant';

type TenantStatus = TenantSummary['status'];

const STATUS_LABELS: Record<TenantStatus, string> = {
  trial: 'Пробен период',
  active: 'Активна',
  suspended: 'Спряна',
  offboarded: 'Закрита',
};

const STATUS_TONES: Record<TenantStatus, StatusTone> = {
  trial: 'pending',
  active: 'resolved',
  suspended: 'urgent',
  offboarded: 'muted',
};

const STATUS_OPTIONS: FacetOption[] = (
  ['active', 'trial', 'suspended', 'offboarded'] as TenantStatus[]
).map((value) => ({ value, label: STATUS_LABELS[value] }));

/** 16.09.26, as the row draws it — hand-built, since bg-BG appends " г.". */
function formatDate(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${pad(d.getFullYear() % 100)}`;
}

type TenantSort = 'newest' | 'name';

/** The frame draws the first; «Име А–Я» is the wording Служители already uses. */
const SORT_LABELS: Record<TenantSort, string> = {
  newest: 'Първо последно създадените',
  name: 'Име А–Я',
};

/** The four counters the mock-up draws; the API has none of them yet. */
const COUNT_COLUMNS = ['Сгради', 'Имоти', 'Жители', 'Служители'] as const;

/** «преди 6 дни» under the creation date, as the row draws it. */
function relativeAge(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return 'днес';
  if (days === 1) return 'вчера';
  if (days < 30) return `преди ${days} дни`;
  const months = Math.floor(days / 30);
  return months === 1 ? 'преди месец' : `преди ${months} месеца`;
}

/** A rounded square with the initials, not the round avatar a person gets. */
function OrgTile({ name }: { name: string }) {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
  return (
    <span
      aria-hidden
      className="text-body-13 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl font-semibold"
      style={{
        background: 'var(--glass-avatar)',
        boxShadow: 'inset 0 0 0 1px var(--glass-avatar-edge)',
      }}
    >
      {initials}
    </span>
  );
}

export function TenantsPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [wizardOpen, setWizardOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<string[]>([]);
  const [sort, setSort] = useState<TenantSort>('newest');

  const tenants = useQuery({
    queryKey: ['platform', 'tenants'],
    queryFn: () => api<TenantSummary[]>('/platform/tenants'),
  });

  const all = useMemo(() => tenants.data ?? [], [tenants.data]);
  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const matching = all.filter(
      (tenant) =>
        (needle === '' ||
          tenant.name.toLowerCase().includes(needle) ||
          tenant.key.toLowerCase().includes(needle)) &&
        (status.length === 0 || status.includes(tenant.status)),
    );
    return [...matching].sort((a, b) =>
      sort === 'name' ? a.name.localeCompare(b.name, 'bg') : b.createdAt.localeCompare(a.createdAt),
    );
  }, [all, search, status, sort]);

  const summary = useMemo(() => {
    const trial = all.filter((t) => t.status === 'trial').length;
    const suspended = all.filter((t) => t.status === 'suspended').length;
    return [
      `${all.length} ${all.length === 1 ? 'организация' : 'организации'}`,
      trial > 0 ? `${trial} пробна` : null,
      suspended > 0 ? `${suspended} спряна` : null,
    ]
      .filter(Boolean)
      .join(' · ');
  }, [all]);

  /** Entering an organization switches the tenant header and leaves the platform scope. */
  const enter = (tenant: TenantSummary) => {
    setSelectedTenantId(tenant.id);
    void navigate({ to: '/' });
  };

  return (
    // Page head, toolbar and table stand 16 apart (V2 frames: 72 + 50 → 138, 242 → 258).
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-4">
        <div className="min-w-0">
          <h1 className="text-title-22 font-medium">Организации</h1>
          <p className="text-body-14 mt-1 text-ink-muted">
            Компаниите за управление на имоти на платформата. Влизането в организация се записва в
            одитния ѝ дневник.
          </p>
        </div>
        <PrimaryButton onClick={() => setWizardOpen(true)}>
          Нова<span className="hidden sm:inline"> организация</span>
        </PrimaryButton>
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <SearchField
            value={search}
            onChange={setSearch}
            placeholder="Търси организация по име или ключ"
            label="Търсене в организациите"
            className="flex-1"
          />
          <Facet label="Статус" options={STATUS_OPTIONS} selected={status} onChange={setStatus} />
        </div>

        <div className="flex min-h-11 flex-wrap items-center gap-3 px-1">
          <p className="num text-body-14 font-medium text-ink" aria-live="polite">
            {summary}
          </p>
          <div className="ml-auto">
            <SortSelect value={sort} options={SORT_LABELS} onChange={setSort} />
          </div>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="glass-data table-card overflow-hidden"
      >
        {/*
          Columns are the contract of `V2/Table · Row · Organization`
          (1146:674) for inner width 1096: 258/96/96/104/112/160/140/130.
          TODO(M2): `/platform/tenants` returns no building, property,
          resident or staff counters. The columns are drawn, so they stay —
          each one shows «—» rather than a number nobody measured.
        */}
        <table className="w-full table-fixed text-left">
          {/*
            A hidden <td> still leaves its <col> holding the width, so the
            column has to leave the layout with the cells it belongs to.
          */}
          <colgroup>
            <col style={{ width: '23.54%' }} />
            <col className="hidden lg:table-column" style={{ width: '8.76%' }} />
            <col className="hidden lg:table-column" style={{ width: '8.76%' }} />
            <col className="hidden lg:table-column" style={{ width: '9.49%' }} />
            <col className="hidden lg:table-column" style={{ width: '10.22%' }} />
            <col style={{ width: '14.60%' }} />
            <col className="hidden sm:table-column" style={{ width: '12.77%' }} />
            <col style={{ width: '11.86%' }} />
          </colgroup>
          <thead>
            <tr className="text-overline-12 text-ink-soft uppercase">
              <th scope="col" className="h-[41px] px-3 font-semibold">
                Организация
              </th>
              {COUNT_COLUMNS.map((label) => (
                <th
                  key={label}
                  scope="col"
                  className="hidden h-[41px] px-3 text-right font-semibold lg:table-cell"
                >
                  {label}
                </th>
              ))}
              <th scope="col" className="h-[41px] px-3 font-semibold">
                Статус
              </th>
              <th scope="col" className="hidden h-[41px] px-3 font-semibold sm:table-cell">
                Създадена
              </th>
              <th scope="col" className="h-[41px] px-3" />
            </tr>
          </thead>
          <tbody>
            {tenants.isLoading &&
              Array.from({ length: 3 }, (_, i) => (
                <tr key={i}>
                  <td className="h-[65px] px-3">
                    <SkeletonBar className="w-2/3" />
                  </td>
                  {COUNT_COLUMNS.map((label) => (
                    <td key={label} className="hidden px-3 lg:table-cell">
                      <SkeletonBar className="ml-auto w-8" />
                    </td>
                  ))}
                  <td className="px-3">
                    <SkeletonBar className="w-1/2" />
                  </td>
                  <td className="hidden px-3 sm:table-cell">
                    <SkeletonBar className="w-1/2" />
                  </td>
                  <td className="px-3">
                    <SkeletonBar className="ml-auto w-12" />
                  </td>
                </tr>
              ))}

            {visible.map((tenant) => (
              <tr key={tenant.id} className="h-[65px] transition-colors hover:bg-glass-inner-soft">
                <td className="px-3 align-middle">
                  <div className="flex items-center gap-3">
                    <OrgTile name={tenant.name} />
                    <span className="min-w-0">
                      <span className="text-body-14 block truncate font-semibold">
                        {tenant.name}
                      </span>
                      <span className="text-body-13-tight block truncate text-ink-soft">
                        ключ {tenant.key}
                      </span>
                    </span>
                  </div>
                </td>
                {COUNT_COLUMNS.map((label) => (
                  <td
                    key={label}
                    className="num text-number-16 hidden px-3 text-right align-middle font-medium text-ink-faint lg:table-cell"
                  >
                    —
                  </td>
                ))}
                <td className="px-3 align-middle">
                  <StatusDot tone={STATUS_TONES[tenant.status]}>
                    {STATUS_LABELS[tenant.status]}
                  </StatusDot>
                </td>
                <td className="hidden px-3 align-middle text-ink-soft sm:table-cell">
                  <p className="num text-body-14 whitespace-nowrap">
                    {formatDate(tenant.createdAt)}
                  </p>
                  <p className="text-body-13-tight whitespace-nowrap">
                    {relativeAge(tenant.createdAt)}
                  </p>
                </td>
                <td className="px-3 align-middle">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => enter(tenant)}
                      className="glass-blur text-body-13 flex h-8 items-center gap-1.5 rounded-full px-3 font-medium text-ink"
                      style={{
                        background: 'var(--glass-inner)',
                        boxShadow: 'inset 0 0 0 1px var(--glass-edge)',
                      }}
                    >
                      Влез <ArrowRight size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}

            {!tenants.isLoading && visible.length === 0 && (
              <tr>
                <td colSpan={8} className="text-body-14 px-6 py-12 text-center text-ink-muted">
                  Няма организации по тези филтри.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </motion.div>

      <ProvisionWizard
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onProvisioned={() => void queryClient.invalidateQueries({ queryKey: ['platform'] })}
      />
    </div>
  );
}

type Step = 'org' | 'admin' | 'review' | 'done';

const STEPS: { id: Step; label: string }[] = [
  { id: 'org', label: 'Организация' },
  { id: 'admin', label: 'Първи администратор' },
  { id: 'review', label: 'Преглед' },
];

function ProvisionWizard({
  open,
  onClose,
  onProvisioned,
}: {
  open: boolean;
  onClose: () => void;
  onProvisioned: () => void;
}) {
  const [step, setStep] = useState<Step>('org');
  const [key, setKey] = useState('');
  const [name, setName] = useState('');
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPhone, setAdminPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ProvisionResult | null>(null);

  const provision = useMutation({
    mutationFn: () =>
      api<ProvisionResult>('/platform/tenants', {
        method: 'POST',
        body: {
          key,
          name,
          adminEmail: adminEmail || undefined,
          adminName: adminName || undefined,
          adminPhone: adminPhone || undefined,
        },
      }),
    onSuccess: (res) => {
      setResult(res);
      setStep('done');
      setError(null);
      onProvisioned();
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : 'Нещо се обърка.'),
  });

  const reset = () => {
    setStep('org');
    setKey('');
    setName('');
    setAdminName('');
    setAdminEmail('');
    setAdminPhone('');
    setError(null);
    setResult(null);
    onClose();
  };

  const orgValid = /^[a-z0-9][a-z0-9-]{1,30}$/.test(key) && name.trim().length >= 2;
  const adminFilled = adminName.trim().length >= 2 && adminEmail.includes('@');
  const adminValid = (adminName === '' && adminEmail === '') || adminFilled;

  return (
    <Modal open={open} title="Нова организация" onClose={reset} wide>
      {step !== 'done' && (
        <div className="mb-6 flex items-center gap-2">
          {STEPS.map((s, i) => {
            const activeIndex = STEPS.findIndex((x) => x.id === step);
            const state = i < activeIndex ? 'done' : i === activeIndex ? 'active' : 'todo';
            return (
              <div key={s.id} className="flex flex-1 items-center gap-2">
                <span
                  className={`num flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                    state === 'todo'
                      ? 'bg-panel-row text-panel-ink-muted'
                      : 'bg-panel-ink text-panel-ink-inverse'
                  }`}
                >
                  {state === 'done' ? <Check size={14} /> : i + 1}
                </span>
                <span
                  className={`hidden text-xs font-medium sm:block ${
                    state === 'todo' ? 'text-panel-ink-muted' : 'text-panel-ink'
                  }`}
                >
                  {s.label}
                </span>
                {i < STEPS.length - 1 && <span className="h-px flex-1 bg-panel-divider" />}
              </div>
            );
          })}
        </div>
      )}

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -12 }}
          transition={{ duration: 0.18 }}
        >
          {step === 'org' && (
            <div className="space-y-4">
              <Field label="Име на компанията">
                <input
                  className={panelInputClass}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Блок София Мениджмънт"
                  autoFocus
                />
              </Field>
              <Field label="Ключ" hint="Малки букви и тирета, използва се в адреси — постоянен.">
                <input
                  className={panelInputClass}
                  value={key}
                  onChange={(e) => setKey(e.target.value.toLowerCase())}
                  placeholder="blok-sofia"
                />
              </Field>
              <div className="flex justify-end">
                <PanelButton disabled={!orgValid} onClick={() => setStep('admin')}>
                  Напред <ArrowRight size={15} />
                </PanelButton>
              </div>
            </div>
          )}

          {step === 'admin' && (
            <div className="space-y-4">
              <p className="text-sm text-panel-ink-muted">
                Първият потребител получава ролята <strong>Администратор</strong> и активира акаунта
                си с код. Може да бъде добавен и по-късно.
              </p>
              <Field label="Име и фамилия">
                <input
                  className={panelInputClass}
                  value={adminName}
                  onChange={(e) => setAdminName(e.target.value)}
                  placeholder="Петър Георгиев"
                  autoFocus
                />
              </Field>
              <Field label="Имейл">
                <input
                  className={panelInputClass}
                  type="email"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  placeholder="admin@bloksofia.bg"
                />
              </Field>
              <Field label="Телефон" hint="По избор — получава кода за активиране.">
                <input
                  className={panelInputClass}
                  value={adminPhone}
                  onChange={(e) => setAdminPhone(e.target.value)}
                  placeholder="+359881234567"
                />
              </Field>
              <div className="flex justify-between">
                <PanelButton ghost onClick={() => setStep('org')}>
                  <ArrowLeft size={14} /> Назад
                </PanelButton>
                <PanelButton disabled={!adminValid} onClick={() => setStep('review')}>
                  {adminFilled ? 'Напред' : 'Пропусни засега'} <ArrowRight size={15} />
                </PanelButton>
              </div>
            </div>
          )}

          {step === 'review' && (
            <div className="space-y-4">
              <dl className="space-y-2 rounded-2xl bg-panel-row p-4 text-sm">
                <Row label="Компания" value={name} />
                <Row label="Ключ" value={key} />
                <Row
                  label="Първи администратор"
                  value={adminFilled ? adminName : '— добавя се по-късно'}
                />
                {adminFilled && <Row label="Имейл" value={adminEmail} />}
                {adminFilled && adminPhone && <Row label="Телефон" value={adminPhone} />}
              </dl>
              <p className="text-xs text-panel-ink-muted">
                Създаването добавя организацията със стартовите роли (Администратор, Домоуправител,
                Жител)
                {adminFilled ? ' и изпраща код за активиране на администратора' : ''}.
              </p>
              {error && (
                <p className="rounded-xl bg-panel-row px-3.5 py-2.5 text-sm font-medium text-panel-status-urgent">
                  {error}
                </p>
              )}
              <div className="flex justify-between">
                <PanelButton ghost onClick={() => setStep('admin')}>
                  <ArrowLeft size={14} /> Назад
                </PanelButton>
                <PanelButton disabled={provision.isPending} onClick={() => provision.mutate()}>
                  <Sparkles size={15} />
                  {provision.isPending ? 'Създава…' : 'Създай организация'}
                </PanelButton>
              </div>
            </div>
          )}

          {step === 'done' && result && (
            <div className="space-y-4 text-center">
              <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-panel-row">
                <Check size={26} className="text-panel-status-resolved" />
              </span>
              <div>
                <h3 className="font-semibold">{result.tenant.name} е готова</h3>
                <p className="mt-1 text-sm text-panel-ink-muted">
                  {result.adminInviteSent
                    ? 'Администраторът получи код за активиране (разработка: доставката е имитирана — вижте конзолата на core-api).'
                    : 'Още няма поканен администратор — добавете го от Служители, след като влезете.'}
                </p>
              </div>
              <div className="flex justify-center gap-2">
                <PanelButton ghost onClick={reset}>
                  Затвори
                </PanelButton>
                <PanelButton
                  onClick={() => {
                    setSelectedTenantId(result.tenant.id);
                    reset();
                  }}
                >
                  Влез в организацията
                </PanelButton>
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </Modal>
  );
}

function PanelButton({
  children,
  onClick,
  disabled = false,
  ghost = false,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  ghost?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold disabled:opacity-40 ${
        ghost ? 'border border-panel-border text-panel-ink' : 'bg-panel-ink text-panel-ink-inverse'
      }`}
    >
      {children}
    </button>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-panel-ink-muted">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
