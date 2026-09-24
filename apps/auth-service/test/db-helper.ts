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
      const admin = new pg.Client({ connectionString: `${clusterUrl}/postgres` });
      await admin.connect();
      try {
        // `pool.end()` resolves once every client has *sent* its Terminate
        // message, not once the server has closed the backend. Dropping the
        // database in that window (`WITH (FORCE)` kills the backend) makes
        // Postgres answer the closing client with FATAL 57P01, and a pooled
        // client with no error listener turns that into an unhandled error
        // after every test has passed. So wait for the backends to be gone.
        const leftover = await waitForNoBackends(admin, name);
        if (leftover.length === 0) {
          await admin.query(`DROP DATABASE IF EXISTS ${name}`);
          return;
        }
        // A connection is really still open: some suite forgot to end a pool
        // or client. Drop the database anyway so it does not pile up on the
        // cluster, then fail the run with the connection named.
        await admin.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
        throw new Error(
          `${name} still had ${leftover.length} open connection(s) at dispose(); ` +
            'every pool and client must be ended before the database is dropped:\n' +
            leftover.map((row) => `  ${describeBackend(row)}`).join('\n'),
        );
      } finally {
        await admin.end();
      }
    },
  };
}

interface Backend {
  pid: number;
  usename: string | null;
  application_name: string;
  state: string | null;
  backend_start: Date;
  query: string;
}

/** How long a backend may take to disappear after its client closed the socket. */
const BACKEND_EXIT_TIMEOUT_MS = 5_000;
const BACKEND_POLL_MS = 25;

async function waitForNoBackends(admin: pg.Client, dbName: string): Promise<Backend[]> {
  const deadline = Date.now() + BACKEND_EXIT_TIMEOUT_MS;
  for (;;) {
    const { rows } = await admin.query<Backend>(
      `SELECT pid, usename, application_name, state, backend_start, query
         FROM pg_stat_activity
        WHERE datname = $1 AND pid <> pg_backend_pid()`,
      [dbName],
    );
    if (rows.length === 0 || Date.now() >= deadline) {
      return rows;
    }
    await new Promise((resolve) => setTimeout(resolve, BACKEND_POLL_MS));
  }
}

function describeBackend(row: Backend): string {
  const app = row.application_name ? ` app=${row.application_name}` : '';
  return `pid=${row.pid} user=${row.usename ?? '?'}${app} state=${row.state ?? '?'} since=${row.backend_start.toISOString()} query=${JSON.stringify(row.query)}`;
}
