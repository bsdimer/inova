import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { asc, ne, sql } from 'drizzle-orm';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

export type Db = NodePgDatabase<typeof schema>;
export type TenantTx = Parameters<Parameters<Db['transaction']>[0]>[0];

/**
 * Connects as `inova_worker` (no BYPASSRLS, D21). A job that spans
 * organisations goes through forEachTenant(): one transaction per tenant with
 * `app.tenant_id` set, so RLS keeps every query inside that tenant.
 *
 * WORKER_DATABASE_URL, not DATABASE_URL: falling back to core-api's URL would
 * silently connect as the wrong role.
 */
@Injectable()
export class DbService implements OnModuleDestroy {
  private readonly pool: Pool;
  readonly db: Db;

  constructor() {
    this.pool = new Pool({
      connectionString:
        process.env.WORKER_DATABASE_URL ??
        'postgres://inova_worker:inova_worker@localhost:5432/inova',
      // Jobs run one tenant at a time; a few connections are plenty.
      max: 4,
    });
    this.db = drizzle(this.pool, { schema });
  }

  async withTenant<T>(tenantId: string, fn: (tx: TenantTx) => Promise<T>): Promise<T> {
    return this.db.transaction(async (tx) => {
      await tx.execute(sql`SELECT set_config('app.tenant_id', ${tenantId}, true)`);
      return fn(tx);
    });
  }

  /**
   * Runs `fn` once per organisation that is not offboarded, each in its own
   * transaction: one tenant's failure is reported and does not undo another's.
   */
  async forEachTenant<T>(
    fn: (tenantId: string, tx: TenantTx) => Promise<T>,
  ): Promise<Array<{ tenantId: string; result?: T; error?: string }>> {
    const tenantRows = await this.db
      .select({ id: schema.tenants.id })
      .from(schema.tenants)
      .where(ne(schema.tenants.status, 'offboarded'))
      .orderBy(asc(schema.tenants.id));
    const outcomes: Array<{ tenantId: string; result?: T; error?: string }> = [];
    for (const { id } of tenantRows) {
      try {
        outcomes.push({ tenantId: id, result: await this.withTenant(id, (tx) => fn(id, tx)) });
      } catch (error) {
        outcomes.push({
          tenantId: id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
    return outcomes;
  }

  /** For the health check: the database answers as this role. */
  async ping(): Promise<void> {
    await this.pool.query('SELECT 1');
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }
}
