/** The `GET /v1/tenant` contract between core-api and its clients. */

export type TenantStatus = 'trial' | 'active' | 'suspended' | 'offboarded';

export interface TenantSummary {
  id: string;
  key: string;
  name: string;
  status: TenantStatus;
  /** ISO timestamp. */
  createdAt: string;
}

/** The selected organisation, the caller's role in it and what that role may do. */
export interface TenantContext {
  tenant: TenantSummary;
  /** Role key within the tenant. */
  role: string;
  /**
   * The role's own name as the organisation stored it. Sent with the context
   * so a role without `roles.read` is named too (WHI-101).
   */
  roleName: string;
  permissions: string[];
}
