import {
  CircleAlert,
  CircleCheck,
  Clock,
  LoaderCircle,
  MoreHorizontal,
  TriangleAlert,
} from '../../components/icons';
import type { ReactNode } from 'react';
import { Avatar, Chip, SolidIconButton, StatusDot } from '../../components/ui';
import type { StaffMember } from '../../lib/api';
import {
  INVITE_LABELS,
  STATUS_LABELS,
  STATUS_TONES,
  formatSince,
  inviteStateOf,
  type InviteState,
  type RowAction,
} from './model';

const INVITE_ICON: Record<InviteState, ReactNode> = {
  activated: <CircleCheck size={16} />,
  'code-sent': <Clock size={16} />,
  none: <CircleAlert size={16} />,
};

/** Invite outcome: an icon carries the tone, the words carry the meaning. */
function InviteCell({ member }: { member: StaffMember }) {
  const state = inviteStateOf(member);
  if (state === 'none') return <span className="text-body-13-tight text-ink-soft">—</span>;
  return (
    <span className="text-body-13-tight inline-flex items-center gap-1.5 whitespace-nowrap text-ink-soft">
      <span
        className="shrink-0"
        style={{
          color: state === 'activated' ? 'var(--status-resolved)' : 'var(--text-muted)',
        }}
      >
        {INVITE_ICON[state]}
      </span>
      {INVITE_LABELS[state]}
    </span>
  );
}

export interface RowProps {
  member: StaffMember;
  roles: { key: string; name: string }[];
  scope: string | null;
  isSelf: boolean;
  canManage: boolean;
  /** Why every write action is blocked, or null when the row is editable. */
  protection: string | null;
  busy: boolean;
  onAction: (action: RowAction) => void;
}

/**
 * One button per row. The mock-ups moved every row action into the «Роли и
 * обхват» drawer, so this opens the drawer rather than a menu; a member
 * without `staff.manage` still opens it and reads the same page without the
 * account actions.
 */
function RowAction({ member, busy, onAction }: RowProps) {
  if (busy) {
    return (
      <span className="flex h-8 w-8 items-center justify-center text-ink-muted">
        <LoaderCircle size={16} className="animate-spin" />
      </span>
    );
  }
  return (
    <SolidIconButton
      label={`Роли и обхват — ${member.fullName}`}
      onClick={() => onAction('change-role')}
    >
      <MoreHorizontal size={16} />
    </SolidIconButton>
  );
}

const CELL = 'px-3 align-middle';

export function StaffRow(props: RowProps) {
  const { member, roles, scope, isSelf, busy } = props;
  const [primary, ...more] = roles;
  const contact = member.email ?? member.phone ?? '—';

  return (
    <tr
      className={`h-16 border-t border-glass-divider transition-colors ${
        busy ? 'opacity-45' : 'hover:bg-glass-inner-soft'
      }`}
      aria-busy={busy}
    >
      <td className={CELL}>
        <div className="flex items-center gap-3">
          <Avatar name={member.fullName} size={36} />
          <span className="min-w-0">
            <span className="text-body-14 block truncate font-semibold">{member.fullName}</span>
            <span className="text-body-13-tight block truncate text-ink-soft">
              {isSelf && 'вие'}
              <span className="@4xl:hidden">
                {isSelf && ' · '}
                {contact}
              </span>
            </span>
          </span>
        </div>
      </td>
      <td className={`${CELL} hidden text-ink-soft @4xl:table-cell`}>
        <p className="text-body-14 truncate">{member.email ?? '—'}</p>
        <p className="num text-body-13-tight truncate">{member.phone ?? '—'}</p>
      </td>
      <td className={CELL}>
        <StatusDot tone={STATUS_TONES[member.status]}>{STATUS_LABELS[member.status]}</StatusDot>
        <div className="mt-1 @5xl:hidden">
          <InviteCell member={member} />
        </div>
      </td>
      <td className={CELL}>
        <div className="flex items-center gap-1.5">
          <Chip>{primary?.name ?? member.roleKey}</Chip>
          {more.length > 0 && <Chip muted>+{more.length}</Chip>}
        </div>
      </td>
      <td className={`${CELL} hidden text-ink-soft @4xl:table-cell`}>
        <p className="text-body-14 truncate">{scope ?? '—'}</p>
      </td>
      <td className={`${CELL} hidden @5xl:table-cell`}>
        <InviteCell member={member} />
      </td>
      <td
        className={`${CELL} num text-body-13-tight hidden pr-1 whitespace-nowrap text-ink-soft @5xl:table-cell`}
      >
        {formatSince(member.since)}
      </td>
      <td className={CELL}>
        <div className="flex justify-end">
          <RowAction {...props} />
        </div>
      </td>
    </tr>
  );
}

/** Phone layout: one card per member, the table's columns stacked. */
export function StaffCard(props: RowProps) {
  const { member, roles, scope, isSelf, busy } = props;
  const [primary, ...more] = roles;

  return (
    <div className={`glass-data p-4 ${busy ? 'opacity-45' : ''}`} aria-busy={busy}>
      <div className="flex items-start gap-3">
        <Avatar name={member.fullName} size={36} />
        <div className="min-w-0 flex-1">
          <p className="text-body-14 truncate font-semibold">{member.fullName}</p>
          <p className="num text-body-13-tight truncate text-ink-soft">
            {isSelf && 'вие · '}
            {[member.email, member.phone].filter(Boolean).join(' · ') || '—'}
          </p>
        </div>
        <RowAction {...props} />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
        <StatusDot tone={STATUS_TONES[member.status]}>{STATUS_LABELS[member.status]}</StatusDot>
        <Chip>{primary?.name ?? member.roleKey}</Chip>
        {more.length > 0 && <Chip muted>+{more.length}</Chip>}
      </div>

      <div className="text-body-13 mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-ink-soft">
        <InviteCell member={member} />
        <span>{scope ?? '—'}</span>
        <span className="num">от {formatSince(member.since)}</span>
      </div>
    </div>
  );
}

/** Kept next to the row so the strip and the drawer use one warning icon. */
export const RowWarningIcon = TriangleAlert;
