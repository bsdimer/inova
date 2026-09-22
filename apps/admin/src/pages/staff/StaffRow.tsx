import { AnimatePresence, motion } from 'framer-motion';
import {
  ChevronRight,
  CircleAlert,
  CircleCheck,
  Clock,
  Eye,
  Info,
  LoaderCircle,
  MoreHorizontal,
  RotateCcw,
  ShieldOff,
  TriangleAlert,
  UserCog,
  UserX,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Avatar, Chip, IconButton, MenuItem, Popover, StatusDot } from '../../components/ui';
import type { StaffMember } from '../../lib/api';
import {
  INVITE_LABELS,
  INVITED_NOTE,
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
  expanded: boolean;
  onToggleDetails: () => void;
  onAction: (action: RowAction) => void;
}

/** The "…" menu, shared by the table row and the phone card. */
function RowMenu(props: RowProps & { onDetails: () => void }) {
  const { member, canManage, protection, expanded } = props;
  const [open, setOpen] = useState(false);
  const writable = canManage && !protection && member.status !== 'revoked';
  const invited = member.status === 'invited';

  const act = (action: RowAction) => {
    setOpen(false);
    props.onAction(action);
  };

  return (
    <Popover
      open={open}
      onClose={() => setOpen(false)}
      align="right"
      anchor={
        <IconButton
          label={`Действия за ${member.fullName}`}
          active={open}
          onClick={() => setOpen((v) => !v)}
        >
          <MoreHorizontal size={16} />
        </IconButton>
      }
    >
      <div role="menu" className="w-72">
        <MenuItem
          icon={<Eye size={15} />}
          onClick={() => {
            setOpen(false);
            props.onDetails();
          }}
          trailing={<ChevronRight size={14} className="opacity-50" />}
        >
          {expanded ? 'Скрий детайлите' : 'Виж детайлите'}
        </MenuItem>
        {canManage && member.status !== 'revoked' && (
          <>
            <MenuItem
              icon={<UserCog size={15} />}
              onClick={() => act('change-role')}
              disabled={!writable}
              trailing={<ChevronRight size={14} className="opacity-50" />}
            >
              Роли и обхват
            </MenuItem>
            <hr className="my-1 border-panel-divider" />
            {member.status === 'suspended' ? (
              <MenuItem
                icon={<RotateCcw size={15} />}
                onClick={() => act('reactivate')}
                disabled={!writable}
              >
                Възстанови
              </MenuItem>
            ) : (
              <MenuItem
                icon={<ShieldOff size={15} />}
                onClick={() => act('suspend')}
                disabled={!writable || invited}
              >
                Спри
              </MenuItem>
            )}
            <MenuItem
              icon={<UserX size={15} />}
              onClick={() => act('revoke')}
              disabled={!writable}
              danger
            >
              {invited ? 'Отмени поканата' : 'Отмени достъпа'}
            </MenuItem>
            {(protection ?? (invited && writable ? INVITED_NOTE : null)) && (
              <p className="mt-1 flex gap-2 rounded-xl bg-panel-row px-3 py-2 text-left text-xs text-panel-status-urgent">
                <Info size={14} className="mt-0.5 shrink-0" />
                {protection ?? INVITED_NOTE}
              </p>
            )}
          </>
        )}
      </div>
    </Popover>
  );
}

const CELL = 'px-3 first:pl-6 last:pr-6 align-middle';

export function StaffRow(props: RowProps) {
  const { member, roles, scope, isSelf, busy, expanded } = props;
  const [primary, ...more] = roles;
  const contact = member.email ?? member.phone ?? '—';

  return (
    <>
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
        <td
          className={`${CELL} num hidden text-sm whitespace-nowrap text-ink-muted @5xl:table-cell`}
        >
          {formatSince(member.since)}
        </td>
        <td className={CELL}>
          <div className="flex justify-end">
            {busy ? (
              <span className="flex h-8 w-8 items-center justify-center text-ink-muted">
                <LoaderCircle size={16} className="animate-spin" />
              </span>
            ) : (
              <RowMenu {...props} onDetails={props.onToggleDetails} />
            )}
          </div>
        </td>
      </tr>
      <AnimatePresence initial={false}>
        {expanded && (
          <tr className="border-t border-glass-divider">
            <td colSpan={8} className="p-0">
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
                style={{ background: 'var(--glass-inner-soft)' }}
              >
                <dl className="grid grid-cols-2 gap-x-6 gap-y-3 px-6 py-4 text-sm sm:grid-cols-3 lg:grid-cols-5">
                  <Detail label="Имейл">{member.email ?? '—'}</Detail>
                  <Detail label="Телефон" numeric>
                    {member.phone ?? '—'}
                  </Detail>
                  <Detail label="Роли">{roles.map((r) => r.name).join(', ')}</Detail>
                  <Detail label="Обхват">{scope ?? '—'}</Detail>
                  <Detail label="От" numeric>
                    {formatSince(member.since)}
                  </Detail>
                </dl>
              </motion.div>
            </td>
          </tr>
        )}
      </AnimatePresence>
    </>
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
        {busy ? (
          <span className="flex h-8 w-8 items-center justify-center text-ink-muted">
            <LoaderCircle size={16} className="animate-spin" />
          </span>
        ) : (
          <RowMenu {...props} onDetails={props.onToggleDetails} />
        )}
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

function Detail({
  label,
  children,
  numeric = false,
}: {
  label: string;
  children: ReactNode;
  numeric?: boolean;
}) {
  return (
    <div>
      <dt className="text-xs font-semibold tracking-wider text-ink-faint uppercase">{label}</dt>
      <dd className={`mt-0.5 text-ink-soft ${numeric ? 'num' : ''}`}>{children}</dd>
    </div>
  );
}

/** Kept next to the row so the strip and the menu use one warning icon. */
export const RowWarningIcon = TriangleAlert;
