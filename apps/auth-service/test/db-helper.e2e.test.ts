/**
 * The per-run database is dropped only after every connection to it is gone.
 * Regression for a flaky CI failure: `pool.end()` resolves before the server
 * has closed the backends, and `DROP DATABASE ... WITH (FORCE)` in that window
 * answered the closing client with FATAL 57P01 — an unhandled error after
 * every test had passed. A connection that is really left open now fails the
 * run with its name instead.
 */
import pg from 'pg';
import { describe, expect, it } from 'vitest';
import { createTestDb } from './db-helper';

const clusterUrl = process.env.TEST_PG_URL ?? 'postgres://inova:inova@localhost:5432';

async function databaseExists(name: string): Promise<boolean> {
  const admin = new pg.Client({ connectionString: `${clusterUrl}/postgres` });
  await admin.connect();
  try {
    const { rows } = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [name]);
    return rows.length > 0;
  } finally {
    await admin.end();
  }
}

describe('createTestDb().dispose()', () => {
  it('drops the database right after a pool ended, without an unhandled client error', async () => {
    const { appUrl, migratorUrl, dispose } = await createTestDb('inova_test_auth_helper');
    const name = migratorUrl.slice(migratorUrl.lastIndexOf('/') + 1);

    // Several idle clients whose Terminate messages are in flight when the
    // pool's end() resolves — the window the drop used to race into.
    const pool = new pg.Pool({ connectionString: appUrl, max: 4 });
    await Promise.all(Array.from({ length: 4 }, () => pool.query('SELECT pg_sleep(0.05)')));
    await pool.end();
    await expect(dispose()).resolves.toBeUndefined();

    expect(await databaseExists(name)).toBe(false);
  });

  it('fails the run and names the connection when a client was left open', async () => {
    const { appUrl, migratorUrl, dispose } = await createTestDb('inova_test_auth_helper');
    const name = migratorUrl.slice(migratorUrl.lastIndexOf('/') + 1);

    const leaked = new pg.Client({ connectionString: appUrl });
    await leaked.connect();
    // The forced drop terminates this client; keep that from becoming a second error.
    leaked.on('error', () => undefined);

    await expect(dispose()).rejects.toThrow(/1 open connection\(s\)[\s\S]*user=inova_auth/);
    expect(await databaseExists(name)).toBe(false);
  });
});
