/**
 * Pure view-model for the Staff table: what the M1 contract shows per row and
 * how the toolbar narrows the list. Kept free of React so the rules stay
 * testable and the page only wires state.
 */
import type { Role, StaffMember } from '../../lib/api';

export type MemberStatus = StaffMember['status'];

/**
 * Invite column. The API only exposes membership status: an `invited` member
 * has a code, everyone else activated at some point. Delivery failures and
 * expiry are not stored yet.
 * TODO(M1): show "Delivery failed" / "Code expired" once the worker records
 * delivery outcomes and the API exposes invite-code state.
 */
export type InviteState = 'activated' | 'code-sent' | 'none';

export function inviteStateOf(member: StaffMember): InviteState {
  if (member.status === 'invited') return 'code-sent';
  if (member.status === 'revoked') return 'none';
  return 'activated';
}

export const INVITE_LABELS: Record<InviteState, string> = {
  activated: 'Activated',
  'code-sent': 'Code sent',
  none: '—',
};

export const STATUS_LABELS: Record<MemberStatus, string> = {
  active: 'Active',
  invited: 'Invited',
  suspended: 'Suspended',
  revoked: 'Revoked',
};

export const STATUS_ORDER: MemberStatus[] = ['active', 'invited', 'suspended', 'revoked'];

/**
 * Roles per member. The API carries one `roleKey`; multiple roles per account
 * arrive with the B8 realm refactor. Shaped as an array now so the row and the
 * `+N` overflow do not change when the data does.
 * TODO(M1-B8): read `member.roles` once the API returns several.
 */
export function rolesOf(member: StaffMember, roles: Role[]): { key: string; name: string }[] {
  const role = roles.find((r) => r.key === member.roleKey);
  return [{ key: member.roleKey, name: role?.name ?? member.roleKey }];
}

/**
 * Building scope. Every M1 staff role applies organization-wide; a revoked
 * account has no scope at all.
 * TODO(M2): building scope from manager assignments.
 */
export function scopeOf(member: StaffMember): string | null {
  return member.status === 'revoked' ? null : 'All buildings';
}

export type SortPreset = 'attention' | 'name' | 'newest';

export const SORT_LABELS: Record<SortPreset, string> = {
  attention: 'Needs attention first',
  name: 'Name A–Z',
  newest: 'Newest first',
};

export interface StaffFilters {
  search: string;
  status: MemberStatus[];
  role: string[];
  invite: InviteState[];
  sort: SortPreset;
}

export const EMPTY_FILTERS: StaffFilters = {
  search: '',
  status: [],
  role: [],
  invite: [],
  sort: 'attention',
};

export function hasActiveFacets(f: StaffFilters): boolean {
  return f.status.length > 0 || f.role.length > 0 || f.invite.length > 0;
}

export function hasAnyFilter(f: StaffFilters): boolean {
  return hasActiveFacets(f) || f.search.trim().length > 0;
}

function matchesSearch(member: StaffMember, needle: string): boolean {
  if (!needle) return true;
  const haystack = [member.fullName, member.email ?? '', member.phone ?? '']
    .join(' ')
    .toLowerCase();
  return haystack.includes(needle);
}

/** Facets are OR inside and AND between; search applies on top. */
export function applyFilters(members: StaffMember[], f: StaffFilters): StaffMember[] {
  const needle = f.search.trim().toLowerCase();
  return members.filter(
    (m) =>
      matchesSearch(m, needle) &&
      (f.status.length === 0 || f.status.includes(m.status)) &&
      (f.role.length === 0 || f.role.includes(m.roleKey)) &&
      (f.invite.length === 0 || f.invite.includes(inviteStateOf(m))),
  );
}

// Lower comes first. Invited accounts wait on someone; suspended ones on a
// decision; revoked ones are history.
const ATTENTION_RANK: Record<MemberStatus, number> = {
  invited: 0,
  suspended: 1,
  active: 2,
  revoked: 3,
};

export function sortMembers(members: StaffMember[], preset: SortPreset): StaffMember[] {
  const byName = (a: StaffMember, b: StaffMember) => a.fullName.localeCompare(b.fullName);
  const sorted = [...members];
  switch (preset) {
    case 'attention':
      return sorted.sort(
        (a, b) => ATTENTION_RANK[a.status] - ATTENTION_RANK[b.status] || byName(a, b),
      );
    case 'newest':
      return sorted.sort((a, b) => b.since.localeCompare(a.since) || byName(a, b));
    case 'name':
      return sorted.sort(byName);
  }
}

/** One human sentence per facet, for the chips and the no-results copy. */
export function describeFacet(
  key: 'status' | 'role' | 'invite',
  values: string[],
  roleNames: Map<string, string>,
): string {
  const labels = values.map((v) => {
    if (key === 'status') return STATUS_LABELS[v as MemberStatus] ?? v;
    if (key === 'invite') return INVITE_LABELS[v as InviteState] ?? v;
    return roleNames.get(v) ?? v;
  });
  const title = key === 'status' ? 'Status' : key === 'invite' ? 'Invite' : 'Role';
  return `${title}: ${labels.join(' or ')}`;
}

export type RowAction = 'suspend' | 'reactivate' | 'revoke' | 'change-role';

export const ACTION_PROGRESS: Record<RowAction, string> = {
  suspend: 'Suspending',
  reactivate: 'Reactivating',
  revoke: 'Revoking',
  'change-role': 'Changing the role of',
};

export const ACTION_DONE: Record<RowAction, string> = {
  suspend: 'suspended',
  reactivate: 'reactivated',
  revoke: 'revoked',
  'change-role': 'now has a new role',
};

/**
 * Why a write action is blocked for this row. Mirrors the core-api guards so
 * the menu can say it before the server does; the server still decides.
 */
export function protectionReason(input: {
  member: StaffMember;
  isSelf: boolean;
  activeAdmins: number;
  tenantName: string;
}): string | null {
  const { member, isSelf, activeAdmins, tenantName } = input;
  if (isSelf) return 'You cannot change your own membership. Ask another administrator.';
  if (member.roleKey === 'admin' && member.status === 'active' && activeAdmins <= 1) {
    return `${member.fullName} is the last administrator of ${tenantName}. Add another administrator before suspending, revoking or changing this account.`;
  }
  return null;
}
