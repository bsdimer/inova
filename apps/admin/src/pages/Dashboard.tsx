import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Building2,
  CalendarDays,
  CircleAlert,
  FileUp,
  ShieldCheck,
  UserCog,
  Wallet,
} from '../components/icons';
import type { ReactNode } from 'react';
import { Chip, StatusDot, type StatusTone } from '../components/ui';
import { api, ApiError, type Role, type StaffMember, type TenantContext } from '../lib/api';
import { useSelectedTenantId } from '../lib/tenant';
import { STATUS_TONES } from './staff/model';

const TENANT_STATUS_LABELS: Record<TenantContext['tenant']['status'], string> = {
  trial: 'Пробен период',
  active: 'Активна',
  suspended: 'Спряна',
  offboarded: 'Закрита',
};

const TENANT_STATUS_TONES: Record<TenantContext['tenant']['status'], StatusTone> = {
  trial: 'pending',
  active: 'resolved',
  suspended: 'urgent',
  offboarded: 'muted',
};

export function DashboardPage() {
  const tenantId = useSelectedTenantId();

  const context = useQuery({
    queryKey: ['tenant', tenantId],
    queryFn: () => api<TenantContext>('/tenant', { tenantId: tenantId! }),
    enabled: Boolean(tenantId),
    staleTime: 60_000,
  });
  const staff = useQuery({
    queryKey: ['staff', tenantId],
    queryFn: () => api<StaffMember[]>('/tenant/staff', { tenantId: tenantId! }),
    enabled: Boolean(tenantId),
    retry: false,
  });
  const roles = useQuery({
    queryKey: ['roles', tenantId],
    queryFn: () => api<Role[]>('/tenant/roles', { tenantId: tenantId! }),
    enabled: Boolean(tenantId),
    retry: false,
  });

  const tenant = context.data?.tenant;
  const members = staff.data ?? [];
  const activeStaff = members.filter((m) => m.status === 'active').length;
  const invitedStaff = members.filter((m) => m.status === 'invited').length;
  const staffDenied = staff.error instanceof ApiError && staff.error.status === 403;

  return (
    <div className="space-y-5">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight">Табло</h1>
        <p className="mt-1 text-sm text-ink-muted">
          {tenant ? `${tenant.name} · ключ ${tenant.key}` : 'Зарежда организацията…'}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        {/* The one card whose numbers exist today: identity and access. */}
        <motion.section
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="glass p-6 xl:col-span-2"
        >
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-base font-semibold">Организация</h2>
            {tenant && (
              <StatusDot tone={TENANT_STATUS_TONES[tenant.status]}>
                {TENANT_STATUS_LABELS[tenant.status]}
              </StatusDot>
            )}
          </div>

          <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Figure
              icon={<UserCog size={16} />}
              label="Активни служители"
              value={staffDenied ? null : activeStaff}
            />
            <Figure
              icon={<UserCog size={16} />}
              label="Чакащи покана"
              value={staffDenied ? null : invitedStaff}
            />
            <Figure
              icon={<ShieldCheck size={16} />}
              label="Роли"
              value={roles.data ? roles.data.length : null}
            />
            <Figure
              icon={<ShieldCheck size={16} />}
              label="Ваши права"
              value={context.data ? context.data.permissions.length : null}
            />
          </div>

          {members.length > 0 && (
            <div className="mt-5 border-t border-glass-divider pt-4">
              <p className="text-xs font-semibold tracking-wider text-ink-faint uppercase">
                Последно добавени
              </p>
              <ul className="mt-2 space-y-1.5">
                {[...members]
                  .sort((a, b) => b.since.localeCompare(a.since))
                  .slice(0, 3)
                  .map((member) => (
                    <li
                      key={member.userId}
                      className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm"
                    >
                      <span className="font-medium">{member.fullName}</span>
                      <StatusDot tone={STATUS_TONES[member.status]}>
                        <span className="text-xs">{member.email ?? member.phone ?? '—'}</span>
                      </StatusDot>
                    </li>
                  ))}
              </ul>
            </div>
          )}
        </motion.section>

        {/*
          The rest of the Табло design needs data no API returns yet. Each card
          keeps its place and says which milestone brings it, rather than
          showing a plausible number that would read as decided.
          Contract: docs/features/admin-dashboard.md.
        */}
        <Planned icon={<CalendarDays size={18} />} title="Календар" milestone="M11" delay={0.05}>
          Общи събрания, отчети и задачи на екипа се появяват тук, когато разделът «Задачи» получи
          своя API.
        </Planned>

        <Planned icon={<Wallet size={18} />} title="Баланс" milestone="M3–M4" delay={0.1}>
          Събрани суми, задължения и дял на плащанията идват с начисленията и касата.
        </Planned>

        <Planned icon={<CircleAlert size={18} />} title="Нередности" milestone="M6" delay={0.15}>
          Отворените сигнали по етикет и спешност идват с раздела «Нередности».
        </Planned>

        <Planned
          icon={<Building2 size={18} />}
          title="Преглед на сгради"
          milestone="M2"
          delay={0.2}
        >
          Сгради, апартаменти и жители идват с йерархията на имотите.
        </Planned>

        <Planned
          icon={<FileUp size={18} />}
          title="Качи документ"
          milestone="M4"
          delay={0.25}
          className="xl:col-span-2"
        >
          Фактури и документи за сгради се качват тук, когато хранилището на документи бъде
          включено.
        </Planned>
      </div>
    </div>
  );
}

function Figure({ icon, label, value }: { icon: ReactNode; label: string; value: number | null }) {
  return (
    <div>
      <span className="flex items-center gap-1.5 text-xs text-ink-muted">
        {icon}
        {label}
      </span>
      <span className="num mt-1 block text-3xl font-semibold tracking-tight">
        {value ?? <span className="text-xl text-ink-faint">—</span>}
      </span>
    </div>
  );
}

/** A card the design places but the data does not exist for yet. */
function Planned({
  icon,
  title,
  milestone,
  children,
  delay,
  className = '',
}: {
  icon: ReactNode;
  title: string;
  milestone: string;
  children: ReactNode;
  delay: number;
  className?: string;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay }}
      className={`glass flex flex-col p-6 ${className}`}
    >
      <div className="flex items-center gap-2.5">
        <span className="text-ink-soft">{icon}</span>
        <h2 className="text-base font-semibold">{title}</h2>
        <span className="ml-auto">
          <Chip muted>{milestone}</Chip>
        </span>
      </div>
      <p className="mt-3 text-sm text-ink-muted">{children}</p>
    </motion.section>
  );
}
