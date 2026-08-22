import { Platform } from 'react-native';

/**
 * Thin auth-service client. Session is kept in memory for now.
 * TODO(M1): persist tokens in expo-secure-store + silent refresh on 401.
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

let session: Session | null = null;

export const getSession = (): Session | null => session;
export const clearSession = (): void => {
  session = null;
};

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
  session = await post<Session>('/auth/login', { email, password });
  return session;
}

export async function activate(code: string): Promise<Session> {
  session = await post<Session>('/auth/activate', { code });
  return session;
}

export async function resendCode(phone: string): Promise<void> {
  await post('/auth/resend-code', { phone });
}
