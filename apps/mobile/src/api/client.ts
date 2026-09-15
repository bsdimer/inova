import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/**
 * Thin auth-service client. The access token lives in memory only; the rotating
 * refresh token is persisted in the device keychain (expo-secure-store) and is
 * exchanged for a fresh session on every app launch — so memberships and
 * permissions are re-read server-side each time the app starts.
 */

// Android emulators reach the host machine via 10.0.2.2, iOS simulator via localhost.
const DEV_HOST = Platform.OS === 'android' ? '10.0.2.2' : 'localhost';
const AUTH_URL = process.env.EXPO_PUBLIC_AUTH_URL ?? `http://${DEV_HOST}:4001/v1`;

export interface SessionUser {
  id: string;
  email: string | null;
  phone: string | null;
  fullName: string;
  platformRole: 'super_admin' | null;
  mustSetPassword: boolean;
}

export interface Membership {
  t: string;
  r: string;
  tenantKey: string;
  tenantName: string;
}

export interface Session {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: SessionUser;
  memberships: Membership[];
}

// Only the (small) refresh token goes to the keychain — access tokens are
// short-lived and re-issued at launch, so persisting them buys nothing.
const REFRESH_TOKEN_KEY = 'inova.refreshToken';

let session: Session | null = null;

export const getSession = (): Session | null => session;

async function storeSession(next: Session): Promise<Session> {
  session = next;
  await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, next.refreshToken);
  return next;
}

export async function clearSession(): Promise<void> {
  session = null;
  await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

async function post<T>(path: string, body: object): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${AUTH_URL}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, 'Cannot reach the server. Check your connection.');
  }
  const data = (await res.json().catch(() => ({}))) as { message?: string | string[] };
  if (!res.ok) {
    const message = Array.isArray(data.message) ? data.message[0] : data.message;
    throw new ApiError(res.status, message ?? 'Something went wrong');
  }
  return data as T;
}

export async function login(email: string, password: string): Promise<Session> {
  return storeSession(await post<Session>('/auth/login', { email, password }));
}

export async function activate(code: string): Promise<Session> {
  return storeSession(await post<Session>('/auth/activate', { code }));
}

export async function resendCode(phone: string): Promise<void> {
  await post('/auth/resend-code', { phone });
}

/**
 * Exchanges the stored refresh token for a fresh session (rotation). Also used
 * as silent refresh when an access token expires mid-session.
 */
export async function refreshSession(): Promise<Session | null> {
  const refreshToken = session?.refreshToken ?? (await SecureStore.getItemAsync(REFRESH_TOKEN_KEY));
  if (!refreshToken) return null;
  try {
    return await storeSession(await post<Session>('/auth/refresh', { refreshToken }));
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
  if (session) return session;
  return refreshSession();
}

export async function logout(): Promise<void> {
  const refreshToken = session?.refreshToken ?? (await SecureStore.getItemAsync(REFRESH_TOKEN_KEY));
  if (refreshToken) {
    // Best-effort server-side revocation; local sign-out must never fail.
    await post('/auth/logout', { refreshToken }).catch(() => undefined);
  }
  await clearSession();
}
