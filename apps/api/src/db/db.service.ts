import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

export type Db = NodePgDatabase<typeof schema>;
export type TenantTx = Parameters<Parameters<Db['transaction']>[0]>[0];

/**
 * Connects as the non-privileged `inova_app` role. All tenant-owned reads/writes
 * must go through withTenant(), which scopes the transaction via
 * `SET LOCAL app.tenant_id` — RLS then guarantees isolation even if a query
 * forgets a WHERE clause. Platform tables (tenants, brands, permissions) are
 * not RLS-protected and may be queried directly via `db`.
 */
@Injectable()
export class DbService implements OnModuleDestroy {
  private readonly pool: Pool;
  readonly db: Db;

  constructor() {
    this.pool = new Pool({
      connectionString:
        process.env.DATABASE_URL ?? 'postgres://inova_app:inova_app@localhost:5432/inova',
      max: 10,
    });
    this.db = drizzle(this.pool, { schema });
  }

  async withTenant<T>(tenantId: string, fn: (tx: TenantTx) => Promise<T>): Promise<T> {
    return this.db.transaction(async (tx) => {
      await tx.execute(sql`SELECT set_config('app.tenant_id', ${tenantId}, true)`);
      return fn(tx);
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }
}
