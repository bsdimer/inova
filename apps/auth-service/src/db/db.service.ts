import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

export type Db = NodePgDatabase<typeof schema>;
export type IdentityTx = Parameters<Parameters<Db['transaction']>[0]>[0];

/**
 * Connects as `inova_auth`, a non-privileged role (no BYPASSRLS) that only this
 * service uses. Identity tables are RLS-protected; every query must run inside
 * identityTx(), which sets `app.identity_scope = 'auth'` for the transaction. The
 * identity-scope policies are granted to `inova_auth` alone (db/migrations/0003), so
 * core-api's `inova_app` role cannot widen its view by setting the same variable.
 *
 * AUTH_DATABASE_URL, not DATABASE_URL: local `.env` files hold one DATABASE_URL for
 * core-api, and falling back to it would silently connect as the wrong role.
 */
@Injectable()
export class DbService implements OnModuleDestroy {
  private readonly pool: Pool;
  readonly db: Db;

  constructor() {
    this.pool = new Pool({
      connectionString:
        process.env.AUTH_DATABASE_URL ?? 'postgres://inova_auth:inova_auth@localhost:5432/inova',
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
