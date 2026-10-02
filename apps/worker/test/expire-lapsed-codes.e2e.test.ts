/**
 * The worker against a real Postgres, as its own role `inova_worker` (D21):
 * the nightly job retires lapsed invite codes and password resets in every
 * organisation, one tenant per transaction, and the role sees nothing beyond
 * the tenant whose context is set.
 */
import { Test } from '@nestjs/testing';
import { createHash } from 'node:crypto';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDb } from '../../api/test/db-helper';
import { DbService } from '../src/db/db.service';
import { ExpireLapsedCodesJob } from '../src/jobs/expire-lapsed-codes.job';

let admin: pg.Pool;
let workerUrl: string;
let disposeDb: () => Promise<void>;
let job: ExpireLapsedCodesJob;
let closeApp: () => Promise<void>;
let tenantA: string;
let tenantB: string;

const hash = (value: string) => createHash('sha256').update(value).digest('hex');
let counter = 0;

/** A pending account of the tenant with one invite code expiring at `expiresAt`. */
async function invite(tenantId: string, expiresAt: string, status = 'active'): Promise<string> {
  counter += 1;
  const user = (
    await admin.query(
      `INSERT INTO users (tenant_id, phone, first_name, status) VALUES ($1, $2, 'Worker', 'pending') RETURNING id`,
      [tenantId, `+35988190${String(counter).padStart(4, '0')}`],
    )
  ).rows[0].id;
  const code = (
    await admin.query(
      `INSERT INTO invite_codes (tenant_id, user_id, code_hash, status, expires_at)
       VALUES ($1, $2, $3, $4, $5::timestamptz) RETURNING id`,
      [tenantId, user, hash(`code-${counter}`), status, expiresAt],
    )
  ).rows[0].id;
  return code;
}

const statusOf = async (table: 'invite_codes' | 'password_resets', id: string) =>
  (await admin.query(`SELECT status FROM ${table} WHERE id = $1`, [id])).rows[0].status;

beforeAll(async () => {
  const testDb = await createTestDb('inova_test_worker');
  disposeDb = testDb.dispose;
  admin = new pg.Pool({ connectionString: testDb.migratorUrl, max: 2 });
  workerUrl = testDb.migratorUrl.replace(/\/\/[^@]+@/, '//inova_worker:inova_worker@');
  process.env.WORKER_DATABASE_URL = workerUrl;

  const moduleRef = await Test.createTestingModule({
    providers: [DbService, ExpireLapsedCodesJob],
  }).compile();
  await moduleRef.init();
  job = moduleRef.get(ExpireLapsedCodesJob);
  closeApp = () => moduleRef.close();

  const tenants = (await admin.query('SELECT id, key FROM tenants')).rows;
  tenantA = tenants.find((t) => t.key === 'inova').id;
  tenantB = tenants.find((t) => t.key === 'demo').id;
});

afterAll(async () => {
  await closeApp?.();
  await admin?.end();
  await disposeDb?.();
});

describe('the nightly expiry job', () => {
  it('expires the lapsed active codes and resets of every organisation, and nothing else', async () => {
    const lapsedA = await invite(tenantA, '2026-01-01T00:00:00Z');
    const lapsedB = await invite(tenantB, '2026-01-01T00:00:00Z');
    const future = await invite(tenantA, '2099-01-01T00:00:00Z');
    const consumed = await invite(tenantA, '2026-01-01T00:00:00Z', 'consumed');
    const voided = await invite(tenantB, '2026-01-01T00:00:00Z', 'voided');
    const owner = (
      await admin.query(`SELECT id FROM users WHERE tenant_id = $1 AND email = 'maria@inova.bg'`, [
        tenantA,
      ])
    ).rows[0].id;
    const reset = (
      await admin.query(
        `INSERT INTO password_resets (tenant_id, user_id, channel, secret_hash, expires_at)
         VALUES ($1, $2, 'phone', $3, '2026-01-01T00:00:00Z') RETURNING id`,
        [tenantA, owner, hash('reset')],
      )
    ).rows[0].id;

    const report = await job.run(new Date('2026-10-02T02:15:00Z'));

    expect(report.failed).toEqual([]);
    expect(report.tenants).toBe(2);
    // The seed's own codes expire 30 days after seeding — after this date.
    expect(report).toMatchObject({ inviteCodes: 2, passwordResets: 1 });
    expect(await statusOf('invite_codes', lapsedA)).toBe('expired');
    expect(await statusOf('invite_codes', lapsedB)).toBe('expired');
    expect(await statusOf('invite_codes', future)).toBe('active');
    expect(await statusOf('invite_codes', consumed)).toBe('consumed');
    expect(await statusOf('invite_codes', voided)).toBe('voided');
    expect(await statusOf('password_resets', reset)).toBe('expired');
  });

  it('changes nothing on a second run', async () => {
    const report = await job.run(new Date('2026-10-02T02:15:00Z'));
    expect(report).toMatchObject({ inviteCodes: 0, passwordResets: 0, failed: [] });
  });

  it('counts a code that lapses exactly at the run time as lapsed', async () => {
    const edge = await invite(tenantA, '2026-10-03T02:15:00Z');
    await job.run(new Date('2026-10-03T02:14:59Z'));
    expect(await statusOf('invite_codes', edge)).toBe('active');
    await job.run(new Date('2026-10-03T02:15:00Z'));
    expect(await statusOf('invite_codes', edge)).toBe('expired');
  });

  it('skips an offboarded organisation', async () => {
    const left = await invite(tenantB, '2026-01-01T00:00:00Z');
    await admin.query(`UPDATE tenants SET status = 'offboarded' WHERE id = $1`, [tenantB]);
    try {
      const report = await job.run(new Date('2026-10-04T02:15:00Z'));
      expect(report.tenants).toBe(1);
      expect(await statusOf('invite_codes', left)).toBe('active');
    } finally {
      await admin.query(`UPDATE tenants SET status = 'trial' WHERE id = $1`, [tenantB]);
    }
  });
});

describe('the worker role (inova_worker)', () => {
  let worker: pg.Pool;
  beforeAll(() => {
    worker = new pg.Pool({ connectionString: workerUrl, max: 1 });
  });
  afterAll(async () => {
    await worker.end();
  });

  it('cannot bypass RLS', async () => {
    const { rows } = await admin.query(
      `SELECT rolbypassrls, rolsuper FROM pg_roles WHERE rolname = 'inova_worker'`,
    );
    expect(rows).toEqual([{ rolbypassrls: false, rolsuper: false }]);
  });

  it('sees no codes without a tenant context, and only its tenant’s inside one', async () => {
    expect((await worker.query('SELECT 1 FROM invite_codes')).rows).toHaveLength(0);
    const client = await worker.connect();
    try {
      await client.query('BEGIN');
      await client.query(`SELECT set_config('app.tenant_id', $1, true)`, [tenantA]);
      const seen = await client.query('SELECT DISTINCT tenant_id FROM invite_codes');
      expect(seen.rows).toEqual([{ tenant_id: tenantA }]);
      const touched = await client.query(
        `UPDATE invite_codes SET status = 'expired' WHERE tenant_id = $1 RETURNING id`,
        [tenantB],
      );
      expect(touched.rows).toHaveLength(0);
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }
  });

  it('has nothing beyond what its jobs need', async () => {
    for (const statement of [
      'SELECT 1 FROM users',
      'SELECT 1 FROM refresh_tokens',
      'SELECT 1 FROM audit_records',
      'DELETE FROM invite_codes',
      `INSERT INTO invite_codes (tenant_id, user_id, code_hash, expires_at) VALUES (gen_random_uuid(), gen_random_uuid(), 'x', now())`,
    ]) {
      await expect(worker.query(statement), statement).rejects.toMatchObject({ code: '42501' });
    }
  });
});
