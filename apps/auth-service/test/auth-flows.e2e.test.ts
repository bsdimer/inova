/**
 * Auth-flow suite — RELEASE BLOCKER: password login, invite-code activation
 * by identifier and code (B7, B14, B15), refresh rotation with reuse
 * detection, and the tenant-scoped account
 * realms of decision B8 (the same e-mail or phone is an independent account in
 * each tenant; no response tells one realm about another). Runs against a
 * dedicated database with real migrations, as the RLS-enforced app role.
 */
import type { INestApplication } from '@nestjs/common';
import { ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { decodeJwt } from 'jose';
import { createHash } from 'node:crypto';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import bcrypt from 'bcryptjs';
import pg from 'pg';
import { createTestDb } from './db-helper';

let app: INestApplication;
let db: pg.Client; // privileged: fixtures and cross-tenant assertions
let appUrl: string;
let disposeDb: () => Promise<void>;

let inovaId: string;
let demoId: string;

const sha256 = (value: string): string => createHash('sha256').update(value).digest('hex');

const post = (url: string, body: object) =>
  request(app.getHttpServer()).post(url).send(body).set('content-type', 'application/json');

const get = (url: string, accessToken: string) =>
  request(app.getHttpServer()).get(url).set('Authorization', `Bearer ${accessToken}`);

const INVALID_CREDENTIALS = {
  statusCode: 401,
  message: 'Invalid credentials',
  error: 'Unauthorized',
};

beforeAll(async () => {
  const testDb = await createTestDb('inova_test_auth');
  appUrl = testDb.appUrl;
  disposeDb = testDb.dispose;
  process.env.AUTH_DATABASE_URL = appUrl;
  process.env.JWT_PRIVATE_KEY_PATH = path.join(
    mkdtempSync(path.join(tmpdir(), 'inova-jwt-')),
    'test.pem',
  );
  process.env.AUTH_THROTTLE_STRICT = '1000'; // throttling is not under test here
  process.env.AUTH_DEFAULT_REALM = 'inova';
  process.env.INVITE_CODE_TTL_DAYS = '7';

  // Dynamic import so env vars above are read at module evaluation time.
  const { AppModule } = await import('../src/app.module');
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  // Listen once: on a server that is not listening, supertest binds a fresh
  // ephemeral port for every request, and parallel requests then race for it.
  await app.listen(0);

  db = new pg.Client({ connectionString: testDb.migratorUrl });
  await db.connect();
  const tenants = await db.query('SELECT id, key FROM tenants');
  inovaId = tenants.rows.find((r) => r.key === 'inova').id;
  demoId = tenants.rows.find((r) => r.key === 'demo').id;
});

afterAll(async () => {
  await app?.close();
  await db?.end();
  await disposeDb?.();
});

describe('password login', () => {
  it('signs a tenant account in with a token for exactly its own tenant', async () => {
    const res = await post('/auth/login', {
      email: 'maria@inova.bg',
      password: 'inova-owner',
      realm: 'inova',
    });
    expect(res.status).toBe(200);
    expect(res.body.refreshToken).toBeTruthy();
    expect(res.body.user.fullName).toBe('Мария Иванова');
    expect(res.body.user.platformRole).toBeNull();
    expect(res.body.memberships).toEqual([
      { t: inovaId, r: 'admin', tenantKey: 'inova', tenantName: 'WhiteNova Technology' },
    ]);

    const claims = decodeJwt(res.body.accessToken);
    expect(claims).toMatchObject({
      kind: 'tenant',
      sub: res.body.user.id,
      tid: inovaId,
      roles: ['admin'],
    });
    expect(claims).not.toHaveProperty('memberships');
    expect(claims).not.toHaveProperty('platform_role');
  });

  it('uses the default realm for a request that names none', async () => {
    const res = await post('/auth/login', { email: 'maria@inova.bg', password: 'inova-owner' });
    expect(res.status).toBe(200);
    expect(decodeJwt(res.body.accessToken).tid).toBe(inovaId);
  });

  it('rejects wrong passwords and unknown emails identically (401)', async () => {
    const wrong = await post('/auth/login', { email: 'maria@inova.bg', password: 'nope' });
    const unknown = await post('/auth/login', { email: 'ghost@inova.bg', password: 'nope' });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.body.message).toBe(unknown.body.message);
  });

  it('answers every failed login with the same 401 body, whatever the account state', async () => {
    try {
      await db.query(
        `INSERT INTO users (tenant_id, email, first_name, password_hash, status) VALUES
           ($1, 'suspended@inova.bg', 'Suspended', $2, 'suspended'),
           ($1, 'nopassword@inova.bg', 'NoPassword', NULL, 'active')`,
        [inovaId, await bcrypt.hash('nope', 4)],
      );

      const attempts = await Promise.all(
        ['ghost@inova.bg', 'maria@inova.bg', 'suspended@inova.bg', 'nopassword@inova.bg'].map(
          (email) => post('/auth/login', { email, password: 'nope' }),
        ),
      );
      const [unknown, ...others] = attempts;
      expect(unknown.status).toBe(401);
      expect(unknown.body).toEqual(INVALID_CREDENTIALS);
      for (const res of others) {
        expect(res.status).toBe(401);
        expect(res.body).toEqual(unknown.body);
      }
    } finally {
      await db.query(
        `DELETE FROM users WHERE email IN ('suspended@inova.bg', 'nopassword@inova.bg')`,
      );
    }
  });
});

describe('sign-in by phone (WHI-122)', () => {
  const PHONE = '+359881500001';

  beforeAll(async () => {
    const argon2 = await import('argon2');
    const hash = await argon2.hash('phone-password', { type: argon2.argon2id });
    // A resident invited by SMS: a phone, no e-mail. And the same phone in demo.
    await db.query(
      `INSERT INTO users (tenant_id, phone, first_name, password_hash, status)
       VALUES ($1, $3, 'Само', $4, 'active'), ($2, $3, 'Друг', $4, 'active')`,
      [inovaId, demoId, PHONE, hash],
    );
    await db.query(`UPDATE users SET password_hash = $2 WHERE tenant_id = $1 AND phone = $3`, [
      demoId,
      await argon2.hash('demo-phone-password', { type: argon2.argon2id }),
      PHONE,
    ]);
  });

  it('signs a resident without an e-mail in with the phone and password', async () => {
    const res = await post('/auth/login', {
      phone: PHONE,
      password: 'phone-password',
      realm: 'inova',
    });
    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ fullName: 'Само', email: null, phone: PHONE });
    expect(decodeJwt(res.body.accessToken)).toMatchObject({ kind: 'tenant', tid: inovaId });
    // The default realm works for the phone as for an e-mail.
    expect((await post('/auth/login', { phone: PHONE, password: 'phone-password' })).status).toBe(
      200,
    );
  });

  it('answers a wrong password, an unknown phone and another realm’s phone alike', async () => {
    const attempts = await Promise.all([
      post('/auth/login', { phone: PHONE, password: 'nope', realm: 'inova' }),
      post('/auth/login', { phone: '+359881599999', password: 'phone-password', realm: 'inova' }),
      // The demo account's password, asked in inova.
      post('/auth/login', { phone: PHONE, password: 'demo-phone-password', realm: 'inova' }),
    ]);
    for (const res of attempts) {
      expect(res.status).toBe(401);
      expect(res.body).toEqual(INVALID_CREDENTIALS);
    }
    // In demo the same phone is demo's own account.
    const demo = await post('/auth/login', {
      phone: PHONE,
      password: 'demo-phone-password',
      realm: 'demo',
    });
    expect(demo.status).toBe(200);
    expect(demo.body.user.fullName).toBe('Друг');
  });

  it('wants an e-mail or a phone, not both and not neither (400)', async () => {
    const both = await post('/auth/login', {
      email: 'maria@inova.bg',
      phone: PHONE,
      password: 'x',
    });
    const neither = await post('/auth/login', { password: 'x' });
    const malformed = await post('/auth/login', { phone: '0881500001', password: 'x' });
    expect([both.status, neither.status, malformed.status]).toEqual([400, 400, 400]);
  });
});

describe('tenant-scoped account realms (B8)', () => {
  it('treats the same e-mail in two tenants as two unrelated accounts', async () => {
    const inova = await post('/auth/login', {
      email: 'maria@inova.bg',
      password: 'inova-owner',
      realm: 'inova',
    });
    const demo = await post('/auth/login', {
      email: 'maria@inova.bg',
      password: 'demo-maria',
      realm: 'demo',
    });
    expect(inova.status).toBe(200);
    expect(demo.status).toBe(200);

    expect(demo.body.user.id).not.toBe(inova.body.user.id);
    expect(demo.body.user.fullName).toBe('Мария Стоянова');
    expect(demo.body.memberships).toEqual([
      { t: demoId, r: 'manager', tenantKey: 'demo', tenantName: 'Demo Blok Management' },
    ]);
    expect(decodeJwt(demo.body.accessToken)).toMatchObject({ tid: demoId, roles: ['manager'] });
    expect(decodeJwt(inova.body.accessToken)).toMatchObject({ tid: inovaId, roles: ['admin'] });

    // Neither session learns of the other tenant.
    const me = await get('/auth/me', demo.body.accessToken);
    expect(me.body.memberships.map((m: { tenantKey: string }) => m.tenantKey)).toEqual(['demo']);
  });

  it("never accepts one realm's password in the other, and answers like an unknown account", async () => {
    const attempts = await Promise.all([
      post('/auth/login', { email: 'maria@inova.bg', password: 'demo-maria', realm: 'inova' }),
      post('/auth/login', { email: 'maria@inova.bg', password: 'inova-owner', realm: 'demo' }),
      // Exists in demo only / in inova only: asked in the other realm.
      post('/auth/login', { email: 'ivan@demo.bg', password: 'demo-owner', realm: 'inova' }),
      post('/auth/login', { email: 'ivan@demo.bg', password: 'demo-owner' }),
      post('/auth/login', { email: 'ghost@inova.bg', password: 'demo-owner', realm: 'demo' }),
      post('/auth/login', {
        email: 'maria@inova.bg',
        password: 'inova-owner',
        realm: 'no-such-org',
      }),
    ]);
    for (const res of attempts) {
      expect(res.status).toBe(401);
      expect(res.body).toEqual(INVALID_CREDENTIALS);
    }
  });

  it('allows the same e-mail and phone in two tenants but not twice in one', async () => {
    const insert = (tenantId: string, email: string, phone: string) =>
      db.query(
        `INSERT INTO users (tenant_id, email, phone, first_name, status)
         VALUES ($1, $2, $3, 'Twin', 'pending')`,
        [tenantId, email, phone],
      );
    try {
      await insert(inovaId, 'twin@example.bg', '+359881555001');
      await insert(demoId, 'twin@example.bg', '+359881555001');

      await expect(insert(inovaId, 'TWIN@example.bg', '+359881555002')).rejects.toMatchObject({
        code: '23505',
        constraint: 'users_tenant_email_unique',
      });
      await expect(insert(demoId, 'other@example.bg', '+359881555001')).rejects.toMatchObject({
        code: '23505',
        constraint: 'users_tenant_phone_unique',
      });
    } finally {
      await db.query(`DELETE FROM users WHERE first_name = 'Twin'`);
    }
  });

  it("changes only this tenant's account when a password is set", async () => {
    const demo = await post('/auth/login', {
      email: 'maria@inova.bg',
      password: 'demo-maria',
      realm: 'demo',
    });
    try {
      const set = await request(app.getHttpServer())
        .post('/auth/password')
        .set('Authorization', `Bearer ${demo.body.accessToken}`)
        .send({ password: 'demo-maria-changed' });
      expect(set.status).toBe(204);

      const login = (realm: string, password: string) =>
        post('/auth/login', { email: 'maria@inova.bg', password, realm });
      expect((await login('demo', 'demo-maria-changed')).status).toBe(200);
      expect((await login('demo', 'demo-maria')).status).toBe(401);
      expect((await login('inova', 'inova-owner')).status).toBe(200);
      expect((await login('inova', 'demo-maria-changed')).status).toBe(401);
    } finally {
      const argon2 = await import('argon2');
      await db.query(
        `UPDATE users SET password_hash = $1 WHERE tenant_id = $2 AND email = 'maria@inova.bg'`,
        [await argon2.hash('demo-maria', { type: argon2.argon2id }), demoId],
      );
    }
  });

  describe('realm selection is mapped server-side', () => {
    it('lets a brand narrow the realm but never widen it', async () => {
      const login = (hint: object) =>
        post('/auth/login', { email: 'maria@inova.bg', password: 'inova-owner', ...hint });

      expect((await login({ realm: 'inova', brand: 'inova' })).status).toBe(200);
      // The organisation exists, but not under that brand.
      const wrongBrand = await login({ realm: 'inova', brand: 'other-brand' });
      expect(wrongBrand.status).toBe(401);
      expect(wrongBrand.body).toEqual(INVALID_CREDENTIALS);
      // Two seeded organisations share the brand: the brand alone picks neither.
      expect((await login({ brand: 'inova' })).status).toBe(401);
    });

    it('resolves a brand that has a single organisation', async () => {
      const argon2 = await import('argon2');
      const soloId = (
        await db.query(
          `INSERT INTO tenants (key, name, brand_key) VALUES ('solo', 'Solo Homes', 'solo') RETURNING id`,
        )
      ).rows[0].id;
      try {
        await db.query(
          `INSERT INTO users (tenant_id, email, first_name, password_hash, status)
           VALUES ($1, 'owner@solo.bg', 'Solo', $2, 'active')`,
          [soloId, await argon2.hash('solo-owner', { type: argon2.argon2id })],
        );
        const res = await post('/auth/login', {
          email: 'owner@solo.bg',
          password: 'solo-owner',
          brand: 'solo',
        });
        expect(res.status).toBe(200);
        expect(decodeJwt(res.body.accessToken).tid).toBe(soloId);
        // An account without any role still signs in; it just holds none.
        expect(res.body.memberships).toEqual([]);
      } finally {
        await db.query('DELETE FROM users WHERE tenant_id = $1', [soloId]);
        await db.query('DELETE FROM tenants WHERE id = $1', [soloId]);
      }
    });

    it('rejects a realm or brand that is not a key (400)', async () => {
      const res = await post('/auth/login', {
        email: 'maria@inova.bg',
        password: 'inova-owner',
        realm: "inova' OR 1=1",
      });
      expect(res.status).toBe(400);
    });
  });

  describe('RLS for auth-service itself (inova_auth role)', () => {
    let authPool: pg.Pool;
    beforeAll(() => {
      authPool = new pg.Pool({ connectionString: appUrl, max: 1 });
    });
    afterAll(async () => {
      await authPool.end();
    });

    it('sees no account and no session without a tenant context', async () => {
      expect((await authPool.query('SELECT 1 FROM users')).rows).toHaveLength(0);
      expect((await authPool.query('SELECT 1 FROM refresh_tokens')).rows).toHaveLength(0);
    });

    it('cannot search accounts across tenants, even with the identity scope', async () => {
      const client = await authPool.connect();
      try {
        await client.query('BEGIN');
        await client.query(`SELECT set_config('app.identity_scope', 'auth', true)`);
        expect((await client.query('SELECT 1 FROM users')).rows).toHaveLength(0);
        expect((await client.query('SELECT 1 FROM refresh_tokens')).rows).toHaveLength(0);

        await client.query(`SELECT set_config('app.tenant_id', $1, true)`, [demoId]);
        const scoped = await client.query('SELECT DISTINCT tenant_id FROM users');
        expect(scoped.rows).toEqual([{ tenant_id: demoId }]);
        await client.query('ROLLBACK');
      } finally {
        client.release();
      }
    });
  });
});

describe('platform identities', () => {
  it('signs a platform operator in with a platform token and no tenant', async () => {
    const res = await post('/auth/login', { email: 'admin@inova.bg', password: 'inova-admin' });
    expect(res.status).toBe(200);
    expect(res.body.user.platformRole).toBe('super_admin');
    expect(res.body.memberships).toEqual([]);

    const claims = decodeJwt(res.body.accessToken);
    expect(claims).toMatchObject({ kind: 'platform', platform_role: 'super_admin' });
    expect(claims).not.toHaveProperty('tid');

    const me = await get('/auth/me', res.body.accessToken);
    expect(me.status).toBe(200);
    expect(me.body.user.platformRole).toBe('super_admin');
    expect(me.body.memberships).toEqual([]);
  });

  it('is not reachable through a tenant realm', async () => {
    const res = await post('/auth/login', {
      email: 'admin@inova.bg',
      password: 'inova-admin',
      realm: 'inova',
    });
    expect(res.status).toBe(401);
    expect(res.body).toEqual(INVALID_CREDENTIALS);
  });

  it('is not a tenant account: no row of it exists in any tenant', async () => {
    const { rows } = await db.query(`SELECT 1 FROM users WHERE email = 'admin@inova.bg'`);
    expect(rows).toHaveLength(0);
  });

  it('rotates its own refresh tokens and stays a platform session', async () => {
    const login = await post('/auth/login', { email: 'admin@inova.bg', password: 'inova-admin' });
    expect(login.body.refreshToken.startsWith('p.')).toBe(true);

    const rotated = await post('/auth/refresh', { refreshToken: login.body.refreshToken });
    expect(rotated.status).toBe(200);
    expect(decodeJwt(rotated.body.accessToken)).toMatchObject({ kind: 'platform' });

    const replay = await post('/auth/refresh', { refreshToken: login.body.refreshToken });
    expect(replay.status).toBe(401);
    const afterReplay = await post('/auth/refresh', { refreshToken: rotated.body.refreshToken });
    expect(afterReplay.status).toBe(401);
  });
});

const INVALID_CODE = { statusCode: 401, message: 'Invalid or expired code', error: 'Unauthorized' };

/** A pending, invited account with a known code — planted directly in the DB. */
async function invited(
  tenantId: string,
  contact: { phone?: string; email?: string },
  code: string,
): Promise<string> {
  const id = (
    await db.query(
      `INSERT INTO users (tenant_id, phone, email, first_name, status)
       VALUES ($1, $2, $3, 'Invited', 'pending') RETURNING id`,
      [tenantId, contact.phone ?? null, contact.email ?? null],
    )
  ).rows[0].id;
  await db.query(
    `INSERT INTO invite_codes (tenant_id, user_id, code_hash, channel, phone, expires_at)
     VALUES ($1, $2, $3, 'sms', $4, now() + interval '30 days')`,
    [tenantId, id, sha256(code), contact.phone ?? null],
  );
  return id;
}

const codesOf = async (accountId: string) =>
  (
    await db.query(
      `SELECT code_hash, status, attempts FROM invite_codes WHERE user_id = $1 ORDER BY created_at`,
      [accountId],
    )
  ).rows;

describe('invite-code activation (B7, B15)', () => {
  const ELENA = '+359881000001';
  const GEORGI = '+359881000002';

  it("does not accept another realm's account and code", async () => {
    // Georgi and his code 735026 live in demo; the default realm is inova.
    const res = await post('/auth/activate', { identifier: GEORGI, code: '735026' });
    expect(res.status).toBe(401);
    expect(res.body).toEqual(INVALID_CODE);
    const { rows } = await db.query(
      `SELECT status, attempts FROM invite_codes WHERE tenant_id = $1 AND code_hash = $2`,
      [demoId, sha256('735026')],
    );
    expect(rows).toEqual([{ status: 'active', attempts: 0 }]);
  });

  it('never activates by the code alone', async () => {
    const withoutIdentifier = await post('/auth/activate', { code: '482913' });
    expect(withoutIdentifier.status).toBe(400);
    // The right code of one account, offered for another account of the realm.
    const other = await invited(inovaId, { phone: '+359881666001' }, '246810');
    const res = await post('/auth/activate', { identifier: '+359881666001', code: '482913' });
    expect(res.status).toBe(401);
    expect(await codesOf(other)).toEqual([
      { code_hash: sha256('246810'), status: 'active', attempts: 1 },
    ]);
  });

  it('activates only the account of the requested realm when two realms hold the same phone and code', async () => {
    const twinId = await invited(demoId, { phone: ELENA }, '482913');

    const res = await post('/auth/activate', { identifier: ELENA, code: '482913', realm: 'inova' });
    expect(res.status).toBe(200);
    expect(res.body.user.fullName).toBe('Елена Петрова');
    expect(res.body.user.mustSetPassword).toBe(true);
    expect(res.body.memberships).toEqual([
      { t: inovaId, r: 'resident', tenantKey: 'inova', tenantName: 'WhiteNova Technology' },
    ]);
    expect(decodeJwt(res.body.accessToken)).toMatchObject({ tid: inovaId, roles: ['resident'] });

    expect(await codesOf(twinId)).toEqual([
      { code_hash: sha256('482913'), status: 'active', attempts: 0 },
    ]);
    const twin = await db.query(`SELECT status FROM users WHERE tenant_id = $1 AND id = $2`, [
      demoId,
      twinId,
    ]);
    expect(twin.rows).toEqual([{ status: 'pending' }]);

    // The demo twin activates with the same phone and digits, in its own realm.
    const demo = await post('/auth/activate', { identifier: ELENA, code: '482913', realm: 'demo' });
    expect(demo.status).toBe(200);
    expect(demo.body.user.id).toBe(twinId);
    expect(decodeJwt(demo.body.accessToken).tid).toBe(demoId);
  });

  it('rejects the same code a second time (single use)', async () => {
    const res = await post('/auth/activate', { identifier: ELENA, code: '482913' });
    expect(res.status).toBe(401);
    const { rows } = await db.query(
      `SELECT status, consumed_at IS NOT NULL AS used FROM invite_codes
       WHERE tenant_id = $1 AND code_hash = $2`,
      [inovaId, sha256('482913')],
    );
    expect(rows).toEqual([{ status: 'consumed', used: true }]);
  });

  it('activates by e-mail as well as by phone', async () => {
    const id = await invited(inovaId, { email: 'Invited.Staff@inova.bg' }, '135791');
    const res = await post('/auth/activate', {
      identifier: 'invited.staff@inova.bg',
      code: '135791',
    });
    expect(res.status).toBe(200);
    expect(res.body.user.id).toBe(id);
  });

  it('answers an unknown realm, an unknown account, a wrong code, a voided and an expired code alike', async () => {
    const voided = await invited(inovaId, { phone: '+359881666002' }, '111222');
    await db.query(`UPDATE invite_codes SET status = 'voided' WHERE user_id = $1`, [voided]);
    const expired = await invited(inovaId, { phone: '+359881666003' }, '333444');
    await db.query(
      `UPDATE invite_codes SET expires_at = now() - interval '1 second' WHERE user_id = $1`,
      [expired],
    );
    await invited(inovaId, { phone: '+359881666004' }, '555666');

    const attempts = await Promise.all([
      post('/auth/activate', { identifier: GEORGI, code: '735026', realm: 'no-such-org' }),
      post('/auth/activate', { identifier: '+359881999999', code: '735026' }),
      post('/auth/activate', { identifier: '+359881666004', code: '000000' }),
      post('/auth/activate', { identifier: '+359881666002', code: '111222' }),
      post('/auth/activate', { identifier: '+359881666003', code: '333444' }),
    ]);
    for (const res of attempts) {
      expect(res.status).toBe(401);
      // No "N attempts left", no hint which part was wrong.
      expect(res.body).toEqual(INVALID_CODE);
    }
    // Expiry is judged on read, and the row then says so.
    expect(await codesOf(expired)).toEqual([
      { code_hash: sha256('333444'), status: 'expired', attempts: 0 },
    ]);
  });

  it('voids the code after five wrong tries: the sixth fails even with the right code', async () => {
    const phone = '+359881666005';
    const id = await invited(inovaId, { phone }, '777888');

    for (let attempt = 1; attempt <= 4; attempt += 1) {
      const res = await post('/auth/activate', { identifier: phone, code: '000000' });
      expect(res.body).toEqual(INVALID_CODE);
      expect(await codesOf(id)).toEqual([
        { code_hash: sha256('777888'), status: 'active', attempts: attempt },
      ]);
    }
    const fifth = await post('/auth/activate', { identifier: phone, code: '000000' });
    expect(fifth.body).toEqual(INVALID_CODE);
    expect(await codesOf(id)).toEqual([
      { code_hash: sha256('777888'), status: 'voided', attempts: 5 },
    ]);

    const sixth = await post('/auth/activate', { identifier: phone, code: '777888' });
    expect(sixth.status).toBe(401);
    expect(sixth.body).toEqual(INVALID_CODE);
    const account = await db.query(`SELECT status FROM users WHERE id = $1`, [id]);
    expect(account.rows).toEqual([{ status: 'pending' }]);
  });

  it('counts parallel wrong tries one by one', async () => {
    const phone = '+359881666006';
    const id = await invited(inovaId, { phone }, '999000');
    await Promise.all(
      ['000001', '000002', '000003'].map((code) =>
        post('/auth/activate', { identifier: phone, code }),
      ),
    );
    expect(await codesOf(id)).toEqual([
      { code_hash: sha256('999000'), status: 'active', attempts: 3 },
    ]);
  });

  it('lets the activated user set a password via their access token', async () => {
    const session = await post('/auth/activate', {
      identifier: GEORGI,
      code: '735026',
      realm: 'demo',
    });
    expect(session.status).toBe(200);
    const res = await request(app.getHttpServer())
      .post('/auth/password')
      .set('Authorization', `Bearer ${session.body.accessToken}`)
      .send({ password: 'brand-new-password' });
    expect(res.status).toBe(204);

    const me = await get('/auth/me', session.body.accessToken);
    expect(me.status).toBe(200);
    expect(me.body.user.mustSetPassword).toBe(false);
  });
});

describe('one active code per account, unique inside the realm (B14)', () => {
  it('cannot store a second active code for an account, nor the same active code twice in a realm', async () => {
    const first = await invited(inovaId, { phone: '+359881888001' }, '121212');
    const second = await invited(inovaId, { phone: '+359881888002' }, '343434');
    const insert = (tenantId: string, accountId: string, code: string) =>
      db.query(
        `INSERT INTO invite_codes (tenant_id, user_id, code_hash, channel, expires_at)
         VALUES ($1, $2, $3, 'sms', now() + interval '30 days')`,
        [tenantId, accountId, sha256(code)],
      );

    await expect(insert(inovaId, first, '565656')).rejects.toMatchObject({
      code: '23505',
      constraint: 'invite_codes_active_account_unique',
    });
    await db.query(`UPDATE invite_codes SET status = 'voided' WHERE user_id = $1`, [second]);
    await expect(insert(inovaId, second, '121212')).rejects.toMatchObject({
      code: '23505',
      constraint: 'invite_codes_active_hash_unique',
    });
    // Another realm may hold the very same digits.
    const elsewhere = await invited(demoId, { phone: '+359881888001' }, '121212');
    expect(await codesOf(elsewhere)).toHaveLength(1);
  });
});

describe('resend-code (B14)', () => {
  it('voids the old code and issues a new one, inside the requested realm only, answering the same either way', async () => {
    const phone = '+359881777001';
    const id = await invited(inovaId, { phone }, '111111');

    // The phone is unknown in demo: nothing changes, and the answer does not say so.
    const elsewhere = await post('/auth/resend-code', { phone, realm: 'demo' });
    expect(elsewhere.status).toBe(202);
    expect(await codesOf(id)).toEqual([
      { code_hash: sha256('111111'), status: 'active', attempts: 0 },
    ]);

    const here = await post('/auth/resend-code', { phone, realm: 'inova' });
    expect(here.status).toBe(202);
    expect(here.body).toEqual(elsewhere.body);

    const codes = await codesOf(id);
    expect(codes).toHaveLength(2);
    expect(codes[0]).toEqual({ code_hash: sha256('111111'), status: 'voided', attempts: 0 });
    expect(codes[1]).toMatchObject({ status: 'active', attempts: 0 });
    expect(codes[1].code_hash).not.toBe(sha256('111111'));

    // The old code no longer activates.
    const old = await post('/auth/activate', { identifier: phone, code: '111111' });
    expect(old.status).toBe(401);
  });

  it('gives a fresh code to an account whose code was burnt by wrong tries', async () => {
    const phone = '+359881777002';
    const id = await invited(inovaId, { phone }, '222222');
    await db.query(`UPDATE invite_codes SET status = 'voided', attempts = 5 WHERE user_id = $1`, [
      id,
    ]);

    expect((await post('/auth/resend-code', { phone })).status).toBe(202);

    const codes = await codesOf(id);
    expect(codes.map((c) => c.status)).toEqual(['voided', 'active']);
    const lifetime = await db.query(
      `SELECT round(extract(epoch FROM expires_at - created_at) / 86400) AS days, max_attempts
       FROM invite_codes WHERE user_id = $1 AND status = 'active'`,
      [id],
    );
    // INVITE_CODE_TTL_DAYS of this suite, not the 30-day default.
    expect(lifetime.rows).toEqual([{ days: '7', max_attempts: 5 }]);
  });

  it('sends nothing to an activated account or an account that was never invited', async () => {
    const before = await db.query('SELECT count(*) FROM invite_codes');
    // Elena is active by now; the second account has no invite at all.
    await db.query(
      `INSERT INTO users (tenant_id, phone, first_name, status) VALUES ($1, '+359881777003', 'Bare', 'pending')`,
      [inovaId],
    );
    expect((await post('/auth/resend-code', { phone: '+359881000001' })).status).toBe(202);
    expect((await post('/auth/resend-code', { phone: '+359881777003' })).status).toBe(202);
    const after = await db.query('SELECT count(*) FROM invite_codes');
    expect(after.rows).toEqual(before.rows);
  });
});

describe('password hashing', () => {
  it('stores argon2id and upgrades a legacy bcrypt hash on the first successful login', async () => {
    const ivan = { email: 'ivan@demo.bg', realm: 'demo' };
    const storedHash = async () =>
      (await db.query(`SELECT password_hash FROM users WHERE email = 'ivan@demo.bg'`)).rows[0]
        .password_hash;
    try {
      // An account hashed before the argon2id switch, planted directly in the DB.
      await db.query(`UPDATE users SET password_hash = $1 WHERE email = 'ivan@demo.bg'`, [
        await bcrypt.hash('legacy-password', 4),
      ]);

      expect((await post('/auth/login', { ...ivan, password: 'nope' })).status).toBe(401);
      expect((await post('/auth/login', { ...ivan, password: 'legacy-password' })).status).toBe(
        200,
      );
      expect((await storedHash()).startsWith('$argon2id$')).toBe(true);

      // The upgraded hash still verifies, and a wrong password still does not.
      expect((await post('/auth/login', { ...ivan, password: 'legacy-password' })).status).toBe(
        200,
      );
      expect((await post('/auth/login', { ...ivan, password: 'nope' })).status).toBe(401);
    } finally {
      // Restore the seeded password for the suites below.
      const argon2 = await import('argon2');
      await db.query(`UPDATE users SET password_hash = $1 WHERE email = 'ivan@demo.bg'`, [
        await argon2.hash('demo-owner', { type: argon2.argon2id }),
      ]);
    }
  });
});

describe('refresh rotation', () => {
  const loginIvan = () =>
    post('/auth/login', { email: 'ivan@demo.bg', password: 'demo-owner', realm: 'demo' });

  it('rotates tokens inside the same tenant, and reuse of a rotated token revokes the whole family', async () => {
    const login = await loginIvan();
    expect(login.status).toBe(200);
    const first = login.body.refreshToken;
    expect(first.startsWith(`t.${demoId}.`)).toBe(true);

    const rotated = await post('/auth/refresh', { refreshToken: first });
    expect(rotated.status).toBe(200);
    const second = rotated.body.refreshToken;
    expect(second).not.toBe(first);
    expect(decodeJwt(rotated.body.accessToken)).toMatchObject({ kind: 'tenant', tid: demoId });
    expect(rotated.body.memberships.map((m: { tenantKey: string }) => m.tenantKey)).toEqual([
      'demo',
    ]);

    // Replay of the already-rotated token → reuse detected.
    const replay = await post('/auth/refresh', { refreshToken: first });
    expect(replay.status).toBe(401);

    // Family revocation must also kill the newest token.
    const afterReplay = await post('/auth/refresh', { refreshToken: second });
    expect(afterReplay.status).toBe(401);
  });

  it('cannot be moved into another tenant by rewriting its prefix', async () => {
    const login = await loginIvan();
    const token: string = login.body.refreshToken;
    const moved = token.replace(`t.${demoId}.`, `t.${inovaId}.`);

    expect((await post('/auth/refresh', { refreshToken: moved })).status).toBe(401);
    // The attempt did not spend the real token.
    expect((await post('/auth/refresh', { refreshToken: token })).status).toBe(200);
  });

  it('rejects a token that names no owner (the pre-B8 shape)', async () => {
    const res = await post('/auth/refresh', { refreshToken: 'c'.repeat(64) });
    expect(res.status).toBe(401);
    expect((await post('/auth/logout', { refreshToken: 'c'.repeat(64) })).status).toBe(204);
  });

  it('stops refreshing once the account is suspended', async () => {
    const login = await loginIvan();
    try {
      await db.query(`UPDATE users SET status = 'suspended' WHERE email = 'ivan@demo.bg'`);
      const res = await post('/auth/refresh', { refreshToken: login.body.refreshToken });
      expect(res.status).toBe(401);
    } finally {
      await db.query(`UPDATE users SET status = 'active' WHERE email = 'ivan@demo.bg'`);
    }
  });

  it('logout revokes the refresh token', async () => {
    const login = await loginIvan();
    const token = login.body.refreshToken;
    const out = await post('/auth/logout', { refreshToken: token });
    expect(out.status).toBe(204);
    const reuse = await post('/auth/refresh', { refreshToken: token });
    expect(reuse.status).toBe(401);
  });
});

describe('access tokens', () => {
  it('rejects a token of the pre-B8 shape even when this service signed it', async () => {
    const { TokenService } = await import('../src/auth/token.service');
    const legacy = await app
      .get(TokenService)
      // A membership list and no `kind`: what the global-user model issued.
      .signAccessToken({ sub: 'u1', name: 'Legacy', memberships: [] } as never);
    expect((await get('/auth/me', legacy)).status).toBe(401);
  });
});
