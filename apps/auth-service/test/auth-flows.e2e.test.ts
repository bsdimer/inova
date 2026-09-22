/**
 * Auth-flow suite: password login, invite-code activation (B7), refresh
 * rotation with reuse detection. Runs against a dedicated database with real
 * migrations, as the RLS-enforced app role.
 */
import type { INestApplication } from '@nestjs/common';
import { ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import bcrypt from 'bcryptjs';
import pg from 'pg';
import { createTestDb } from './db-helper';

let app: INestApplication;
let migratorUrl: string;
let disposeDb: () => Promise<void>;

const post = (url: string, body: object) =>
  request(app.getHttpServer()).post(url).send(body).set('content-type', 'application/json');

beforeAll(async () => {
  const { appUrl, migratorUrl: migrator, dispose } = await createTestDb('inova_test_auth');
  migratorUrl = migrator;
  disposeDb = dispose;
  process.env.AUTH_DATABASE_URL = appUrl;
  process.env.JWT_PRIVATE_KEY_PATH = path.join(
    mkdtempSync(path.join(tmpdir(), 'inova-jwt-')),
    'test.pem',
  );
  process.env.AUTH_THROTTLE_STRICT = '1000'; // throttling is not under test here

  // Dynamic import so env vars above are read at module evaluation time.
  const { AppModule } = await import('../src/app.module');
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.init();
});

afterAll(async () => {
  await app?.close();
  await disposeDb?.();
});

describe('password login', () => {
  it('returns tokens and membership claims for valid credentials', async () => {
    const res = await post('/auth/login', { email: 'maria@inova.bg', password: 'inova-owner' });
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeTruthy();
    expect(res.body.refreshToken).toBeTruthy();
    expect(res.body.memberships).toHaveLength(1);
    expect(res.body.memberships[0].r).toBe('admin');
    expect(res.body.memberships[0].tenantKey).toBe('inova');
  });

  it('rejects wrong passwords and unknown emails identically (401)', async () => {
    const wrong = await post('/auth/login', { email: 'maria@inova.bg', password: 'nope' });
    const unknown = await post('/auth/login', { email: 'ghost@inova.bg', password: 'nope' });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.body.message).toBe(unknown.body.message);
  });
});

describe('invite-code activation (B7)', () => {
  it('activates a manager-created account and returns a session', async () => {
    const res = await post('/auth/activate', { code: '482913' });
    expect(res.status).toBe(200);
    expect(res.body.user.fullName).toBe('Elena Petrova');
    expect(res.body.user.mustSetPassword).toBe(true);
    expect(res.body.memberships[0].r).toBe('resident');
  });

  it('rejects the same code a second time (single use)', async () => {
    const res = await post('/auth/activate', { code: '482913' });
    expect(res.status).toBe(401);
  });

  it('rejects unknown codes with the same error (no oracle)', async () => {
    const res = await post('/auth/activate', { code: '000000' });
    expect(res.status).toBe(401);
  });

  it('lets the activated user set a password via their access token', async () => {
    const session = await post('/auth/activate', { code: '735026' });
    expect(session.status).toBe(200);
    const res = await request(app.getHttpServer())
      .post('/auth/password')
      .set('Authorization', `Bearer ${session.body.accessToken}`)
      .send({ password: 'brand-new-password' });
    expect(res.status).toBe(204);

    const me = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${session.body.accessToken}`);
    expect(me.status).toBe(200);
    expect(me.body.user.mustSetPassword).toBe(false);
  });
});

describe('password hashing', () => {
  it('stores argon2id and upgrades a legacy bcrypt hash on the first successful login', async () => {
    // An account hashed before the argon2id switch, planted directly in the DB.
    const db = new pg.Client({ connectionString: migratorUrl });
    await db.connect();
    try {
      const legacy = await bcrypt.hash('legacy-password', 4);
      await db.query(`UPDATE users SET password_hash = $1 WHERE lower(email) = 'ivan@demo.bg'`, [
        legacy,
      ]);

      const wrong = await post('/auth/login', { email: 'ivan@demo.bg', password: 'nope' });
      expect(wrong.status).toBe(401);
      const ok = await post('/auth/login', { email: 'ivan@demo.bg', password: 'legacy-password' });
      expect(ok.status).toBe(200);

      const { rows } = await db.query(
        `SELECT password_hash FROM users WHERE lower(email) = 'ivan@demo.bg'`,
      );
      expect(rows[0].password_hash.startsWith('$argon2id$')).toBe(true);

      // The upgraded hash still verifies, and a wrong password still does not.
      expect(
        (await post('/auth/login', { email: 'ivan@demo.bg', password: 'legacy-password' })).status,
      ).toBe(200);
      expect((await post('/auth/login', { email: 'ivan@demo.bg', password: 'nope' })).status).toBe(
        401,
      );
    } finally {
      // Restore the seeded password for the suites below.
      const argon2 = await import('argon2');
      await db.query(`UPDATE users SET password_hash = $1 WHERE lower(email) = 'ivan@demo.bg'`, [
        await argon2.hash('demo-owner', { type: argon2.argon2id }),
      ]);
      await db.end();
    }
  });
});

describe('refresh rotation', () => {
  it('rotates tokens, and reuse of a rotated token revokes the whole family', async () => {
    const login = await post('/auth/login', { email: 'ivan@demo.bg', password: 'demo-owner' });
    expect(login.status).toBe(200);
    const first = login.body.refreshToken;

    const rotated = await post('/auth/refresh', { refreshToken: first });
    expect(rotated.status).toBe(200);
    const second = rotated.body.refreshToken;
    expect(second).not.toBe(first);

    // Replay of the already-rotated token → reuse detected.
    const replay = await post('/auth/refresh', { refreshToken: first });
    expect(replay.status).toBe(401);

    // Family revocation must also kill the newest token.
    const afterReplay = await post('/auth/refresh', { refreshToken: second });
    expect(afterReplay.status).toBe(401);
  });

  it('logout revokes the refresh token', async () => {
    const login = await post('/auth/login', { email: 'ivan@demo.bg', password: 'demo-owner' });
    const token = login.body.refreshToken;
    const out = await post('/auth/logout', { refreshToken: token });
    expect(out.status).toBe(204);
    const reuse = await post('/auth/refresh', { refreshToken: token });
    expect(reuse.status).toBe(401);
  });
});
