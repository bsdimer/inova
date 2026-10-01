/**
 * Tenant-isolation suite v1 — RELEASE BLOCKER (AGENTS.md rule 5).
 * Proves isolation at two layers:
 *   1. SQL/RLS: the `inova_app` role cannot touch another tenant's rows even
 *      with hand-written queries (missing WHERE clauses included).
 *   2. API: cross-tenant requests are rejected regardless of valid JWTs.
 */
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JWT_AUDIENCE, JWT_ISSUER } from '@inova/shared';
import { SignJWT, calculateJwkThumbprint, exportJWK, generateKeyPair } from 'jose';
import pg from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { resetJwksCache } from '../src/auth/jwt.guard';
import { createTestDb } from './db-helper';

let app: INestApplication;
let adminPool: pg.Pool;
let appPool: pg.Pool;
/** auth-service's role — only used to prove it is tenant-scoped like core-api's. */
let authUrl: string;
let disposeDb: () => Promise<void>;

let tenantA: string; // inova
let tenantB: string; // demo
let mariaId: string; // tenant admin of A
let elenaId: string; // resident of A
let demoMariaId: string; // manager of B — same e-mail as Maria, another account
let platformAdminId: string; // platform super_admin, no tenant

type SigningKey = Awaited<ReturnType<typeof generateKeyPair>>['privateKey'];
let signingKey: SigningKey;
let rogueKey: SigningKey;
let kid: string;

async function sign(
  claims: Record<string, unknown>,
  key: SigningKey = signingKey,
): Promise<string> {
  const { sub, ...rest } = claims;
  return new SignJWT({ name: 'Test User', ...rest })
    .setProtectedHeader({ alg: 'RS256', kid })
    .setSubject(String(sub))
    .setIssuer(JWT_ISSUER)
    .setAudience(JWT_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(key);
}

/** A tenant account's token: one tenant, the roles held there (decision B8). */
const tenantToken = (sub: string, tid: string, roles: string[], key?: SigningKey) =>
  sign({ kind: 'tenant', sub, tid, roles }, key);

const platformToken = (sub: string) =>
  sign({ kind: 'platform', sub, platform_role: 'super_admin' });

const getTenant = (token: string, tenantId: string) =>
  request(app.getHttpServer())
    .get('/tenant')
    .set('Authorization', `Bearer ${token}`)
    .set('X-Tenant-Id', tenantId);

beforeAll(async () => {
  const { migratorUrl, appUrl, dispose } = await createTestDb('inova_test_api');
  authUrl = migratorUrl.replace(/\/\/[^@]+@/, '//inova_auth:inova_auth@');
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
  // Listen once: on a server that is not listening, supertest binds a fresh
  // ephemeral port for every request.
  await app.listen(0);

  adminPool = new pg.Pool({ connectionString: migratorUrl, max: 2 });
  appPool = new pg.Pool({ connectionString: appUrl, max: 2 });

  const tenants = await adminPool.query('SELECT id, key FROM tenants ORDER BY key');
  tenantB = tenants.rows.find((r) => r.key === 'demo').id;
  tenantA = tenants.rows.find((r) => r.key === 'inova').id;
  const accountId = async (tenantId: string, column: 'email' | 'phone', value: string) =>
    (
      await adminPool.query(`SELECT id FROM users WHERE tenant_id = $1 AND ${column} = $2`, [
        tenantId,
        value,
      ])
    ).rows[0].id;
  mariaId = await accountId(tenantA, 'email', 'maria@inova.bg');
  elenaId = await accountId(tenantA, 'phone', '+359881000001');
  demoMariaId = await accountId(tenantB, 'email', 'maria@inova.bg');
  platformAdminId = (
    await adminPool.query(`SELECT id FROM platform_users WHERE email = 'admin@inova.bg'`)
  ).rows[0].id;

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

describe('RLS at the SQL layer (inova_app role)', () => {
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

  it('cannot widen its view by setting the old identity scope', async () => {
    // Regression: `identity_scope` policies once applied to every role, so
    // setting this variable from core-api exposed all tenants' identity rows.
    // Since B8 the policies are gone for every role.
    const client = await appPool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`SELECT set_config('app.identity_scope', 'auth', true)`);
      const memberships = await client.query('SELECT 1 FROM staff_memberships');
      const invites = await client.query('SELECT 1 FROM invite_codes');
      expect(memberships.rows).toHaveLength(0);
      expect(invites.rows).toHaveLength(0);
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }
  });

  it('has no access to refresh tokens or to platform identities', async () => {
    for (const table of ['refresh_tokens', 'platform_refresh_tokens', 'platform_users']) {
      await expect(appPool.query(`SELECT 1 FROM ${table}`), table).rejects.toMatchObject({
        code: '42501',
      });
    }
  });

  it('sees accounts of the configured tenant only (B8)', async () => {
    expect((await appPool.query('SELECT 1 FROM users')).rows).toHaveLength(0);

    const client = await appPool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`SELECT set_config('app.tenant_id', $1, true)`, [tenantA]);
      const accounts = await client.query('SELECT tenant_id, id FROM users');
      expect(accounts.rows.length).toBeGreaterThan(0);
      expect(new Set(accounts.rows.map((r) => r.tenant_id))).toEqual(new Set([tenantA]));
      // The other tenant's account with the very same e-mail stays out of sight.
      const marias = await client.query(`SELECT id FROM users WHERE email = 'maria@inova.bg'`);
      expect(marias.rows).toEqual([{ id: mariaId }]);

      // The identity scope reserved for auth-service widens nothing here.
      await client.query(`SELECT set_config('app.identity_scope', 'auth', true)`);
      const stillScoped = await client.query('SELECT DISTINCT tenant_id FROM users');
      expect(stillScoped.rows).toEqual([{ tenant_id: tenantA }]);
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }
  });

  it("cannot create or change an account in another tenant's realm", async () => {
    const client = await appPool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`SELECT set_config('app.tenant_id', $1, true)`, [tenantA]);
      const renamed = await client.query(
        `UPDATE users SET first_name = 'Hijacked' WHERE id = $1 RETURNING id`,
        [demoMariaId],
      );
      expect(renamed.rows).toHaveLength(0);
      await expect(
        client.query(
          `INSERT INTO users (tenant_id, email, first_name, status)
           VALUES ($1, 'sneaky@demo.bg', 'Sneaky', 'pending')`,
          [tenantB],
        ),
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

  it('hides identity tables without a tenant context — from auth-service too', async () => {
    const none = await appPool.query('SELECT * FROM staff_memberships');
    expect(none.rows).toHaveLength(0);

    // auth-service's own role gets one tenant at a time, like everyone else.
    const authPool = new pg.Pool({ connectionString: authUrl, max: 1 });
    const client = await authPool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`SELECT set_config('app.identity_scope', 'auth', true)`);
      for (const table of ['staff_memberships', 'invite_codes', 'users']) {
        const unscoped = await client.query(`SELECT 1 FROM ${table}`);
        expect(unscoped.rows, table).toHaveLength(0);
      }

      await client.query(`SELECT set_config('app.tenant_id', $1, true)`, [tenantB]);
      const scoped = await client.query('SELECT DISTINCT tenant_id FROM staff_memberships');
      expect(scoped.rows).toEqual([{ tenant_id: tenantB }]);
      await client.query('ROLLBACK');
    } finally {
      client.release();
      await authPool.end();
    }
  });
});

describe('Tenant isolation at the API layer', () => {
  it('allows a member to read their own tenant', async () => {
    const res = await getTenant(await tenantToken(mariaId, tenantA, ['admin']), tenantA);
    expect(res.status).toBe(200);
    expect(res.body.tenant.key).toBe('inova');
    expect(res.body.role).toBe('admin');
  });

  it("rejects a valid token targeting another tenant's id (403)", async () => {
    const res = await getTenant(await tenantToken(mariaId, tenantA, ['admin']), tenantB);
    expect(res.status).toBe(403);
  });

  it('never lets X-Tenant-Id move a token into another tenant, whatever the account (B8)', async () => {
    // The demo account with Maria's e-mail is a real, active manager of B —
    // its token still opens nothing in A, and Maria's nothing in B.
    const demoMaria = await tenantToken(demoMariaId, tenantB, ['manager']);
    expect((await getTenant(demoMaria, tenantB)).status).toBe(200);
    expect((await getTenant(demoMaria, tenantA)).status).toBe(403);
    expect((await getTenant(await tenantToken(mariaId, tenantA, ['admin']), tenantB)).status).toBe(
      403,
    );
  });

  it('rejects a forged tenant claim when the DB re-check fails (403)', async () => {
    // Token *claims* tenant B, but Maria's account does not exist there.
    const res = await getTenant(await tenantToken(mariaId, tenantB, ['admin']), tenantB);
    expect(res.status).toBe(403);
  });

  it('takes the role from the database, not from the token', async () => {
    // Elena claims admin; her membership says resident.
    const res = await getTenant(await tenantToken(elenaId, tenantA, ['admin']), tenantA);
    expect(res.status).toBe(200);
    expect(res.body.role).toBe('resident');
  });

  it('rejects tokens signed by an untrusted key (401)', async () => {
    const res = await getTenant(await tenantToken(mariaId, tenantA, ['admin'], rogueKey), tenantA);
    expect(res.status).toBe(401);
  });

  it('rejects a correctly signed token of the pre-B8 shape (401)', async () => {
    const legacy = await sign({ sub: mariaId, memberships: [{ t: tenantA, r: 'admin' }] });
    expect((await getTenant(legacy, tenantA)).status).toBe(401);
    const withoutTenant = await sign({ kind: 'tenant', sub: mariaId, roles: ['admin'] });
    expect((await getTenant(withoutTenant, tenantA)).status).toBe(401);
  });

  it('enforces permissions per role (resident cannot list staff)', async () => {
    const token = await tenantToken(elenaId, tenantA, ['resident']);
    const res = await request(app.getHttpServer())
      .get('/tenant/staff')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Tenant-Id', tenantA);
    expect(res.status).toBe(403);
  });

  it("lists only the tenant's own staff, also when an e-mail exists in both tenants", async () => {
    const staffOf = async (token: string, tenantId: string) =>
      (
        await request(app.getHttpServer())
          .get('/tenant/staff')
          .set('Authorization', `Bearer ${token}`)
          .set('X-Tenant-Id', tenantId)
      ).body as Array<{ userId: string; email: string | null; fullName: string }>;

    const inA = await staffOf(await tenantToken(mariaId, tenantA, ['admin']), tenantA);
    const inB = await staffOf(await tenantToken(demoMariaId, tenantB, ['manager']), tenantB);

    expect(inA.filter((m) => m.email === 'maria@inova.bg')).toEqual([
      expect.objectContaining({ userId: mariaId, fullName: 'Мария Иванова' }),
    ]);
    expect(inB.filter((m) => m.email === 'maria@inova.bg')).toEqual([
      expect.objectContaining({ userId: demoMariaId, fullName: 'Мария Стоянова' }),
    ]);
    expect(inA.map((m) => m.userId)).not.toContain(demoMariaId);
  });
});

describe('Platform identities', () => {
  const listTenants = (token: string) =>
    request(app.getHttpServer()).get('/platform/tenants').set('Authorization', `Bearer ${token}`);

  it('restricts platform endpoints to a platform super_admin', async () => {
    const denied = await listTenants(await tenantToken(mariaId, tenantA, ['admin']));
    expect(denied.status).toBe(403);

    const allowed = await listTenants(await platformToken(platformAdminId));
    expect(allowed.status).toBe(200);
    expect(allowed.body.map((t: { key: string }) => t.key).sort()).toEqual(['demo', 'inova']);
  });

  it('never treats a tenant account as platform, whatever its token claims', async () => {
    const forged = await sign({
      kind: 'tenant',
      sub: mariaId,
      tid: tenantA,
      roles: ['admin'],
      platform_role: 'super_admin',
    });
    expect((await listTenants(forged)).status).toBe(403);
    // …and the claim does not carry it into another tenant either.
    expect((await getTenant(forged, tenantB)).status).toBe(403);
  });

  it('lets a super_admin enter any tenant and records the entry in its audit trail', async () => {
    const token = await platformToken(platformAdminId);
    const accessRecords = async (tenantId: string) =>
      (
        await adminPool.query(
          `SELECT actor_user_id, actor_type, entity_id, payload FROM audit_records
           WHERE tenant_id = $1 AND action = 'platform.access'`,
          [tenantId],
        )
      ).rows;
    expect(await accessRecords(tenantB)).toHaveLength(0);

    const first = await getTenant(token, tenantB);
    expect(first.status).toBe(200);
    expect(first.body.tenant.key).toBe('demo');
    expect(first.body.role).toBe('admin');
    // A second request in the same visit is not a second entry.
    expect((await getTenant(token, tenantB)).status).toBe(200);

    expect(await accessRecords(tenantB)).toEqual([
      {
        actor_user_id: platformAdminId,
        actor_type: 'platform',
        entity_id: tenantB,
        payload: { platform_access: true },
      },
    ]);
    expect(await accessRecords(tenantA)).toHaveLength(0);
  });

  it('refuses a tenant that does not exist (403)', async () => {
    const token = await platformToken(platformAdminId);
    const missing = await getTenant(token, '00000000-0000-4000-8000-000000000000');
    expect(missing.status).toBe(403);
    expect((await getTenant(token, 'not-a-tenant-id')).status).toBe(403);

    const { rows } = await adminPool.query(
      `SELECT 1 FROM audit_records WHERE tenant_id = '00000000-0000-4000-8000-000000000000'`,
    );
    expect(rows).toHaveLength(0);
  });
});

describe('Accounts are created inside one realm (B8)', () => {
  it('invites staff with an e-mail that another tenant already uses as a separate account', async () => {
    const before = await adminPool.query(
      `SELECT id, first_name, status FROM users WHERE tenant_id = $1 AND email = 'ivan@demo.bg'`,
      [tenantB],
    );

    const res = await request(app.getHttpServer())
      .post('/tenant/staff')
      .set('Authorization', `Bearer ${await tenantToken(mariaId, tenantA, ['admin'])}`)
      .set('X-Tenant-Id', tenantA)
      .send({ email: 'ivan@demo.bg', fullName: 'Иван Нов', roleKey: 'manager' });
    expect(res.status).toBe(201);
    // Ivan is active in demo; here he is a new, pending account with an invite.
    expect(res.body).toMatchObject({ status: 'invited', inviteSent: true, fullName: 'Иван Нов' });
    expect(res.body.userId).not.toBe(before.rows[0].id);

    const created = await adminPool.query(
      `SELECT tenant_id, first_name, last_name, status FROM users WHERE id = $1`,
      [res.body.userId],
    );
    expect(created.rows).toEqual([
      { tenant_id: tenantA, first_name: 'Иван', last_name: 'Нов', status: 'pending' },
    ]);
    const after = await adminPool.query(
      `SELECT id, first_name, status FROM users WHERE tenant_id = $1 AND email = 'ivan@demo.bg'`,
      [tenantB],
    );
    expect(after.rows).toEqual(before.rows);
    const memberships = await adminPool.query(
      `SELECT tenant_id FROM staff_memberships WHERE user_id = $1`,
      [res.body.userId],
    );
    expect(memberships.rows).toEqual([{ tenant_id: tenantA }]);
  });

  it("provisions a tenant whose first admin shares an e-mail with another tenant's account", async () => {
    const res = await request(app.getHttpServer())
      .post('/platform/tenants')
      .set('Authorization', `Bearer ${await platformToken(platformAdminId)}`)
      .send({
        key: 'third',
        name: 'Third Homes',
        adminEmail: 'maria@inova.bg',
        adminName: 'Мария Трета',
      });
    expect(res.status).toBe(201);
    expect(res.body.adminInviteSent).toBe(true);

    const marias = await adminPool.query(
      `SELECT u.id, t.key, u.status, u.full_name FROM users u JOIN tenants t ON t.id = u.tenant_id
       WHERE u.email = 'maria@inova.bg' ORDER BY t.key`,
    );
    expect(marias.rows.map((r) => [r.key, r.status, r.full_name])).toEqual([
      ['demo', 'active', 'Мария Стоянова'],
      ['inova', 'active', 'Мария Иванова'],
      ['third', 'pending', 'Мария Трета'],
    ]);
    expect(new Set(marias.rows.map((r) => r.id)).size).toBe(3);

    const invite = await adminPool.query(
      `SELECT user_id, created_by FROM invite_codes WHERE tenant_id = $1`,
      [res.body.tenant.id],
    );
    expect(invite.rows).toEqual([{ user_id: marias.rows[2].id, created_by: platformAdminId }]);
  });
});

describe('Property hierarchy (M2) stays inside its tenant', () => {
  let buildingA: string;
  let entranceA: string;
  let propertyA: string;

  beforeAll(async () => {
    buildingA = (
      await adminPool.query(
        `INSERT INTO buildings (tenant_id, name, city, district, address, floors, assessment_basis)
         VALUES ($1, 'Isolation Tower', 'София', 'Център', 'ул. Проба 1', 5, 'fixed') RETURNING id`,
        [tenantA],
      )
    ).rows[0].id;
    entranceA = (
      await adminPool.query(
        `INSERT INTO entrances (tenant_id, building_id, name) VALUES ($1, $2, 'А') RETURNING id`,
        [tenantA, buildingA],
      )
    ).rows[0].id;
    propertyA = (
      await adminPool.query(
        `INSERT INTO apartments (tenant_id, building_id, entrance_id, floor, number)
         VALUES ($1, $2, $3, 1, '1') RETURNING id`,
        [tenantA, buildingA, entranceA],
      )
    ).rows[0].id;
  });

  it('RLS: another tenant reads and changes none of the three tables', async () => {
    for (const table of ['buildings', 'entrances', 'apartments']) {
      expect((await appPool.query(`SELECT 1 FROM ${table}`)).rows, table).toHaveLength(0);
    }
    const client = await appPool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`SELECT set_config('app.tenant_id', $1, true)`, [tenantB]);
      // Tenant B has its own seeded building; none of tenant A's rows may show.
      for (const table of ['buildings', 'entrances', 'apartments']) {
        const { rows } = await client.query(`SELECT DISTINCT tenant_id FROM ${table}`);
        expect(rows, table).toEqual([{ tenant_id: tenantB }]);
      }
      const renamed = await client.query(
        `UPDATE buildings SET name = 'Hijacked' WHERE id = $1 RETURNING id`,
        [buildingA],
      );
      expect(renamed.rows).toHaveLength(0);
      const removed = await client.query(`DELETE FROM apartments WHERE id = $1 RETURNING id`, [
        propertyA,
      ]);
      expect(removed.rows).toHaveLength(0);
      await expect(
        client.query(
          `INSERT INTO apartments (tenant_id, building_id, entrance_id, floor, number)
           VALUES ($1, $2, $3, 2, '2')`,
          [tenantA, buildingA, entranceA],
        ),
      ).rejects.toMatchObject({ code: '42501' });
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }
  });

  it('a property cannot sit in an entrance of another building or another tenant', async () => {
    // Tenant B's own building, pointing at tenant A's entrance: the key refuses it.
    const buildingB = (
      await adminPool.query(
        `INSERT INTO buildings (tenant_id, name, city, district, address, floors, assessment_basis)
         VALUES ($1, 'Demo House', 'София', 'Център', 'ул. Проба 2', 5, 'fixed') RETURNING id`,
        [tenantB],
      )
    ).rows[0].id;
    await expect(
      adminPool.query(
        `INSERT INTO apartments (tenant_id, building_id, entrance_id, floor, number)
         VALUES ($1, $2, $3, 1, '1')`,
        [tenantB, buildingB, entranceA],
      ),
    ).rejects.toMatchObject({ code: '23503' });
  });

  it('API: a manager of tenant B cannot reach a building of tenant A by any route', async () => {
    // The demo account with Maria's e-mail is a manager there: it holds both property rights.
    const inB = await tenantToken(demoMariaId, tenantB, ['manager']);
    const call = (method: 'get' | 'patch' | 'post' | 'delete', url: string, tenantId: string) => {
      const agent = request(app.getHttpServer());
      return agent[method](url)
        .set('Authorization', `Bearer ${inB}`)
        .set('X-Tenant-Id', tenantId)
        .send(method === 'get' || method === 'delete' ? undefined : { name: 'Hijacked' });
    };

    const own = await call('get', '/buildings', tenantB);
    expect(own.status).toBe(200);
    expect(own.body.map((b: { id: string }) => b.id)).not.toContain(buildingA);

    const routes: Array<['get' | 'patch' | 'post' | 'delete', string]> = [
      ['get', `/buildings/${buildingA}`],
      ['patch', `/buildings/${buildingA}`],
      ['post', `/buildings/${buildingA}/activate`],
      ['post', `/buildings/${buildingA}/entrances`],
      ['patch', `/buildings/${buildingA}/entrances/${entranceA}`],
      ['delete', `/buildings/${buildingA}/entrances/${entranceA}`],
      ['get', `/buildings/${buildingA}/properties`],
      ['patch', `/buildings/${buildingA}/properties/${propertyA}`],
      ['delete', `/buildings/${buildingA}/properties/${propertyA}`],
    ];
    for (const [method, url] of routes) {
      // In its own tenant the building does not exist; with the other tenant's
      // id in the header the token is refused before anything is looked up.
      expect((await call(method, url, tenantB)).status, `${method} ${url}`).toBe(404);
      expect((await call(method, url, tenantA)).status, `${method} ${url} as A`).toBe(403);
    }

    const intact = await adminPool.query(
      `SELECT b.name, b.status, count(a.id)::int AS properties FROM buildings b
       LEFT JOIN apartments a ON a.tenant_id = b.tenant_id AND a.building_id = b.id
       WHERE b.id = $1 GROUP BY b.name, b.status`,
      [buildingA],
    );
    expect(intact.rows).toEqual([{ name: 'Isolation Tower', status: 'draft', properties: 1 }]);
  });
});

describe('Residents and pets (M2) stay inside their tenant', () => {
  let buildingA: string;
  let propertyA: string;
  let occupancyA: string;

  beforeAll(async () => {
    buildingA = (
      await adminPool.query(
        `INSERT INTO buildings (tenant_id, name, city, district, address, floors, assessment_basis)
         VALUES ($1, 'Resident Tower', 'София', 'Център', 'ул. Проба 3', 5, 'fixed') RETURNING id`,
        [tenantA],
      )
    ).rows[0].id;
    const entrance = (
      await adminPool.query(
        `INSERT INTO entrances (tenant_id, building_id, name) VALUES ($1, $2, 'А') RETURNING id`,
        [tenantA, buildingA],
      )
    ).rows[0].id;
    propertyA = (
      await adminPool.query(
        `INSERT INTO apartments (tenant_id, building_id, entrance_id, floor, number)
         VALUES ($1, $2, $3, 1, '1') RETURNING id`,
        [tenantA, buildingA, entrance],
      )
    ).rows[0].id;
    occupancyA = (
      await adminPool.query(
        `INSERT INTO occupancies (tenant_id, apartment_id, user_id, role, valid_from, created_by)
         VALUES ($1, $2, $3, 'owner', '2026-01-01', $3) RETURNING id`,
        [tenantA, propertyA, elenaId],
      )
    ).rows[0].id;
    await adminPool.query(
      `INSERT INTO pets (tenant_id, apartment_id, name, species, valid_from, created_by)
       VALUES ($1, $2, 'Рекс', 'dog', '2026-01-01', $3)`,
      [tenantA, propertyA, elenaId],
    );
  });

  it('RLS: another tenant reads and changes neither table; the app role cannot delete history', async () => {
    const client = await appPool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`SELECT set_config('app.tenant_id', $1, true)`, [tenantB]);
      // Tenant B has its own seeded occupancy; none of tenant A's rows may show.
      const seen = await client.query('SELECT DISTINCT tenant_id FROM occupancies');
      expect(seen.rows).toEqual([{ tenant_id: tenantB }]);
      const own = await client.query('SELECT 1 FROM occupancies WHERE id = $1', [occupancyA]);
      expect(own.rows).toHaveLength(0);
      expect((await client.query('SELECT 1 FROM pets')).rows).toHaveLength(0);
      const ended = await client.query(
        `UPDATE occupancies SET valid_to = '2026-01-02' WHERE id = $1 RETURNING id`,
        [occupancyA],
      );
      expect(ended.rows).toHaveLength(0);
      await expect(
        client.query(
          `INSERT INTO pets (tenant_id, apartment_id, name, species, valid_from, created_by)
           VALUES ($1, $2, 'Мац', 'cat', '2026-01-01', $3)`,
          [tenantA, propertyA, demoMariaId],
        ),
      ).rejects.toMatchObject({ code: '42501' });
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }
    await expect(appPool.query('DELETE FROM occupancies')).rejects.toMatchObject({ code: '42501' });
    await expect(appPool.query('DELETE FROM pets')).rejects.toMatchObject({ code: '42501' });
  });

  it("an occupancy cannot point at another tenant's account or property", async () => {
    await expect(
      adminPool.query(
        `INSERT INTO occupancies (tenant_id, apartment_id, user_id, role, valid_from, created_by)
         VALUES ($1, $2, $3, 'owner', '2026-01-01', $3)`,
        [tenantA, propertyA, demoMariaId],
      ),
    ).rejects.toMatchObject({ code: '23503' });
  });

  it('API: tenant B reaches neither the residents of A nor A-residents’ own routes', async () => {
    const inB = await tenantToken(demoMariaId, tenantB, ['manager']);
    const call = (method: 'get' | 'post', url: string, tenantId: string) => {
      const agent = request(app.getHttpServer());
      return agent[method](url)
        .set('Authorization', `Bearer ${inB}`)
        .set('X-Tenant-Id', tenantId)
        .send(
          method === 'post'
            ? {
                role: 'occupant',
                firstName: 'X',
                name: 'X',
                species: 'cat',
                validFrom: '2026-01-01',
              }
            : undefined,
        );
    };
    const routes: Array<['get' | 'post', string]> = [
      ['get', `/buildings/${buildingA}/properties/${propertyA}/residents`],
      ['post', `/buildings/${buildingA}/properties/${propertyA}/residents`],
      ['get', `/me/properties/${propertyA}`],
      ['post', `/me/properties/${propertyA}/occupants`],
      ['post', `/me/properties/${propertyA}/pets`],
    ];
    for (const [method, url] of routes) {
      expect((await call(method, url, tenantB)).status, `${method} ${url}`).toBe(404);
      expect((await call(method, url, tenantA)).status, `${method} ${url} as A`).toBe(403);
    }
    const mine = await call('get', '/me/properties', tenantB);
    expect(mine.status).toBe(200);
    expect(mine.body).toEqual([]);

    const untouched = await adminPool.query(
      `SELECT (SELECT count(*) FROM occupancies WHERE apartment_id = $1)::int AS people,
              (SELECT count(*) FROM pets WHERE apartment_id = $1)::int AS pets`,
      [propertyA],
    );
    expect(untouched.rows).toEqual([{ people: 1, pets: 1 }]);
  });
});
