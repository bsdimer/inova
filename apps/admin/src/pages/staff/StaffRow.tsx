import { AnimatePresence, motion } from 'framer-motion';
import {
  ChevronRight,
  CircleCheck,
  Clock,
  Eye,
  Info,
  LoaderCircle,
  MoreHorizontal,
  RotateCcw,
  ShieldOff,
  UserCog,
  UserX,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Chip, IconButton, MenuItem, Popover, StatusBadge } from '../../components/ui';
import type { StaffMember } from '../../lib/api';
import { INVITE_LABELS, inviteStateOf, type InviteState, type RowAction } from './model';

const INVITE_ICON: Record<InviteState, ReactNode> = {
  activated: <CircleCheck size={13} />,
  'code-sent': <Clock size={13} />,
  none: <Clock size={13} />,
};

function InviteCell({ member }: { member: StaffMember }) {
  const state = inviteStateOf(member);
  const tone =
    state === 'activated' && member.status === 'active' ? 'text-success' : 'text-landmark';
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${tone}`}>
      {INVITE_ICON[state]}
      {INVITE_LABELS[state]}
    </span>
  );
}

function formatSince(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  });
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

const CELL = 'px-4 py-3 align-middle';

export function StaffRow(props: RowProps) {
  const { member, roles, scope, isSelf, canManage, protection, busy, expanded } = props;
  const [menuOpen, setMenuOpen] = useState(false);
  const [primary, ...more] = roles;
  const contact = member.email ?? member.phone ?? '—';

  const act = (action: RowAction) => {
    setMenuOpen(false);
    props.onAction(action);
  };
  const details = () => {
    setMenuOpen(false);
    props.onToggleDetails();
  };

  const writable = canManage && !protection && member.status !== 'revoked';
  const invited = member.status === 'invited';

  return (
    <>
      <tr
        className={`border-b border-sand/60 transition-colors last:border-0 hover:bg-orange/4 ${
          busy ? 'opacity-50' : ''
        }`}
        aria-busy={busy}
      >
        <td className={CELL}>
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[35%] bg-gradient-to-br from-orange-bright to-orange text-sm font-bold text-white shadow-sm shadow-orange/15">
              {member.fullName.slice(0, 1).toUpperCase()}
            </span>
            <span className="min-w-0">
              <span className="block font-semibold whitespace-nowrap">{member.fullName}</span>
              <span className="block truncate text-xs text-landmark">
                {isSelf && 'you'}
                <span className="@4xl:hidden">
                  {isSelf && ' · '}
                  {contact}
                </span>
              </span>
            </span>
          </div>
        </td>
        <td className={`${CELL} hidden text-landmark @4xl:table-cell`}>
          <p className="truncate">{member.email ?? '—'}</p>
          <p className="truncate text-xs">{member.phone ?? '—'}</p>
        </td>
        <td className={CELL}>
          <StatusBadge status={member.status} />
          <div className="mt-1.5 @5xl:hidden">
            <InviteCell member={member} />
          </div>
        </td>
        <td className={CELL}>
          <div className="flex flex-wrap items-center gap-1.5">
            <Chip>{primary?.name ?? member.roleKey}</Chip>
            {more.length > 0 && <Chip muted>+{more.length}</Chip>}
          </div>
        </td>
        <td className={`${CELL} hidden text-xs font-medium whitespace-nowrap @4xl:table-cell`}>
          {scope ?? '—'}
        </td>
        <td className={`${CELL} hidden whitespace-nowrap @5xl:table-cell`}>
          <InviteCell member={member} />
        </td>
        <td className={`${CELL} hidden text-xs whitespace-nowrap text-landmark @5xl:table-cell`}>
          {formatSince(member.since)}
        </td>
        <td className={`${CELL} text-right`}>
          <div className="flex justify-end">
            {busy ? (
              <span className="flex h-8 w-8 items-center justify-center text-landmark">
                <LoaderCircle size={16} className="animate-spin" />
              </span>
            ) : (
              <Popover
                open={menuOpen}
                onClose={() => setMenuOpen(false)}
                align="right"
                anchor={
                  <IconButton
                    label={`Actions for ${member.fullName}`}
                    active={menuOpen}
                    onClick={() => setMenuOpen((v) => !v)}
                  >
                    <MoreHorizontal size={16} />
                  </IconButton>
                }
              >
                <div role="menu" className="w-72">
                  <MenuItem
                    icon={<Eye size={15} />}
                    onClick={details}
                    trailing={<ChevronRight size={14} className="text-stone" />}
                  >
                    {expanded ? 'Hide details' : 'Open details'}
                  </MenuItem>
                  {canManage && member.status !== 'revoked' && (
                    <>
                      <MenuItem
                        icon={<UserCog size={15} />}
                        onClick={() => act('change-role')}
                        disabled={!writable}
                        trailing={<ChevronRight size={14} className="text-stone" />}
                      >
                        Change roles and scope
                      </MenuItem>
                      <hr className="my-1 border-sand/80" />
                      {member.status === 'suspended' ? (
                        <MenuItem
                          icon={<RotateCcw size={15} />}
                          onClick={() => act('reactivate')}
                          disabled={!writable}
                        >
                          Reactivate
                        </MenuItem>
                      ) : (
                        <MenuItem
                          icon={<ShieldOff size={15} />}
                          onClick={() => act('suspend')}
                          disabled={!writable || invited}
                        >
                          Suspend
                        </MenuItem>
                      )}
                      <MenuItem
                        icon={<UserX size={15} />}
                        onClick={() => act('revoke')}
                        disabled={!writable}
                        danger
                      >
                        {invited ? 'Revoke invite' : 'Revoke'}
                      </MenuItem>
                      {(protection ?? (invited && writable ? INVITED_NOTE : null)) && (
                        <p className="mt-1 flex gap-2 rounded-xl bg-danger/6 px-3 py-2 text-left text-xs font-medium text-danger">
                          <Info size={14} className="mt-0.5 shrink-0" />
                          {protection ?? INVITED_NOTE}
                        </p>
                      )}
                    </>
                  )}
                </div>
              </Popover>
            )}
          </div>
        </td>
      </tr>
      <AnimatePresence initial={false}>
        {expanded && (
          <tr className="border-b border-sand/60 bg-cream/50">
            <td colSpan={8} className="px-4 py-0">
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <dl className="grid grid-cols-2 gap-x-6 gap-y-3 py-4 text-sm sm:grid-cols-3 lg:grid-cols-5">
                  <Detail label="Email">{member.email ?? '—'}</Detail>
                  <Detail label="Phone">{member.phone ?? '—'}</Detail>
                  <Detail label="Roles">{roles.map((r) => r.name).join(', ')}</Detail>
                  <Detail label="Scope">{scope ?? '—'}</Detail>
                  <Detail label="Since">{formatSince(member.since)}</Detail>
                </dl>
              </motion.div>
            </td>
          </tr>
        )}
      </AnimatePresence>
    </>
  );
}

const INVITED_NOTE =
  'Invited members activate with their code first. Until then the invite can only be revoked.';

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-semibold tracking-wider text-landmark uppercase">{label}</dt>
      <dd className="mt-0.5 font-medium">{children}</dd>
    </div>
  );
}
