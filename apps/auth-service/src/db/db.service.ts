import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

export type Db = NodePgDatabase<typeof schema>;
export type AuthTx = Parameters<Parameters<Db['transaction']>[0]>[0];

/**
 * Connects as `inova_auth`, a non-privileged role (no BYPASSRLS) that only this
 * service uses. Tenant accounts, their memberships, invites and refresh tokens
 * are RLS-protected: every query on them runs inside tenantTx(), scoped to the
 * one tenant the realm resolved to (decision B8). There is no cross-tenant
 * account search — not for this service either. Platform identities have no
 * tenant and go through platformTx().
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

  async tenantTx<T>(tenantId: string, fn: (tx: AuthTx) => Promise<T>): Promise<T> {
    return this.db.transaction(async (tx) => {
      await tx.execute(sql`SELECT set_config('app.tenant_id', ${tenantId}, true)`);
      return fn(tx);
    });
  }

  /** No tenant context: tenant-owned rows are invisible inside it. */
  async platformTx<T>(fn: (tx: AuthTx) => Promise<T>): Promise<T> {
    return this.db.transaction(fn);
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }
}
