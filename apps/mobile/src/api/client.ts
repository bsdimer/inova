import {
  identifierValue,
  type AuthProfile,
  type AuthSession,
  type SignInIdentifier,
} from '@inova/shared';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/**
 * Thin auth-service client. The access token lives in memory only; the rotating
 * refresh token is persisted in the device keychain (expo-secure-store) and is
 * exchanged for a fresh session on every app launch — so memberships and
 * permissions are re-read server-side each time the app starts.
 */

const PROD_AUTH_URL = 'https://portal.whitenova.tech/auth/v1';
// Android emulators reach the host machine via 10.0.2.2, iOS simulator via localhost.
const DEV_HOST = Platform.OS === 'android' ? '10.0.2.2' : 'localhost';

function resolveAuthUrl(): string {
  if (process.env.EXPO_PUBLIC_AUTH_URL) return process.env.EXPO_PUBLIC_AUTH_URL;
  if (__DEV__) return `http://${DEV_HOST}:4001/v1`;
  return PROD_AUTH_URL;
}

const AUTH_URL = resolveAuthUrl();

/**
 * The organisation whose accounts this app signs in to (B8). Unset, the server
 * uses its default realm (`inova` on test); set `demo` to use the sample
 * residents. A hint for the server, never proof of access.
 * TODO(M10): the shared app chooses the organisation by invitation or selection.
 */
const REALM = process.env.EXPO_PUBLIC_AUTH_REALM || undefined;
const realmHint = (): { realm?: string } => (REALM ? { realm: REALM } : {});

/** Refresh the access token this many ms before it expires. */
const REFRESH_SKEW_MS = 60_000;

export interface Session extends AuthSession {
  /** Absolute expiry of the access token (client-side clock). */
  expiresAt: number;
}

export type PostAuthRoute = '/set-password' | '/home';

/** Where to send the user after login/activate/bootstrap. */
export function postAuthRoute(session: Session): PostAuthRoute {
  return session.user.mustSetPassword ? '/set-password' : '/home';
}

// Only the (small) refresh token goes to the keychain — access tokens are
// short-lived and re-issued at launch, so persisting them buys nothing.
const REFRESH_TOKEN_KEY = 'inova.refreshToken';

let session: Session | null = null;
type SessionListener = () => void;
const listeners = new Set<SessionListener>();

function notifySessionListeners(): void {
  for (const listener of listeners) listener();
}

/** Subscribe to in-memory session changes (login, refresh, logout, set-password). */
export function subscribeSession(listener: SessionListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export const getSession = (): Session | null => session;

function withExpiry(raw: Omit<Session, 'expiresAt'> & { expiresAt?: number }): Session {
  const expiresIn = raw.expiresIn;
  return {
    ...raw,
    expiresAt: raw.expiresAt ?? Date.now() + expiresIn * 1000,
  };
}

async function storeSession(
  next: Omit<Session, 'expiresAt'> & { expiresAt?: number },
): Promise<Session> {
  session = withExpiry(next);
  await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, session.refreshToken);
  notifySessionListeners();
  return session;
}

export async function clearSession(): Promise<void> {
  session = null;
  await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
  notifySessionListeners();
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

function parseErrorMessage(data: { message?: string | string[] }): string {
  const message = Array.isArray(data.message) ? data.message[0] : data.message;
  return message ?? 'Something went wrong';
}

async function request<T>(
  path: string,
  init: {
    method: 'GET' | 'POST';
    body?: object;
    accessToken?: string;
  },
): Promise<T> {
  const headers: Record<string, string> = {};
  if (init.body !== undefined) headers['content-type'] = 'application/json';
  if (init.accessToken) headers.authorization = `Bearer ${init.accessToken}`;

  let res: Response;
  try {
    res = await fetch(`${AUTH_URL}${path}`, {
      method: init.method,
      headers,
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'Cannot reach the server. Check your connection.');
  }

  const data = (await res.json().catch(() => ({}))) as { message?: string | string[] };
  if (!res.ok) {
    throw new ApiError(res.status, parseErrorMessage(data));
  }
  return data as T;
}

async function post<T>(path: string, body: object): Promise<T> {
  return request<T>(path, { method: 'POST', body });
}

/**
 * Ensures a non-expired access token is in memory. Rotates via refresh when the
 * access token is missing or within the skew window.
 */
export async function ensureFreshAccessToken(): Promise<string> {
  if (session && session.expiresAt - Date.now() > REFRESH_SKEW_MS) {
    return session.accessToken;
  }
  const refreshed = await refreshSession();
  if (!refreshed) {
    throw new ApiError(401, 'Session expired. Please sign in again.');
  }
  return refreshed.accessToken;
}

export async function login(identifier: SignInIdentifier, password: string): Promise<Session> {
  const who =
    identifier.kind === 'email' ? { email: identifier.email } : { phone: identifier.phone };
  return storeSession(await post<AuthSession>('/auth/login', { ...realmHint(), ...who, password }));
}

/** Invite-code activation: the phone or e-mail the code went to, plus the code (B15). */
export async function activate(identifier: SignInIdentifier, code: string): Promise<Session> {
  return storeSession(
    await post<AuthSession>('/auth/activate', {
      ...realmHint(),
      identifier: identifierValue(identifier),
      code,
    }),
  );
}

export async function resendCode(phone: string): Promise<void> {
  await post('/auth/resend-code', { ...realmHint(), phone });
}

/**
 * Exchanges the stored refresh token for a fresh session (rotation). Also used
 * as silent refresh when an access token expires mid-session.
 */
export async function refreshSession(): Promise<Session | null> {
  const refreshToken = session?.refreshToken ?? (await SecureStore.getItemAsync(REFRESH_TOKEN_KEY));
  if (!refreshToken) return null;
  try {
    return await storeSession(await post<AuthSession>('/auth/refresh', { refreshToken }));
  } catch (error) {
    if (error instanceof ApiError && error.status > 0) {
      // Token revoked/expired/reused — the stored token is dead, drop it.
      await clearSession();
      return null;
    }
    // Offline: keep the stored token and try again next launch.
    return null;
  }
}

/** Restores the session at app launch. Resolves null when the user must log in. */
export async function bootstrapSession(): Promise<Session | null> {
  if (session && session.expiresAt - Date.now() > REFRESH_SKEW_MS) return session;
  return refreshSession();
}

/**
 * Sets or changes the password. The server ends every session of the account,
 * this one included, and answers with a fresh one — keep it, or the next
 * refresh uses a revoked token. `currentPassword` is required once the account
 * has a password; right after activation it has none.
 */
export async function setPassword(password: string, currentPassword?: string): Promise<Session> {
  const accessToken = await ensureFreshAccessToken();
  const next = await request<AuthSession>('/auth/password', {
    method: 'POST',
    body: currentPassword === undefined ? { password } : { password, currentPassword },
    accessToken,
  });
  return storeSession(next);
}

export async function fetchMe(): Promise<AuthProfile> {
  const accessToken = await ensureFreshAccessToken();
  const data = await request<AuthProfile>('/auth/me', { method: 'GET', accessToken });
  if (session) {
    session = {
      ...session,
      user: data.user,
      memberships: data.memberships,
    };
    notifySessionListeners();
  }
  return data;
}

export async function logout(): Promise<void> {
  const refreshToken = session?.refreshToken ?? (await SecureStore.getItemAsync(REFRESH_TOKEN_KEY));
  if (refreshToken) {
    // Best-effort server-side revocation; local sign-out must never fail.
    await post('/auth/logout', { refreshToken }).catch(() => undefined);
  }
  await clearSession();
}
