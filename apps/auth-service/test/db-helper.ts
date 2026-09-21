import { execFileSync } from 'node:child_process';
import path from 'node:path';
import pg from 'pg';

const repoRoot = path.resolve(__dirname, '..', '..', '..');

/** Cluster URL without a database name; CI overrides via TEST_PG_URL. */
const clusterUrl = process.env.TEST_PG_URL ?? 'postgres://inova:inova@localhost:5432';

export interface TestDb {
  /** Privileged connection (migrations, fixtures, cross-tenant assertions). */
  migratorUrl: string;
  /** RLS-enforced `inova_auth` connection — what auth-service actually uses. */
  appUrl: string;
  dispose: () => Promise<void>;
}

function uniqueName(prefix: string): string {
  const suffix = `${process.pid}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  return `${prefix}_${suffix}`;
}

/** Creates a unique database, then runs real migrations + seeds. */
export async function createTestDb(prefix: string): Promise<TestDb> {
  const name = uniqueName(prefix);
  const admin = new pg.Client({ connectionString: `${clusterUrl}/postgres` });
  await admin.connect();
  try {
    await admin.query(`CREATE DATABASE ${name}`);
  } finally {
    await admin.end();
  }

  const migratorUrl = `${clusterUrl}/${name}`;
  execFileSync('node', [path.join(repoRoot, 'db', 'migrate.mjs'), '--url', migratorUrl], {
    stdio: 'pipe',
  });
  execFileSync('node', [path.join(repoRoot, 'db', 'seed.mjs'), '--url', migratorUrl], {
    stdio: 'pipe',
  });

  const appUrl = `${migratorUrl.replace(/\/\/[^@]+@/, '//inova_auth:inova_auth@')}`;
  return {
    migratorUrl,
    appUrl,
    async dispose() {
      const drop = new pg.Client({ connectionString: `${clusterUrl}/postgres` });
      await drop.connect();
      try {
        await drop.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
      } finally {
        await drop.end();
      }
    },
  };
}
