import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CircleAlert,
  CircleCheck,
  Eye,
  LoaderCircle,
  Lock,
  MailPlus,
  RefreshCw,
  Search,
  Users,
} from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import {
  EmptyState,
  GhostButton,
  PrimaryButton,
  TableStrip,
  type FacetOption,
  type StripTone,
} from '../components/ui';
import { api, ApiError, type Role, type StaffMember, type TenantContext } from '../lib/api';
import { getSession } from '../lib/auth';
import { useSelectedTenantId } from '../lib/tenant';
import { ChangeRoleModal } from './staff/ChangeRoleModal';
import { InviteModal } from './staff/InviteModal';
import { BodyMessage, SkeletonRows, StaffTable } from './staff/StaffTable';
import { StaffRow } from './staff/StaffRow';
import { StaffToolbar } from './staff/StaffToolbar';
import {
  ACTION_DONE,
  ACTION_PROGRESS,
  EMPTY_FILTERS,
  applyFilters,
  describeFacet,
  hasAnyFilter,
  protectionReason,
  rolesOf,
  scopeOf,
  sortMembers,
  type RowAction,
  type StaffFilters,
} from './staff/model';

interface Notice {
  tone: StripTone;
  text: string;
}

export function StaffPage() {
  const tenantId = useSelectedTenantId();
  const queryClient = useQueryClient();
  const session = getSession();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [filters, setFilters] = useState<StaffFilters>(EMPTY_FILTERS);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [pending, setPending] = useState<{ member: StaffMember; action: RowAction } | null>(null);
  const [roleTarget, setRoleTarget] = useState<StaffMember | null>(null);

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
  });
  const roles = useQuery({
    queryKey: ['roles', tenantId],
    queryFn: () => api<Role[]>('/tenant/roles', { tenantId: tenantId! }),
    enabled: Boolean(tenantId),
  });

  const update = useMutation({
    mutationFn: (input: { member: StaffMember; action: RowAction; roleKey?: string }) => {
      const body =
        input.action === 'change-role'
          ? { roleKey: input.roleKey }
          : { status: STATUS_FOR_ACTION[input.action] };
      return api(`/tenant/staff/${input.member.userId}`, {
        method: 'PATCH',
        tenantId: tenantId!,
        body,
      });
    },
    onMutate: (input) => {
      setNotice(null);
      setPending({ member: input.member, action: input.action });
    },
    onSuccess: (_data, input) => {
      setNotice({
        tone: 'success',
        text: `${input.member.fullName} ${ACTION_DONE[input.action]}.`,
      });
      void queryClient.invalidateQueries({ queryKey: ['staff', tenantId] });
      void queryClient.invalidateQueries({ queryKey: ['roles', tenantId] });
    },
    onError: (e, input) =>
      setNotice({
        tone: 'danger',
        text: `${ACTION_PROGRESS[input.action]} ${input.member.fullName} failed: ${
          e instanceof ApiError ? e.message : 'something went wrong.'
        }`,
      }),
    onSettled: () => setPending(null),
  });

  const members = useMemo(() => staff.data ?? [], [staff.data]);
  const roleList = useMemo(() => roles.data ?? [], [roles.data]);
  const roleNames = useMemo(
    () => new Map(roleList.map((r) => [r.key, r.name] as const)),
    [roleList],
  );
  const roleOptions: FacetOption[] = useMemo(() => {
    const keys = new Set([...roleList.map((r) => r.key), ...members.map((m) => m.roleKey)]);
    return [...keys].map((key) => ({ value: key, label: roleNames.get(key) ?? key }));
  }, [roleList, members, roleNames]);

  const visible = useMemo(
    () => sortMembers(applyFilters(members, filters), filters.sort),
    [members, filters],
  );
  const activeAdmins = members.filter((m) => m.roleKey === 'admin' && m.status === 'active').length;
  const tenantName = context.data?.tenant.name ?? 'this organization';
  // Undefined while the permission set is loading: no write affordance is
  // shown yet, but the read-only strip waits for a definite answer.
  const canManage = context.data ? context.data.permissions.includes('staff.manage') : undefined;
  const denied = staff.error instanceof ApiError && staff.error.status === 403;

  const onAction = (member: StaffMember, action: RowAction) => {
    if (action === 'change-role') {
      setRoleTarget(member);
      return;
    }
    update.mutate({ member, action });
  };

  const strip = pickStrip({
    denied,
    canManage,
    refreshing: staff.isFetching && !staff.isLoading,
    pending,
    notice,
    error: !denied && staff.error ? staff.error : null,
    onDismiss: () => setNotice(null),
    onRetry: () => void staff.refetch(),
  });

  let body: ReactNode;
  if (denied) {
    body = (
      <BodyMessage>
        <EmptyState icon={<Lock size={22} />} title="Your role cannot view staff">
          Viewing accounts needs the <code className="font-semibold">staff.read</code> permission.
          An administrator of {tenantName} can add it to your role.
        </EmptyState>
      </BodyMessage>
    );
  } else if (staff.isLoading) {
    body = <SkeletonRows />;
  } else if (staff.isError) {
    body = null;
  } else if (members.length === 0) {
    body = (
      <BodyMessage>
        <EmptyState
          icon={<Users size={22} />}
          title="No staff accounts yet"
          action={
            canManage && (
              <PrimaryButton onClick={() => setInviteOpen(true)}>
                <span className="flex items-center gap-2">
                  <MailPlus size={16} /> Invite the first member
                </span>
              </PrimaryButton>
            )
          }
        >
          Invite the first person who should be able to sign in to this organization. They activate
          with a code sent by email, SMS or Viber.
        </EmptyState>
      </BodyMessage>
    );
  } else if (visible.length === 0) {
    const parts = (['status', 'role', 'invite'] as const)
      .filter((k) => filters[k].length > 0)
      .map((k) => describeFacet(k, filters[k], roleNames));
    if (filters.search.trim()) parts.push(`Search is “${filters.search.trim()}”`);
    body = (
      <BodyMessage>
        <EmptyState
          icon={<Search size={22} />}
          title="No members match these filters"
          action={
            <GhostButton onClick={() => setFilters(EMPTY_FILTERS)}>Reset filters</GhostButton>
          }
        >
          {parts.join(' and ')}. Widen a facet or clear them to see the other {members.length}{' '}
          {members.length === 1 ? 'account' : 'accounts'}.
        </EmptyState>
      </BodyMessage>
    );
  } else {
    body = visible.map((member) => {
      const isSelf = member.userId === session?.user.id;
      return (
        <StaffRow
          key={member.userId}
          member={member}
          roles={rolesOf(member, roleList)}
          scope={scopeOf(member)}
          isSelf={isSelf}
          canManage={canManage === true}
          protection={protectionReason({ member, isSelf, activeAdmins, tenantName })}
          busy={pending?.member.userId === member.userId}
          expanded={expanded === member.userId}
          onToggleDetails={() => setExpanded((v) => (v === member.userId ? null : member.userId))}
          onAction={(action) => onAction(member, action)}
        />
      );
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Staff</h1>
          <p className="mt-1 text-sm text-landmark">
            Accounts that can sign in to {tenantName}, the roles they hold and where those roles
            apply.
          </p>
        </div>
        {canManage && (
          <PrimaryButton onClick={() => setInviteOpen(true)}>
            <span className="flex items-center gap-2">
              <MailPlus size={16} />
              <span>
                Invite<span className="hidden xl:inline"> member</span>
              </span>
            </span>
          </PrimaryButton>
        )}
      </div>

      <StaffToolbar
        filters={filters}
        onChange={setFilters}
        roleOptions={roleOptions}
        roleNames={roleNames}
        shown={hasAnyFilter(filters) ? visible.length : members.length}
        total={members.length}
      />

      <StaffTable strip={strip}>{body}</StaffTable>

      <InviteModal
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        tenantId={tenantId}
        roles={roleList}
      />
      <ChangeRoleModal
        member={roleTarget}
        roles={roleList}
        onClose={() => setRoleTarget(null)}
        onSave={(roleKey) => {
          if (roleTarget) update.mutate({ member: roleTarget, action: 'change-role', roleKey });
          setRoleTarget(null);
        }}
      />
    </div>
  );
}

const STATUS_FOR_ACTION: Record<Exclude<RowAction, 'change-role'>, StaffMember['status']> = {
  suspend: 'suspended',
  reactivate: 'active',
  revoke: 'revoked',
};

/**
 * One strip at a time, most urgent first. The Figma gallery also has a
 * "partial failure" strip for bulk invite re-sends; the core-api has no bulk
 * action yet, so that tone has no producer.
 * TODO(M1): partial-failure strip once bulk re-send exists (needs worker delivery).
 */
function pickStrip(input: {
  denied: boolean;
  canManage: boolean | undefined;
  refreshing: boolean;
  pending: { member: StaffMember; action: RowAction } | null;
  notice: Notice | null;
  error: Error | null;
  onDismiss: () => void;
  onRetry: () => void;
}) {
  if (input.denied) return undefined;
  if (input.error) {
    return (
      <TableStrip
        tone="danger"
        icon={<CircleAlert size={14} />}
        action={<GhostButton onClick={input.onRetry}>Retry</GhostButton>}
      >
        Could not load staff: {input.error.message}
      </TableStrip>
    );
  }
  if (input.pending) {
    return (
      <TableStrip tone="busy" icon={<LoaderCircle size={14} />}>
        {ACTION_PROGRESS[input.pending.action]} {input.pending.member.fullName} — the row stays in
        place until the server confirms.
      </TableStrip>
    );
  }
  if (input.notice) {
    return (
      <TableStrip
        tone={input.notice.tone}
        icon={
          input.notice.tone === 'success' ? <CircleCheck size={14} /> : <CircleAlert size={14} />
        }
        onDismiss={input.onDismiss}
      >
        {input.notice.text}
      </TableStrip>
    );
  }
  if (input.refreshing) {
    return (
      <TableStrip tone="info" icon={<RefreshCw size={13} />}>
        Refreshing — showing the last loaded list
      </TableStrip>
    );
  }
  if (input.canManage === false) {
    return (
      <TableStrip tone="muted" icon={<Eye size={14} />}>
        Read-only — your role can view accounts but cannot invite, suspend or change roles.
      </TableStrip>
    );
  }
  return undefined;
}

export function AccessNote({ page }: { page: string }) {
  return (
    <div className="rounded-3xl border border-sand/70 bg-white/80 p-10 text-center shadow-sm shadow-landmark/5 backdrop-blur">
      <h1 className="text-xl font-extrabold">{page}</h1>
      <p className="mt-2 text-sm text-landmark">Your role doesn't include access to this page.</p>
    </div>
  );
}
