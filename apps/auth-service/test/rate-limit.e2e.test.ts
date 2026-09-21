/**
 * Brute-force limit on credential endpoints, as deployed: behind one reverse
 * proxy that sets X-Forwarded-For. Regression for two defects — the limit was
 * disabled by a non-numeric env value, and without proxy trust every client
 * shared the proxy's address, i.e. one bucket.
 */
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDb } from './db-helper';

let app: NestExpressApplication;
let disposeDb: (() => Promise<void>) | undefined;

const login = (forwardedFor: string) =>
  request(app.getHttpServer())
    .post('/auth/login')
    .set('X-Forwarded-For', forwardedFor)
    .send({ email: 'nobody@inova.bg', password: 'wrong-password' });

beforeAll(async () => {
  const { appUrl, dispose } = await createTestDb('inova_test_auth_limit');
  disposeDb = dispose;
  process.env.AUTH_DATABASE_URL = appUrl;
  process.env.JWT_PRIVATE_KEY_PATH = path.join(
    mkdtempSync(path.join(tmpdir(), 'inova-jwt-')),
    'test.pem',
  );
  process.env.AUTH_THROTTLE_STRICT = '3';
  process.env.TRUST_PROXY_HOPS = '1';

  // Dynamic import so env vars above are read at module evaluation time.
  const { AppModule } = await import('../src/app.module');
  const { configureHttpApp } = await import('../src/http-app');
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication<NestExpressApplication>();
  configureHttpApp(app);
  await app.init();
});

afterAll(async () => {
  await app?.close();
  await disposeDb?.();
});

describe('strict rate limit behind a reverse proxy', () => {
  it('blocks one client after the configured number of attempts', async () => {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      expect((await login('203.0.113.10')).status).toBe(401);
    }
    expect((await login('203.0.113.10')).status).toBe(429);
  });

  it('keeps a separate budget for another client', async () => {
    expect((await login('203.0.113.20')).status).toBe(401);
  });

  it('ignores addresses a client prepends to X-Forwarded-For', async () => {
    // The proxy appends the address it saw; only that last hop is trusted.
    expect((await login('198.51.100.1, 203.0.113.10')).status).toBe(429);
  });
});
