import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

export type Db = NodePgDatabase<typeof schema>;
export type IdentityTx = Parameters<Parameters<Db['transaction']>[0]>[0];

/**
 * Connects as the non-privileged `inova_app` role. Identity tables are RLS-protected;
 * every query must run inside identityTx(), which sets `app.identity_scope = 'auth'`
 * for the transaction (the policy-based allowance for the identity service — see
 * db/migrations/0001).
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

  async identityTx<T>(fn: (tx: IdentityTx) => Promise<T>): Promise<T> {
    return this.db.transaction(async (tx) => {
      await tx.execute(sql`SELECT set_config('app.identity_scope', 'auth', true)`);
      return fn(tx);
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }
}
