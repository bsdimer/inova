/**
 * Staff & roles management suite — RELEASE BLOCKER tier (auth/RBAC behavior).
 * Covers permission enforcement on the management endpoints, role catalog
 * integrity (locked admin role, system roles), invite flow, and the
 * last-active-admin lockout guard. Runs against a real Postgres with RLS.
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

let tenantA: string; // sosedo
let tenantB: string; // demo
let mariaId: string; // tenant admin of A (the only active admin)
let elenaId: string; // resident of A
let managerId: string; // active manager of A (created in setup)

type SigningKey = Awaited<ReturnType<typeof generateKeyPair>>['privateKey'];
let signingKey: SigningKey;
let kid: string;

async function sign(sub: string, memberships: MembershipClaim[]): Promise<string> {
  return new SignJWT({ name: 'Test User', memberships })
    .setProtectedHeader({ alg: 'RS256', kid })
    .setSubject(sub)
    .setIssuer(JWT_ISSUER)
    .setAudience(JWT_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(signingKey);
}

function as(token: string, tenantId: string) {
  return {
    get: (url: string) =>
      request(app.getHttpServer())
        .get(url)
        .set('Authorization', `Bearer ${token}`)
        .set('X-Tenant-Id', tenantId),
    post: (url: string, body?: object) =>
      request(app.getHttpServer())
        .post(url)
        .set('Authorization', `Bearer ${token}`)
        .set('X-Tenant-Id', tenantId)
        .send(body),
    patch: (url: string, body?: object) =>
      request(app.getHttpServer())
        .patch(url)
        .set('Authorization', `Bearer ${token}`)
        .set('X-Tenant-Id', tenantId)
        .send(body),
    delete: (url: string) =>
      request(app.getHttpServer())
        .delete(url)
        .set('Authorization', `Bearer ${token}`)
        .set('X-Tenant-Id', tenantId),
  };
}

let admin: ReturnType<typeof as>;
let manager: ReturnType<typeof as>;
let resident: ReturnType<typeof as>;

beforeAll(async () => {
  const { migratorUrl, appUrl } = await createTestDb('sosedo_test_api_mgmt');
  process.env.DATABASE_URL = appUrl;

  const pair = await generateKeyPair('RS256');
  signingKey = pair.privateKey;
  const jwk = await exportJWK(pair.publicKey);
  kid = await calculateJwkThumbprint(jwk);
  process.env.AUTH_JWKS_JSON = JSON.stringify({ keys: [{ ...jwk, kid, alg: 'RS256' }] });
  resetJwksCache();

  const { AppModule } = await import('../src/app.module');
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication();
  await app.init();

  adminPool = new pg.Pool({ connectionString: migratorUrl, max: 2 });

  const tenants = await adminPool.query('SELECT id, key FROM tenants ORDER BY key');
  tenantA = tenants.rows.find((r) => r.key === 'sosedo').id;
  tenantB = tenants.rows.find((r) => r.key === 'demo').id;
  mariaId = (await adminPool.query(`SELECT id FROM users WHERE email = 'maria@sosedo.bg'`))
    .rows[0].id;
  elenaId = (await adminPool.query(`SELECT id FROM users WHERE phone = '+359881000001'`))
    .rows[0].id;
  await adminPool.query(
    `UPDATE staff_memberships SET status = 'active' WHERE user_id = $1 AND tenant_id = $2`,
    [elenaId, tenantA],
  );

  // An active manager so we can exercise staff.manage without roles.manage.
  managerId = (
    await adminPool.query(
      `INSERT INTO users (email, full_name, status) VALUES ('manager@sosedo.bg', 'Test Manager', 'active') RETURNING id`,
    )
  ).rows[0].id;
  await adminPool.query(
    `INSERT INTO staff_memberships (tenant_id, user_id, role_key, status) VALUES ($1, $2, 'manager', 'active')`,
    [tenantA, managerId],
  );

  admin = as(await sign(mariaId, [{ t: tenantA, r: 'admin' }]), tenantA);
  manager = as(await sign(managerId, [{ t: tenantA, r: 'manager' }]), tenantA);
  resident = as(await sign(elenaId, [{ t: tenantA, r: 'resident' }]), tenantA);
});

afterAll(async () => {
  await app?.close();
  await adminPool?.end();
});

describe('Roles endpoints', () => {
  it('lists roles with permissions and member counts (roles.read)', async () => {
    const res = await manager.get('/tenant/roles');
    expect(res.status).toBe(200);
    const keys = res.body.map((r: { key: string }) => r.key).sort();
    expect(keys).toEqual(['admin', 'manager', 'resident']);
    const adminRole = res.body.find((r: { key: string }) => r.key === 'admin');
    expect(adminRole.permissions).toContain('roles.manage');
    expect(adminRole.members).toBeGreaterThanOrEqual(1);
  });

  it('denies the roles list to residents and role edits to managers (403)', async () => {
    expect((await resident.get('/tenant/roles')).status).toBe(403);
    expect(
      (await manager.post('/tenant/roles', { key: 'x1', name: 'X1', permissions: [] })).status,
    ).toBe(403);
  });

  it('serves the permission catalog', async () => {
    const res = await manager.get('/tenant/permissions');
    expect(res.status).toBe(200);
    expect(res.body.map((p: { key: string }) => p.key)).toContain('staff.manage');
  });

  it('creates, updates and deletes a custom role', async () => {
    const created = await admin.post('/tenant/roles', {
      key: 'accountant',
      name: 'Accountant',
      permissions: ['tenant.read', 'audit.read'],
    });
    expect(created.status).toBe(201);

    const updated = await admin.patch('/tenant/roles/accountant', {
      name: 'Chief Accountant',
      permissions: ['tenant.read'],
    });
    expect(updated.status).toBe(200);

    const list = await admin.get('/tenant/roles');
    const role = list.body.find((r: { key: string }) => r.key === 'accountant');
    expect(role.name).toBe('Chief Accountant');
    expect(role.permissions).toEqual(['tenant.read']);

    expect((await admin.delete('/tenant/roles/accountant')).status).toBe(200);

    const { rows } = await adminPool.query(
      `SELECT action FROM audit_records WHERE tenant_id = $1 AND entity_id = 'accountant' ORDER BY created_at`,
      [tenantA],
    );
    expect(rows.map((r) => r.action)).toEqual(['role.created', 'role.updated', 'role.deleted']);
  });

  it('rejects unknown permission keys (400)', async () => {
    const res = await admin.post('/tenant/roles', {
      key: 'bogus',
      name: 'Bogus',
      permissions: ['not.a.permission'],
    });
    expect(res.status).toBe(400);
  });

  it('locks the admin role and protects system roles from deletion', async () => {
    expect((await admin.patch('/tenant/roles/admin', { name: 'Root' })).status).toBe(400);
    expect((await admin.delete('/tenant/roles/admin')).status).toBe(400);
    expect((await admin.delete('/tenant/roles/manager')).status).toBe(400);
  });
});

describe('Staff endpoints', () => {
  it('invites a new staff member and records an invite code', async () => {
    const res = await admin.post('/tenant/staff', {
      email: 'nikol@sosedo.bg',
      fullName: 'Nikol Petrova',
      phone: '+359881000099',
      roleKey: 'manager',
    });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('invited');
    expect(res.body.inviteSent).toBe(true);

    const codes = await adminPool.query(
      `SELECT * FROM invite_codes WHERE tenant_id = $1 AND user_id = $2`,
      [tenantA, res.body.userId],
    );
    expect(codes.rows).toHaveLength(1);

    // Duplicate invite → conflict.
    const dup = await admin.post('/tenant/staff', {
      email: 'nikol@sosedo.bg',
      fullName: 'Nikol Petrova',
      roleKey: 'manager',
    });
    expect(dup.status).toBe(409);
  });

  it('rejects invites to a nonexistent role (400)', async () => {
    const res = await admin.post('/tenant/staff', {
      email: 'somebody@sosedo.bg',
      fullName: 'Some Body',
      roleKey: 'ghost-role',
    });
    expect(res.status).toBe(400);
  });

  it('denies staff mutations to residents (403)', async () => {
    const res = await resident.post('/tenant/staff', {
      email: 'x@sosedo.bg',
      fullName: 'X Y',
      roleKey: 'resident',
    });
    expect(res.status).toBe(403);
  });

  it("changes a member's role and suspends/reactivates them", async () => {
    const changed = await manager.patch(`/tenant/staff/${elenaId}`, { roleKey: 'manager' });
    expect(changed.status).toBe(200);
    expect(changed.body.roleKey).toBe('manager');

    const suspended = await manager.patch(`/tenant/staff/${elenaId}`, { status: 'suspended' });
    expect(suspended.status).toBe(200);

    const restored = await manager.patch(`/tenant/staff/${elenaId}`, {
      roleKey: 'resident',
      status: 'active',
    });
    expect(restored.status).toBe(200);

    const audit = await adminPool.query(
      `SELECT action FROM audit_records WHERE tenant_id = $1 AND entity_id = $2 AND action = 'staff.updated'`,
      [tenantA, elenaId],
    );
    expect(audit.rows.length).toBe(3);
  });

  it('blocks changing your own membership (400)', async () => {
    const res = await manager.patch(`/tenant/staff/${managerId}`, { status: 'suspended' });
    expect(res.status).toBe(400);
  });

  it('never leaves the tenant without an active administrator (400)', async () => {
    // Maria is the only active admin — both demotion and suspension must fail.
    expect((await manager.patch(`/tenant/staff/${mariaId}`, { status: 'suspended' })).status).toBe(
      400,
    );
    expect((await manager.patch(`/tenant/staff/${mariaId}`, { roleKey: 'manager' })).status).toBe(
      400,
    );
  });

  it('rejects cross-tenant staff mutations (403)', async () => {
    const token = await sign(managerId, [{ t: tenantA, r: 'manager' }]);
    const res = await as(token, tenantB).post('/tenant/staff', {
      email: 'x@demo.bg',
      fullName: 'X Y',
      roleKey: 'manager',
    });
    expect(res.status).toBe(403);
  });
});
