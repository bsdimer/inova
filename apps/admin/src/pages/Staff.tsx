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
import { InviteModal } from './staff/InviteModal';
import { RolesScopeDrawer } from './staff/RolesScopeDrawer';
import { StaffCard, StaffRow } from './staff/StaffRow';
import { BodyMessage, SkeletonRows, StaffCards, StaffTable } from './staff/StaffTable';
import { StaffToolbar } from './staff/StaffToolbar';
import {
  ACTION_DONE,
  ACTION_PROGRESS,
  EMPTY_FILTERS,
  applyFilters,
  describeFacet,
  hasAnyFilter,
  protectionReason,
  roleName,
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
  const [notice, setNotice] = useState<Notice | null>(null);
  const [pending, setPending] = useState<{ member: StaffMember; action: RowAction } | null>(null);
  const [drawerFor, setDrawerFor] = useState<string | null>(null);
  const [drawerError, setDrawerError] = useState<string | null>(null);

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
          : { status: STATUS_FOR_ACTION[input.action as Exclude<RowAction, 'change-role'>] };
      return api(`/tenant/staff/${input.member.userId}`, {
        method: 'PATCH',
        tenantId: tenantId!,
        body,
      });
    },
    onMutate: (input) => {
      setNotice(null);
      setDrawerError(null);
      setPending({ member: input.member, action: input.action });
    },
    onSuccess: (_data, input) => {
      setNotice({
        tone: 'success',
        text: `${input.member.fullName} ${ACTION_DONE[input.action]}.`,
      });
      setDrawerFor(null);
      void queryClient.invalidateQueries({ queryKey: ['staff', tenantId] });
      void queryClient.invalidateQueries({ queryKey: ['roles', tenantId] });
    },
    onError: (e, input) => {
      const reason = e instanceof ApiError ? e.message : 'нещо се обърка.';
      // A failed save keeps the drawer open with the edit still in it.
      setDrawerError(reason);
      setNotice({
        tone: 'danger',
        text: `${ACTION_PROGRESS[input.action]} ${input.member.fullName} не успя: ${reason}`,
      });
    },
    onSettled: () => setPending(null),
  });

  const members = useMemo(() => staff.data ?? [], [staff.data]);
  const roleList = useMemo(() => roles.data ?? [], [roles.data]);
  const roleOptions: FacetOption[] = useMemo(() => {
    const keys = new Set([...roleList.map((r) => r.key), ...members.map((m) => m.roleKey)]);
    return [...keys].map((key) => ({ value: key, label: roleName(key, roleList) }));
  }, [roleList, members]);

  const visible = useMemo(
    () => sortMembers(applyFilters(members, filters), filters.sort),
    [members, filters],
  );
  const activeAdmins = members.filter((m) => m.roleKey === 'admin' && m.status === 'active').length;
  const tenantName = context.data?.tenant.name ?? 'организацията';
  // Undefined while the permission set loads: no write affordance is shown yet,
  // but the read-only strip waits for a definite answer.
  const canManage = context.data ? context.data.permissions.includes('staff.manage') : undefined;
  const denied = staff.error instanceof ApiError && staff.error.status === 403;

  const drawerMember = members.find((m) => m.userId === drawerFor) ?? null;

  const rowProps = (member: StaffMember) => {
    const isSelf = member.userId === session?.user.id;
    return {
      member,
      roles: rolesOf(member, roleList),
      scope: scopeOf(member),
      isSelf,
      canManage: canManage === true,
      protection: protectionReason({ member, isSelf, activeAdmins, tenantName }),
      busy: pending?.member.userId === member.userId,
      onAction: (action: RowAction) => {
        if (action === 'change-role') {
          setDrawerError(null);
          setDrawerFor(member.userId);
          return;
        }
        update.mutate({ member, action });
      },
    };
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

  const emptyBody = buildEmptyBody({
    denied,
    tenantName,
    members,
    visible,
    filters,
    roles: roleList,
    canManage: canManage === true,
    onInvite: () => setInviteOpen(true),
    onReset: () => setFilters(EMPTY_FILTERS),
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">Служители</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Акаунти с достъп до {tenantName}, ролите им и къде важат.
          </p>
        </div>
        {canManage && (
          <PrimaryButton onClick={() => setInviteOpen(true)}>
            <span className="flex items-center gap-2">
              <MailPlus size={16} />
              <span>
                Покани<span className="hidden sm:inline"> служител</span>
              </span>
            </span>
          </PrimaryButton>
        )}
      </div>

      <StaffToolbar
        filters={filters}
        onChange={setFilters}
        roleOptions={roleOptions}
        roles={roleList}
        shown={hasAnyFilter(filters) ? visible.length : members.length}
        total={members.length}
      />

      {/* The table is the drawn layout; below md the same rows become cards. */}
      <div className="hidden md:block">
        <StaffTable strip={strip}>
          {emptyBody ? (
            <BodyMessage>{emptyBody}</BodyMessage>
          ) : staff.isLoading ? (
            <SkeletonRows />
          ) : (
            visible.map((member) => <StaffRow key={member.userId} {...rowProps(member)} />)
          )}
        </StaffTable>
      </div>

      <div className="md:hidden">
        <StaffCards strip={strip}>
          {emptyBody ? (
            <div className="glass-data">{emptyBody}</div>
          ) : staff.isLoading ? (
            <div className="glass-data space-y-3 p-4">
              <div className="h-16 animate-pulse rounded-2xl bg-glass-inner" />
              <div className="h-16 animate-pulse rounded-2xl bg-glass-inner" />
            </div>
          ) : (
            visible.map((member) => <StaffCard key={member.userId} {...rowProps(member)} />)
          )}
        </StaffCards>
      </div>

      <InviteModal
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        tenantId={tenantId}
        roles={roleList}
      />
      <RolesScopeDrawer
        member={drawerMember}
        roles={roleList}
        saving={update.isPending && pending?.action === 'change-role'}
        error={drawerError}
        protection={
          drawerMember
            ? protectionReason({
                member: drawerMember,
                isSelf: drawerMember.userId === session?.user.id,
                activeAdmins,
                tenantName,
              })
            : null
        }
        onClose={() => {
          setDrawerFor(null);
          setDrawerError(null);
        }}
        onSave={(roleKey) => {
          if (drawerMember) update.mutate({ member: drawerMember, action: 'change-role', roleKey });
        }}
        onAccountAction={(action) => {
          if (drawerMember) update.mutate({ member: drawerMember, action });
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

/** The body when there are no rows to show, or null when there are. */
function buildEmptyBody(input: {
  denied: boolean;
  tenantName: string;
  members: StaffMember[];
  visible: StaffMember[];
  filters: StaffFilters;
  roles: Role[];
  canManage: boolean;
  onInvite: () => void;
  onReset: () => void;
}): ReactNode {
  if (input.denied) {
    return (
      <EmptyState icon={<Lock size={22} />} title="Ролята ви не може да вижда служители">
        Преглеждането на акаунти изисква правото staff.read. Администратор на {input.tenantName}{' '}
        може да го добави към ролята ви.
      </EmptyState>
    );
  }
  if (input.members.length === 0) {
    return (
      <EmptyState
        icon={<Users size={22} />}
        title="Още няма акаунти на служители"
        action={
          input.canManage && (
            <PrimaryButton onClick={input.onInvite}>
              <span className="flex items-center gap-2">
                <MailPlus size={16} /> Покани първия служител
              </span>
            </PrimaryButton>
          )
        }
      >
        Поканете първия човек, който трябва да има достъп до организацията. Акаунтът се активира с
        код, изпратен по имейл, SMS или Viber.
      </EmptyState>
    );
  }
  if (input.visible.length === 0) {
    const parts = (['status', 'role', 'invite'] as const)
      .filter((k) => input.filters[k].length > 0)
      .map((k) => describeFacet(k, input.filters[k], input.roles));
    if (input.filters.search.trim()) parts.push(`Търсенето е „${input.filters.search.trim()}“`);
    return (
      <EmptyState
        icon={<Search size={22} />}
        title="Няма служители по тези филтри"
        action={<GhostButton onClick={input.onReset}>Изчисти филтрите</GhostButton>}
      >
        {parts.join(' и ')}. Разширете филтър или ги изчистете, за да видите другите{' '}
        {input.members.length} {input.members.length === 1 ? 'акаунт' : 'акаунта'}.
      </EmptyState>
    );
  }
  return null;
}

/**
 * One strip at a time, most urgent first. The Figma gallery also has a
 * "Частичен неуспех" strip for bulk invite re-sends; core-api has no bulk
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
        action={<GhostButton onClick={input.onRetry}>Опитай пак</GhostButton>}
      >
        Списъкът не можа да се зареди: {input.error.message}
      </TableStrip>
    );
  }
  if (input.pending) {
    return (
      <TableStrip tone="busy" icon={<LoaderCircle size={14} />}>
        {ACTION_PROGRESS[input.pending.action]} {input.pending.member.fullName} — редът остава на
        мястото си, докато сървърът потвърди.
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
        Обновява се — показва се последно зареденият списък
      </TableStrip>
    );
  }
  if (input.canManage === false) {
    return (
      <TableStrip tone="muted" icon={<Eye size={14} />}>
        Само за четене — ролята ви вижда акаунтите, но не може да кани, спира или променя роли.
      </TableStrip>
    );
  }
  return undefined;
}

export function AccessNote({ page }: { page: string }) {
  return (
    <div className="glass p-10 text-center">
      <h1 className="text-xl font-semibold">{page}</h1>
      <p className="mt-2 text-sm text-ink-muted">Ролята ви няма достъп до този раздел.</p>
    </div>
  );
}
