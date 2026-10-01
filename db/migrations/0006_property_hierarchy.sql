-- M2: buildings, entrances and properties.
--
-- A building is set up as a draft — entrances and properties may be added and
-- removed freely — and is then activated; from that point a property leaves
-- only through the approval flow (removal requests, a later migration).
-- "Property" is the word for what the table calls an apartment: a flat, a
-- garage, a shop, a storage room or a parking spot (D26).
--
-- All three tables are tenant-owned: tenant_id leads every key and index, RLS
-- by tenant context.

CREATE TABLE buildings (
  tenant_id         uuid NOT NULL REFERENCES tenants (id),
  id                uuid NOT NULL DEFAULT gen_random_uuid(),
  name              text NOT NULL,
  -- City and district are columns of their own: the list filters by them (D24).
  city              text NOT NULL,
  district          text NOT NULL,
  address           text NOT NULL,
  -- What a contractor needs on site (D30).
  floors            integer NOT NULL CHECK (floors BETWEEN 1 AND 200),
  has_elevator      boolean NOT NULL DEFAULT false,
  -- How monthly fees are shared between the properties; rules come in M3.
  assessment_basis  text NOT NULL
                    CHECK (assessment_basis IN ('fixed', 'per_area', 'per_occupant', 'per_ideal_part', 'per_room')),
  -- D36: shown to residents and used in messages; both optional.
  bank_account      text,
  signature_name    text,
  status            text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived')),
  activated_at      timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id)
);

CREATE INDEX buildings_place_idx ON buildings (tenant_id, city, district);

CREATE TABLE entrances (
  tenant_id    uuid NOT NULL,
  id           uuid NOT NULL DEFAULT gen_random_uuid(),
  building_id  uuid NOT NULL,
  name         text NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id),
  FOREIGN KEY (tenant_id, building_id) REFERENCES buildings (tenant_id, id) ON DELETE CASCADE,
  -- Lets a property prove its entrance belongs to its own building.
  UNIQUE (tenant_id, building_id, id)
);

CREATE UNIQUE INDEX entrances_name_unique ON entrances (tenant_id, building_id, lower(name));

CREATE TABLE apartments (
  tenant_id      uuid NOT NULL,
  id             uuid NOT NULL DEFAULT gen_random_uuid(),
  building_id    uuid NOT NULL,
  entrance_id    uuid NOT NULL,
  floor          integer NOT NULL CHECK (floor BETWEEN -10 AND 200),
  number         text NOT NULL,
  property_type  text NOT NULL DEFAULT 'apartment'
                 CHECK (property_type IN ('apartment', 'garage', 'shop', 'storage', 'parking_spot')),
  rooms          integer CHECK (rooms BETWEEN 1 AND 50),
  area_m2        numeric(8, 2) CHECK (area_m2 > 0),
  -- Share of the common parts, in percent.
  ideal_parts    numeric(7, 4) CHECK (ideal_parts >= 0 AND ideal_parts <= 100),
  status         text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id),
  FOREIGN KEY (tenant_id, building_id) REFERENCES buildings (tenant_id, id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id, building_id, entrance_id) REFERENCES entrances (tenant_id, building_id, id)
);

-- The business key: no two properties of a building share entrance, floor and
-- number. The floor is part of it — «ап. 3» may exist on two floors.
CREATE UNIQUE INDEX apartments_natural_key
  ON apartments (tenant_id, building_id, entrance_id, floor, lower(number));
CREATE INDEX apartments_entrance_idx ON apartments (tenant_id, entrance_id);

ALTER TABLE buildings ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON buildings
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

ALTER TABLE entrances ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON entrances
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

ALTER TABLE apartments ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON apartments
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

GRANT SELECT, INSERT, UPDATE, DELETE ON buildings, entrances, apartments TO inova_app;

-- ---------------------------------------------------------------------------
-- Permissions. The administrator role always holds every right; the seeded
-- house-manager role sets buildings up, so it gets both.
-- ---------------------------------------------------------------------------

INSERT INTO permissions (key, description) VALUES
  ('property.read',  'See buildings, entrances and properties'),
  ('property.write', 'Create, edit and activate buildings, entrances and properties');

INSERT INTO role_permissions (tenant_id, role_key, permission_key)
SELECT r.tenant_id, r.key, p.key
FROM roles r
CROSS JOIN (VALUES ('property.read'), ('property.write')) AS p (key)
WHERE r.key = 'admin' OR (r.key = 'manager' AND r.is_system);
