/**
 * Password recovery (decision B13) — RELEASE BLOCKER with the other auth
 * suites: by e-mail link and by phone code, inside one realm; single-use;
 * expiring; five wrong codes void the code; the same answer whether or not the
 * account exists here or in another realm; a reset ends every session and is
 * audited. Runs against real migrations as the RLS-enforced auth role.
 */
import type { INestApplication } from '@nestjs/common';
import { ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { DeliveryJob } from '@inova/shared';
import argon2 from 'argon2';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import pg from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestDb } from './db-helper';

let app: INestApplication;
let db: pg.Client;
let disposeDb: () => Promise<void>;
let inovaId: string;
let demoId: string;
/** The delivery queue, replaced at its boundary: what a person would be sent. */
const delivered = vi.fn(async (_job: DeliveryJob) => undefined);

const post = (url: string, body: object) =>
  request(app.getHttpServer()).post(url).send(body).set('content-type', 'application/json');

const INVALID = {
  statusCode: 401,
  message: 'Invalid or expired link or code',
  error: 'Unauthorized',
};

/** The link or code the last request sent — what the person would receive. */
const lastSecret = (): string => delivered.mock.calls.at(-1)![0].secret;

const login = (email: string, password: string, realm: string) =>
  post('/auth/login', { email, password, realm });

/** An active account with a password, planted directly in the database. */
async function account(
  tenantId: string,
  contact: { email: string; phone?: string },
  password: string,
): Promise<string> {
  const { rows } = await db.query(
    `INSERT INTO users (tenant_id, email, phone, first_name, password_hash, status)
     VALUES ($1, $2, $3, 'Recovering', $4, 'active') RETURNING id`,
    [
      tenantId,
      contact.email,
      contact.phone ?? null,
      await argon2.hash(password, { type: argon2.argon2id }),
    ],
  );
  await db.query(
    `INSERT INTO staff_memberships (tenant_id, user_id, role_key, status) VALUES ($1, $2, 'resident', 'active')`,
    [tenantId, rows[0].id],
  );
  return rows[0].id;
}

const resetsOf = async (accountId: string) =>
  (
    await db.query(
      `SELECT channel, status, attempts FROM password_resets WHERE user_id = $1 ORDER BY created_at`,
      [accountId],
    )
  ).rows;

beforeAll(async () => {
  const testDb = await createTestDb('inova_test_recovery');
  disposeDb = testDb.dispose;
  process.env.AUTH_DATABASE_URL = testDb.appUrl;
  process.env.JWT_PRIVATE_KEY_PATH = path.join(
    mkdtempSync(path.join(tmpdir(), 'inova-jwt-')),
    'test.pem',
  );
  process.env.AUTH_THROTTLE_STRICT = '1000'; // throttling is not under test here
  process.env.AUTH_DEFAULT_REALM = 'inova';
  process.env.RECOVERY_LINK_TTL_MINUTES = '30';

  const { AppModule } = await import('../src/app.module');
  const { DeliveryJobs } = await import('../src/delivery/delivery-jobs');
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(DeliveryJobs)
    .useValue({ add: delivered })
    .compile();
  app = moduleRef.createNestApplication();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  // Listen once: on a server that is not listening, supertest binds a fresh
  // ephemeral port for every request.
  await app.listen(0);

  db = new pg.Client({ connectionString: testDb.migratorUrl });
  await db.connect();
  const tenants = await db.query('SELECT id, key FROM tenants');
  inovaId = tenants.rows.find((r) => r.key === 'inova').id;
  demoId = tenants.rows.find((r) => r.key === 'demo').id;
});

beforeEach(() => {
  delivered.mockClear();
});

afterAll(async () => {
  await app?.close();
  await db?.end();
  await disposeDb?.();
});

describe('recovery by e-mail link', () => {
  it('sets a new password, ends every session and is audited', async () => {
    const id = await account(inovaId, { email: 'link@inova.bg' }, 'old-password');
    const before = await login('link@inova.bg', 'old-password', 'inova');
    expect(before.status).toBe(200);

    const asked = await post('/auth/recovery', { email: 'LINK@inova.bg', realm: 'inova' });
    expect(asked.status).toBe(202);
    expect(asked.body).toEqual({ status: 'ok', channel: 'email', expiresInMinutes: 30 });
    expect(delivered).toHaveBeenCalledTimes(1);
    const token = lastSecret();
    expect(token.startsWith(`r.${inovaId}.`)).toBe(true);
    // Recorded for the worker under the realm, to the account's own address.
    const { deliveryId, tenantId } = delivered.mock.calls.at(-1)![0];
    expect(tenantId).toBe(inovaId);
    const [delivery] = (
      await db.query(
        'SELECT tenant_id, purpose, channel, recipient FROM message_deliveries WHERE id = $1',
        [deliveryId],
      )
    ).rows;
    expect(delivery).toEqual({
      tenant_id: inovaId,
      purpose: 'recovery_link',
      channel: 'email',
      recipient: 'link@inova.bg',
    });

    const done = await post('/auth/recovery/confirm', { token, password: 'new-password-1' });
    expect(done.status).toBe(204);

    expect((await login('link@inova.bg', 'new-password-1', 'inova')).status).toBe(200);
    expect((await login('link@inova.bg', 'old-password', 'inova')).status).toBe(401);
    // The session opened with the old password is over.
    expect((await post('/auth/refresh', { refreshToken: before.body.refreshToken })).status).toBe(
      401,
    );

    const audit = await db.query(
      `SELECT actor_user_id, action, payload FROM audit_records WHERE tenant_id = $1 AND entity_id = $2`,
      [inovaId, id],
    );
    expect(audit.rows).toEqual([
      { actor_user_id: id, action: 'password.reset', payload: { channel: 'email' } },
    ]);
    expect(await resetsOf(id)).toEqual([{ channel: 'email', status: 'consumed', attempts: 0 }]);
  });

  it('refuses a used link, an expired link, a replaced link and a rewritten one', async () => {
    const id = await account(inovaId, { email: 'once@inova.bg' }, 'old-password');
    await post('/auth/recovery', { email: 'once@inova.bg' });
    const used = lastSecret();
    expect(
      (await post('/auth/recovery/confirm', { token: used, password: 'new-password-1' })).status,
    ).toBe(204);
    const again = await post('/auth/recovery/confirm', { token: used, password: 'new-password-2' });
    expect(again.status).toBe(401);
    expect(again.body).toEqual(INVALID);

    await post('/auth/recovery', { email: 'once@inova.bg' });
    const lapsed = lastSecret();
    await db.query(
      `UPDATE password_resets SET expires_at = now() - interval '1 second' WHERE user_id = $1 AND status = 'active'`,
      [id],
    );
    expect(
      (await post('/auth/recovery/confirm', { token: lapsed, password: 'new-password-3' })).body,
    ).toEqual(INVALID);

    await post('/auth/recovery', { email: 'once@inova.bg' });
    const first = lastSecret();
    await post('/auth/recovery', { email: 'once@inova.bg' });
    const second = lastSecret();
    expect(
      (await post('/auth/recovery/confirm', { token: first, password: 'new-password-4' })).body,
    ).toEqual(INVALID);
    // The same secret under another tenant's prefix is not a link of that tenant.
    const moved = second.replace(`r.${inovaId}.`, `r.${demoId}.`);
    expect(
      (await post('/auth/recovery/confirm', { token: moved, password: 'new-password-5' })).body,
    ).toEqual(INVALID);
    expect(
      (await post('/auth/recovery/confirm', { token: second, password: 'new-password-6' })).status,
    ).toBe(204);

    expect((await resetsOf(id)).map((r) => r.status)).toEqual([
      'consumed',
      'expired',
      'voided',
      'consumed',
    ]);
    expect((await login('once@inova.bg', 'new-password-6', 'inova')).status).toBe(200);
  });
});

describe('recovery by phone code', () => {
  it('sets a new password with the phone and the code', async () => {
    const id = await account(
      inovaId,
      { email: 'sms@inova.bg', phone: '+359881300001' },
      'old-password',
    );
    const asked = await post('/auth/recovery', { phone: '+359881300001', realm: 'inova' });
    expect(asked.body).toEqual({ status: 'ok', channel: 'phone', expiresInMinutes: 10 });
    const code = lastSecret();
    expect(code).toMatch(/^\d{6}$/);

    const done = await post('/auth/recovery/confirm', {
      phone: '+359881300001',
      code,
      password: 'new-password-1',
      realm: 'inova',
    });
    expect(done.status).toBe(204);
    expect((await login('sms@inova.bg', 'new-password-1', 'inova')).status).toBe(200);
    expect(await resetsOf(id)).toEqual([{ channel: 'phone', status: 'consumed', attempts: 0 }]);
  });

  it('voids the code after five wrong tries: the sixth fails even with the right code', async () => {
    const id = await account(
      inovaId,
      { email: 'guess@inova.bg', phone: '+359881300002' },
      'old-password',
    );
    await post('/auth/recovery', { phone: '+359881300002' });
    const code = lastSecret();
    const wrong = code === '000000' ? '111111' : '000000';

    for (let attempt = 1; attempt <= 5; attempt += 1) {
      const res = await post('/auth/recovery/confirm', {
        phone: '+359881300002',
        code: wrong,
        password: 'new-password-1',
      });
      expect(res.body).toEqual(INVALID);
    }
    expect(await resetsOf(id)).toEqual([{ channel: 'phone', status: 'voided', attempts: 5 }]);
    const sixth = await post('/auth/recovery/confirm', {
      phone: '+359881300002',
      code,
      password: 'new-password-1',
    });
    expect(sixth.body).toEqual(INVALID);
    expect((await login('guess@inova.bg', 'old-password', 'inova')).status).toBe(200);
  });

  it('refuses an expired code and a code asked for in another realm', async () => {
    const id = await account(
      inovaId,
      { email: 'late@inova.bg', phone: '+359881300003' },
      'old-password',
    );
    await post('/auth/recovery', { phone: '+359881300003' });
    const code = lastSecret();
    // Not in demo: the right code, the right phone, the wrong realm.
    const elsewhere = await post('/auth/recovery/confirm', {
      phone: '+359881300003',
      code,
      password: 'new-password-1',
      realm: 'demo',
    });
    expect(elsewhere.body).toEqual(INVALID);

    await db.query(
      `UPDATE password_resets SET expires_at = now() - interval '1 second' WHERE user_id = $1`,
      [id],
    );
    const late = await post('/auth/recovery/confirm', {
      phone: '+359881300003',
      code,
      password: 'new-password-1',
    });
    expect(late.body).toEqual(INVALID);
    expect(await resetsOf(id)).toEqual([{ channel: 'phone', status: 'expired', attempts: 0 }]);
  });
});

describe('no answer tells whether an account exists (B8, B13)', () => {
  it('answers alike and sends nothing for an unknown, another-realm, pending or suspended account', async () => {
    await account(inovaId, { email: 'suspended@inova.bg' }, 'old-password');
    await db.query(`UPDATE users SET status = 'suspended' WHERE email = 'suspended@inova.bg'`);

    const known = await post('/auth/recovery', { email: 'maria@inova.bg', realm: 'inova' });
    expect(delivered).toHaveBeenCalledTimes(1);
    delivered.mockClear();

    const others = await Promise.all([
      post('/auth/recovery', { email: 'ghost@inova.bg', realm: 'inova' }),
      // Ivan exists in demo only.
      post('/auth/recovery', { email: 'ivan@demo.bg', realm: 'inova' }),
      post('/auth/recovery', { email: 'maria@inova.bg', realm: 'no-such-org' }),
      post('/auth/recovery', { email: 'suspended@inova.bg' }),
      // The platform administrator is no tenant account (platform recovery is separate).
      post('/auth/recovery', { email: 'admin@inova.bg' }),
    ]);
    for (const res of others) {
      expect(res.status).toBe(202);
      expect(res.body).toEqual(known.body);
    }
    // Elena is invited but not activated: she activates with her code instead.
    const pending = await post('/auth/recovery', { phone: '+359881000001', realm: 'inova' });
    expect(pending.status).toBe(202);
    expect(delivered).not.toHaveBeenCalled();
    // Nothing deliverable was even recorded for them.
    const recorded = await db.query(
      `SELECT count(*)::int AS n FROM message_deliveries
       WHERE recipient IN ('ghost@inova.bg', 'ivan@demo.bg', 'suspended@inova.bg', 'admin@inova.bg', '+359881000001')`,
    );
    expect(recorded.rows[0].n).toBe(0);
  });

  it('recovers only the account of the requested realm when the e-mail is in both', async () => {
    await post('/auth/recovery', { email: 'maria@inova.bg', realm: 'demo' });
    const token = lastSecret();
    expect(token.startsWith(`r.${demoId}.`)).toBe(true);
    expect(
      (await post('/auth/recovery/confirm', { token, password: 'demo-maria-new' })).status,
    ).toBe(204);

    expect((await login('maria@inova.bg', 'demo-maria-new', 'demo')).status).toBe(200);
    // The inova account with the same e-mail keeps its password.
    expect((await login('maria@inova.bg', 'inova-owner', 'inova')).status).toBe(200);
    expect((await login('maria@inova.bg', 'demo-maria-new', 'inova')).status).toBe(401);
  });
});

describe('RLS on password resets (inova_auth)', () => {
  it('shows no reset without a tenant context and none of another tenant inside one', async () => {
    const id = await account(inovaId, { email: 'rls@inova.bg' }, 'old-password');
    await post('/auth/recovery', { email: 'rls@inova.bg' });

    const auth = new pg.Client({ connectionString: process.env.AUTH_DATABASE_URL });
    await auth.connect();
    const resetOf = `SELECT 1 FROM password_resets WHERE user_id = $1`;
    try {
      expect((await auth.query('SELECT 1 FROM password_resets')).rows).toHaveLength(0);
      await auth.query('BEGIN');
      await auth.query(`SELECT set_config('app.tenant_id', $1, true)`, [demoId]);
      expect((await auth.query(resetOf, [id])).rows).toHaveLength(0);
      await auth.query(`SELECT set_config('app.tenant_id', $1, true)`, [inovaId]);
      expect((await auth.query(resetOf, [id])).rows).toHaveLength(1);
      await auth.query('ROLLBACK');
    } finally {
      await auth.end();
    }
  });
});

describe('invalid input (400)', () => {
  it.each([
    ['both an e-mail and a phone', { email: 'a@inova.bg', phone: '+359881300009' }],
    ['neither', {}],
    ['a malformed e-mail', { email: 'not-an-email' }],
    ['a phone not in E.164', { phone: '0881300009' }],
  ])('refuses a request with %s', async (_case, body) => {
    expect((await post('/auth/recovery', body)).status).toBe(400);
  });

  it.each([
    [
      'a token and a phone',
      { token: `r.${'0'.repeat(36)}.${'x'.repeat(43)}`, phone: '+359881300009' },
    ],
    ['a phone without the code', { phone: '+359881300009' }],
    ['nothing to prove', {}],
    ['a code of five digits', { phone: '+359881300009', code: '12345' }],
  ])('refuses a confirmation with %s', async (_case, body) => {
    expect(
      (await post('/auth/recovery/confirm', { password: 'new-password-1', ...body })).status,
    ).toBe(400);
  });

  it('refuses a new password shorter than eight characters', async () => {
    const res = await post('/auth/recovery/confirm', {
      phone: '+359881300009',
      code: '123456',
      password: 'short',
    });
    expect(res.status).toBe(400);
  });
});

describe('the page the recovery link opens (WHI-150)', () => {
  it('is one static page for everyone: the token stays in the fragment, the script under a nonce', async () => {
    const res = await request(app.getHttpServer()).get('/auth/reset');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/^text\/html/);
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.headers['referrer-policy']).toBe('no-referrer');

    const csp = res.headers['content-security-policy'] as string;
    const nonce = /script-src 'nonce-([^']+)'/.exec(csp)?.[1];
    expect(nonce).toBeDefined();
    expect(csp).toContain("connect-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(res.text).toContain(`<script nonce="${nonce}">`);
    // The token is read from location.hash and posted to the confirm route next to it.
    expect(res.text).toContain('location.hash');
    expect(res.text).toContain("fetch('recovery/confirm'");
    expect(res.text).toContain("'inova://reset?token='");

    // A fresh nonce per response.
    const again = await request(app.getHttpServer()).get('/auth/reset');
    expect(again.headers['content-security-policy']).not.toBe(csp);
  });
});
