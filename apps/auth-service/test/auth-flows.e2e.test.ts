/**
 * Auth-flow suite — RELEASE BLOCKER: password login, invite-code activation
 * (B7), refresh rotation with reuse detection, and the tenant-scoped account
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

describe('invite-code activation (B7)', () => {
  it("does not accept another realm's code", async () => {
    // 735026 is Georgi's code in demo; the default realm is inova.
    const res = await post('/auth/activate', { code: '735026' });
    expect(res.status).toBe(401);
    const { rows } = await db.query(
      `SELECT consumed_at FROM invite_codes WHERE tenant_id = $1 AND code_hash = $2`,
      [demoId, sha256('735026')],
    );
    expect(rows[0].consumed_at).toBeNull();
  });

  it('activates only the account of the requested realm when two realms hold the same code', async () => {
    // A second pending account in demo with Elena's phone and Elena's code.
    const twinId = (
      await db.query(
        `INSERT INTO users (tenant_id, phone, first_name, last_name, status)
         VALUES ($1, '+359881000001', 'Елена', 'Двойник', 'pending') RETURNING id`,
        [demoId],
      )
    ).rows[0].id;
    await db.query(
      `INSERT INTO invite_codes (tenant_id, user_id, code_hash, channel, phone, expires_at)
       VALUES ($1, $2, $3, 'sms', '+359881000001', now() + interval '30 days')`,
      [demoId, twinId, sha256('482913')],
    );

    const res = await post('/auth/activate', { code: '482913', realm: 'inova' });
    expect(res.status).toBe(200);
    expect(res.body.user.fullName).toBe('Елена Петрова');
    expect(res.body.user.mustSetPassword).toBe(true);
    expect(res.body.memberships).toEqual([
      { t: inovaId, r: 'resident', tenantKey: 'inova', tenantName: 'WhiteNova Technology' },
    ]);
    expect(decodeJwt(res.body.accessToken)).toMatchObject({ tid: inovaId, roles: ['resident'] });

    const twin = await db.query(
      `SELECT u.status, c.consumed_at FROM users u
       JOIN invite_codes c ON c.tenant_id = u.tenant_id AND c.user_id = u.id
       WHERE u.tenant_id = $1 AND u.id = $2`,
      [demoId, twinId],
    );
    expect(twin.rows).toEqual([{ status: 'pending', consumed_at: null }]);

    // The demo twin activates with the same digits, in its own realm.
    const demo = await post('/auth/activate', { code: '482913', realm: 'demo' });
    expect(demo.status).toBe(200);
    expect(demo.body.user.id).toBe(twinId);
    expect(decodeJwt(demo.body.accessToken).tid).toBe(demoId);
  });

  it('rejects the same code a second time (single use)', async () => {
    const res = await post('/auth/activate', { code: '482913' });
    expect(res.status).toBe(401);
  });

  it('rejects unknown codes and unknown realms with the same error (no oracle)', async () => {
    const unknownCode = await post('/auth/activate', { code: '000000' });
    const unknownRealm = await post('/auth/activate', { code: '735026', realm: 'no-such-org' });
    expect(unknownCode.status).toBe(401);
    expect(unknownRealm.status).toBe(401);
    expect(unknownRealm.body).toEqual(unknownCode.body);
  });

  it('lets the activated user set a password via their access token', async () => {
    const session = await post('/auth/activate', { code: '735026', realm: 'demo' });
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

describe('resend-code', () => {
  it('replaces the code only inside the requested realm and answers the same either way', async () => {
    const pendingId = (
      await db.query(
        `INSERT INTO users (tenant_id, phone, first_name, status)
         VALUES ($1, '+359881777001', 'Pending', 'pending') RETURNING id`,
        [inovaId],
      )
    ).rows[0].id;
    await db.query(
      `INSERT INTO invite_codes (tenant_id, user_id, code_hash, channel, phone, expires_at)
       VALUES ($1, $2, $3, 'sms', '+359881777001', now() + interval '30 days')`,
      [inovaId, pendingId, sha256('111111')],
    );
    const codeHash = async () =>
      (
        await db.query(`SELECT code_hash FROM invite_codes WHERE tenant_id = $1 AND user_id = $2`, [
          inovaId,
          pendingId,
        ])
      ).rows[0].code_hash;

    // The phone is unknown in demo: nothing changes, and the answer does not say so.
    const elsewhere = await post('/auth/resend-code', { phone: '+359881777001', realm: 'demo' });
    expect(elsewhere.status).toBe(202);
    expect(await codeHash()).toBe(sha256('111111'));

    const here = await post('/auth/resend-code', { phone: '+359881777001', realm: 'inova' });
    expect(here.status).toBe(202);
    expect(here.body).toEqual(elsewhere.body);
    expect(await codeHash()).not.toBe(sha256('111111'));
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
