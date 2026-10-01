-- M2: who lives in a property, and since when (decisions B7, B9, A-OCCUPANCY).
--
-- An occupancy links a person to a property with a role and dates. Owners and
-- tenants always have an account — the manager creates it and an invite code
-- goes out. An occupant may be a household member without an account (a child,
-- a relative): the resident records them by name, because fees per occupant
-- count them. Several owners of one property are several owner occupancies.
--
-- Dates are calendar days in the organisation's time zone; valid_to is the last
-- day the occupancy counts (inclusive), NULL while it lasts. Ending an
-- occupancy after activation needs the approval flow (B10) — a later migration.

CREATE TABLE occupancies (
  tenant_id     uuid NOT NULL,
  id            uuid NOT NULL DEFAULT gen_random_uuid(),
  apartment_id  uuid NOT NULL,
  user_id       uuid,
  role          text NOT NULL CHECK (role IN ('owner', 'tenant', 'occupant')),
  -- The name of an occupant without an account; an account carries its own.
  first_name    text,
  last_name     text,
  valid_from    date NOT NULL,
  valid_to      date,
  created_by    uuid NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id),
  FOREIGN KEY (tenant_id, apartment_id) REFERENCES apartments (tenant_id, id),
  FOREIGN KEY (tenant_id, user_id) REFERENCES users (tenant_id, id),
  CHECK (valid_to IS NULL OR valid_to >= valid_from),
  CHECK (role = 'occupant' OR user_id IS NOT NULL),
  CHECK (user_id IS NOT NULL OR first_name IS NOT NULL)
);

-- A person holds a role on a property once at a time.
CREATE UNIQUE INDEX occupancies_open_unique
  ON occupancies (tenant_id, apartment_id, user_id, role) WHERE valid_to IS NULL AND user_id IS NOT NULL;
CREATE INDEX occupancies_apartment_idx ON occupancies (tenant_id, apartment_id);
CREATE INDEX occupancies_user_idx ON occupancies (tenant_id, user_id);

CREATE TABLE pets (
  tenant_id     uuid NOT NULL,
  id            uuid NOT NULL DEFAULT gen_random_uuid(),
  apartment_id  uuid NOT NULL,
  name          text NOT NULL,
  species       text NOT NULL CHECK (species IN ('dog', 'cat', 'other')),
  valid_from    date NOT NULL,
  valid_to      date,
  created_by    uuid NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id),
  FOREIGN KEY (tenant_id, apartment_id) REFERENCES apartments (tenant_id, id),
  CHECK (valid_to IS NULL OR valid_to >= valid_from)
);

CREATE INDEX pets_apartment_idx ON pets (tenant_id, apartment_id);

ALTER TABLE occupancies ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON occupancies
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

ALTER TABLE pets ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON pets
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

-- Occupancies and pets are ended, never deleted: no DELETE for the app role.
GRANT SELECT, INSERT, UPDATE ON occupancies, pets TO inova_app;

INSERT INTO permissions (key, description) VALUES
  ('residents.read', 'See the residents, occupants and pets of properties');

INSERT INTO role_permissions (tenant_id, role_key, permission_key)
SELECT r.tenant_id, r.key, 'residents.read'
FROM roles r
WHERE r.key = 'admin' OR (r.key = 'manager' AND r.is_system);
