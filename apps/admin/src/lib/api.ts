/**
 * Core-api client (port 4000): JWT + X-Tenant-Id on every tenant-scoped call.
 * TODO(M1): silent refresh — currently a 401 clears the session and returns
 * the user to the login screen.
 */
import { clearSession, getSession } from './auth';

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

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const session = getSession();
  const headers: Record<string, string> = {};
  if (session) headers.Authorization = `Bearer ${session.accessToken}`;
  if (options.tenantId) headers['X-Tenant-Id'] = options.tenantId;
  if (options.body !== undefined) headers['content-type'] = 'application/json';

  const res = await fetch(`${API_URL}${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

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

export interface TenantSummary {
  id: string;
  key: string;
  name: string;
  status: 'trial' | 'active' | 'suspended' | 'offboarded';
  createdAt: string;
}

export interface StaffMember {
  userId: string;
  roleKey: string;
  status: 'invited' | 'active' | 'suspended' | 'revoked';
  fullName: string;
  email: string | null;
  phone: string | null;
  since: string;
}

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
