/**
 * Auth-service client for the admin panel. Session persists in localStorage.
 * TODO(M1): silent refresh on 401 + core-api client with X-Tenant-Id header.
 */

const AUTH_URL = import.meta.env.VITE_AUTH_URL ?? 'http://localhost:4001/v1';
const STORAGE_KEY = 'inova.session';

export interface Membership {
  t: string;
  r: string;
  tenantKey: string;
  tenantName: string;
}

export interface Session {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string | null;
    fullName: string;
    platformRole: 'super_admin' | null;
  };
  memberships: Membership[];
}

export function getSession(): Session | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Session;
  } catch {
    return null;
  }
}

export function clearSession(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export async function login(email: string, password: string): Promise<Session> {
  const res = await fetch(`${AUTH_URL}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    throw new Error(res.status === 401 ? 'Wrong email or password.' : 'Something went wrong.');
  }
  const session = (await res.json()) as Session;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  return session;
}
