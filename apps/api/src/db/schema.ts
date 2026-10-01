import { sql } from 'drizzle-orm';
import {
  boolean,
  date,
  integer,
  jsonb,
  numeric,
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
    /** Holders see and change only the buildings assigned to them (M2). */
    buildingScoped: boolean('building_scoped').notNull().default(false),
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

/** Property hierarchy, owned by the property module (db/migrations/0006). */

export const ASSESSMENT_BASES = [
  'fixed',
  'per_area',
  'per_occupant',
  'per_ideal_part',
  'per_room',
] as const;

export const PROPERTY_TYPES = ['apartment', 'garage', 'shop', 'storage', 'parking_spot'] as const;

export const buildings = pgTable(
  'buildings',
  {
    tenantId: uuid('tenant_id').notNull(),
    id: uuid('id').notNull().defaultRandom(),
    name: text('name').notNull(),
    city: text('city').notNull(),
    district: text('district').notNull(),
    address: text('address').notNull(),
    floors: integer('floors').notNull(),
    hasElevator: boolean('has_elevator').notNull().default(false),
    assessmentBasis: text('assessment_basis', { enum: ASSESSMENT_BASES }).notNull(),
    bankAccount: text('bank_account'),
    signatureName: text('signature_name'),
    status: text('status', { enum: ['draft', 'active', 'archived'] })
      .notNull()
      .default('draft'),
    activatedAt: timestamp('activated_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.tenantId, t.id] })],
);

export const entrances = pgTable(
  'entrances',
  {
    tenantId: uuid('tenant_id').notNull(),
    id: uuid('id').notNull().defaultRandom(),
    buildingId: uuid('building_id').notNull(),
    name: text('name').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.tenantId, t.id] })],
);

/** A property of any type (D26); the table keeps the plan's name. */
export const apartments = pgTable(
  'apartments',
  {
    tenantId: uuid('tenant_id').notNull(),
    id: uuid('id').notNull().defaultRandom(),
    buildingId: uuid('building_id').notNull(),
    entranceId: uuid('entrance_id').notNull(),
    floor: integer('floor').notNull(),
    number: text('number').notNull(),
    propertyType: text('property_type', { enum: PROPERTY_TYPES }).notNull().default('apartment'),
    rooms: integer('rooms'),
    /** Decimal string, two places — never a float. */
    areaM2: numeric('area_m2', { precision: 8, scale: 2 }),
    /** Share of the common parts in percent; decimal string, four places. */
    idealParts: numeric('ideal_parts', { precision: 7, scale: 4 }),
    status: text('status', { enum: ['active', 'archived'] })
      .notNull()
      .default('active'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.tenantId, t.id] })],
);

/** Who lives in a property, and pets (db/migrations/0007). Dates are `YYYY-MM-DD`. */

export const OCCUPANCY_ROLES = ['owner', 'tenant', 'occupant'] as const;
export const PET_SPECIES = ['dog', 'cat', 'other'] as const;

export const occupancies = pgTable(
  'occupancies',
  {
    tenantId: uuid('tenant_id').notNull(),
    id: uuid('id').notNull().defaultRandom(),
    apartmentId: uuid('apartment_id').notNull(),
    /** Null for a household member recorded by name only. */
    userId: uuid('user_id'),
    role: text('role', { enum: OCCUPANCY_ROLES }).notNull(),
    firstName: text('first_name'),
    lastName: text('last_name'),
    validFrom: date('valid_from').notNull(),
    /** The last day it counts, inclusive; null while it lasts. */
    validTo: date('valid_to'),
    createdBy: uuid('created_by').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.tenantId, t.id] })],
);

export const pets = pgTable(
  'pets',
  {
    tenantId: uuid('tenant_id').notNull(),
    id: uuid('id').notNull().defaultRandom(),
    apartmentId: uuid('apartment_id').notNull(),
    name: text('name').notNull(),
    species: text('species', { enum: PET_SPECIES }).notNull(),
    validFrom: date('valid_from').notNull(),
    validTo: date('valid_to'),
    createdBy: uuid('created_by').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.tenantId, t.id] })],
);

/** Removal and link requests, building managers (db/migrations/0009). */

export const REMOVAL_SUBJECTS = ['occupancy', 'account', 'property'] as const;
export const REMOVAL_STATUSES = [
  'pending',
  'approved',
  'rejected',
  'applied',
  'withdrawn',
] as const;
export const LINK_STATUSES = ['pending', 'approved', 'rejected', 'withdrawn'] as const;

export const removalRequests = pgTable(
  'removal_requests',
  {
    tenantId: uuid('tenant_id').notNull(),
    id: uuid('id').notNull().defaultRandom(),
    subjectType: text('subject_type', { enum: REMOVAL_SUBJECTS }).notNull(),
    subjectId: uuid('subject_id').notNull(),
    buildingId: uuid('building_id').notNull(),
    reason: text('reason').notNull(),
    /** The last day the occupancies count. */
    effectiveDate: date('effective_date').notNull(),
    status: text('status', { enum: REMOVAL_STATUSES }).notNull().default('pending'),
    requestedBy: uuid('requested_by').notNull(),
    decidedBy: uuid('decided_by'),
    decidedAt: timestamp('decided_at', { withTimezone: true }),
    decisionNote: text('decision_note'),
    appliedAt: timestamp('applied_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.tenantId, t.id] })],
);

export const linkRequests = pgTable(
  'link_requests',
  {
    tenantId: uuid('tenant_id').notNull(),
    id: uuid('id').notNull().defaultRandom(),
    userId: uuid('user_id').notNull(),
    role: text('role', { enum: ['owner', 'tenant'] }).notNull(),
    validFrom: date('valid_from').notNull(),
    address: text('address').notNull(),
    entrance: text('entrance'),
    floor: text('floor'),
    number: text('number').notNull(),
    note: text('note'),
    status: text('status', { enum: LINK_STATUSES }).notNull().default('pending'),
    apartmentId: uuid('apartment_id'),
    occupancyId: uuid('occupancy_id'),
    decidedBy: uuid('decided_by'),
    decidedAt: timestamp('decided_at', { withTimezone: true }),
    decisionNote: text('decision_note'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.tenantId, t.id] })],
);

export const buildingManagerAssignments = pgTable(
  'building_manager_assignments',
  {
    tenantId: uuid('tenant_id').notNull(),
    id: uuid('id').notNull().defaultRandom(),
    buildingId: uuid('building_id').notNull(),
    userId: uuid('user_id').notNull(),
    assignedBy: uuid('assigned_by').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    endedAt: timestamp('ended_at', { withTimezone: true }),
  },
  (t) => [primaryKey({ columns: [t.tenantId, t.id] })],
);
