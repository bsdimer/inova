import { and, eq, gte, isNull, lte, or, sql, type SQL } from 'drizzle-orm';
import type { TenantTx } from '../../db/db.service';
import { occupancies, pets, tenants } from '../../db/schema';

/** A dated record counts on `day`: valid_from ≤ day ≤ valid_to, open end included. */
export function effectiveOn(table: typeof occupancies | typeof pets, day: string): SQL | undefined {
  return and(lte(table.validFrom, day), or(isNull(table.validTo), gte(table.validTo, day)));
}

/** Today in the organisation's time zone — the day occupancies are judged on. */
export async function todayIn(tx: TenantTx, tenantId: string): Promise<string> {
  const [row] = await tx
    .select({ today: sql<string>`((now() AT TIME ZONE ${tenants.timezone})::date)::text` })
    .from(tenants)
    .where(eq(tenants.id, tenantId));
  return row.today;
}
