/**
 * Migration 0004 on a database that already holds data of the global-user
 * model: what becomes of a person with memberships in two tenants, of a
 * platform operator, and of the sessions that were open (decision B8).
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const repoRoot = path.resolve(__dirname, '..', '..', '..');
const migrationsDir = path.join(repoRoot, 'db', 'migrations');
const clusterUrl = process.env.TEST_PG_URL ?? 'postgres://inova:inova@localhost:5432';
const dbName = `inova_test_realm_migration_${process.pid}_${Date.now().toString(36)}`;
const LEGACY = [
  '0001_identity_tenancy.sql',
  '0002_rename_product_to_inova.sql',
  '0003_auth_db_role.sql',
];

let db: pg.Client;
let tenantA: string;
let tenantB: string;

const insertUser = async (columns: Record<string, string | null>): Promise<string> => {
  const names = Object.keys(columns);
  const { rows } = await db.query(
    `INSERT INTO users (${names.join(', ')}) VALUES (${names.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING id`,
    Object.values(columns),
  );
  return rows[0].id;
};

let shared: string; // staff in A and B
let resident: string; // invited in B only, by phone
let operator: string; // platform super_admin, no tenant
let operatorWithTenant: string; // super_admin who is also staff in A
let orphan: string; // no tenant, no platform role

beforeAll(async () => {
  const admin = new pg.Client({ connectionString: `${clusterUrl}/postgres` });
  await admin.connect();
  await admin.query(`CREATE DATABASE ${dbName}`);
  await admin.end();

  db = new pg.Client({ connectionString: `${clusterUrl}/${dbName}` });
  await db.connect();

  // The schema as it was before B8, recorded the way the runner records it.
  await db.query(
    `CREATE TABLE schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now(), checksum text)`,
  );
  for (const file of LEGACY) {
    await db.query(readFileSync(path.join(migrationsDir, file), 'utf8'));
    await db.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
  }

  const tenant = async (key: string) =>
    (await db.query(`INSERT INTO tenants (key, name) VALUES ($1, $1) RETURNING id`, [key])).rows[0]
      .id;
  tenantA = await tenant('alpha');
  tenantB = await tenant('beta');
  for (const tenantId of [tenantA, tenantB]) {
    await db.query(
      `INSERT INTO roles (tenant_id, key, name) VALUES ($1, 'admin', 'Administrator')`,
      [tenantId],
    );
  }

  shared = await insertUser({
    email: 'Shared@Example.bg',
    phone: '+359880000001',
    full_name: 'Мария Петрова Иванова',
    password_hash: 'hash-shared',
    status: 'active',
  });
  resident = await insertUser({ phone: '+359880000002', full_name: 'Георги', status: 'pending' });
  operator = await insertUser({
    email: 'operator@platform.bg',
    full_name: 'Пламен Атанасов',
    password_hash: 'hash-operator',
    status: 'active',
    platform_role: 'super_admin',
  });
  operatorWithTenant = await insertUser({
    email: 'both@platform.bg',
    full_name: 'Both Roles',
    password_hash: 'hash-both',
    status: 'active',
    platform_role: 'super_admin',
  });
  orphan = await insertUser({
    email: 'orphan@example.bg',
    full_name: 'No Tenant',
    status: 'active',
  });

  const membership = (tenantId: string, userId: string) =>
    db.query(
      `INSERT INTO staff_memberships (tenant_id, user_id, role_key, status) VALUES ($1, $2, 'admin', 'active')`,
      [tenantId, userId],
    );
  await membership(tenantA, shared);
  await membership(tenantB, shared);
  await membership(tenantA, operatorWithTenant);
  await db.query(
    `INSERT INTO invite_codes (tenant_id, user_id, code_hash, phone, expires_at, created_by)
     VALUES ($1, $2, 'code-hash', '+359880000002', now() + interval '30 days', $3)`,
    [tenantB, resident, operator],
  );
  await db.query(
    `INSERT INTO refresh_tokens (user_id, family_id, token_hash, expires_at)
     VALUES ($1, gen_random_uuid(), 'legacy-token', now() + interval '30 days')`,
    [shared],
  );

  execFileSync(
    'node',
    [path.join(repoRoot, 'db', 'migrate.mjs'), '--url', `${clusterUrl}/${dbName}`],
    {
      stdio: 'pipe',
    },
  );
});

afterAll(async () => {
  await db?.end();
  const admin = new pg.Client({ connectionString: `${clusterUrl}/postgres` });
  await admin.connect();
  await admin.query(`DROP DATABASE IF EXISTS ${dbName} WITH (FORCE)`);
  await admin.end();
});

describe('0004 on a database of the global-user model', () => {
  it('turns a person with two memberships into one account per tenant, id kept', async () => {
    const { rows } = await db.query(
      `SELECT tenant_id, email, phone, first_name, last_name, full_name, password_hash, status
       FROM users WHERE id = $1 ORDER BY tenant_id`,
      [shared],
    );
    const account = {
      email: 'Shared@Example.bg',
      phone: '+359880000001',
      first_name: 'Мария',
      last_name: 'Петрова Иванова',
      full_name: 'Мария Петрова Иванова',
      password_hash: 'hash-shared',
      status: 'active',
    };
    expect(rows).toEqual([tenantA, tenantB].sort().map((tenant_id) => ({ tenant_id, ...account })));
    // Memberships still point at an account of their own tenant.
    const memberships = await db.query(
      `SELECT m.tenant_id FROM staff_memberships m
       JOIN users u ON u.tenant_id = m.tenant_id AND u.id = m.user_id WHERE m.user_id = $1`,
      [shared],
    );
    expect(memberships.rows).toHaveLength(2);
  });

  it('keeps an invited resident in the tenant of the invite, with a one-word name', async () => {
    const { rows } = await db.query(
      `SELECT tenant_id, first_name, last_name, full_name, status FROM users WHERE id = $1`,
      [resident],
    );
    expect(rows).toEqual([
      {
        tenant_id: tenantB,
        first_name: 'Георги',
        last_name: '',
        full_name: 'Георги',
        status: 'pending',
      },
    ]);
    const invite = await db.query(`SELECT user_id, created_by FROM invite_codes`);
    expect(invite.rows).toEqual([{ user_id: resident, created_by: operator }]);
  });

  it('moves platform operators to platform_users and out of every tenant', async () => {
    const platform = await db.query(
      `SELECT id, email, full_name, password_hash, status, platform_role FROM platform_users ORDER BY email`,
    );
    expect(platform.rows).toEqual([
      {
        id: operatorWithTenant,
        email: 'both@platform.bg',
        full_name: 'Both Roles',
        password_hash: 'hash-both',
        status: 'active',
        platform_role: 'super_admin',
      },
      {
        id: operator,
        email: 'operator@platform.bg',
        full_name: 'Пламен Атанасов',
        password_hash: 'hash-operator',
        status: 'active',
        platform_role: 'super_admin',
      },
    ]);
    expect((await db.query(`SELECT 1 FROM users WHERE id = $1`, [operator])).rows).toHaveLength(0);
    // An operator who was also staff keeps that as a separate tenant account.
    const staffSide = await db.query(`SELECT tenant_id FROM users WHERE id = $1`, [
      operatorWithTenant,
    ]);
    expect(staffSide.rows).toEqual([{ tenant_id: tenantA }]);
  });

  it('drops a user that belonged to no tenant and ends every open session', async () => {
    expect((await db.query(`SELECT 1 FROM users WHERE id = $1`, [orphan])).rows).toHaveLength(0);
    expect((await db.query(`SELECT 1 FROM refresh_tokens`)).rows).toHaveLength(0);
    expect((await db.query(`SELECT 1 FROM platform_refresh_tokens`)).rows).toHaveLength(0);
  });

  it('leaves no global user behind: every account has a tenant', async () => {
    const columns = await db.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'users'`,
    );
    expect(columns.rows.map((r) => r.column_name)).not.toContain('platform_role');
    expect((await db.query(`SELECT 1 FROM users WHERE tenant_id IS NULL`)).rows).toHaveLength(0);
  });
});
