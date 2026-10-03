import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { JWT_AUDIENCE, JWT_ISSUER, type DeliveryJob } from '@inova/shared';
import { SignJWT, calculateJwkThumbprint, exportJWK, generateKeyPair } from 'jose';
import pg from 'pg';
import request from 'supertest';
import { resetJwksCache } from '../src/auth/jwt.guard';
import { createTestDb } from './db-helper';

export interface TestApp {
  app: NestExpressApplication;
  /** Privileged connection: fixtures and assertions across tenants. */
  adminPool: pg.Pool;
  /** The privileged URL of the test database — to rerun the seed against it. */
  migratorUrl: string;
  /** Tenant ids by key, from the seed (`inova`, `demo`). */
  tenants: Record<string, string>;
  /** A tenant account's access token (decision B8: one tenant per token). */
  tenantToken(accountId: string, tenantId: string, role: string): Promise<string>;
  /** A platform super_admin's access token. */
  platformToken(platformUserId: string): Promise<string>;
  /** Requests as that token, with `X-Tenant-Id` set. */
  as(token: string, tenantId: string): Client;
  /** An active account with a membership, planted directly in the database. */
  account(tenantId: string, email: string, roleKey: string): Promise<string>;
  /** The delivery jobs queued so far — the queue is replaced at its boundary. */
  delivered: DeliveryJob[];
  dispose(): Promise<void>;
}

export interface Client {
  get(url: string): request.Test;
  post(url: string, body?: object): request.Test;
  patch(url: string, body?: object): request.Test;
  put(url: string, body?: object): request.Test;
  delete(url: string): request.Test;
}

/**
 * Boots core-api the way production does (same pipes and proxy settings) on a
 * fresh migrated and seeded database, with a local JWKS instead of a running
 * auth-service.
 */
export async function bootTestApp(dbPrefix: string): Promise<TestApp> {
  const { migratorUrl, appUrl, dispose: disposeDb } = await createTestDb(dbPrefix);
  process.env.DATABASE_URL = appUrl;

  const pair = await generateKeyPair('RS256');
  const jwk = await exportJWK(pair.publicKey);
  const kid = await calculateJwkThumbprint(jwk);
  process.env.AUTH_JWKS_JSON = JSON.stringify({ keys: [{ ...jwk, kid, alg: 'RS256' }] });
  resetJwksCache();

  // Dynamic import so the env vars above are read at module evaluation time.
  const { AppModule } = await import('../src/app.module');
  const { configureHttpApp } = await import('../src/http-app');
  // The delivery queue is Redis: recorded here instead of sent.
  const delivered: DeliveryJob[] = [];
  const { DeliveryJobs } = await import('../src/delivery/delivery-jobs');
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(DeliveryJobs)
    .useValue({ add: async (job: DeliveryJob) => void delivered.push(job) })
    .compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>();
  configureHttpApp(app);
  // Listen once: on a server that is not listening, supertest binds a fresh
  // ephemeral port for every request.
  await app.listen(0);

  const adminPool = new pg.Pool({ connectionString: migratorUrl, max: 2 });
  const tenantRows = await adminPool.query('SELECT id, key FROM tenants');
  const tenants = Object.fromEntries(tenantRows.rows.map((row) => [row.key, row.id]));

  const client = (token: string, tenantId: string): Client => {
    const send = (
      method: 'get' | 'post' | 'patch' | 'put' | 'delete',
      url: string,
      body?: object,
    ) => {
      const agent = request(app.getHttpServer());
      const req = agent[method](url)
        .set('Authorization', `Bearer ${token}`)
        .set('X-Tenant-Id', tenantId);
      return body === undefined ? req : req.send(body);
    };
    return {
      get: (url) => send('get', url),
      post: (url, body) => send('post', url, body),
      patch: (url, body) => send('patch', url, body),
      put: (url, body) => send('put', url, body),
      delete: (url) => send('delete', url),
    };
  };

  return {
    app,
    adminPool,
    migratorUrl,
    tenants,
    delivered,
    as: client,
    platformToken: (platformUserId) =>
      new SignJWT({ kind: 'platform', name: 'Platform', platform_role: 'super_admin' })
        .setProtectedHeader({ alg: 'RS256', kid })
        .setSubject(platformUserId)
        .setIssuer(JWT_ISSUER)
        .setAudience(JWT_AUDIENCE)
        .setIssuedAt()
        .setExpirationTime('5m')
        .sign(pair.privateKey),
    tenantToken: (accountId, tenantId, role) =>
      new SignJWT({ kind: 'tenant', name: 'Test User', tid: tenantId, roles: [role] })
        .setProtectedHeader({ alg: 'RS256', kid })
        .setSubject(accountId)
        .setIssuer(JWT_ISSUER)
        .setAudience(JWT_AUDIENCE)
        .setIssuedAt()
        .setExpirationTime('5m')
        .sign(pair.privateKey),
    async account(tenantId, email, roleKey) {
      const { rows } = await adminPool.query(
        `INSERT INTO users (tenant_id, email, first_name, last_name, status)
         VALUES ($1, $2, 'Test', $3, 'active') RETURNING id`,
        [tenantId, email, roleKey],
      );
      await adminPool.query(
        `INSERT INTO staff_memberships (tenant_id, user_id, role_key, status)
         VALUES ($1, $2, $3, 'active')`,
        [tenantId, rows[0].id, roleKey],
      );
      return rows[0].id;
    },
    async dispose() {
      await app.close();
      await adminPool.end();
      await disposeDb();
    },
  };
}
