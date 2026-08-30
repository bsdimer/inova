/**
 * Tenant-isolation suite v1 — RELEASE BLOCKER (AGENTS.md rule 5).
 * Proves isolation at two layers:
 *   1. SQL/RLS: the `sosedo_app` role cannot touch another tenant's rows even
 *      with hand-written queries (missing WHERE clauses included).
 *   2. API: cross-tenant requests are rejected regardless of valid JWTs.
 */
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JWT_AUDIENCE, JWT_ISSUER, type MembershipClaim } from '@sosedo/shared';
import { SignJWT, calculateJwkThumbprint, exportJWK, generateKeyPair } from 'jose';
import pg from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { resetJwksCache } from '../src/auth/jwt.guard';
import { createTestDb } from './db-helper';

let app: INestApplication;
let adminPool: pg.Pool;
let appPool: pg.Pool;
let disposeDb: () => Promise<void>;

let tenantA: string; // sosedo
let tenantB: string; // demo
let mariaId: string; // tenant admin of A
let elenaId: string; // resident of A

type SigningKey = Awaited<ReturnType<typeof generateKeyPair>>['privateKey'];
let signingKey: SigningKey;
let rogueKey: SigningKey;
let kid: string;

async function sign(
  sub: string,
  memberships: MembershipClaim[],
  opts: { platformRole?: string; key?: SigningKey } = {},
): Promise<string> {
  return new SignJWT({
    name: 'Test User',
    memberships,
    ...(opts.platformRole ? { platform_role: opts.platformRole } : {}),
  })
    .setProtectedHeader({ alg: 'RS256', kid })
    .setSubject(sub)
    .setIssuer(JWT_ISSUER)
    .setAudience(JWT_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(opts.key ?? signingKey);
}

beforeAll(async () => {
  const { migratorUrl, appUrl, dispose } = await createTestDb('sosedo_test_api');
  disposeDb = dispose;
  process.env.DATABASE_URL = appUrl;

  // Local JWKS instead of a running auth-service.
  const pair = await generateKeyPair('RS256');
  signingKey = pair.privateKey;
  const jwk = await exportJWK(pair.publicKey);
  kid = await calculateJwkThumbprint(jwk);
  process.env.AUTH_JWKS_JSON = JSON.stringify({ keys: [{ ...jwk, kid, alg: 'RS256' }] });
  resetJwksCache();
  rogueKey = (await generateKeyPair('RS256')).privateKey;

  const { AppModule } = await import('../src/app.module');
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication();
  await app.init();

  adminPool = new pg.Pool({ connectionString: migratorUrl, max: 2 });
  appPool = new pg.Pool({ connectionString: appUrl, max: 2 });

  const tenants = await adminPool.query('SELECT id, key FROM tenants ORDER BY key');
  tenantB = tenants.rows.find((r) => r.key === 'demo').id;
  tenantA = tenants.rows.find((r) => r.key === 'sosedo').id;
  mariaId = (await adminPool.query(`SELECT id FROM users WHERE email = 'maria@sosedo.bg'`)).rows[0]
    .id;
  elenaId = (await adminPool.query(`SELECT id FROM users WHERE phone = '+359881000001'`)).rows[0]
    .id;

  // Elena is seeded as 'invited'; activate her so the permission layer (not the
  // membership re-check) is what rejects her staff-listing request.
  await adminPool.query(
    `UPDATE staff_memberships SET status = 'active' WHERE user_id = $1 AND tenant_id = $2`,
    [elenaId, tenantA],
  );
});

afterAll(async () => {
  await app?.close();
  await adminPool?.end();
  await appPool?.end();
  await disposeDb?.();
});

describe('RLS at the SQL layer (sosedo_app role)', () => {
  it('returns no tenant-owned rows without tenant context', async () => {
    const { rows } = await appPool.query('SELECT * FROM roles');
    expect(rows).toHaveLength(0);
  });

  it('scopes reads to the configured tenant even without WHERE clauses', async () => {
    const client = await appPool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`SELECT set_config('app.tenant_id', $1, true)`, [tenantA]);
      const roles = await client.query('SELECT DISTINCT tenant_id FROM roles');
      expect(roles.rows).toHaveLength(1);
      expect(roles.rows[0].tenant_id).toBe(tenantA);
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }
  });

  it("rejects INSERTs targeting another tenant's id", async () => {
    const client = await appPool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`SELECT set_config('app.tenant_id', $1, true)`, [tenantA]);
      await expect(
        client.query(`INSERT INTO roles (tenant_id, key, name) VALUES ($1, 'sneaky', 'Sneaky')`, [
          tenantB,
        ]),
      ).rejects.toMatchObject({ code: '42501' });
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }
  });

  it('denies UPDATE/DELETE on the append-only audit trail entirely', async () => {
    // Table-privilege denials — independent of tenant context, so no transaction
    // needed (and a denied statement would abort one anyway).
    await expect(
      appPool.query(`UPDATE audit_records SET action = 'tampered'`),
    ).rejects.toMatchObject({ code: '42501' });
    await expect(appPool.query('DELETE FROM audit_records')).rejects.toMatchObject({
      code: '42501',
    });
  });

  it('hides identity tables without tenant or identity scope', async () => {
    const none = await appPool.query('SELECT * FROM staff_memberships');
    expect(none.rows).toHaveLength(0);

    const client = await appPool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`SELECT set_config('app.identity_scope', 'auth', true)`);
      const all = await client.query('SELECT DISTINCT tenant_id FROM staff_memberships');
      expect(all.rows.length).toBeGreaterThan(1); // identity scope sees across tenants
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }
  });
});

describe('Tenant isolation at the API layer', () => {
  it('allows a member to read their own tenant', async () => {
    const token = await sign(mariaId, [{ t: tenantA, r: 'admin' }]);
    const res = await request(app.getHttpServer())
      .get('/tenant')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Tenant-Id', tenantA);
    expect(res.status).toBe(200);
    expect(res.body.tenant.key).toBe('sosedo');
    expect(res.body.role).toBe('admin');
  });

  it("rejects a valid user targeting another tenant's id (403)", async () => {
    const token = await sign(mariaId, [{ t: tenantA, r: 'admin' }]);
    const res = await request(app.getHttpServer())
      .get('/tenant')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Tenant-Id', tenantB);
    expect(res.status).toBe(403);
  });

  it('rejects forged membership claims when the DB re-check fails (403)', async () => {
    // Token *claims* membership in tenant B, but no membership row exists.
    const token = await sign(mariaId, [{ t: tenantB, r: 'admin' }]);
    const res = await request(app.getHttpServer())
      .get('/tenant')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Tenant-Id', tenantB);
    expect(res.status).toBe(403);
  });

  it('rejects tokens signed by an untrusted key (401)', async () => {
    const token = await sign(mariaId, [{ t: tenantA, r: 'admin' }], { key: rogueKey });
    const res = await request(app.getHttpServer())
      .get('/tenant')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Tenant-Id', tenantA);
    expect(res.status).toBe(401);
  });

  it('enforces permissions per role (resident cannot list staff)', async () => {
    const token = await sign(elenaId, [{ t: tenantA, r: 'resident' }]);
    const res = await request(app.getHttpServer())
      .get('/tenant/staff')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Tenant-Id', tenantA);
    expect(res.status).toBe(403);
  });

  it('restricts platform endpoints to super_admin', async () => {
    const staffToken = await sign(mariaId, [{ t: tenantA, r: 'admin' }]);
    const denied = await request(app.getHttpServer())
      .get('/platform/tenants')
      .set('Authorization', `Bearer ${staffToken}`);
    expect(denied.status).toBe(403);

    const adminToken = await sign(mariaId, [], { platformRole: 'super_admin' });
    const allowed = await request(app.getHttpServer())
      .get('/platform/tenants')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(allowed.status).toBe(200);
    expect(allowed.body.map((t: { key: string }) => t.key).sort()).toEqual(['demo', 'sosedo']);
  });
});
