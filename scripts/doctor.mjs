#!/usr/bin/env node
/**
 * Local environment check. Prints fixes instead of a stack trace.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const pkg = require(path.join(root, 'package.json'));

const issues = [];

function ok(msg) {
  console.log(`  ok    ${msg}`);
}
function fail(msg, fix) {
  console.log(`  FAIL  ${msg}`);
  if (fix) console.log(`        → ${fix}`);
  issues.push(msg);
}
function warn(msg, fix) {
  console.log(`  warn  ${msg}`);
  if (fix) console.log(`        → ${fix}`);
}

function run(cmd, args) {
  const r = spawnSync(cmd, args, { encoding: 'utf8' });
  return r.status === 0 ? r.stdout.trim() : null;
}

console.log('Sosedo doctor\n');

const nodeMajor = Number(process.versions.node.split('.')[0]);
const wantNode = 22;
if (nodeMajor >= wantNode) ok(`Node ${process.versions.node} (>= ${wantNode})`);
else fail(`Node ${process.versions.node}`, `Install Node ${wantNode}+ (engines in package.json)`);

const wantPnpm = String(pkg.packageManager ?? 'pnpm@10').replace(/^pnpm@/, '');
const pnpmVer = run('pnpm', ['--version']);
if (pnpmVer && pnpmVer.startsWith(wantPnpm.split('.')[0])) ok(`pnpm ${pnpmVer}`);
else
  fail(
    `pnpm ${pnpmVer ?? 'not found'}`,
    `corepack enable && corepack prepare pnpm@${wantPnpm} --activate`,
  );

const docker = run('docker', ['info']);
if (docker) ok('Docker is running');
else
  fail(
    'Docker is not running',
    'Start Docker Desktop, then: docker compose -f infra/docker/docker-compose.yml up -d',
  );

const envPath = path.join(root, '.env');
const examplePath = path.join(root, '.env.example');
if (existsSync(envPath)) ok('.env present');
else warn('.env missing (defaults may still work)', `cp .env.example .env`);

const example = readFileSync(examplePath, 'utf8');
const required = [...example.matchAll(/^([A-Z][A-Z0-9_]+)=/gm)].map((m) => m[1]);
const envFile = existsSync(envPath) ? readFileSync(envPath, 'utf8') : '';
for (const key of required) {
  if (process.env[key] || new RegExp(`^${key}=`, 'm').test(envFile)) continue;
  warn(`${key} is not set`, `Add it to .env (see .env.example)`);
}

const migratorUrl =
  process.env.DATABASE_URL_MIGRATOR ?? 'postgres://sosedo:sosedo@localhost:5432/sosedo';

try {
  const client = new pg.Client({ connectionString: migratorUrl, connectionTimeoutMillis: 3000 });
  await client.connect();
  const ready = await client.query('SELECT current_database() AS db, current_user AS user');
  ok(`PostgreSQL ${ready.rows[0].db} as ${ready.rows[0].user}`);

  const bypass = await client.query(
    `SELECT rolbypassrls FROM pg_roles WHERE rolname = 'sosedo_app'`,
  );
  if (bypass.rowCount === 0) {
    warn('role sosedo_app missing', 'pnpm db:migrate (creates the runtime role)');
  } else if (bypass.rows[0].rolbypassrls) {
    fail('sosedo_app has BYPASSRLS', 'This is a security bug — do not grant BYPASSRLS');
  } else {
    ok('sosedo_app exists and does not bypass RLS');
  }

  const applied = await client
    .query(`SELECT name FROM schema_migrations ORDER BY name`)
    .catch(() => ({ rows: [] }));
  const files = readdirSync(path.join(root, 'db/migrations')).filter((f) => f.endsWith('.sql'));
  const names = new Set(applied.rows.map((r) => r.name));
  const pending = files.filter((f) => !names.has(f));
  if (pending.length === 0 && files.length > 0) ok(`migrations up to date (${files.length})`);
  else if (files.length === 0) warn('no SQL migrations found');
  else fail(`pending migrations: ${pending.join(', ')}`, 'pnpm db:migrate');

  await client.end();
} catch (err) {
  const msg = err instanceof Error ? err.message : String(err);
  if (/password authentication failed/i.test(msg)) {
    fail(
      `PostgreSQL on this port is not the Sosedo instance (${migratorUrl})`,
      'Stop the other Postgres on :5432, or: docker compose -f infra/docker/docker-compose.yml up -d, or set TEST_PG_URL / DATABASE_URL_MIGRATOR to the Sosedo cluster',
    );
  } else {
    fail(
      `PostgreSQL not reachable at ${migratorUrl}`,
      'docker compose -f infra/docker/docker-compose.yml up -d',
    );
  }
  console.log(`        (${msg})`);
}

const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379';
const redis = run('docker', ['exec', 'sosedo-redis', 'redis-cli', 'ping']);
if (redis === 'PONG') ok('Redis (sosedo-redis) PONG');
else
  warn(
    `Redis not reachable (${redisUrl})`,
    'Needed for the M1 denylist/worker — start the compose stack',
  );

if (issues.length) {
  console.log(`\n${issues.length} issue(s) to fix before \`pnpm verify\` / integration tests.`);
  process.exit(1);
}
console.log('\nEnvironment looks good.');
