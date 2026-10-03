/**
 * Selected-tenant store. A staff account belongs to one organisation (B8) and
 * is always in it; a super_admin enters one from the platform tenant list.
 * The selection is a UI convenience only — authorization always happens
 * server-side per request.
 */
import { useQuery } from '@tanstack/react-query';
import { useSyncExternalStore } from 'react';
import type { TenantContext } from '@inova/shared';
import { api } from './api';
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

/**
 * A super_admin is in the platform scope until they enter an organization, and
 * back in it the moment they leave — «Върни се в платформата» clears the
 * selection. Everyone else is always in a tenant.
 */
export function usePlatformScope(): boolean {
  const session = getSession();
  const tenantId = useSelectedTenantId();
  return session?.user.platformRole === 'super_admin' && !tenantId;
}

/** The selected organisation, the caller's role in it and what that role may do. */
export function useTenantContext() {
  const tenantId = useSelectedTenantId();
  return useQuery({
    queryKey: ['tenant', tenantId],
    queryFn: () => api<TenantContext>('/tenant', { tenantId: tenantId! }),
    enabled: Boolean(tenantId),
    staleTime: 60_000,
  });
}
