#!/usr/bin/env node
/**
 * Development seed: two tenants (isolation testing needs at least two), role
 * templates, a platform super_admin, per-tenant admin staff, and pending
 * residents with fixed invite codes for demoing the mobile activation flow.
 * Accounts are tenant-scoped (decision B8): maria@inova.bg exists in both
 * tenants as two unrelated accounts with different passwords.
 *
 * Idempotent — safe to rerun. Connects as the migrator role (superuser locally),
 * which bypasses RLS; runtime services never do this.
 *
 * DEV CREDENTIALS (local only, never reuse in real environments):
 *   super admin:  admin@inova.bg / inova-admin
 *   inova admin: maria@inova.bg / inova-owner
 *   demo admin:   ivan@demo.bg    / demo-owner
 *   demo manager: maria@inova.bg  / demo-maria   (same e-mail, another account)
 *   invite codes: 482913 (Elena, inova) · 735026 (Georgi, demo)
 *   residents:    Elena owns бл. 3 ап. 4 (inova) · Georgi rents бл. 12 ап. 2 (demo)
 */
import argon2 from 'argon2';
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
    : (process.env.DATABASE_URL_MIGRATOR ?? 'postgres://inova:inova@localhost:5432/inova');

const sha256 = (value) => createHash('sha256').update(value).digest('hex');

const ROLE_TEMPLATES = [
  { key: 'admin', name: 'Administrator', permissions: '*' },
  {
    key: 'manager',
    name: 'House manager',
    permissions: [
      'tenant.read',
      'staff.read',
      'staff.manage',
      'roles.read',
      'audit.read',
      'property.read',
      'property.write',
      'residents.read',
      'property.removal.request',
    ],
    buildingScoped: true,
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
      await readFile(path.join(here, '..', 'brands', 'inova', 'brand.json'), 'utf8'),
    );
    await client.query(
      `INSERT INTO brands (key, name, config) VALUES ('inova', 'inova', $1)
       ON CONFLICT (key) DO UPDATE SET name = EXCLUDED.name,
                                       config = EXCLUDED.config,
                                       updated_at = now()`,
      [brandConfig],
    );

    // Tenants
    const tenants = [
      { key: 'inova', name: 'WhiteNova Technology', status: 'active' },
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
          `INSERT INTO roles (tenant_id, key, name, is_system, building_scoped)
           VALUES ($1, $2, $3, true, $4)
           ON CONFLICT (tenant_id, key) DO UPDATE SET building_scoped = EXCLUDED.building_scoped`,
          [tenantId, tpl.key, tpl.name, tpl.buildingScoped === true],
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

    // Same argon2id parameters as auth-service's PasswordHasher, so seeded
    // accounts are not rehashed on their first login.
    const hashPassword = (password) =>
      argon2.hash(password, {
        type: argon2.argon2id,
        memoryCost: 19 * 1024,
        timeCost: 2,
        parallelism: 1,
      });

    // Platform super admin: a platform identity, never a tenant account.
    await client.query(
      `INSERT INTO platform_users (email, full_name, password_hash, status, platform_role)
       VALUES ($1, $2, $3, 'active', 'super_admin')
       ON CONFLICT (lower(email))
       DO UPDATE SET full_name = EXCLUDED.full_name,
                     password_hash = EXCLUDED.password_hash,
                     status = EXCLUDED.status,
                     updated_at = now()`,
      ['admin@inova.bg', 'Пламен Атанасов', await hashPassword('inova-admin')],
    );

    // Staff accounts. The first user of each tenant gets the per-tenant 'admin'
    // role. Мария Стоянова in demo shares her e-mail with Мария Иванова in
    // inova on purpose: the two accounts must never meet.
    const staff = [
      {
        tenant: 'inova',
        email: 'maria@inova.bg',
        salutation: 'mrs',
        firstName: 'Мария',
        lastName: 'Иванова',
        password: 'inova-owner',
        role: 'admin',
      },
      {
        tenant: 'demo',
        email: 'ivan@demo.bg',
        salutation: 'mr',
        firstName: 'Иван',
        lastName: 'Петров',
        password: 'demo-owner',
        role: 'admin',
      },
      {
        tenant: 'demo',
        email: 'maria@inova.bg',
        salutation: 'mrs',
        firstName: 'Мария',
        lastName: 'Стоянова',
        password: 'demo-maria',
        role: 'manager',
      },
    ];
    for (const o of staff) {
      const res = await client.query(
        `INSERT INTO users (tenant_id, email, salutation, first_name, last_name, password_hash, status)
         VALUES ($1, $2, $3, $4, $5, $6, 'active')
         ON CONFLICT (tenant_id, lower(email)) WHERE email IS NOT NULL
         DO UPDATE SET salutation = EXCLUDED.salutation,
                       first_name = EXCLUDED.first_name,
                       last_name = EXCLUDED.last_name,
                       password_hash = EXCLUDED.password_hash,
                       status = EXCLUDED.status,
                       updated_at = now()
         RETURNING id`,
        [
          tenantIds[o.tenant],
          o.email,
          o.salutation,
          o.firstName,
          o.lastName,
          await hashPassword(o.password),
        ],
      );
      await client.query(
        `INSERT INTO staff_memberships (tenant_id, user_id, role_key, status)
         VALUES ($1, $2, $3, 'active')
         ON CONFLICT (tenant_id, user_id) DO UPDATE SET role_key = EXCLUDED.role_key, status = 'active'`,
        [tenantIds[o.tenant], res.rows[0].id, o.role],
      );
    }

    // Pending residents with invite codes (manager-created accounts, decision B7)
    const residents = [
      {
        tenant: 'inova',
        phone: '+359881000001',
        salutation: 'mrs',
        firstName: 'Елена',
        lastName: 'Петрова',
        code: '482913',
      },
      {
        tenant: 'demo',
        phone: '+359881000002',
        salutation: 'mr',
        firstName: 'Георги',
        lastName: 'Димитров',
        code: '735026',
      },
    ];
    for (const r of residents) {
      const tenantId = tenantIds[r.tenant];
      // Reset to pending if a previous run activated this demo account, and
      // carry the name across so a renamed fixture does not stick.
      const userId = (
        await client.query(
          `INSERT INTO users (tenant_id, phone, salutation, first_name, last_name, status)
           VALUES ($1, $2, $3, $4, $5, 'pending')
           ON CONFLICT (tenant_id, phone) WHERE phone IS NOT NULL
           DO UPDATE SET salutation = EXCLUDED.salutation,
                         first_name = EXCLUDED.first_name,
                         last_name = EXCLUDED.last_name,
                         status = CASE WHEN users.status = 'suspended' THEN users.status ELSE 'pending' END,
                         password_hash = CASE WHEN users.status = 'suspended' THEN users.password_hash END,
                         updated_at = now()
           RETURNING id`,
          [tenantId, r.phone, r.salutation, r.firstName, r.lastName],
        )
      ).rows[0].id;

      await client.query(
        // A re-run restores the seed's role and invitation, as for the
        // administrators above, so a local database never keeps a role a
        // test or a hand edit left and silently differs from CI's fresh one.
        // A suspended membership stays suspended, like its account.
        `INSERT INTO staff_memberships (tenant_id, user_id, role_key, status)
         VALUES ($1, $2, 'resident', 'invited')
         ON CONFLICT (tenant_id, user_id) DO UPDATE
           SET role_key = EXCLUDED.role_key,
               status = CASE WHEN staff_memberships.status = 'suspended'
                             THEN staff_memberships.status ELSE EXCLUDED.status END`,
        [tenantId, userId],
      );

      // Fresh, never-expiring-soon code on each seed run
      await client.query(
        `DELETE FROM invite_codes WHERE tenant_id = $1 AND user_id = $2 AND consumed_at IS NULL`,
        [tenantId, userId],
      );
      await client.query(
        `INSERT INTO invite_codes (tenant_id, user_id, code_hash, channel, phone, expires_at)
         VALUES ($1, $2, $3, 'sms', $4, now() + interval '30 days')`,
        [tenantId, userId, sha256(r.code), r.phone],
      );
    }

    // A building per tenant with the pending residents on it, so the resident
    // app shows real data on the test environment (M2). Elena owns ап. 4 in
    // inova, Georgi rents ап. 2 in demo; both from 1 January 2026.
    const buildings = [
      {
        tenant: 'inova',
        name: 'бл. 3',
        district: 'Лозенец',
        address: 'ул. Кораб планина 12',
        resident: '+359881000001',
        flat: '4',
        role: 'owner',
      },
      {
        tenant: 'demo',
        name: 'бл. 12',
        district: 'Младост',
        address: 'ул. Проф. Александър Фол 7',
        resident: '+359881000002',
        flat: '2',
        role: 'tenant',
      },
    ];
    for (const b of buildings) {
      const tenantId = tenantIds[b.tenant];
      const buildingId =
        (
          await client.query('SELECT id FROM buildings WHERE tenant_id = $1 AND name = $2', [
            tenantId,
            b.name,
          ])
        ).rows[0]?.id ??
        (
          await client.query(
            `INSERT INTO buildings (tenant_id, name, city, district, address, floors, has_elevator,
                                    assessment_basis, status, activated_at)
             VALUES ($1, $2, 'София', $3, $4, 4, true, 'per_occupant', 'active', now())
             RETURNING id`,
            [tenantId, b.name, b.district, b.address],
          )
        ).rows[0].id;
      const entranceId =
        (
          await client.query(
            `SELECT id FROM entrances WHERE tenant_id = $1 AND building_id = $2 AND name = 'А'`,
            [tenantId, buildingId],
          )
        ).rows[0]?.id ??
        (
          await client.query(
            `INSERT INTO entrances (tenant_id, building_id, name) VALUES ($1, $2, 'А') RETURNING id`,
            [tenantId, buildingId],
          )
        ).rows[0].id;
      for (const number of ['1', '2', '3', '4']) {
        await client.query(
          `INSERT INTO apartments (tenant_id, building_id, entrance_id, floor, number, rooms, area_m2, ideal_parts)
           VALUES ($1, $2, $3, $4, $5, 3, '72.50', '2.5000')
           ON CONFLICT (tenant_id, building_id, entrance_id, floor, lower(number)) DO NOTHING`,
          [tenantId, buildingId, entranceId, Number(number), number],
        );
      }
      const flatId = (
        await client.query(
          `SELECT id FROM apartments WHERE tenant_id = $1 AND building_id = $2 AND number = $3`,
          [tenantId, buildingId, b.flat],
        )
      ).rows[0].id;
      const residentId = (
        await client.query('SELECT id FROM users WHERE tenant_id = $1 AND phone = $2', [
          tenantId,
          b.resident,
        ])
      ).rows[0].id;
      // The building-scoped House managers of the tenant manage its seeded building.
      await client.query(
        `INSERT INTO building_manager_assignments (tenant_id, building_id, user_id, assigned_by)
         SELECT m.tenant_id, $2, m.user_id, m.user_id
         FROM staff_memberships m
         JOIN roles r ON r.tenant_id = m.tenant_id AND r.key = m.role_key AND r.building_scoped
         WHERE m.tenant_id = $1
         ON CONFLICT DO NOTHING`,
        [tenantId, buildingId],
      );
      await client.query(
        `INSERT INTO occupancies (tenant_id, apartment_id, user_id, role, valid_from, created_by)
         SELECT $1, $2, $3, $4, '2026-01-01', $3
         WHERE NOT EXISTS (
           SELECT 1 FROM occupancies
           WHERE tenant_id = $1 AND apartment_id = $2 AND user_id = $3 AND role = $4 AND valid_to IS NULL
         )`,
        [tenantId, flatId, residentId, b.role],
      );
    }

    await client.query('COMMIT');
    log('seed complete.');
    log('  super admin : admin@inova.bg / inova-admin');
    log('  inova admin : maria@inova.bg / inova-owner');
    log('  demo admin  : ivan@demo.bg / demo-owner');
    log('  demo manager: maria@inova.bg / demo-maria (same e-mail, another account)');
    log('  invite codes: 482913 (Elena, inova) · 735026 (Georgi, demo)');
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
