/** JWT contract between auth-service (issuer) and core-api (verifier). */

export const JWT_ISSUER = 'inova-auth';
export const JWT_AUDIENCE = 'inova';

/**
 * A tenant account's token (decision B8): it authorizes exactly one tenant.
 * The same person in another tenant is another account with another token.
 */
export interface TenantAccountClaims {
  kind: 'tenant';
  /** Account id, unique inside the tenant. */
  sub: string;
  /** The one tenant this token belongs to. `X-Tenant-Id` must equal it. */
  tid: string;
  /** Role keys the account holds in that tenant when the token was issued. */
  roles: string[];
  name: string;
  email?: string;
}

/** A platform operator's token. Never a tenant account, never mixed with one. */
export interface PlatformClaims {
  kind: 'platform';
  /** Platform user id. */
  sub: string;
  platform_role: 'super_admin';
  name: string;
  email?: string;
}

export type AccessTokenClaims = TenantAccountClaims | PlatformClaims;

/**
 * Tells a verified payload of this contract from anything else signed with the
 * same key — above all the tokens issued before B8, which carried a list of
 * memberships and no `kind`.
 */
export function isAccessTokenClaims(payload: unknown): payload is AccessTokenClaims {
  if (typeof payload !== 'object' || payload === null) return false;
  const claims = payload as Record<string, unknown>;
  if (typeof claims.sub !== 'string' || claims.sub === '') return false;
  if (claims.kind === 'platform') return claims.platform_role === 'super_admin';
  if (claims.kind === 'tenant') {
    return (
      typeof claims.tid === 'string' &&
      claims.tid !== '' &&
      Array.isArray(claims.roles) &&
      claims.roles.every((role) => typeof role === 'string')
    );
  }
  return false;
}
