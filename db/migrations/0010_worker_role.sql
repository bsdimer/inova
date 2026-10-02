-- The worker's own database role (decision D21).
--
-- One non-privileged role per deployable, none with BYPASSRLS. The worker
-- runs jobs that span organisations; it iterates them and sets
-- `app.tenant_id` for each transaction, so the tenant_isolation policies apply
-- to it exactly as to core-api. It gets only what its jobs touch — today the
-- nightly retirement of lapsed invite codes and password resets.

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'inova_worker') THEN
    BEGIN
      -- Local-dev default, same convention as inova_app and inova_auth.
      -- Deployed environments re-set it from their own secret (deploy.sh).
      CREATE ROLE inova_worker LOGIN PASSWORD 'inova_worker' NOBYPASSRLS;
    EXCEPTION
      -- Roles are cluster-wide; parallel test databases can race the check.
      WHEN duplicate_object THEN NULL;
    END;
  END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO inova_worker;
-- The list of organisations to iterate; not tenant-owned.
GRANT SELECT ON tenants TO inova_worker;
-- Retiring lapsed codes: read the status, write `expired`. Nothing else.
GRANT SELECT, UPDATE ON invite_codes, password_resets TO inova_worker;
