import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Check, Plus, Sparkles } from 'lucide-react';
import { useState } from 'react';
import {
  ErrorNote,
  Field,
  GhostButton,
  Modal,
  PrimaryButton,
  StatusBadge,
  inputClass,
} from '../components/ui';
import { api, ApiError, type ProvisionResult, type TenantSummary } from '../lib/api';
import { setSelectedTenantId } from '../lib/tenant';

export function TenantsPage() {
  const queryClient = useQueryClient();
  const [wizardOpen, setWizardOpen] = useState(false);

  const tenants = useQuery({
    queryKey: ['platform', 'tenants'],
    queryFn: () => api<TenantSummary[]>('/platform/tenants'),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Tenants</h1>
          <p className="mt-1 text-sm text-landmark">
            Property-management companies on the platform. Provisioning seeds the starter roles and
            invites the first administrator.
          </p>
        </div>
        <PrimaryButton onClick={() => setWizardOpen(true)}>
          <span className="flex items-center gap-2">
            <Plus size={16} /> New tenant
          </span>
        </PrimaryButton>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="overflow-x-auto rounded-3xl border border-sand/70 bg-white/80 shadow-sm shadow-landmark/5 backdrop-blur"
      >
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-sand/80 bg-cream/70 text-xs font-semibold tracking-wider text-landmark uppercase">
              <th className="px-6 py-3">Tenant</th>
              <th className="px-6 py-3">Key</th>
              <th className="px-6 py-3">Status</th>
              <th className="px-6 py-3">Created</th>
              <th className="px-6 py-3 text-right"></th>
            </tr>
          </thead>
          <tbody>
            {tenants.isLoading && (
              <tr>
                <td colSpan={5} className="px-6 py-10 text-center text-landmark">
                  Loading tenants…
                </td>
              </tr>
            )}
            {tenants.data?.map((tenant) => (
              <tr
                key={tenant.id}
                className="border-b border-sand/60 transition-colors last:border-0 hover:bg-orange/4"
              >
                <td className="px-6 py-3.5 font-semibold">{tenant.name}</td>
                <td className="px-6 py-3.5 font-mono text-xs text-landmark">{tenant.key}</td>
                <td className="px-6 py-3.5">
                  <StatusBadge status={tenant.status} />
                </td>
                <td className="px-6 py-3.5 text-landmark">
                  {new Date(tenant.createdAt).toLocaleDateString()}
                </td>
                <td className="px-6 py-3.5 text-right">
                  <GhostButton onClick={() => setSelectedTenantId(tenant.id)}>
                    Switch to
                  </GhostButton>
                </td>
              </tr>
            ))}
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
  { id: 'org', label: 'Organization' },
  { id: 'admin', label: 'First admin' },
  { id: 'review', label: 'Review' },
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
    onError: (e) => setError(e instanceof ApiError ? e.message : 'Something went wrong.'),
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
    <Modal open={open} title="Provision a new tenant" onClose={reset} wide>
      {/* Step indicator */}
      {step !== 'done' && (
        <div className="mb-6 flex items-center gap-2">
          {STEPS.map((s, i) => {
            const activeIndex = STEPS.findIndex((x) => x.id === step);
            const state = i < activeIndex ? 'done' : i === activeIndex ? 'active' : 'todo';
            return (
              <div key={s.id} className="flex flex-1 items-center gap-2">
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                    state === 'done'
                      ? 'bg-success text-white'
                      : state === 'active'
                        ? 'bg-orange text-white'
                        : 'bg-foam text-landmark'
                  }`}
                >
                  {state === 'done' ? <Check size={14} /> : i + 1}
                </span>
                <span
                  className={`text-xs font-semibold ${
                    state === 'todo' ? 'text-landmark' : 'text-gold-black'
                  }`}
                >
                  {s.label}
                </span>
                {i < STEPS.length - 1 && <span className="h-px flex-1 bg-sand" />}
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
              <Field label="Company name">
                <input
                  className={inputClass}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Blok Sofia Management"
                  autoFocus
                />
              </Field>
              <Field label="Key" hint="Lowercase slug used in URLs and configs — permanent.">
                <input
                  className={inputClass}
                  value={key}
                  onChange={(e) => setKey(e.target.value.toLowerCase())}
                  placeholder="blok-sofia"
                />
              </Field>
              <div className="flex justify-end">
                <PrimaryButton disabled={!orgValid} onClick={() => setStep('admin')}>
                  <span className="flex items-center gap-2">
                    Continue <ArrowRight size={15} />
                  </span>
                </PrimaryButton>
              </div>
            </div>
          )}

          {step === 'admin' && (
            <div className="space-y-4">
              <p className="text-sm text-landmark">
                The first user gets the tenant's <strong>admin</strong> role and activates via an
                invite code. You can skip this and add them later.
              </p>
              <Field label="Full name">
                <input
                  className={inputClass}
                  value={adminName}
                  onChange={(e) => setAdminName(e.target.value)}
                  placeholder="Petar Georgiev"
                  autoFocus
                />
              </Field>
              <Field label="Email">
                <input
                  className={inputClass}
                  type="email"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  placeholder="admin@bloksofia.bg"
                />
              </Field>
              <Field label="Phone" hint="Optional — receives the activation code.">
                <input
                  className={inputClass}
                  value={adminPhone}
                  onChange={(e) => setAdminPhone(e.target.value)}
                  placeholder="+359881234567"
                />
              </Field>
              <div className="flex justify-between">
                <GhostButton onClick={() => setStep('org')}>
                  <span className="flex items-center gap-1.5">
                    <ArrowLeft size={14} /> Back
                  </span>
                </GhostButton>
                <PrimaryButton disabled={!adminValid} onClick={() => setStep('review')}>
                  <span className="flex items-center gap-2">
                    {adminFilled ? 'Continue' : 'Skip for now'} <ArrowRight size={15} />
                  </span>
                </PrimaryButton>
              </div>
            </div>
          )}

          {step === 'review' && (
            <div className="space-y-4">
              <dl className="space-y-2 rounded-xl border border-sand/70 bg-foam/70 p-4 text-sm">
                <Row label="Company" value={name} />
                <Row label="Key" value={key} />
                <Row label="First admin" value={adminFilled ? adminName : '— added later'} />
                {adminFilled && <Row label="Email" value={adminEmail} />}
                {adminFilled && adminPhone && <Row label="Phone" value={adminPhone} />}
              </dl>
              <p className="text-xs text-landmark">
                Provisioning creates the tenant with the starter roles (Administrator, House
                manager, Resident){adminFilled ? ' and sends the admin an activation code' : ''}.
              </p>
              <ErrorNote message={error} />
              <div className="flex justify-between">
                <GhostButton onClick={() => setStep('admin')}>
                  <span className="flex items-center gap-1.5">
                    <ArrowLeft size={14} /> Back
                  </span>
                </GhostButton>
                <PrimaryButton disabled={provision.isPending} onClick={() => provision.mutate()}>
                  <span className="flex items-center gap-2">
                    <Sparkles size={15} />
                    {provision.isPending ? 'Provisioning…' : 'Provision tenant'}
                  </span>
                </PrimaryButton>
              </div>
            </div>
          )}

          {step === 'done' && result && (
            <div className="space-y-4 text-center">
              <motion.span
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', damping: 14 }}
                className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-success/10"
              >
                <Check size={26} className="text-success" />
              </motion.span>
              <div>
                <h3 className="font-extrabold">{result.tenant.name} is ready</h3>
                <p className="mt-1 text-sm text-landmark">
                  {result.adminInviteSent
                    ? 'The first admin got an activation code (dev: MOCK delivery — check the core-api console).'
                    : 'No admin was invited yet — add one from the Staff page after switching in.'}
                </p>
              </div>
              <div className="flex justify-center gap-2">
                <GhostButton onClick={reset}>Close</GhostButton>
                <PrimaryButton
                  onClick={() => {
                    setSelectedTenantId(result.tenant.id);
                    reset();
                  }}
                >
                  Switch to tenant
                </PrimaryButton>
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </Modal>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-landmark">{label}</dt>
      <dd className="font-semibold">{value}</dd>
    </div>
  );
}
