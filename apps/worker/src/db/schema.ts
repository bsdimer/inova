import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

/**
 * The columns the worker's jobs read and write (db/migrations/0001–0010). Each
 * table is owned by another service; the worker's database role is granted
 * exactly these (0010), and RLS scopes every row to one tenant at a time.
 */

export const tenants = pgTable('tenants', {
  id: uuid('id').primaryKey(),
  key: text('key').notNull(),
  status: text('status', { enum: ['trial', 'active', 'suspended', 'offboarded'] }).notNull(),
});

export const inviteCodes = pgTable('invite_codes', {
  tenantId: uuid('tenant_id').notNull(),
  id: uuid('id').notNull(),
  status: text('status', { enum: ['active', 'consumed', 'expired', 'voided'] }).notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
});

export const passwordResets = pgTable('password_resets', {
  tenantId: uuid('tenant_id').notNull(),
  id: uuid('id').notNull(),
  status: text('status', { enum: ['active', 'consumed', 'expired', 'voided'] }).notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
});
