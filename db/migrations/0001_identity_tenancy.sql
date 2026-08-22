-- M1: identity, tenancy, RBAC foundations.
--
-- Ownership boundaries (see docs/implementation-plan.md §4.1):
--   auth-service (identity):  users, staff_memberships, refresh_tokens, invite_codes
--   core-api (domain):        tenants, brands, permissions, roles, role_permissions, audit_records
--
-- RLS model:
--   * Tenant-owned tables carry tenant_id as the LEADING PK/index column and enable RLS.
--   * The application connects as `sosedo_app` (no BYPASSRLS). Queries must run inside a
--     transaction that sets `app.tenant_id` via SET LOCAL.
--   * Identity tables additionally allow `app.identity_scope = 'auth'` — auth-service must
--     read a user's memberships across ALL tenants to mint JWT claims. This is a policy-based
--     allowance for the identity service only, never a role-level RLS bypass.

BEGIN;

-- ---------------------------------------------------------------------------
-- Application role (login role used by auth-service and core-api).
-- Password is a local-dev default; production uses managed credentials.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'sosedo_app') THEN
    CREATE ROLE sosedo_app LOGIN PASSWORD 'sosedo_app';
  END IF;
END
$$;

-- ---------------------------------------------------------------------------
-- Platform-scope tables (no tenant_id; authorization happens at service layer)
-- ---------------------------------------------------------------------------

CREATE TABLE tenants (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key         text NOT NULL UNIQUE,
  name        text NOT NULL,
  brand_key   text NOT NULL DEFAULT 'sosedo',
  locale      text NOT NULL DEFAULT 'bg-BG',
  currency    text NOT NULL DEFAULT 'EUR',
  timezone    text NOT NULL DEFAULT 'Europe/Sofia',
  status      text NOT NULL DEFAULT 'trial'
              CHECK (status IN ('trial', 'active', 'suspended', 'offboarded')),
  settings    jsonb NOT NULL DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE brands (
  key         text PRIMARY KEY,
  name        text NOT NULL,
  config      jsonb NOT NULL DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE users (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email          text,
  phone          text,
  full_name      text NOT NULL,
  password_hash  text,
  status         text NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending', 'active', 'suspended')),
  platform_role  text CHECK (platform_role IN ('super_admin')),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX users_email_unique ON users (lower(email)) WHERE email IS NOT NULL;
CREATE UNIQUE INDEX users_phone_unique ON users (phone) WHERE phone IS NOT NULL;

CREATE TABLE refresh_tokens (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  family_id   uuid NOT NULL,
  token_hash  text NOT NULL UNIQUE,
  expires_at  timestamptz NOT NULL,
  rotated_at  timestamptz,
  revoked_at  timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX refresh_tokens_user_idx ON refresh_tokens (user_id);
CREATE INDEX refresh_tokens_family_idx ON refresh_tokens (family_id);

-- ---------------------------------------------------------------------------
-- Permission catalog (global, static — seeded here, extended by later migrations)
-- ---------------------------------------------------------------------------

CREATE TABLE permissions (
  key          text PRIMARY KEY,
  description  text NOT NULL
);

INSERT INTO permissions (key, description) VALUES
  ('tenant.read',    'Read tenant profile and settings'),
  ('tenant.manage',  'Update tenant profile and settings'),
  ('staff.read',     'List staff members and their roles'),
  ('staff.manage',   'Invite, suspend and remove staff members'),
  ('roles.read',     'List roles and permissions'),
  ('roles.manage',   'Create and edit roles and their permissions'),
  ('audit.read',     'Read the tenant audit trail');

-- ---------------------------------------------------------------------------
-- Tenant-owned tables (tenant_id leading PK + RLS)
-- ---------------------------------------------------------------------------

CREATE TABLE roles (
  tenant_id   uuid NOT NULL REFERENCES tenants (id),
  key         text NOT NULL,
  name        text NOT NULL,
  is_system   boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, key)
);

CREATE TABLE role_permissions (
  tenant_id       uuid NOT NULL,
  role_key        text NOT NULL,
  permission_key  text NOT NULL REFERENCES permissions (key),
  PRIMARY KEY (tenant_id, role_key, permission_key),
  FOREIGN KEY (tenant_id, role_key) REFERENCES roles (tenant_id, key) ON DELETE CASCADE
);

CREATE TABLE staff_memberships (
  tenant_id   uuid NOT NULL REFERENCES tenants (id),
  user_id     uuid NOT NULL REFERENCES users (id),
  role_key    text NOT NULL,
  status      text NOT NULL DEFAULT 'active'
              CHECK (status IN ('invited', 'active', 'suspended', 'revoked')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, user_id),
  FOREIGN KEY (tenant_id, role_key) REFERENCES roles (tenant_id, key)
);

CREATE INDEX staff_memberships_user_idx ON staff_memberships (user_id);

-- Invite codes for resident/staff activation (decision B7).
-- The 6-digit code is stored hashed; generation must keep active codes globally
-- unique so activation can look up by hash alone.
CREATE TABLE invite_codes (
  tenant_id     uuid NOT NULL REFERENCES tenants (id),
  id            uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  code_hash     text NOT NULL,
  channel       text NOT NULL DEFAULT 'sms' CHECK (channel IN ('sms', 'viber')),
  phone         text,
  attempts      integer NOT NULL DEFAULT 0,
  max_attempts  integer NOT NULL DEFAULT 5,
  expires_at    timestamptz NOT NULL,
  consumed_at   timestamptz,
  created_by    uuid REFERENCES users (id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id)
);

CREATE INDEX invite_codes_hash_idx ON invite_codes (code_hash) WHERE consumed_at IS NULL;
CREATE INDEX invite_codes_user_idx ON invite_codes (user_id);

-- Audit trail: append-only, hash-partitioned by tenant_id from day 1 (§4.7).
CREATE TABLE audit_records (
  tenant_id      uuid NOT NULL,
  id             uuid NOT NULL DEFAULT gen_random_uuid(),
  actor_user_id  uuid,
  actor_type     text NOT NULL DEFAULT 'user' CHECK (actor_type IN ('user', 'system', 'platform')),
  action         text NOT NULL,
  entity_type    text NOT NULL,
  entity_id      text,
  payload        jsonb NOT NULL DEFAULT '{}',
  created_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id)
) PARTITION BY HASH (tenant_id);

DO $$
DECLARE
  i integer;
BEGIN
  FOR i IN 0..7 LOOP
    EXECUTE format(
      'CREATE TABLE audit_records_p%s PARTITION OF audit_records FOR VALUES WITH (MODULUS 8, REMAINDER %s)',
      i, i
    );
  END LOOP;
END
$$;

CREATE INDEX audit_records_created_idx ON audit_records (tenant_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------

-- Domain tables: tenant context only.
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON roles
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON role_permissions
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

ALTER TABLE audit_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON audit_records
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

-- Identity tables: tenant context OR identity scope (auth-service token issuance,
-- invite-code activation before any tenant context exists).
ALTER TABLE staff_memberships ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON staff_memberships
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
CREATE POLICY identity_scope ON staff_memberships
  USING (current_setting('app.identity_scope', true) = 'auth');

ALTER TABLE invite_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON invite_codes
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
CREATE POLICY identity_scope ON invite_codes
  USING (current_setting('app.identity_scope', true) = 'auth');

-- ---------------------------------------------------------------------------
-- Grants for the application role
-- ---------------------------------------------------------------------------

GRANT USAGE ON SCHEMA public TO sosedo_app;

GRANT SELECT, INSERT, UPDATE ON tenants, brands, users TO sosedo_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON refresh_tokens, invite_codes TO sosedo_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON roles, role_permissions, staff_memberships TO sosedo_app;
GRANT SELECT ON permissions TO sosedo_app;

-- Audit records are append-only: no UPDATE/DELETE for the app role, ever.
GRANT SELECT, INSERT ON audit_records TO sosedo_app;

COMMIT;
