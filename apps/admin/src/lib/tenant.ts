/**
 * Selected-tenant store. Staff pick from their memberships; super_admin picks
 * from the platform tenant list. The selection is a UI convenience only —
 * authorization always happens server-side per request.
 */
import { useQuery } from '@tanstack/react-query';
import { useSyncExternalStore } from 'react';
import { api, type TenantSummary } from './api';
import { getSession } from './auth';

const STORAGE_KEY = 'inova.tenantId';
const listeners = new Set<() => void>();

export function getSelectedTenantId(): string | null {
  return localStorage.getItem(STORAGE_KEY) ?? getSession()?.memberships[0]?.t ?? null;
}

export function setSelectedTenantId(id: string): void {
  localStorage.setItem(STORAGE_KEY, id);
  listeners.forEach((fn) => fn());
}

export function clearSelectedTenantId(): void {
  localStorage.removeItem(STORAGE_KEY);
  listeners.forEach((fn) => fn());
}

export function useSelectedTenantId(): string | null {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    getSelectedTenantId,
    () => null,
  );
}

export interface TenantOption {
  id: string;
  key: string;
  name: string;
}

/** Tenants the current user can enter (memberships, or all for super_admin). */
export function useTenantOptions(): { options: TenantOption[]; isLoading: boolean } {
  const session = getSession();
  const isSuperAdmin = session?.user.platformRole === 'super_admin';

  const platformTenants = useQuery({
    queryKey: ['platform', 'tenants'],
    queryFn: () => api<TenantSummary[]>('/platform/tenants'),
    enabled: isSuperAdmin,
    staleTime: 60_000,
  });

  if (isSuperAdmin) {
    return {
      options: (platformTenants.data ?? []).map((t) => ({ id: t.id, key: t.key, name: t.name })),
      isLoading: platformTenants.isLoading,
    };
  }
  return {
    options: (session?.memberships ?? []).map((m) => ({
      id: m.t,
      key: m.tenantKey,
      name: m.tenantName,
    })),
    isLoading: false,
  };
}
