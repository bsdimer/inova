import { Info, LoaderCircle, RotateCcw, ShieldOff, UserX, X } from '../../components/icons';
import { useEffect, useState } from 'react';
import { Avatar, Drawer, StatusDot } from '../../components/ui';
import type { Role, StaffMember } from '../../lib/api';
import {
  ROLE_NAMES,
  STATUS_LABELS,
  STATUS_TONES,
  formatSince,
  roleName,
  type RowAction,
} from './model';

/**
 * What each seeded role is for, in the stakeholder's own words from the
 * 2026-09-22 decisions. A tenant's custom role falls back to its permission
 * count, which is the only description the API can supply.
 */
const ROLE_DESCRIPTIONS: Record<string, string> = {
  admin: 'Всички права в организацията.',
  manager: 'Ежедневни операции в сградите в обхвата.',
  accountant: 'Такси, плащания и финансови отчети.',
  resident: 'Собственият апартамент.',
  owner: 'Собственият апартамент. Предлага анкети и гласува.',
  tenant: 'Собственият апартамент. Без предложения и гласуване.',
  cleaning: 'Само сигналите с етикет «Чистота».',
  technician: 'Само сигналите с етикет «Поддръжка».',
};

function describeRole(role: Role): string {
  return (
    ROLE_DESCRIPTIONS[role.key] ??
    `${role.permissions.length} ${role.permissions.length === 1 ? 'право' : 'права'}.`
  );
}

export function RolesScopeDrawer({
  member,
  roles,
  saving,
  error,
  protection,
  onClose,
  onSave,
  onAccountAction,
}: {
  member: StaffMember | null;
  roles: Role[];
  saving: boolean;
  error: string | null;
  protection: string | null;
  onClose: () => void;
  onSave: (roleKey: string) => void;
  onAccountAction: (action: RowAction) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);

  // A different member in the same drawer starts from that member's own role.
  useEffect(() => setDraft(null), [member?.userId]);

  if (!member) {
    return (
      <Drawer open={false} onClose={onClose} label="Роли и обхват" header={null} footer={null}>
        {null}
      </Drawer>
    );
  }

  const selected = draft ?? member.roleKey;
  const dirty = selected !== member.roleKey;
  const close = () => {
    if (saving) return;
    setDraft(null);
    onClose();
  };

  return (
    <Drawer
      open
      onClose={close}
      label={`Роли и обхват — ${member.fullName}`}
      header={
        <div className="flex items-start gap-3">
          <Avatar name={member.fullName} size={40} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-semibold">{member.fullName}</p>
            <p className="truncate text-sm text-panel-ink-muted">{member.email ?? member.phone}</p>
            <p className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-panel-ink-muted">
              <StatusDot tone={STATUS_TONES[member.status]} onPanel>
                <span className="text-xs">{STATUS_LABELS[member.status]}</span>
              </StatusDot>
              <span className="num">· Член от {formatSince(member.since)}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label="Затвори"
            className="rounded-full p-1.5 text-panel-ink-muted transition-colors hover:bg-panel-row hover:text-panel-ink"
          >
            <X size="1.125rem" />
          </button>
        </div>
      }
      footer={
        <div className="flex items-center gap-3">
          <span className="min-w-0 flex-1 truncate text-xs text-panel-ink-faint">
            {error ?? (dirty ? 'Има незапазени промени' : 'Няма промени')}
          </span>
          <button
            type="button"
            onClick={close}
            disabled={saving}
            className="rounded-full border border-panel-border px-4 py-2 text-sm font-medium text-panel-ink disabled:opacity-40"
          >
            Отказ
          </button>
          <button
            type="button"
            onClick={() => onSave(selected)}
            disabled={!dirty || saving}
            className="flex items-center gap-2 rounded-full bg-panel-ink px-5 py-2 text-sm font-semibold text-panel-ink-inverse disabled:opacity-40"
          >
            {saving && <LoaderCircle size="0.875rem" className="animate-spin" />}
            Запази
          </button>
        </div>
      }
    >
      <fieldset disabled={saving} className="space-y-7">
        <section>
          <h3 className="text-sm font-semibold">Роли</h3>
          {/*
            TODO(M1-B8): several roles per account. `PATCH /tenant/staff/:id`
            takes one `roleKey`, so this is a single choice — check boxes here
            would let the drawer show a second role the server silently drops.
          */}
          <p className="mt-0.5 text-xs text-panel-ink-muted">
            Акаунтът има една роля. Няколко роли на един акаунт идват с преработката на регистрите
            (B8).
          </p>
          <div className="mt-3 space-y-1.5">
            {roles.map((role) => {
              const checked = role.key === selected;
              return (
                <button
                  key={role.key}
                  type="button"
                  role="radio"
                  aria-checked={checked}
                  onClick={() => setDraft(role.key)}
                  className={`flex w-full items-start gap-3 rounded-2xl px-3.5 py-3 text-left transition-colors ${
                    checked ? 'bg-panel-row-strong' : 'bg-panel-row hover:bg-panel-row-strong'
                  }`}
                >
                  <span
                    className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full"
                    style={{ boxShadow: 'inset 0 0 0 0.09375rem var(--panel-border)' }}
                  >
                    {checked && (
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ background: 'var(--panel-text)' }}
                      />
                    )}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-panel-ink">
                      {ROLE_NAMES[role.key] ?? roleName(role.key, roles)}
                    </span>
                    <span className="block text-xs text-panel-ink-muted">{describeRole(role)}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <section>
          <h3 className="text-sm font-semibold">Обхват</h3>
          <p className="mt-0.5 text-xs text-panel-ink-muted">
            Къде важат ролите. Стесняването на обхвата никога не разширява правата.
          </p>
          {/* TODO(M2): building scope — assignments arrive with the property hierarchy. */}
          <div className="mt-3 rounded-2xl bg-panel-row px-3.5 py-3 opacity-60">
            <p className="text-sm font-medium text-panel-ink">Всички сгради в организацията</p>
            <p className="text-xs text-panel-ink-muted">
              Избор на отделни сгради идва с йерархията на имотите (M2).
            </p>
          </div>
        </section>

        <section>
          <h3 className="text-sm font-semibold">Акаунт</h3>
          {!protection && (
            <p className="mt-0.5 text-xs text-panel-ink-muted">
              Спирането е обратимо. Отмяната прекратява достъпа завинаги.
            </p>
          )}
          {protection ? (
            <p className="mt-3 flex gap-2 rounded-2xl bg-panel-row px-3.5 py-3 text-xs text-panel-status-urgent">
              <Info size="0.875rem" className="mt-0.5 shrink-0" />
              {protection}
            </p>
          ) : (
            <div className="mt-3 flex flex-wrap gap-2">
              {member.status === 'suspended' ? (
                <AccountAction
                  icon={<RotateCcw size="0.9375rem" />}
                  onClick={() => onAccountAction('reactivate')}
                >
                  Възстанови достъпа
                </AccountAction>
              ) : (
                <AccountAction
                  icon={<ShieldOff size="0.9375rem" />}
                  onClick={() => onAccountAction('suspend')}
                  disabled={member.status === 'invited'}
                  hint={
                    member.status === 'invited'
                      ? 'Поканените активират акаунта си с код първо.'
                      : undefined
                  }
                >
                  Спри достъпа
                </AccountAction>
              )}
              <AccountAction
                icon={<UserX size="0.9375rem" />}
                onClick={() => onAccountAction('revoke')}
                danger
              >
                {member.status === 'invited' ? 'Отмени поканата' : 'Отмени достъпа'}
              </AccountAction>
            </div>
          )}
        </section>
      </fieldset>
    </Drawer>
  );
}

/** The two account actions sit side by side as outlined pills, as drawn. */
function AccountAction({
  icon,
  children,
  onClick,
  disabled = false,
  danger = false,
  hint,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  hint?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={hint}
      className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors hover:bg-panel-row disabled:cursor-not-allowed disabled:opacity-40 ${
        danger
          ? 'border-panel-status-urgent text-panel-status-urgent'
          : 'border-panel-border text-panel-ink'
      }`}
    >
      <span className="shrink-0">{icon}</span>
      {children}
    </button>
  );
}
