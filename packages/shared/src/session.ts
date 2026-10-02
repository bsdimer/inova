/**
 * The answers of auth-service (`/v1/auth/*`) — the contract the resident app
 * and the admin portal sign in with. The OpenAPI documents describe the same
 * shapes; their response classes implement these interfaces, so the two
 * cannot drift apart unnoticed.
 */

/** The signed-in account as the session describes it. */
export interface SessionUser {
  id: string;
  email: string | null;
  /** E.164, e.g. `+359881000101`. */
  phone: string | null;
  fullName: string;
  /** Set for a platform operator only; a tenant account is always `null`. */
  platformRole: 'super_admin' | null;
  /** True right after activation: send the user to «set a password». */
  mustSetPassword: boolean;
}

/**
 * The session's own organisation, once per role held there — empty for a
 * platform operator. A session never lists another organisation (B8).
 */
export interface SessionMembership {
  /** The organisation's id: send it as `X-Tenant-Id` to core-api. */
  t: string;
  /** Role key, e.g. `resident`, `manager`, `admin`. */
  r: string;
  tenantKey: string;
  tenantName: string;
}

/** What `login`, `activate` and `refresh` return. */
export interface AuthSession {
  /** Bearer token for core-api and auth-service; valid `expiresIn` seconds. */
  accessToken: string;
  /** Single use: each `refresh` returns a new one; reusing an old one ends the session. */
  refreshToken: string;
  expiresIn: number;
  user: SessionUser;
  memberships: SessionMembership[];
}

/** What `GET /v1/auth/me` returns: the session without the tokens. */
export type AuthProfile = Pick<AuthSession, 'user' | 'memberships'>;

/** What `POST /v1/auth/recovery` returns — the same whether or not the account exists. */
export interface RecoveryStarted {
  status: 'ok';
  channel: 'email' | 'phone';
  /** How long the link or code is valid; the screen states it. */
  expiresInMinutes: number;
}

/** An accepted request with nothing more to say (`resend-code`). */
export interface Accepted {
  status: 'ok';
}

/**
 * Every error of both services. `message` is a list for 400 validation
 * errors (one line per broken field) and a sentence otherwise. The words are
 * for developers; screens show their own text, chosen by `statusCode`.
 */
export interface ApiError {
  statusCode: number;
  message: string | string[];
  error: string;
}
