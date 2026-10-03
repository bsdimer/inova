import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  WarningCircle,
  CheckCircle,
  Eye,
  CircleNotch,
  Lock,
  EnvelopeSimple,
  ArrowsClockwise,
  MagnifyingGlass,
  Users,
} from '../components/icons';
import { useMemo, useState, type ReactNode } from 'react';
import {
  EmptyState,
  GhostButton,
  PrimaryButton,
  TableStrip,
  type FacetOption,
  type StripTone,
} from '../components/ui';
import {
  api,
  ApiError,
  retryUnlessRefused,
  type Building,
  type Role,
  type StaffMember,
  type TenantContext,
} from '../lib/api';
import { getSession } from '../lib/auth';
import { useSelectedTenantId } from '../lib/tenant';
import { permissionLabel } from './roles/permissions';
import { InviteModal } from './staff/InviteModal';
import { RolesScopeDrawer, type SaveState } from './staff/RolesScopeDrawer';
import { StaffCard, StaffRow } from './staff/StaffRow';
import { BodyMessage, SkeletonRows, StaffCards, StaffTable } from './staff/StaffTable';
import { StaffToolbar } from './staff/StaffToolbar';
import {
  ACTION_DONE,
  ACTION_PROGRESS,
  EMPTY_FILTERS,
  applyFilters,
  describeFilters,
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

type Update =
  | { member: StaffMember; action: 'change-role'; roleKey: string; then: 'stay' | 'close' }
  | { member: StaffMember; action: Exclude<RowAction, 'change-role'> };

const IDLE: SaveState = { kind: 'idle' };

export function StaffPage() {
  const tenantId = useSelectedTenantId();
  const queryClient = useQueryClient();
  const session = getSession();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [filters, setFilters] = useState<StaffFilters>(EMPTY_FILTERS);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [pending, setPending] = useState<{ member: StaffMember; action: RowAction } | null>(null);
  const [drawerFor, setDrawerFor] = useState<string | null>(null);
  const [drawerSave, setDrawerSave] = useState<SaveState>(IDLE);

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
    retry: retryUnlessRefused,
  });
  // Only for the phone's head line, and only for a role that may read
  // buildings; the others get the accounts alone.
  const canReadBuildings = context.data?.permissions.includes('property.read') === true;
  const buildings = useQuery({
    queryKey: ['buildings', tenantId],
    queryFn: () => api<Building[]>('/buildings', { tenantId: tenantId! }),
    enabled: Boolean(tenantId) && canReadBuildings,
    // A count in a head line is not worth ~7 s of retries: on any failure
    // the line shows the accounts alone.
    retry: false,
  });
  const roles = useQuery({
    queryKey: ['roles', tenantId],
    queryFn: () => api<Role[]>('/tenant/roles', { tenantId: tenantId! }),
    enabled: Boolean(tenantId),
  });

  const update = useMutation({
    mutationFn: (input: Update) => {
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
      setDrawerSave(input.action === 'change-role' ? { kind: 'saving' } : IDLE);
      setPending({ member: input.member, action: input.action });
    },
    onSuccess: (_data, input) => {
      setNotice({
        tone: 'success',
        text: `${input.member.fullName} ${ACTION_DONE[input.action]}.`,
      });
      // A role saved from the footer stays on screen with its confirmation
      // (1607:37346); one saved from «Да се запазят ли промените?» closes,
      // and so does an account action — the list's strip names it.
      if (input.action === 'change-role' && input.then === 'stay') {
        setDrawerSave({ kind: 'saved', roleKey: input.roleKey });
      } else {
        setDrawerFor(null);
        setDrawerSave(IDLE);
      }
      void queryClient.invalidateQueries({ queryKey: ['staff', tenantId] });
      void queryClient.invalidateQueries({ queryKey: ['roles', tenantId] });
    },
    onError: (e, input) => {
      const reason = e instanceof ApiError ? e.message : 'нещо се обърка.';
      // A failed save keeps the drawer open with the edit still in it.
      setDrawerSave({ kind: 'failed', action: input.action, reason });
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
          setDrawerSave(IDLE);
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
    retrying: staff.isFetching,
    onRetry: () => void staff.refetch(),
  });

  // Until the list has arrived there is nothing to call empty: the skeleton
  // rows stand in, not «Още няма акаунти», which used to flash on every visit.
  const emptyBody = buildEmptyBody({
    loaded: !staff.isPending,
    denied,
    tenantName,
    members,
    visible,
    filters,
    roles: roleList,
    canManage: canManage === true,
    onInvite: () => setInviteOpen(true),
    // The sort is not a filter: clearing the filters keeps it.
    onReset: () => setFilters({ ...EMPTY_FILTERS, sort: filters.sort }),
  });

  return (
    // Page head, toolbar and table stand 16 apart (V2 frames: 72 + 50 → 138, 242 → 258).
    <div className="space-y-4">
      {/* On a phone the button stays beside the title (877:2945); from md the row may wrap. */}
      <div className="flex items-start justify-between gap-4 md:flex-wrap md:items-center md:gap-x-6">
        <div className="min-w-0">
          <h1 className="text-title-22 font-medium">Служители</h1>
          <p className="text-body-14 mt-1 hidden text-ink-muted md:block">
            Акаунти с достъп до {tenantName}, ролите им и къде важат.
          </p>
          {/* Waits for the first answer of both, so the line does not grow after it
              appears; a background refresh keeps it (a switched-off query is idle). */}
          {staff.data &&
            context.data &&
            !(buildings.isPending && buildings.fetchStatus !== 'idle') && (
              <p className="num text-body-14 mt-1 text-ink-soft md:hidden">
                {phoneSummary(members.length, buildings.data?.length)}
              </p>
            )}
        </div>
        {canManage && (
          <PrimaryButton onClick={() => setInviteOpen(true)}>
            Покани<span className="hidden sm:inline"> служител</span>
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
        countWith={(next) => applyFilters(members, next).length}
      />

      {/* The table is the drawn layout; below md the same rows become cards. */}
      <div className="hidden md:block">
        <StaffTable strip={strip}>
          {emptyBody ? (
            <BodyMessage>{emptyBody}</BodyMessage>
          ) : staff.isPending ? (
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
          ) : staff.isPending ? (
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
        save={drawerSave}
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
          setDrawerSave(IDLE);
        }}
        onSave={(roleKey, then) => {
          if (drawerMember) {
            update.mutate({ member: drawerMember, action: 'change-role', roleKey, then });
          }
        }}
        onAccountAction={(action) => {
          if (drawerMember) update.mutate({ member: drawerMember, action });
        }}
      />
    </div>
  );
}

/** «2 акаунта · 1 сграда»; without the buildings, the accounts alone. */
function phoneSummary(accounts: number, buildings: number | undefined): string {
  const head = `${accounts} ${accounts === 1 ? 'акаунт' : 'акаунта'}`;
  if (buildings === undefined) return head;
  return `${head} · ${buildings} ${buildings === 1 ? 'сграда' : 'сгради'}`;
}

const STATUS_FOR_ACTION: Record<Exclude<RowAction, 'change-role'>, StaffMember['status']> = {
  suspend: 'suspended',
  reactivate: 'active',
  revoke: 'revoked',
};

/** The body when there are no rows to show, or null when there are. */
function buildEmptyBody(input: {
  loaded: boolean;
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
      <EmptyState icon={<Lock size="1.375rem" />} title="Ролята ви не може да вижда служители">
        За преглед на акаунти е нужно правото „{permissionLabel('staff.read')}“. Администратор на{' '}
        {input.tenantName} може да го добави към ролята ви.
      </EmptyState>
    );
  }
  if (!input.loaded) return null;
  if (input.members.length === 0) {
    return (
      <EmptyState
        icon={<Users size="1.375rem" />}
        title="Още няма служители"
        action={
          input.canManage && (
            <PrimaryButton onClick={input.onInvite}>
              <span className="flex items-center gap-2">
                <EnvelopeSimple size="1rem" /> Покани първия служител
              </span>
            </PrimaryButton>
          )
        }
      >
        Поканете първия човек, който трябва да може да влиза в тази организация. Активира се с код
        по имейл, SMS или Viber.
      </EmptyState>
    );
  }
  if (input.visible.length === 0) {
    return (
      <EmptyState
        icon={<MagnifyingGlass size="1.375rem" />}
        title="Няма служители по тези филтри"
        action={<GhostButton onClick={input.onReset}>Изчисти филтрите</GhostButton>}
      >
        {describeFilters(input.filters, input.roles)}. Разширете опциите във филтрите или ги
        изчистете, за да видите другите {input.members.length}{' '}
        {input.members.length === 1 ? 'акаунт' : 'акаунта'}.
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
  /** A retry runs its own back-off; the button waits for it. */
  retrying: boolean;
  onRetry: () => void;
}) {
  if (input.denied) return undefined;
  if (input.error) {
    return (
      <TableStrip
        tone="danger"
        icon={<WarningCircle size="0.875rem" />}
        action={
          <GhostButton onClick={input.onRetry} disabled={input.retrying}>
            {input.retrying ? 'Зарежда…' : 'Опитай пак'}
          </GhostButton>
        }
      >
        Списъкът не можа да се зареди: {input.error.message}
      </TableStrip>
    );
  }
  if (input.pending) {
    return (
      <TableStrip tone="busy" icon={<CircleNotch size="0.875rem" />}>
        {ACTION_PROGRESS[input.pending.action]} {input.pending.member.fullName} — редът остава на
        място, докато сървърът потвърди.
      </TableStrip>
    );
  }
  if (input.notice) {
    return (
      <TableStrip
        tone={input.notice.tone}
        icon={
          input.notice.tone === 'success' ? (
            <CheckCircle size="0.875rem" />
          ) : (
            <WarningCircle size="0.875rem" />
          )
        }
        onDismiss={input.onDismiss}
      >
        {input.notice.text}
      </TableStrip>
    );
  }
  if (input.refreshing) {
    return (
      <TableStrip tone="info" icon={<ArrowsClockwise size="0.8125rem" />}>
        Обновяване — показва последно заредения списък
      </TableStrip>
    );
  }
  if (input.canManage === false) {
    return (
      <TableStrip tone="muted" icon={<Eye size="0.875rem" />}>
        Само за четене — ролята ви може да вижда акаунти, но не и да кани, спира или сменя роли.
      </TableStrip>
    );
  }
  return undefined;
}

export function AccessNote({ page }: { page: string }) {
  return (
    <div className="glass p-10 text-center">
      <h1 className="text-title-22 font-medium">{page}</h1>
      <p className="mt-2 text-sm text-ink-muted">Ролята ви няма достъп до този раздел.</p>
    </div>
  );
}
