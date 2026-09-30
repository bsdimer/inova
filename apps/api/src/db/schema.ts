import { sql } from 'drizzle-orm';
import {
  boolean,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

/** Domain tables owned by core-api (see db/migrations/0001). */

export const tenants = pgTable('tenants', {
  id: uuid('id').primaryKey().defaultRandom(),
  key: text('key').notNull(),
  name: text('name').notNull(),
  brandKey: text('brand_key').notNull().default('inova'),
  locale: text('locale').notNull().default('bg-BG'),
  currency: text('currency').notNull().default('EUR'),
  timezone: text('timezone').notNull().default('Europe/Sofia'),
  status: text('status', { enum: ['trial', 'active', 'suspended', 'offboarded'] })
    .notNull()
    .default('trial'),
  settings: jsonb('settings').notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const permissions = pgTable('permissions', {
  key: text('key').primaryKey(),
  description: text('description').notNull(),
});

export const roles = pgTable(
  'roles',
  {
    tenantId: uuid('tenant_id').notNull(),
    key: text('key').notNull(),
    name: text('name').notNull(),
    isSystem: boolean('is_system').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.tenantId, t.key] })],
);

export const rolePermissions = pgTable(
  'role_permissions',
  {
    tenantId: uuid('tenant_id').notNull(),
    roleKey: text('role_key').notNull(),
    permissionKey: text('permission_key').notNull(),
  },
  (t) => [primaryKey({ columns: [t.tenantId, t.roleKey, t.permissionKey] })],
);

export const auditRecords = pgTable(
  'audit_records',
  {
    tenantId: uuid('tenant_id').notNull(),
    id: uuid('id').notNull().defaultRandom(),
    actorUserId: uuid('actor_user_id'),
    actorType: text('actor_type', { enum: ['user', 'system', 'platform'] }).notNull(),
    action: text('action').notNull(),
    entityType: text('entity_type').notNull(),
    entityId: text('entity_id'),
    payload: jsonb('payload').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.tenantId, t.id] })],
);

/**
 * Identity tables owned by auth-service. core-api reads them for membership
 * re-checks and staff listings, and inserts accounts/memberships/invites when
 * staff are invited and tenants provisioned. A row of `users` is a tenant
 * account (decision B8): it belongs to one tenant, under RLS like any other
 * tenant-owned table. Schema changes belong to the identity domain — do not
 * alter these from core-api migrations.
 */
export const users = pgTable(
  'users',
  {
    tenantId: uuid('tenant_id').notNull(),
    id: uuid('id').notNull().defaultRandom(),
    email: text('email'),
    phone: text('phone'),
    salutation: text('salutation', { enum: ['mr', 'mrs'] }),
    firstName: text('first_name').notNull(),
    lastName: text('last_name').notNull().default(''),
    /** Derived by the database from the first and last name (D36). */
    fullName: text('full_name')
      .notNull()
      .generatedAlwaysAs(sql`btrim(first_name || ' ' || last_name)`),
    status: text('status', { enum: ['pending', 'active', 'suspended'] }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.tenantId, t.id] })],
);

export const staffMemberships = pgTable(
  'staff_memberships',
  {
    tenantId: uuid('tenant_id').notNull(),
    userId: uuid('user_id').notNull(),
    roleKey: text('role_key').notNull(),
    status: text('status', { enum: ['invited', 'active', 'suspended', 'revoked'] }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.tenantId, t.userId] })],
);

export const inviteCodes = pgTable(
  'invite_codes',
  {
    tenantId: uuid('tenant_id').notNull(),
    id: uuid('id').notNull().defaultRandom(),
    userId: uuid('user_id').notNull(),
    codeHash: text('code_hash').notNull(),
    channel: text('channel', { enum: ['sms', 'viber'] }).notNull(),
    phone: text('phone'),
    maxAttempts: integer('max_attempts').notNull().default(5),
    status: text('status', { enum: ['active', 'consumed', 'expired', 'voided'] })
      .notNull()
      .default('active'),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    consumedAt: timestamp('consumed_at', { withTimezone: true }),
    createdBy: uuid('created_by'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.tenantId, t.id] })],
);
