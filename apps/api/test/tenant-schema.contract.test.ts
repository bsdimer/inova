/**
 * Tenant schema contract — RELEASE BLOCKER.
 * Every tenant-owned table (today and future milestones) must satisfy the
 * isolation invariants. Uses pg_catalog so new M2+ tables are covered automatically.
 */
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDb } from './db-helper';

let pool: pg.Pool;
let disposeDb: () => Promise<void>;

beforeAll(async () => {
  const { migratorUrl, dispose } = await createTestDb('inova_test_schema');
  disposeDb = dispose;
  pool = new pg.Pool({ connectionString: migratorUrl });
});

afterAll(async () => {
  await pool?.end();
  await disposeDb?.();
});

const TENANT_TABLES = `
  SELECT c.oid, n.nspname, c.relname
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  JOIN pg_attribute a ON a.attrelid = c.oid AND a.attname = 'tenant_id' AND NOT a.attisdropped
  WHERE n.nspname = 'public'
    AND c.relkind IN ('r', 'p')
    AND NOT c.relispartition
`;

describe('tenant schema contract', () => {
  it('inova_app cannot bypass RLS', async () => {
    const { rows } = await pool.query(
      `SELECT rolbypassrls FROM pg_roles WHERE rolname = 'inova_app'`,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].rolbypassrls).toBe(false);
  });

  it('every tenant-owned table has tenant_id NOT NULL as the leading PK column', async () => {
    const { rows: tables } = await pool.query(TENANT_TABLES);
    expect(tables.length).toBeGreaterThan(0);

    for (const table of tables) {
      const { rows: cols } = await pool.query(
        `SELECT a.attnotnull
         FROM pg_attribute a
         WHERE a.attrelid = $1 AND a.attname = 'tenant_id'`,
        [table.oid],
      );
      expect(cols[0]?.attnotnull, `${table.relname}.tenant_id NOT NULL`).toBe(true);

      const { rows: pk } = await pool.query(
        `SELECT a.attname
         FROM pg_index i
         JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = i.indkey[0]
         WHERE i.indrelid = $1 AND i.indisprimary`,
        [table.oid],
      );
      expect(pk[0]?.attname, `${table.relname} PK leading column`).toBe('tenant_id');
    }
  });

  it('tenant-scoped indexes lead with tenant_id', async () => {
    const { rows } = await pool.query(
      `SELECT c.relname AS table_name, ic.relname AS index_name, a.attname AS first_col
       FROM pg_index i
       JOIN pg_class c ON c.oid = i.indrelid
       JOIN pg_class ic ON ic.oid = i.indexrelid
       JOIN pg_namespace n ON n.oid = c.relnamespace
       LEFT JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = i.indkey[0]
       WHERE n.nspname = 'public'
         AND NOT c.relispartition
         AND EXISTS (
           SELECT 1 FROM pg_attribute t
           WHERE t.attrelid = c.oid AND t.attname = 'tenant_id' AND NOT t.attisdropped
         )`,
    );
    // Auth must find a membership/invite before it knows the tenant. These exact
    // identity-scope indexes are the only audited exceptions to tenant-leading indexes.
    const identityScopeIndexes = new Set([
      'staff_memberships_user_idx',
      'invite_codes_hash_idx',
      'invite_codes_user_idx',
    ]);
    for (const row of rows) {
      if (identityScopeIndexes.has(row.index_name)) continue;
      expect(row.first_col, `${row.table_name}.${row.index_name}`).toBe('tenant_id');
    }
  });

  it('RLS is enabled on every tenant-owned table', async () => {
    const { rows } = await pool.query(
      `SELECT c.relname, c.relrowsecurity
       FROM pg_class c
       JOIN pg_namespace n ON n.oid = c.relnamespace
       JOIN pg_attribute a ON a.attrelid = c.oid AND a.attname = 'tenant_id' AND NOT a.attisdropped
       WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p') AND NOT c.relispartition`,
    );
    for (const row of rows) {
      expect(row.relrowsecurity, `${row.relname} RLS`).toBe(true);
    }
  });

  it('append-only audit_records has no UPDATE/DELETE for inova_app', async () => {
    const { rows } = await pool.query(
      `SELECT privilege_type
       FROM information_schema.role_table_grants
       WHERE grantee = 'inova_app' AND table_name = 'audit_records'`,
    );
    const privs = rows.map((r) => r.privilege_type);
    expect(privs).toContain('SELECT');
    expect(privs).toContain('INSERT');
    expect(privs).not.toContain('UPDATE');
    expect(privs).not.toContain('DELETE');
  });
});
