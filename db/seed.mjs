#!/usr/bin/env node
/**
 * Development seed: two tenants (isolation testing needs at least two), role
 * templates, a platform super_admin, per-tenant admin staff, and pending
 * residents with fixed invite codes for demoing the mobile activation flow.
 *
 * Idempotent — safe to rerun. Connects as the migrator role (superuser locally),
 * which bypasses RLS; runtime services never do this.
 *
 * DEV CREDENTIALS (local only, never reuse in real environments):
 *   super admin:  admin@sosedo.bg / sosedo-admin
 *   sosedo admin: maria@sosedo.bg / sosedo-owner
 *   demo admin:   ivan@demo.bg    / demo-owner
 *   invite codes: 482913 (Elena, sosedo) · 735026 (Georgi, demo)
 */
import bcrypt from 'bcryptjs';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const here = path.dirname(fileURLToPath(import.meta.url));

const urlFlag = process.argv.indexOf('--url');
const databaseUrl =
  urlFlag !== -1
    ? process.argv[urlFlag + 1]
    : (process.env.DATABASE_URL_MIGRATOR ?? 'postgres://sosedo:sosedo@localhost:5432/sosedo');

const sha256 = (value) => createHash('sha256').update(value).digest('hex');

const ROLE_TEMPLATES = [
  { key: 'admin', name: 'Administrator', permissions: '*' },
  {
    key: 'manager',
    name: 'House manager',
    permissions: ['tenant.read', 'staff.read', 'staff.manage', 'roles.read', 'audit.read'],
  },
  // TODO(M2): residents move to occupancy-based linking; until then a system
  // 'resident' role gives them a tenant membership for JWT claims.
  { key: 'resident', name: 'Resident', permissions: ['tenant.read'] },
];

export async function seed(url = databaseUrl, { quiet = false } = {}) {
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  const log = (msg) => !quiet && console.log(msg);

  try {
    await client.query('BEGIN');

    // Brand from the canonical brand.json
    const brandConfig = JSON.parse(
      await readFile(path.join(here, '..', 'brands', 'sosedo', 'brand.json'), 'utf8'),
    );
    await client.query(
      `INSERT INTO brands (key, name, config) VALUES ('sosedo', 'Sosedo', $1)
       ON CONFLICT (key) DO UPDATE SET config = EXCLUDED.config, updated_at = now()`,
      [brandConfig],
    );

    // Tenants
    const tenants = [
      { key: 'sosedo', name: 'Sosedo Property Management', status: 'active' },
      { key: 'demo', name: 'Demo Blok Management', status: 'trial' },
    ];
    const tenantIds = {};
    for (const t of tenants) {
      const res = await client.query(
        `INSERT INTO tenants (key, name, status) VALUES ($1, $2, $3)
         ON CONFLICT (key) DO UPDATE SET name = EXCLUDED.name, updated_at = now()
         RETURNING id`,
        [t.key, t.name, t.status],
      );
      tenantIds[t.key] = res.rows[0].id;
    }

    // Role templates + permissions per tenant
    const allPermissions = (await client.query('SELECT key FROM permissions')).rows.map(
      (r) => r.key,
    );
    for (const tenantId of Object.values(tenantIds)) {
      for (const tpl of ROLE_TEMPLATES) {
        await client.query(
          `INSERT INTO roles (tenant_id, key, name, is_system) VALUES ($1, $2, $3, true)
           ON CONFLICT (tenant_id, key) DO NOTHING`,
          [tenantId, tpl.key, tpl.name],
        );
        const perms = tpl.permissions === '*' ? allPermissions : tpl.permissions;
        for (const perm of perms) {
          await client.query(
            `INSERT INTO role_permissions (tenant_id, role_key, permission_key)
             VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
            [tenantId, tpl.key, perm],
          );
        }
      }
    }

    const upsertUser = async ({ email, phone, fullName, password, status, platformRole }) => {
      const passwordHash = password ? await bcrypt.hash(password, 10) : null;
      const res = await client.query(
        `INSERT INTO users (email, phone, full_name, password_hash, status, platform_role)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (lower(email)) WHERE email IS NOT NULL
         DO UPDATE SET full_name = EXCLUDED.full_name,
                       password_hash = COALESCE(EXCLUDED.password_hash, users.password_hash),
                       status = EXCLUDED.status,
                       platform_role = EXCLUDED.platform_role,
                       updated_at = now()
         RETURNING id`,
        [email ?? null, phone ?? null, fullName, passwordHash, status, platformRole ?? null],
      );
      return res.rows[0].id;
    };

    // Platform super admin (no tenant memberships — platform_role claim only)
    await upsertUser({
      email: 'admin@sosedo.bg',
      fullName: 'Platform Admin',
      password: 'sosedo-admin',
      status: 'active',
      platformRole: 'super_admin',
    });

    // First user of each tenant gets the per-tenant 'admin' role
    const admins = [
      {
        tenant: 'sosedo',
        email: 'maria@sosedo.bg',
        fullName: 'Maria Ivanova',
        password: 'sosedo-owner',
      },
      { tenant: 'demo', email: 'ivan@demo.bg', fullName: 'Ivan Petrov', password: 'demo-owner' },
    ];
    for (const o of admins) {
      const userId = await upsertUser({
        email: o.email,
        fullName: o.fullName,
        password: o.password,
        status: 'active',
      });
      await client.query(
        `INSERT INTO staff_memberships (tenant_id, user_id, role_key, status)
         VALUES ($1, $2, 'admin', 'active')
         ON CONFLICT (tenant_id, user_id) DO UPDATE SET role_key = 'admin', status = 'active'`,
        [tenantIds[o.tenant], userId],
      );
    }

    // Pending residents with invite codes (manager-created accounts, decision B7)
    const residents = [
      { tenant: 'sosedo', phone: '+359881000001', fullName: 'Elena Petrova', code: '482913' },
      { tenant: 'demo', phone: '+359881000002', fullName: 'Georgi Dimitrov', code: '735026' },
    ];
    for (const r of residents) {
      const existing = await client.query('SELECT id FROM users WHERE phone = $1', [r.phone]);
      const userId =
        existing.rows[0]?.id ??
        (
          await client.query(
            `INSERT INTO users (phone, full_name, status) VALUES ($1, $2, 'pending') RETURNING id`,
            [r.phone, r.fullName],
          )
        ).rows[0].id;

      await client.query(
        `INSERT INTO staff_memberships (tenant_id, user_id, role_key, status)
         VALUES ($1, $2, 'resident', 'invited')
         ON CONFLICT (tenant_id, user_id) DO NOTHING`,
        [tenantIds[r.tenant], userId],
      );

      // Fresh, never-expiring-soon code on each seed run
      await client.query(`DELETE FROM invite_codes WHERE user_id = $1 AND consumed_at IS NULL`, [
        userId,
      ]);
      await client.query(
        `INSERT INTO invite_codes (tenant_id, user_id, code_hash, channel, phone, expires_at)
         VALUES ($1, $2, $3, 'sms', $4, now() + interval '30 days')`,
        [tenantIds[r.tenant], userId, sha256(r.code), r.phone],
      );
      // Reset consumed state if a previous run activated this demo user
      await client.query(
        `UPDATE users SET status = 'pending', password_hash = NULL, updated_at = now()
         WHERE id = $1 AND status <> 'suspended'`,
        [userId],
      );
    }

    await client.query('COMMIT');
    log('seed complete.');
    log('  super admin : admin@sosedo.bg / sosedo-admin');
    log('  sosedo admin : maria@sosedo.bg / sosedo-owner');
    log('  demo admin  : ivan@demo.bg / demo-owner');
    log('  invite codes: 482913 (Elena, sosedo) · 735026 (Georgi, demo)');
    return tenantIds;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    await client.end();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  seed().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
