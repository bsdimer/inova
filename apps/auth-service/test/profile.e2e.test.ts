/**
 * The signed-in person's own account (WHI-128): name and salutation, password
 * change with the current password and every other session ended, e-mail
 * change confirmed by a code sent to the new address. Real migrations, the
 * RLS-enforced auth role.
 */
import type { INestApplication } from '@nestjs/common';
import { ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { MockCodeDelivery } from '@inova/shared';
import argon2 from 'argon2';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import pg from 'pg';
import request from 'supertest';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type MockInstance,
} from 'vitest';
import { createTestDb } from './db-helper';

let app: INestApplication;
let db: pg.Client;
let disposeDb: () => Promise<void>;
let inovaId: string;
let delivered: MockInstance<MockCodeDelivery['deliver']>;

const http = () => request(app.getHttpServer());
const post = (url: string, body: object, token?: string) => {
  const req = http().post(url).send(body);
  return token ? req.set('Authorization', `Bearer ${token}`) : req;
};
const patch = (url: string, body: object, token: string) =>
  http().patch(url).set('Authorization', `Bearer ${token}`).send(body);
const lastCode = (): string => delivered.mock.calls.at(-1)![2];

let counter = 0;
/** An active resident with a password; returns a fresh session of theirs. */
async function signedIn(password = 'old-password', email: string | null = null) {
  counter += 1;
  const phone = `+35988160${String(counter).padStart(4, '0')}`;
  await db.query(
    `INSERT INTO users (tenant_id, phone, email, salutation, first_name, last_name, password_hash, status)
     VALUES ($1, $2, $3, 'mr', 'Стар', 'Профил', $4, 'active')`,
    [inovaId, phone, email, await argon2.hash(password, { type: argon2.argon2id })],
  );
  const res = await post('/auth/login', { phone, password, realm: 'inova' });
  expect(res.status).toBe(200);
  return {
    phone,
    session: res.body as { accessToken: string; refreshToken: string; user: { id: string } },
  };
}

const auditOf = async (accountId: string) =>
  (
    await db.query(
      `SELECT action, payload FROM audit_records WHERE tenant_id = $1 AND entity_id = $2 ORDER BY created_at`,
      [inovaId, accountId],
    )
  ).rows;

beforeAll(async () => {
  const testDb = await createTestDb('inova_test_profile');
  disposeDb = testDb.dispose;
  process.env.AUTH_DATABASE_URL = testDb.appUrl;
  process.env.JWT_PRIVATE_KEY_PATH = path.join(
    mkdtempSync(path.join(tmpdir(), 'inova-jwt-')),
    'test.pem',
  );
  process.env.AUTH_THROTTLE_STRICT = '1000'; // throttling is not under test here
  process.env.AUTH_DEFAULT_REALM = 'inova';

  const { AppModule } = await import('../src/app.module');
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.listen(0);
  delivered = vi.spyOn(app.get(MockCodeDelivery), 'deliver');

  db = new pg.Client({ connectionString: testDb.migratorUrl });
  await db.connect();
  inovaId = (await db.query(`SELECT id FROM tenants WHERE key = 'inova'`)).rows[0].id;
});

beforeEach(() => {
  // A block, not an expression: vitest runs a function returned here as a cleanup hook.
  delivered.mockClear();
});

afterAll(async () => {
  await app?.close();
  await db?.end();
  await disposeDb?.();
});

describe('name and salutation', () => {
  it('changes them, shows them in the profile and the next session, and audits the change', async () => {
    const { phone, session } = await signedIn();
    const res = await patch(
      '/auth/me',
      { salutation: 'mrs', firstName: ' Нова ', lastName: 'Фамилия' },
      session.accessToken,
    );
    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({
      salutation: 'mrs',
      firstName: 'Нова',
      lastName: 'Фамилия',
      fullName: 'Нова Фамилия',
    });

    const again = await post('/auth/login', { phone, password: 'old-password', realm: 'inova' });
    expect(again.body.user.fullName).toBe('Нова Фамилия');

    expect(await auditOf(session.user.id)).toEqual([
      {
        action: 'account.profile_updated',
        payload: {
          from: { salutation: 'mr', firstName: 'Стар', lastName: 'Профил' },
          to: { salutation: 'mrs', firstName: 'Нова', lastName: 'Фамилия' },
        },
      },
    ]);
  });

  it('clears the salutation with null, keeps a one-word name, and writes nothing for an empty change', async () => {
    const { session } = await signedIn();
    const res = await patch('/auth/me', { salutation: null, lastName: '' }, session.accessToken);
    expect(res.body.user).toMatchObject({ salutation: null, lastName: '', fullName: 'Стар' });
    expect((await patch('/auth/me', {}, session.accessToken)).status).toBe(200);
    expect(await auditOf(session.user.id)).toHaveLength(1);
  });

  it('refuses bad input (400), no token (401) and a platform identity (403)', async () => {
    const { session } = await signedIn();
    expect((await patch('/auth/me', { salutation: 'dr' }, session.accessToken)).status).toBe(400);
    expect((await patch('/auth/me', { firstName: '' }, session.accessToken)).status).toBe(400);
    expect((await http().patch('/auth/me').send({ firstName: 'X' })).status).toBe(401);
    const platform = await post('/auth/login', {
      email: 'admin@inova.bg',
      password: 'inova-admin',
    });
    expect((await patch('/auth/me', { firstName: 'X' }, platform.body.accessToken)).status).toBe(
      403,
    );
  });
});

describe('password', () => {
  it('needs the current password once there is one, and ends every other session', async () => {
    const { phone, session } = await signedIn();
    const otherPhone = await post('/auth/login', {
      phone,
      password: 'old-password',
      realm: 'inova',
    });

    const without = await post(
      '/auth/password',
      { password: 'new-password-1' },
      session.accessToken,
    );
    const wrong = await post(
      '/auth/password',
      { password: 'new-password-1', currentPassword: 'nope' },
      session.accessToken,
    );
    expect([without.status, wrong.status]).toEqual([403, 403]);
    expect(
      (await post('/auth/login', { phone, password: 'old-password', realm: 'inova' })).status,
    ).toBe(200);

    const changed = await post(
      '/auth/password',
      { password: 'new-password-1', currentPassword: 'old-password' },
      session.accessToken,
    );
    expect(changed.status).toBe(200);
    expect(changed.body.user.mustSetPassword).toBe(false);

    // The other phone and this one's old refresh token are signed out; the new pair works.
    expect(
      (await post('/auth/refresh', { refreshToken: otherPhone.body.refreshToken })).status,
    ).toBe(401);
    expect((await post('/auth/refresh', { refreshToken: session.refreshToken })).status).toBe(401);
    expect((await post('/auth/refresh', { refreshToken: changed.body.refreshToken })).status).toBe(
      200,
    );
    expect(
      (await post('/auth/login', { phone, password: 'old-password', realm: 'inova' })).status,
    ).toBe(401);
    expect(
      (await post('/auth/login', { phone, password: 'new-password-1', realm: 'inova' })).status,
    ).toBe(200);
    expect((await auditOf(session.user.id)).map((r) => r.action)).toEqual([
      'account.password_changed',
    ]);
  });

  it('changes a platform operator’s password the same way', async () => {
    const platform = await post('/auth/login', {
      email: 'admin@inova.bg',
      password: 'inova-admin',
    });
    try {
      const changed = await post(
        '/auth/password',
        { password: 'platform-new-1', currentPassword: 'inova-admin' },
        platform.body.accessToken,
      );
      expect(changed.status).toBe(200);
      expect(
        (await post('/auth/refresh', { refreshToken: platform.body.refreshToken })).status,
      ).toBe(401);
      expect(
        (await post('/auth/login', { email: 'admin@inova.bg', password: 'platform-new-1' })).status,
      ).toBe(200);
    } finally {
      await db.query(
        `UPDATE platform_users SET password_hash = $1 WHERE email = 'admin@inova.bg'`,
        [await argon2.hash('inova-admin', { type: argon2.argon2id })],
      );
    }
  });

  it('refuses a new password shorter than eight characters (400)', async () => {
    const { session } = await signedIn();
    const res = await post(
      '/auth/password',
      { password: 'short', currentPassword: 'old-password' },
      session.accessToken,
    );
    expect(res.status).toBe(400);
  });
});

describe('e-mail', () => {
  it('takes effect only after the code from the new address, then signs in with it', async () => {
    const { session } = await signedIn('old-password', 'old@example.bg');
    const started = await post(
      '/auth/me/email',
      { email: 'New@Example.bg', password: 'old-password' },
      session.accessToken,
    );
    expect(started.status).toBe(202);
    expect(started.body).toEqual({ status: 'ok', email: 'new@example.bg', expiresInMinutes: 10 });
    expect(delivered.mock.calls.at(-1)![1]).toBe('new@example.bg');

    // Not yet: the old address still signs in, the new one does not.
    expect(
      (
        await post('/auth/login', {
          email: 'old@example.bg',
          password: 'old-password',
          realm: 'inova',
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await post('/auth/login', {
          email: 'new@example.bg',
          password: 'old-password',
          realm: 'inova',
        })
      ).status,
    ).toBe(401);

    const confirmed = await post(
      '/auth/me/email/confirm',
      { code: lastCode() },
      session.accessToken,
    );
    expect(confirmed.status).toBe(200);
    expect(confirmed.body.user.email).toBe('new@example.bg');
    expect(
      (
        await post('/auth/login', {
          email: 'new@example.bg',
          password: 'old-password',
          realm: 'inova',
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await post('/auth/login', {
          email: 'old@example.bg',
          password: 'old-password',
          realm: 'inova',
        })
      ).status,
    ).toBe(401);
    expect(await auditOf(session.user.id)).toEqual([
      {
        action: 'account.email_changed',
        payload: { from: 'old@example.bg', to: 'new@example.bg' },
      },
    ]);
    // Used once.
    expect(
      (await post('/auth/me/email/confirm', { code: lastCode() }, session.accessToken)).status,
    ).toBe(400);
  });

  it('cancels the code after five wrong tries: the sixth fails even with the right code', async () => {
    const { session } = await signedIn();
    await post(
      '/auth/me/email',
      { email: 'guess@example.bg', password: 'old-password' },
      session.accessToken,
    );
    const code = lastCode();
    const wrong = code === '000000' ? '111111' : '000000';
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      const res = await post('/auth/me/email/confirm', { code: wrong }, session.accessToken);
      expect(res.body).toEqual({
        statusCode: 400,
        message: 'Invalid or expired code',
        error: 'Bad Request',
      });
    }
    expect((await post('/auth/me/email/confirm', { code }, session.accessToken)).status).toBe(400);
    const { rows } = await db.query(`SELECT email FROM users WHERE id = $1`, [session.user.id]);
    expect(rows[0].email).toBeNull();
  });

  it('refuses an expired code, and lets a new request replace the old one', async () => {
    const { session } = await signedIn();
    await post(
      '/auth/me/email',
      { email: 'first@example.bg', password: 'old-password' },
      session.accessToken,
    );
    const first = lastCode();
    await post(
      '/auth/me/email',
      { email: 'second@example.bg', password: 'old-password' },
      session.accessToken,
    );
    const second = lastCode();
    if (first !== second) {
      expect(
        (await post('/auth/me/email/confirm', { code: first }, session.accessToken)).status,
      ).toBe(400);
    }
    await db.query(
      `UPDATE email_changes SET expires_at = now() - interval '1 second' WHERE user_id = $1 AND status = 'active'`,
      [session.user.id],
    );
    expect(
      (await post('/auth/me/email/confirm', { code: second }, session.accessToken)).status,
    ).toBe(400);
    const { rows } = await db.query(
      `SELECT status FROM email_changes WHERE user_id = $1 ORDER BY created_at`,
      [session.user.id],
    );
    expect(rows.map((r) => r.status)).toEqual(['voided', 'expired']);
  });

  it('needs the current password, a new address, and one no other account of the organisation uses', async () => {
    const { session } = await signedIn('old-password', 'mine@example.bg');
    const start = (body: object) => post('/auth/me/email', body, session.accessToken);
    expect((await start({ email: 'x@example.bg', password: 'nope' })).status).toBe(403);
    expect((await start({ email: 'MINE@example.bg', password: 'old-password' })).status).toBe(400);
    // Мария Иванова of inova already uses it.
    expect((await start({ email: 'maria@inova.bg', password: 'old-password' })).status).toBe(409);
    expect((await start({ email: 'not-an-email', password: 'old-password' })).status).toBe(400);
    expect(delivered).not.toHaveBeenCalled();
  });

  it('allows an address another organisation’s account uses (B8)', async () => {
    const { session } = await signedIn();
    // ivan@demo.bg exists in demo only.
    const res = await post(
      '/auth/me/email',
      { email: 'ivan@demo.bg', password: 'old-password' },
      session.accessToken,
    );
    expect(res.status).toBe(202);
  });

  it('refuses a platform identity (403)', async () => {
    const platform = await post('/auth/login', {
      email: 'admin@inova.bg',
      password: 'inova-admin',
    });
    const res = await post(
      '/auth/me/email',
      { email: 'p@example.bg', password: 'inova-admin' },
      platform.body.accessToken,
    );
    expect(res.status).toBe(403);
  });
});
