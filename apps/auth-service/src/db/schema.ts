import { sql } from 'drizzle-orm';
import { integer, pgTable, primaryKey, text, timestamp, uuid } from 'drizzle-orm/pg-core';

/**
 * Identity tables owned by auth-service (db/migrations/0001, reshaped by 0004).
 * A row of `users` is a tenant account (decision B8): it belongs to one tenant
 * and its key is (tenant_id, id). Platform operators live in `platform_users`.
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
    passwordHash: text('password_hash'),
    status: text('status', { enum: ['pending', 'active', 'suspended'] }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.tenantId, t.id] })],
);

export const platformUsers = pgTable('platform_users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull(),
  fullName: text('full_name').notNull(),
  passwordHash: text('password_hash'),
  status: text('status', { enum: ['pending', 'active', 'suspended'] }).notNull(),
  platformRole: text('platform_role', { enum: ['super_admin'] }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

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

export const refreshTokens = pgTable(
  'refresh_tokens',
  {
    tenantId: uuid('tenant_id').notNull(),
    id: uuid('id').notNull().defaultRandom(),
    userId: uuid('user_id').notNull(),
    familyId: uuid('family_id').notNull(),
    tokenHash: text('token_hash').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    rotatedAt: timestamp('rotated_at', { withTimezone: true }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.tenantId, t.id] })],
);

export const platformRefreshTokens = pgTable('platform_refresh_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull(),
  familyId: uuid('family_id').notNull(),
  tokenHash: text('token_hash').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  rotatedAt: timestamp('rotated_at', { withTimezone: true }),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const inviteCodes = pgTable(
  'invite_codes',
  {
    tenantId: uuid('tenant_id').notNull(),
    id: uuid('id').notNull().defaultRandom(),
    userId: uuid('user_id').notNull(),
    codeHash: text('code_hash').notNull(),
    channel: text('channel', { enum: ['sms', 'viber'] }).notNull(),
    phone: text('phone'),
    attempts: integer('attempts').notNull().default(0),
    maxAttempts: integer('max_attempts').notNull().default(5),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    consumedAt: timestamp('consumed_at', { withTimezone: true }),
    createdBy: uuid('created_by'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.tenantId, t.id] })],
);

/** Read-only view of tenants: realm resolution and the names in responses. */
export const tenants = pgTable('tenants', {
  id: uuid('id').primaryKey().defaultRandom(),
  key: text('key').notNull(),
  name: text('name').notNull(),
  brandKey: text('brand_key').notNull(),
  status: text('status', { enum: ['trial', 'active', 'suspended', 'offboarded'] }).notNull(),
});
