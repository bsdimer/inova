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
 * expiry are drawn in the mock-up but not stored yet.
 * TODO(M1): "Доставката неуспешна" / "Кодът изтече" once the worker records
 * delivery outcomes and the API exposes invite-code state.
 */
export type InviteState = 'activated' | 'code-sent' | 'none';

export function inviteStateOf(member: StaffMember): InviteState {
  if (member.status === 'invited') return 'code-sent';
  if (member.status === 'revoked') return 'none';
  return 'activated';
}

export const INVITE_LABELS: Record<InviteState, string> = {
  activated: 'Активиран',
  'code-sent': 'Код изпратен',
  none: '—',
};

export const STATUS_LABELS: Record<MemberStatus, string> = {
  active: 'Активен',
  invited: 'Поканен',
  suspended: 'Спрян',
  revoked: 'Отменен',
};

export type StatusTone = 'pending' | 'urgent' | 'resolved' | 'muted';

export const STATUS_TONES: Record<MemberStatus, StatusTone> = {
  active: 'resolved',
  invited: 'pending',
  suspended: 'urgent',
  revoked: 'muted',
};

export const STATUS_ORDER: MemberStatus[] = ['active', 'invited', 'suspended', 'revoked'];

/**
 * Bulgarian names for the role keys the seed creates. A tenant's own custom
 * role falls back to whatever name it was given in the API.
 * TODO(M1-B8): Собственик / Наемател (D8) and Почистваща фирма / Техник (D22)
 * are stakeholder decisions with no backend yet; the drawer lists the roles
 * `/tenant/roles` really returns rather than four names the server would
 * reject.
 */
export const ROLE_NAMES: Record<string, string> = {
  admin: 'Администратор',
  manager: 'Домоуправител',
  accountant: 'Счетоводител',
  resident: 'Жител',
  owner: 'Собственик',
  tenant: 'Наемател',
  cleaning: 'Почистваща фирма',
  technician: 'Техник',
};

export function roleName(key: string, roles: Role[]): string {
  return ROLE_NAMES[key] ?? roles.find((r) => r.key === key)?.name ?? key;
}

/**
 * Roles per member. The API carries one `roleKey`; several roles per account
 * arrive with the B8 realm refactor. Shaped as an array now so the row and the
 * `+N` overflow do not change when the data does.
 * TODO(M1-B8): read `member.roles` once the API returns several.
 */
export function rolesOf(member: StaffMember, roles: Role[]): { key: string; name: string }[] {
  return [{ key: member.roleKey, name: roleName(member.roleKey, roles) }];
}

/**
 * Building scope. Every M1 staff role applies organization-wide; a revoked
 * account has no scope at all.
 * TODO(M2): real building scope from manager assignments.
 */
export function scopeOf(member: StaffMember): string | null {
  return member.status === 'revoked' ? null : 'Всички сгради';
}

export type SortPreset = 'attention' | 'name' | 'newest';

export const SORT_LABELS: Record<SortPreset, string> = {
  attention: 'Първо нуждаещите се от внимание',
  name: 'Име А–Я',
  newest: 'Първо най-новите',
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

export function facetCount(f: StaffFilters): number {
  return f.status.length + f.role.length + f.invite.length;
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
  const byName = (a: StaffMember, b: StaffMember) => a.fullName.localeCompare(b.fullName, 'bg');
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

/** One human phrase per facet, for the chips and the no-results copy. */
export function describeFacet(
  key: 'status' | 'role' | 'invite',
  values: string[],
  roles: Role[],
): string {
  const labels = values.map((v) => {
    if (key === 'status') return STATUS_LABELS[v as MemberStatus] ?? v;
    if (key === 'invite') return INVITE_LABELS[v as InviteState] ?? v;
    return roleName(v, roles);
  });
  const title = key === 'status' ? 'Статус' : key === 'invite' ? 'Покана' : 'Роля';
  return `${title}: ${labels.join(' или ')}`;
}

export type RowAction = 'suspend' | 'reactivate' | 'revoke' | 'change-role';

export const ACTION_PROGRESS: Record<RowAction, string> = {
  suspend: 'Спира',
  reactivate: 'Възстановява',
  revoke: 'Отменя',
  'change-role': 'Променя ролята на',
};

export const ACTION_DONE: Record<RowAction, string> = {
  suspend: 'е спрян',
  reactivate: 'е възстановен',
  revoke: 'е отменен',
  'change-role': 'вече има нова роля',
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
  if (isSelf) return 'Не можете да променяте собственото си членство. Помолете друг администратор.';
  if (member.roleKey === 'admin' && member.status === 'active' && activeAdmins <= 1) {
    return `${member.fullName} е последният администратор на ${tenantName}. Добавете друг администратор, преди да спрете, отмените или промените този акаунт.`;
  }
  return null;
}

export const INVITED_NOTE =
  'Поканените активират акаунта си с код. Дотогава поканата може само да бъде отменена.';

/**
 * Dates render as in the mock-up: 16.09.26. Built by hand because the bg-BG
 * locale appends " г." to a formatted date, which does not fit a 72px column.
 */
export function formatSince(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${String(d.getFullYear()).slice(2)}`;
}
