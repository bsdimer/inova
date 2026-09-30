-- Tenant-scoped account realms (decision B8) and the name split of D36.
--
-- Until now `users` was one global table: one row per person, one e-mail and one
-- phone in the whole platform, memberships in any number of tenants, and the
-- platform operators in the same table behind a `platform_role` column. B8
-- replaces that model:
--
--   * a tenant-facing account belongs to exactly one tenant. E-mail and phone are
--     unique inside the tenant only; the same values in another tenant are an
--     unrelated account that no query of this tenant can see (RLS);
--   * platform operators are separate identities in `platform_users`;
--   * every refresh-token family belongs to one tenant account (or to one
--     platform user) — a session never spans tenants.
--
-- 0001–0003 stay immutable; this is the forward change. It is not an
-- expand/contract migration: the token and table shapes change together, so
-- every session is ended here and services of the previous version cannot run
-- against this schema. Acceptable only because no production environment exists.

-- ---------------------------------------------------------------------------
-- Platform identities (no tenant; auth-service only)
-- ---------------------------------------------------------------------------

CREATE TABLE platform_users (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email          text NOT NULL,
  full_name      text NOT NULL,
  password_hash  text,
  status         text NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending', 'active', 'suspended')),
  platform_role  text NOT NULL CHECK (platform_role IN ('super_admin')),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX platform_users_email_unique ON platform_users (lower(email));

INSERT INTO platform_users (id, email, full_name, password_hash, status, platform_role, created_at, updated_at)
SELECT id, email, full_name, password_hash, status, platform_role, created_at, updated_at
FROM users
WHERE platform_role IS NOT NULL AND email IS NOT NULL;

CREATE TABLE platform_refresh_tokens (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES platform_users (id) ON DELETE CASCADE,
  family_id    uuid NOT NULL,
  token_hash   text NOT NULL UNIQUE,
  expires_at   timestamptz NOT NULL,
  rotated_at   timestamptz,
  revoked_at   timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX platform_refresh_tokens_family_idx ON platform_refresh_tokens (family_id);

-- ---------------------------------------------------------------------------
-- users → tenant accounts
-- ---------------------------------------------------------------------------

-- Sessions of the global model carry claims that no longer exist.
DROP TABLE refresh_tokens;

ALTER TABLE staff_memberships DROP CONSTRAINT staff_memberships_user_id_fkey;
ALTER TABLE invite_codes DROP CONSTRAINT invite_codes_user_id_fkey;
-- The author of an invite may be a platform user (tenant provisioning), so the
-- column stays a plain id, like audit_records.actor_user_id.
ALTER TABLE invite_codes DROP CONSTRAINT invite_codes_created_by_fkey;

DROP INDEX users_email_unique;
DROP INDEX users_phone_unique;
ALTER TABLE users DROP CONSTRAINT users_pkey;

ALTER TABLE users
  ADD COLUMN tenant_id   uuid REFERENCES tenants (id),
  ADD COLUMN salutation  text CHECK (salutation IN ('mr', 'mrs')),
  ADD COLUMN first_name  text,
  ADD COLUMN last_name   text NOT NULL DEFAULT '';

-- One account per tenant the person was known in (a membership or an invite).
-- The account keeps the person's old id in each of those tenants: the key is
-- now (tenant_id, id), so memberships, invites and audit rows stay valid as
-- they are. The copies share a password hash on day one and diverge from then.
INSERT INTO users (id, tenant_id, email, phone, full_name, password_hash, status, created_at, updated_at)
SELECT u.id, r.tenant_id, u.email, u.phone, u.full_name, u.password_hash, u.status, u.created_at, u.updated_at
FROM users u
JOIN (
  SELECT tenant_id, user_id FROM staff_memberships
  UNION
  SELECT tenant_id, user_id FROM invite_codes
) r ON r.user_id = u.id;

-- The global originals: platform operators (copied above) and rows that were
-- never attached to a tenant, which nothing can reach any more.
DELETE FROM users WHERE tenant_id IS NULL;

UPDATE users
SET first_name = split_part(btrim(full_name), ' ', 1),
    last_name  = btrim(substr(btrim(full_name), length(split_part(btrim(full_name), ' ', 1)) + 1));

ALTER TABLE users
  ALTER COLUMN tenant_id SET NOT NULL,
  ALTER COLUMN first_name SET NOT NULL,
  DROP COLUMN platform_role,
  DROP COLUMN full_name;

-- D36: messages address a person by salutation, first and last name; the full
-- name is derived so the two can never disagree.
ALTER TABLE users
  ADD COLUMN full_name text NOT NULL GENERATED ALWAYS AS (btrim(first_name || ' ' || last_name)) STORED;

ALTER TABLE users ADD PRIMARY KEY (tenant_id, id);

CREATE UNIQUE INDEX users_tenant_email_unique ON users (tenant_id, lower(email)) WHERE email IS NOT NULL;
CREATE UNIQUE INDEX users_tenant_phone_unique ON users (tenant_id, phone) WHERE phone IS NOT NULL;

ALTER TABLE staff_memberships
  ADD CONSTRAINT staff_memberships_account_fkey
  FOREIGN KEY (tenant_id, user_id) REFERENCES users (tenant_id, id);

ALTER TABLE invite_codes
  ADD CONSTRAINT invite_codes_account_fkey
  FOREIGN KEY (tenant_id, user_id) REFERENCES users (tenant_id, id) ON DELETE CASCADE;

-- Tenant context only. There is no identity-scope policy here: credential
-- lookup resolves the realm first and then reads inside that tenant, so not
-- even auth-service can search accounts across tenants.
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON users
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

-- The identity scope let auth-service read memberships and invite codes of all
-- tenants, because sign-in used to start without one. It now starts with the
-- realm, so the scope and the global lookup indexes that served it go away:
-- from here on no role can read these tables across tenants.
DROP POLICY identity_scope ON staff_memberships;
DROP POLICY identity_scope ON invite_codes;

DROP INDEX staff_memberships_user_idx; -- the primary key is (tenant_id, user_id)
DROP INDEX invite_codes_hash_idx;
DROP INDEX invite_codes_user_idx;
CREATE INDEX invite_codes_tenant_hash_idx ON invite_codes (tenant_id, code_hash) WHERE consumed_at IS NULL;
CREATE INDEX invite_codes_tenant_user_idx ON invite_codes (tenant_id, user_id);

-- ---------------------------------------------------------------------------
-- Refresh tokens: bound to one tenant account
-- ---------------------------------------------------------------------------

CREATE TABLE refresh_tokens (
  tenant_id    uuid NOT NULL REFERENCES tenants (id),
  id           uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL,
  family_id    uuid NOT NULL,
  token_hash   text NOT NULL,
  expires_at   timestamptz NOT NULL,
  rotated_at   timestamptz,
  revoked_at   timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id),
  FOREIGN KEY (tenant_id, user_id) REFERENCES users (tenant_id, id) ON DELETE CASCADE
);

-- The token names its tenant, so the lookup is tenant-leading like every other.
CREATE UNIQUE INDEX refresh_tokens_hash_unique ON refresh_tokens (tenant_id, token_hash);
CREATE INDEX refresh_tokens_family_idx ON refresh_tokens (tenant_id, family_id);
CREATE INDEX refresh_tokens_user_idx ON refresh_tokens (tenant_id, user_id);

ALTER TABLE refresh_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON refresh_tokens
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

-- ---------------------------------------------------------------------------
-- Grants. Session credentials and platform identities are auth-service's alone;
-- core-api (inova_app) gets nothing on them.
-- ---------------------------------------------------------------------------

GRANT SELECT, INSERT, UPDATE, DELETE ON refresh_tokens, platform_refresh_tokens TO inova_auth;
GRANT SELECT, UPDATE ON platform_users TO inova_auth;
