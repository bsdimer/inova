import { integer, jsonb, pgTable, primaryKey, text, timestamp, uuid } from 'drizzle-orm/pg-core';

/**
 * The columns the worker's jobs read and write (db/migrations/0001–0013). Each
 * table is owned by another service; the worker's database role is granted
 * exactly these (0010), and RLS scopes every row to one tenant at a time.
 */

export const tenants = pgTable('tenants', {
  id: uuid('id').primaryKey(),
  key: text('key').notNull(),
  name: text('name').notNull(),
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

/** Messages to send (D41, 0013): the producers record them, the worker sends them. */
export const messageDeliveries = pgTable(
  'message_deliveries',
  {
    tenantId: uuid('tenant_id').notNull(),
    id: uuid('id').notNull(),
    purpose: text('purpose', {
      enum: ['invite_code', 'recovery_link', 'recovery_code', 'email_change_code'],
    }).notNull(),
    channel: text('channel', { enum: ['email', 'sms'] }).notNull(),
    recipient: text('recipient').notNull(),
    status: text('status', { enum: ['queued', 'sent', 'failed'] }).notNull(),
    attempts: integer('attempts').notNull(),
    lastError: text('last_error'),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    failedAt: timestamp('failed_at', { withTimezone: true }),
  },
  (t) => [primaryKey({ columns: [t.tenantId, t.id] })],
);

/** Insert-only: a delivery that finally failed is written to the organisation's trail. */
export const auditRecords = pgTable('audit_records', {
  tenantId: uuid('tenant_id').notNull(),
  actorType: text('actor_type', { enum: ['user', 'system', 'platform'] }).notNull(),
  action: text('action').notNull(),
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id'),
  payload: jsonb('payload').notNull(),
});
