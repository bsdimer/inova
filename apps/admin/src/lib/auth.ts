/**
 * Auth-service client for the admin panel. Session persists in localStorage,
 * shared by every tab of the portal.
 */

import { loginFailure, type AuthSession, type LoginFailure } from '@inova/shared';

const AUTH_URL = import.meta.env.VITE_AUTH_URL ?? 'http://localhost:4001/v1';
const STORAGE_KEY = 'inova.session';

export function getSession(): AuthSession | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthSession;
  } catch {
    return null;
  }
}

export function clearSession(): void {
  localStorage.removeItem(STORAGE_KEY);
}

function saveSession(session: AuthSession): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

const REFRESH_LOCK = 'inova.session.refresh';

/**
 * Renews `stale`, the session whose access token was refused, and returns
 * the session to retry with — or null when it cannot be renewed and is
 * cleared.
 *
 * A refresh token is single-use: spending one twice revokes its whole family
 * and signs every tab out. So the renewal runs under one lock for all tabs,
 * and whoever enters second finds the refresh token already rotated and
 * simply uses the new session. The refresh token is the sign, not the access
 * token: a JWT issued in the same second as the last one can be identical.
 */
export async function renewSession(stale: AuthSession): Promise<AuthSession | null> {
  return navigator.locks.request(REFRESH_LOCK, async () => {
    const current = getSession();
    if (!current) return null;
    if (current.refreshToken !== stale.refreshToken) return current;
    // A network failure throws to the caller and keeps the session: the
    // refresh token is still good once the connection is back.
    const res = await fetch(`${AUTH_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ refreshToken: current.refreshToken }),
    });
    // Only auth-service refusing the token ends the session: 401 (expired,
    // revoked, reused) or 400 (malformed). A restart during a deploy (502,
    // 503) or the rate limit (429) says nothing about the token, so the
    // session is kept and the request fails like a network error would.
    if (res.status === 401 || res.status === 400) {
      clearSession();
      return null;
    }
    if (!res.ok) throw new Error(`Session renewal failed (${res.status})`);
    const next = (await res.json()) as AuthSession;
    saveSession(next);
    return next;
  });
}

/** A sign-in that did not succeed, with what the form should say about it. */
export class LoginError extends Error {
  constructor(readonly failure: LoginFailure) {
    super(failure);
  }
}

export async function login(email: string, password: string): Promise<AuthSession> {
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
  const session = (await res.json()) as AuthSession;
  saveSession(session);
  return session;
}
