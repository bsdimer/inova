import type { TenantSummary } from '@inova/shared';
import type { tenants } from './schema';

/** What a client sees of an organisation; settings and branding stay on the server. */
export function toTenantSummary(row: typeof tenants.$inferSelect): TenantSummary {
  return {
    id: row.id,
    key: row.key,
    name: row.name,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
  };
}
