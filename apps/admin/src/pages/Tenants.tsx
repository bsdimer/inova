import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Check, Plus, Search, Sparkles } from '../components/icons';
import { useMemo, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import {
  Facet,
  Field,
  Modal,
  PrimaryButton,
  SkeletonBar,
  StatusDot,
  panelInputClass,
  type FacetOption,
  type StatusTone,
} from '../components/ui';
import { InovaMark } from '../components/Logo';
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

/** 16.09.2026 — hand-built, since bg-BG appends " г." to a formatted date. */
function formatDate(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
}

export function TenantsPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [wizardOpen, setWizardOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<string[]>([]);

  const tenants = useQuery({
    queryKey: ['platform', 'tenants'],
    queryFn: () => api<TenantSummary[]>('/platform/tenants'),
  });

  const all = useMemo(() => tenants.data ?? [], [tenants.data]);
  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return all.filter(
      (tenant) =>
        (needle === '' ||
          tenant.name.toLowerCase().includes(needle) ||
          tenant.key.toLowerCase().includes(needle)) &&
        (status.length === 0 || status.includes(tenant.status)),
    );
  }, [all, search, status]);

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
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-title-22 font-medium">Организации</h1>
          <p className="text-body-14 mt-1 text-ink-muted">
            Компаниите за управление на имоти на платформата. Влизането в организация се записва в
            одитния ѝ дневник.
          </p>
        </div>
        <PrimaryButton onClick={() => setWizardOpen(true)}>
          <span className="flex items-center gap-2">
            <Plus size={16} />
            <span>
              Нова<span className="hidden sm:inline"> организация</span>
            </span>
          </span>
        </PrimaryButton>
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <label className="glass-control flex h-12 min-w-56 flex-1 items-center gap-3 rounded-full px-5">
          <Search size={16} className="shrink-0 text-ink-faint" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Търси организация по име или ключ"
            aria-label="Търсене в организациите"
            className="w-full bg-transparent text-sm font-medium text-ink outline-none placeholder:text-ink-faint"
          />
        </label>
        <Facet label="Статус" options={STATUS_OPTIONS} selected={status} onChange={setStatus} />
      </div>

      <p className="num text-sm font-medium text-ink-soft">{summary}</p>

      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="glass-data overflow-hidden"
      >
        {/*
          The mock-up also carries Сгради / Жители / Служители counts.
          TODO(M2): `/platform/tenants` returns no counters, and inventing them
          would read as real numbers, so those columns wait for the API.
        */}
        <table className="w-full table-fixed text-left text-sm">
          <colgroup>
            <col style={{ width: '44%' }} />
            <col style={{ width: '20%' }} />
            <col style={{ width: '20%' }} />
            <col style={{ width: '16%' }} />
          </colgroup>
          <thead>
            <tr className="text-xs font-semibold tracking-wider text-ink-faint uppercase">
              <th scope="col" className="px-3 pt-5 pb-3 pl-6">
                Организация
              </th>
              <th scope="col" className="px-3 pt-5 pb-3">
                Статус
              </th>
              <th scope="col" className="hidden px-3 pt-5 pb-3 sm:table-cell">
                Създадена
              </th>
              <th scope="col" className="px-3 pt-5 pr-6 pb-3" />
            </tr>
          </thead>
          <tbody>
            {tenants.isLoading &&
              Array.from({ length: 3 }, (_, i) => (
                <tr key={i} className="border-t border-glass-divider">
                  <td className="h-16 px-3 pl-6">
                    <SkeletonBar className="w-2/3" />
                  </td>
                  <td className="px-3">
                    <SkeletonBar className="w-1/2" />
                  </td>
                  <td className="hidden px-3 sm:table-cell">
                    <SkeletonBar className="w-1/2" />
                  </td>
                  <td className="px-3 pr-6">
                    <SkeletonBar className="ml-auto w-12" />
                  </td>
                </tr>
              ))}

            {visible.map((tenant) => (
              <tr
                key={tenant.id}
                className="h-16 border-t border-glass-divider transition-colors hover:bg-glass-inner-soft"
              >
                <td className="px-3 pl-6">
                  <div className="flex items-center gap-3">
                    <InovaMark size={34} />
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{tenant.name}</span>
                      <span className="block truncate text-xs text-ink-faint">
                        ключ {tenant.key}
                      </span>
                    </span>
                  </div>
                </td>
                <td className="px-3">
                  <StatusDot tone={STATUS_TONES[tenant.status]}>
                    {STATUS_LABELS[tenant.status]}
                  </StatusDot>
                </td>
                <td className="num hidden px-3 text-sm whitespace-nowrap text-ink-muted sm:table-cell">
                  {formatDate(tenant.createdAt)}
                </td>
                <td className="px-3 pr-6">
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => enter(tenant)}
                      className="glass-control flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-medium text-ink"
                    >
                      Влез <ArrowRight size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}

            {!tenants.isLoading && visible.length === 0 && (
              <tr className="border-t border-glass-divider">
                <td colSpan={4} className="px-6 py-12 text-center text-sm text-ink-muted">
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
