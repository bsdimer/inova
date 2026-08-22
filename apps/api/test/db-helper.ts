import { execFileSync } from 'node:child_process';
import path from 'node:path';
import pg from 'pg';

const repoRoot = path.resolve(__dirname, '..', '..', '..');

/** Cluster URL without a database name; CI overrides via TEST_PG_URL. */
const clusterUrl = process.env.TEST_PG_URL ?? 'postgres://sosedo:sosedo@localhost:5432';

export interface TestDb {
  /** Privileged connection (migrations, fixtures, cross-tenant assertions). */
  migratorUrl: string;
  /** RLS-enforced `sosedo_app` connection — what the services actually use. */
  appUrl: string;
}

/** Drops/recreates a dedicated database, then runs real migrations + seeds. */
export async function createTestDb(name: string): Promise<TestDb> {
  const admin = new pg.Client({ connectionString: `${clusterUrl}/postgres` });
  await admin.connect();
  try {
    await admin.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
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

  const appUrl = `${migratorUrl.replace(/\/\/[^@]+@/, '//sosedo_app:sosedo_app@')}`;
  return { migratorUrl, appUrl };
}
