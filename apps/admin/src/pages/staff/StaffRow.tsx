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
  activated: <CircleCheck size={14} />,
  'code-sent': <Clock size={14} />,
  none: <CircleAlert size={14} />,
};

/** Invite outcome: an icon carries the tone, the words carry the meaning. */
function InviteCell({ member }: { member: StaffMember }) {
  const state = inviteStateOf(member);
  if (state === 'none') return <span className="text-sm text-ink-faint">—</span>;
  return (
    <span className="inline-flex items-center gap-2 text-sm whitespace-nowrap text-ink-soft">
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

const CELL = 'px-3 first:pl-6 last:pr-6 align-middle';

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
            <span className="block truncate font-medium">{member.fullName}</span>
            <span className="block truncate text-xs text-ink-faint">
              {isSelf && 'вие'}
              <span className="@4xl:hidden">
                {isSelf && ' · '}
                {contact}
              </span>
            </span>
          </span>
        </div>
      </td>
      <td className={`${CELL} hidden text-ink-muted @4xl:table-cell`}>
        <p className="truncate text-sm">{member.email ?? '—'}</p>
        <p className="num truncate text-xs">{member.phone ?? '—'}</p>
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
      <td className={`${CELL} hidden text-sm whitespace-nowrap text-ink-muted @4xl:table-cell`}>
        {scope ?? '—'}
      </td>
      <td className={`${CELL} hidden @5xl:table-cell`}>
        <InviteCell member={member} />
      </td>
      <td className={`${CELL} num hidden text-sm whitespace-nowrap text-ink-muted @5xl:table-cell`}>
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
          <p className="truncate font-medium">{member.fullName}</p>
          <p className="num truncate text-xs text-ink-faint">
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

      <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-muted">
        <InviteCell member={member} />
        <span>{scope ?? '—'}</span>
        <span className="num">от {formatSince(member.since)}</span>
      </div>
    </div>
  );
}

/** Kept next to the row so the strip and the drawer use one warning icon. */
export const RowWarningIcon = TriangleAlert;
