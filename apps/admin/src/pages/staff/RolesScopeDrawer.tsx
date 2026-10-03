import {
  Info,
  CheckCircle,
  CircleNotch,
  ArrowCounterClockwise,
  ShieldSlash,
  UserMinus,
  WarningCircle,
  X,
} from '../../components/icons';
import { useState } from 'react';
import { Avatar, ConfirmDialog, Drawer, StatusDot } from '../../components/ui';
import type { Role, StaffMember } from '../../lib/api';
import { permissionLabel, sortPermissions } from '../roles/permissions';
import {
  ACTION_PROGRESS,
  ROLE_NAMES,
  STATUS_LABELS,
  STATUS_TONES,
  formatSince,
  permissionDiff,
  roleName,
  type RowAction,
} from './model';

/**
 * What each seeded role is for, in the words of the approved panel
 * (1607:36771). A tenant's custom role falls back to its permission count,
 * which is the only description the API can supply.
 */
const ROLE_DESCRIPTIONS: Record<string, string> = {
  admin: 'Всички права в организацията.',
  manager: 'Ежедневни операции за сградите в обхвата.',
  accountant: 'Входни такси, плащания и финансови отчети.',
  resident: 'Собственият имот.',
  owner: 'Собственият имот. Предлага анкети и гласува.',
  tenant: 'Собственият имот. Без предложения и гласуване.',
  cleaning: 'Само сигналите с етикет «Чистота».',
  technician: 'Само сигналите с етикет «Поддръжка».',
};

function describeRole(role: Role): string {
  return (
    ROLE_DESCRIPTIONS[role.key] ??
    `${role.permissions.length} ${role.permissions.length === 1 ? 'право' : 'права'}.`
  );
}

/**
 * How the last save from the panel went. Owned by the page, which runs the
 * request; the panel only draws it (the five approved states of 1607:36771).
 */
export type SaveState =
  | { kind: 'idle' }
  | { kind: 'saving' }
  | { kind: 'failed'; action: RowAction; reason: string }
  | { kind: 'saved'; roleKey: string };

export function RolesScopeDrawer({
  member,
  roles,
  save,
  protection,
  onClose,
  onSave,
  onAccountAction,
}: {
  member: StaffMember | null;
  roles: Role[];
  save: SaveState;
  protection: string | null;
  onClose: () => void;
  /** `then`: stay open with the confirmation, or close once saved. */
  onSave: (roleKey: string, then: 'stay' | 'close') => void;
  onAccountAction: (action: Exclude<RowAction, 'change-role'>) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  // The draft belongs to one opening: when the page closes the panel (a save
  // from the question, an account action) or opens it on someone else, it
  // starts clean. Reset during render, as React advises for state that
  // follows a prop, rather than through an effect that would first paint
  // the stale choice.
  const [draftFor, setDraftFor] = useState(member?.userId ?? null);
  if ((member?.userId ?? null) !== draftFor) {
    setDraftFor(member?.userId ?? null);
    setDraft(null);
    setAsking(false);
  }

  if (!member) {
    return (
      <>
        <Drawer open={false} onClose={onClose} label="Роли и обхват" header={null} footer={null}>
          {null}
        </Drawer>
        <SaveQuestion open={false} onSave={onClose} onDiscard={onClose} onDismiss={onClose} />
      </>
    );
  }

  // Once saved, the panel measures changes against the role it just saved:
  // the list behind it catches up a moment later.
  const base = save.kind === 'saved' ? save.roleKey : member.roleKey;
  const selected = draft ?? base;
  const dirty = selected !== base;
  const saving = save.kind === 'saving';

  const leave = () => {
    setDraft(null);
    setAsking(false);
    onClose();
  };
  const close = () => {
    if (saving) return;
    if (dirty) setAsking(true);
    else leave();
  };
  // «Запази» in the question: the panel closes once saved; a failed save
  // closes the question and the panel says why.
  const saveAndClose = () => {
    setAsking(false);
    onSave(selected, 'close');
  };

  const fromRole = roles.find((role) => role.key === base);
  const toRole = roles.find((role) => role.key === selected);
  const diff =
    dirty && fromRole && toRole ? permissionDiff(fromRole.permissions, toRole.permissions) : null;

  return (
    <>
      <Drawer
        open
        onClose={close}
        label={`Роли и обхват — ${member.fullName}`}
        // 1764:28895: on a phone the sheet starts 40 below the top.
        phoneHeight="max-h-[calc(100dvh-2.5rem)]"
        header={
          <div className="flex items-start gap-3">
            <Avatar name={member.fullName} size={40} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-base font-medium">{member.fullName}</p>
              <p className="text-body-13-tight truncate text-panel-ink-muted">
                {member.email ?? member.phone}
              </p>
              <p className="text-body-13-tight mt-1 flex flex-wrap items-center gap-x-2 text-panel-ink-muted">
                <StatusDot tone={STATUS_TONES[member.status]} onPanel>
                  <span className="text-body-13-tight font-normal">
                    {STATUS_LABELS[member.status]}
                  </span>
                </StatusDot>
                <span className="num">· Член от {formatSince(member.since)}</span>
              </p>
            </div>
            <button
              type="button"
              onClick={close}
              data-dialog-close
              aria-label="Затвори"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-panel-ink-muted transition-colors hover:bg-panel-row hover:text-panel-ink"
            >
              <X size="1.125rem" />
            </button>
          </div>
        }
        footer={
          <Footer
            save={save}
            dirty={dirty}
            onCancel={close}
            onSave={() => onSave(selected, 'stay')}
            onDone={leave}
          />
        }
      >
        <SaveBand save={save} member={member} roles={roles} dirty={dirty} />

        <fieldset disabled={saving} className="space-y-7">
          <section>
            <h3 className="text-sm font-semibold">Роли</h3>
            {/*
            TODO(M1-B8): several roles per account. `PATCH /tenant/staff/:id`
            takes one `roleKey`, so this is a single choice — check boxes here
            would let the drawer show a second role the server silently drops.
          */}
            <p className="text-body-13-tight mt-0.5 text-panel-ink-muted">
              Акаунтът има една роля. Няколко роли на един акаунт ще са възможни по-късно.
            </p>
            <div role="radiogroup" aria-label="Роля" className="mt-3 space-y-1.5">
              {roles.map((role) => {
                const checked = role.key === selected;
                return (
                  <button
                    key={role.key}
                    type="button"
                    role="radio"
                    aria-checked={checked}
                    data-autofocus={checked ? '' : undefined}
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
                      <span className="block text-sm font-semibold text-panel-ink">
                        {ROLE_NAMES[role.key] ?? roleName(role.key, roles)}
                      </span>
                      <span className="text-body-13-tight block text-panel-ink-muted">
                        {describeRole(role)}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <section>
            <h3 className="text-sm font-semibold">Обхват</h3>
            <p className="text-body-13-tight mt-0.5 text-panel-ink-muted">
              Къде важат ролите. Стесняването на обхвата никога не разширява правата.
            </p>
            {/* TODO(M2): building scope — assignments arrive with the property hierarchy. */}
            <div className="mt-3 rounded-2xl bg-panel-row px-3.5 py-3 opacity-60">
              <p className="text-sm font-semibold text-panel-ink">Всички сгради в организацията</p>
              <p className="text-body-13-tight text-panel-ink-muted">
                Избор на отделни сгради идва с йерархията на имотите.
              </p>
            </div>
          </section>

          {diff && <Changes gains={diff.gains} losses={diff.losses} />}

          <section>
            <h3 className="text-sm font-semibold">Акаунт</h3>
            {!protection && (
              <p className="text-body-13-tight mt-0.5 text-panel-ink-muted">
                Спирането е обратимо. Изтриването прекратява достъпа завинаги.
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
                    icon={<ArrowCounterClockwise size="0.9375rem" />}
                    onClick={() => onAccountAction('reactivate')}
                  >
                    Възстанови достъпа
                  </AccountAction>
                ) : (
                  <AccountAction
                    icon={<ShieldSlash size="0.9375rem" />}
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
                  icon={<UserMinus size="0.9375rem" />}
                  onClick={() => onAccountAction('revoke')}
                  danger
                >
                  Изтрий достъпа
                </AccountAction>
              </div>
            )}
          </section>
        </fieldset>
      </Drawer>
      <SaveQuestion
        open={asking}
        onSave={saveAndClose}
        onDiscard={leave}
        onDismiss={() => setAsking(false)}
      />
    </>
  );
}

/**
 * «Да се запазят ли промените?» (design.md → Windows and navigation, 1925:2).
 * It stands beside the drawer, not inside it: a child of the closing drawer
 * would leave with it, frozen open through the exit animation — visible over
 * the departing panel, the page inert meanwhile.
 */
function SaveQuestion({
  open,
  onSave,
  onDiscard,
  onDismiss,
}: {
  open: boolean;
  onSave: () => void;
  onDiscard: () => void;
  onDismiss: () => void;
}) {
  return (
    <ConfirmDialog
      open={open}
      title="Да се запазят ли промените?"
      primary={{ label: 'Запази', onClick: onSave }}
      danger={{ label: 'Не запазвай', onClick: onDiscard }}
      onDismiss={onDismiss}
    >
      Промените още не са запазени.
    </ConfirmDialog>
  );
}

/** The band above the form: how the last save went (states 4 and 5). */
function SaveBand({
  save,
  member,
  roles,
  dirty,
}: {
  save: SaveState;
  member: StaffMember;
  roles: Role[];
  dirty: boolean;
}) {
  if (save.kind === 'failed') {
    const text =
      save.action === 'change-role'
        ? `Не се запази — ${save.reason}`
        : `${ACTION_PROGRESS[save.action]} ${member.fullName} не успя: ${save.reason}`;
    return (
      <p
        role="alert"
        className="mb-5 flex gap-2 rounded-2xl px-3.5 py-3 text-sm text-panel-ink"
        style={{ boxShadow: 'inset 0 0 0 0.0625rem var(--panel-status-urgent)' }}
      >
        <WarningCircle size="1rem" className="mt-0.5 shrink-0 text-panel-status-urgent" />
        <span>{text}</span>
      </p>
    );
  }
  // A new choice after a save is a new change; the confirmation steps aside.
  if (save.kind === 'saved' && !dirty) {
    return (
      <p
        role="status"
        className="mb-5 flex gap-2 rounded-2xl px-3.5 py-3 text-sm text-panel-ink"
        style={{ boxShadow: 'inset 0 0 0 0.0625rem var(--panel-status-resolved)' }}
      >
        <CheckCircle size="1rem" className="mt-0.5 shrink-0 text-panel-status-resolved" />
        <span>
          Запазено. {member.fullName} е {roleName(save.roleKey, roles)} във всички сгради.
        </span>
      </p>
    );
  }
  return null;
}

/** «Какво се променя при запис» (1607:976): the rights that come and go. */
function Changes({ gains, losses }: { gains: string[]; losses: string[] }) {
  return (
    <section className="rounded-2xl bg-panel-row p-4">
      <h3 className="text-sm font-semibold">Какво се променя при запис</h3>
      <dl className="mt-3 space-y-2.5">
        <ChangeRow label="Получава" keys={gains} />
        <ChangeRow label="Губи" keys={losses} />
      </dl>
    </section>
  );
}

function ChangeRow({ label, keys }: { label: string; keys: string[] }) {
  const chip =
    'text-label-12 inline-flex items-center rounded-full px-2.5 py-1 font-semibold whitespace-nowrap';
  return (
    <div className="grid grid-cols-[5.25rem_1fr] gap-x-3">
      <dt className="pt-1 text-xs text-panel-ink-muted">{label}</dt>
      <dd>
        <ul aria-label={label} className="flex flex-wrap gap-1.5">
          {keys.length === 0 ? (
            <li className={`${chip} bg-panel-row-strong text-panel-ink-muted`}>нищо</li>
          ) : (
            sortPermissions(keys).map((key) => (
              <li
                key={key}
                className={`${chip} text-panel-ink`}
                style={{ boxShadow: 'inset 0 0 0 0.0625rem var(--panel-status-resolved)' }}
              >
                {permissionLabel(key)}
              </li>
            ))
          )}
        </ul>
      </dd>
    </div>
  );
}

/**
 * The footer per state: what is unsaved, then «Отказ» and the save; while
 * saving both wait; after a failure the save is a retry; once saved and
 * untouched, only «Затвори».
 */
function Footer({
  save,
  dirty,
  onCancel,
  onSave,
  onDone,
}: {
  save: SaveState;
  dirty: boolean;
  onCancel: () => void;
  onSave: () => void;
  onDone: () => void;
}) {
  const secondary =
    'h-11 rounded-full border border-panel-border px-4 text-sm font-medium text-panel-ink disabled:opacity-40';
  const primary =
    'flex h-11 items-center gap-2 rounded-full bg-panel-ink px-5 text-sm font-semibold text-panel-ink-inverse disabled:opacity-40';

  if (save.kind === 'saved' && !dirty) {
    return (
      <div className="flex items-center gap-3">
        <span className="text-body-13-tight min-w-0 flex-1 truncate text-panel-ink-faint">
          Няма промени
        </span>
        <button type="button" onClick={onDone} className={secondary}>
          Затвори
        </button>
      </div>
    );
  }

  const saving = save.kind === 'saving';
  // A retry sends the choice that failed; put back to the saved role there
  // is nothing to retry.
  const failed = save.kind === 'failed' && save.action === 'change-role' && dirty;
  const note = saving
    ? 'Прилагане на 1 промяна…'
    : failed
      ? 'Не се запази'
      : dirty
        ? '1 незапазена промяна'
        : 'Няма промени';

  return (
    <div className="flex items-center gap-3">
      <span className="text-body-13-tight min-w-0 flex-1 truncate text-panel-ink-faint">
        {note}
      </span>
      <button type="button" onClick={onCancel} disabled={saving} className={secondary}>
        Отказ
      </button>
      <button
        type="button"
        onClick={onSave}
        disabled={saving || !(dirty || failed)}
        className={primary}
      >
        {saving && <CircleNotch size="0.875rem" className="animate-spin" />}
        {saving ? (
          'Запазване…'
        ) : failed ? (
          'Опитай отново'
        ) : (
          // The phone frame (1764:28895) keeps the short «Запази».
          <span>
            Запази<span className="hidden sm:inline"> промените</span>
          </span>
        )}
      </button>
    </div>
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
