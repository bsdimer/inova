-- Rename the product/runtime identity from the legacy product name to inova.
-- Keep 0001 immutable: deployed databases verify its checksum.

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'inova_app') THEN
    BEGIN
      CREATE ROLE inova_app LOGIN PASSWORD 'inova_app';
    EXCEPTION
      -- Test databases migrate in parallel but PostgreSQL roles are cluster-wide.
      WHEN duplicate_object THEN NULL;
    END;
  END IF;

  -- Keep the legacy role as a disabled compatibility sentinel. Migration 0001
  -- must continue to see it in new databases, otherwise parallel migrations can
  -- race while trying to recreate the same cluster-wide role.
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'sosedo_app') THEN
    ALTER ROLE sosedo_app NOLOGIN;
  END IF;
END
$$;

-- Parallel test databases share cluster roles. Grant explicitly in every
-- database even when another test already created/renamed the role.
ALTER ROLE inova_app LOGIN PASSWORD 'inova_app';
GRANT USAGE ON SCHEMA public TO inova_app;
GRANT SELECT, INSERT, UPDATE ON tenants, brands, users TO inova_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON refresh_tokens, invite_codes TO inova_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON roles, role_permissions, staff_memberships TO inova_app;
GRANT SELECT ON permissions TO inova_app;
GRANT SELECT, INSERT ON audit_records TO inova_app;

ALTER TABLE tenants ALTER COLUMN brand_key SET DEFAULT 'inova';

UPDATE tenants
SET brand_key = 'inova',
    updated_at = now()
WHERE brand_key = 'sosedo';

UPDATE tenants
SET key = 'inova',
    name = 'WhiteNova Technology',
    updated_at = now()
WHERE key = 'sosedo';

UPDATE brands
SET key = 'inova',
    name = 'inova',
    config = jsonb_set(
      jsonb_set(
        jsonb_set(
          jsonb_set(
            jsonb_set(
              jsonb_set(
                jsonb_set(
                  jsonb_set(config, '{key}', '"inova"', true),
                  '{name}', '"inova"', true
                ),
                '{displayName}', '"inova"', true
              ),
              '{company}', '{"legalName":"WhiteNova Technology"}'::jsonb, true
            ),
            '{distribution,ios,bundleId}', '"bg.inova.resident"', true
          ),
          '{distribution,android,package}', '"bg.inova.resident"', true
        ),
        '{distribution,deepLinkDomain}', '"app.inova.bg"', true
      ),
      '{distribution,scheme}', '"inova"', true
    ) || jsonb_build_object(
      'support',
      COALESCE(config -> 'support', '{}'::jsonb) || jsonb_build_object('email', 'support@inova.bg')
    ),
    updated_at = now()
WHERE key = 'sosedo';

UPDATE users
SET email = regexp_replace(email, '@sosedo\.bg$', '@inova.bg'),
    updated_at = now()
WHERE email ~* '@sosedo\.bg$';
