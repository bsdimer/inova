/** JWT contract between auth-service (issuer) and core-api (verifier). */

export const JWT_ISSUER = 'sosedo-auth';
export const JWT_AUDIENCE = 'sosedo';

export interface MembershipClaim {
  /** Tenant id. */
  t: string;
  /** Role key within that tenant. */
  r: string;
}

export interface AccessTokenClaims {
  /** User id. */
  sub: string;
  email?: string;
  name: string;
  platform_role?: 'super_admin';
  memberships: MembershipClaim[];
}
