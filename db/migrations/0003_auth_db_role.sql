-- Separate database role for auth-service.
--
-- Until now both services connected as `inova_app`, and the `identity_scope`
-- policies on the identity tables applied to every role. Any session able to
-- run `set_config('app.identity_scope', 'auth', ...)` — core-api, or an SQL
-- injection inside it — could therefore read staff memberships and invite codes
-- of ALL tenants. A policy that depends on a session setting is only as strong
-- as the set of roles allowed to use it, so that set is now one role:
--
--   inova_auth  auth-service only. May use identity scope. No BYPASSRLS.
--   inova_app   core-api (and later the worker). Tenant scope only.
--
-- 0001/0002 stay immutable; this is the forward change.

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'inova_auth') THEN
    BEGIN
      -- Local-dev default, same convention as inova_app. Deployed environments
      -- re-set it from their own secret right after migrating (deploy.sh).
      CREATE ROLE inova_auth LOGIN PASSWORD 'inova_auth' NOBYPASSRLS;
    EXCEPTION
      -- Roles are cluster-wide; parallel test databases can race the check.
      WHEN duplicate_object THEN NULL;
    END;
  END IF;
END
$$;

-- Identity scope belongs to auth-service alone. tenant_isolation stays PUBLIC:
-- both roles may act inside one tenant's context.
ALTER POLICY identity_scope ON staff_memberships TO inova_auth;
ALTER POLICY identity_scope ON invite_codes TO inova_auth;

-- Least privilege: exactly what auth-service reads and writes today.
GRANT USAGE ON SCHEMA public TO inova_auth;
GRANT SELECT ON tenants TO inova_auth;
GRANT SELECT, UPDATE ON users, staff_memberships, invite_codes TO inova_auth;
GRANT SELECT, INSERT, UPDATE, DELETE ON refresh_tokens TO inova_auth;

-- Refresh tokens are session credentials. core-api never touches them.
REVOKE ALL ON refresh_tokens FROM inova_app;
