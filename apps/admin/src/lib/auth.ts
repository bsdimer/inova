/**
 * Auth-service client for the admin panel. Session persists in localStorage.
 * TODO(M1): silent refresh on 401 + core-api client with X-Tenant-Id header.
 */

import { loginFailure, type LoginFailure } from '@inova/shared';

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

/** A sign-in that did not succeed, with what the form should say about it. */
export class LoginError extends Error {
  constructor(readonly failure: LoginFailure) {
    super(failure);
  }
}

export async function login(email: string, password: string): Promise<Session> {
  let res: Response;
  try {
    res = await fetch(`${AUTH_URL}/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
  } catch {
    throw new LoginError(loginFailure(null));
  }
  if (!res.ok) throw new LoginError(loginFailure(res.status));
  const session = (await res.json()) as Session;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  return session;
}
