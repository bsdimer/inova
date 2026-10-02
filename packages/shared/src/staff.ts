import type { TenantSummary } from './tenant';

/*
 * The staff, roles and organisation routes of core-api (`/v1/tenant/*`,
 * `/v1/platform/tenants`), shared by the server and the admin portal.
 * Timestamps are ISO strings.
 */

export type StaffStatus = 'invited' | 'active' | 'suspended' | 'revoked';

/** `GET /v1/tenant/staff` — one staff membership with the account behind it. */
export interface StaffMember {
  userId: string;
  roleKey: string;
  status: StaffStatus;
  fullName: string;
  email: string | null;
  phone: string | null;
  /** When the membership was created. */
  since: string;
}

/** `POST /v1/tenant/staff` — the membership as invited, and whether a code went out. */
export interface InvitedStaff extends Omit<StaffMember, 'since'> {
  /** False when the account was already active: it simply gains the role. */
  inviteSent: boolean;
}

/** `PATCH /v1/tenant/staff/:userId` — the membership after the change. */
export interface StaffChange {
  userId: string;
  roleKey: string;
  status: StaffStatus;
}

/** `GET /v1/tenant/permissions` — one right of the fixed platform catalog. */
export interface PermissionInfo {
  key: string;
  description: string;
}

/** `GET /v1/tenant/roles` — a role with its rights and how many staff hold it. */
export interface RoleSummary {
  key: string;
  name: string;
  /** System roles cannot be deleted; `admin` cannot be edited either. */
  isSystem: boolean;
  permissions: string[];
  members: number;
}

/** `POST /v1/tenant/roles` — the custom role as created; it has no members yet. */
export type CreatedRole = Omit<RoleSummary, 'members'>;

/** `GET /v1/tenant/audit` — one audit record, newest first. */
export interface AuditEntry {
  id: string;
  actorUserId: string | null;
  actorType: 'user' | 'system' | 'platform';
  /** Dotted verb such as `staff.invited` or `building.activated`. */
  action: string;
  entityType: string;
  entityId: string | null;
  /** What changed; its shape depends on `action`. */
  payload: Record<string, unknown>;
  createdAt: string;
}

/** `POST /v1/platform/tenants` — the new organisation and whether its admin got an invite. */
export interface ProvisionResult {
  tenant: TenantSummary;
  adminInviteSent: boolean;
}
