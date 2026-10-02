/**
 * Core-api client (port 4000): JWT + X-Tenant-Id on every tenant-scoped call.
 * An expired access token is renewed once and the request repeated; only a
 * session that cannot be renewed returns the user to the login screen.
 */
import type { AuthSession } from '@inova/shared';
import { clearSession, getSession, renewSession } from './auth';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000/v1';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  tenantId?: string;
}

function send(path: string, options: RequestOptions, session: AuthSession | null) {
  const headers: Record<string, string> = {};
  if (session) headers.Authorization = `Bearer ${session.accessToken}`;
  if (options.tenantId) headers['X-Tenant-Id'] = options.tenantId;
  if (options.body !== undefined) headers['content-type'] = 'application/json';
  return fetch(`${API_URL}${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
}

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const session = getSession();
  let res = await send(path, options, session);
  if (res.status === 401 && session) {
    const renewed = await renewSession(session);
    if (renewed) res = await send(path, options, renewed);
  }

  if (res.status === 401) {
    clearSession();
    window.location.assign('/login');
    throw new ApiError('Session expired', 401);
  }
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const data = (await res.json()) as { message?: string | string[] };
      if (data.message) {
        message = Array.isArray(data.message) ? data.message.join(', ') : data.message;
      }
    } catch {
      // keep the generic message
    }
    throw new ApiError(message, res.status);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

// ---------------------------------------------------------------------------
// API response types (mirror apps/api controllers)

import type { TenantSummary } from '@inova/shared';

// The /tenant contract lives in packages/shared, shared with core-api.
export type { TenantContext, TenantSummary } from '@inova/shared';

export interface StaffMember {
  userId: string;
  roleKey: string;
  status: 'invited' | 'active' | 'suspended' | 'revoked';
  fullName: string;
  email: string | null;
  phone: string | null;
  since: string;
}

/** `GET /tenant` — the caller's own role and effective permissions. */
export interface Role {
  key: string;
  name: string;
  isSystem: boolean;
  permissions: string[];
  members: number;
}

export interface Permission {
  key: string;
  description: string;
}

export interface ProvisionResult {
  tenant: TenantSummary;
  adminInviteSent: boolean;
}

/** One row of `GET /buildings`: the building with its entrance and property counts. */
export interface Building {
  id: string;
  name: string;
  city: string;
  district: string;
  address: string;
  floors: number;
  hasElevator: boolean;
  status: 'draft' | 'active' | 'archived';
  activatedAt: string | null;
  entranceCount: number;
  propertyCounts: Record<'apartment' | 'garage' | 'shop' | 'storage' | 'parking_spot', number>;
}
