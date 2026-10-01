-- M2: removal requests, link requests and building-scoped house managers
-- (decisions B10, D25, D27; security.md §6.2).
--
-- Removal. After a building is activated nothing that has history is deleted:
-- a house manager asks, with a reason and an end date, to end an occupancy,
-- remove a resident account or archive a property. A platform super_admin
-- decides; approving applies the request at once (team lead, 01.10), so the
-- request passes approved and applied in one step and both times are kept.
-- The author may edit or withdraw it while it is pending (D27).
--
-- Link («Заявки за връзка»). The fallback to manager-created residents: a
-- resident asks to be linked to a property, staff approve by choosing the
-- property (which creates the occupancy) or reject.
--
-- Managers. A role may be building-scoped: an account holding such a role
-- sees and changes only the buildings assigned to it. The seeded House
-- manager role is; the Administrator role never is (team lead, 01.10).

CREATE TABLE removal_requests (
  tenant_id       uuid NOT NULL REFERENCES tenants (id),
  id              uuid NOT NULL DEFAULT gen_random_uuid(),
  subject_type    text NOT NULL CHECK (subject_type IN ('occupancy', 'account', 'property')),
  subject_id      uuid NOT NULL,
  -- The building the subject belongs to: the scope filter and the queues use it.
  -- An account may live in several buildings; it carries the one it was asked from.
  building_id     uuid NOT NULL,
  reason          text NOT NULL CHECK (length(btrim(reason)) >= 10),
  -- The last day the occupancies count (inclusive, like occupancies.valid_to).
  effective_date  date NOT NULL,
  status          text NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'approved', 'rejected', 'applied', 'withdrawn')),
  requested_by    uuid NOT NULL,
  decided_by      uuid,
  decided_at      timestamptz,
  decision_note   text,
  applied_at      timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id),
  FOREIGN KEY (tenant_id, building_id) REFERENCES buildings (tenant_id, id)
);

-- One open request per subject: a second one would race the first.
CREATE UNIQUE INDEX removal_requests_pending_unique
  ON removal_requests (tenant_id, subject_type, subject_id) WHERE status = 'pending';
CREATE INDEX removal_requests_status_idx ON removal_requests (tenant_id, status, created_at);
CREATE INDEX removal_requests_building_idx ON removal_requests (tenant_id, building_id);

CREATE TABLE link_requests (
  tenant_id      uuid NOT NULL REFERENCES tenants (id),
  id             uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL,
  role           text NOT NULL CHECK (role IN ('owner', 'tenant')),
  valid_from     date NOT NULL,
  -- What the resident knows about the property, as they wrote it.
  address        text NOT NULL,
  entrance       text,
  floor          text,
  number         text NOT NULL,
  note           text,
  status         text NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending', 'approved', 'rejected', 'withdrawn')),
  apartment_id   uuid,
  occupancy_id   uuid,
  decided_by     uuid,
  decided_at     timestamptz,
  decision_note  text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id),
  FOREIGN KEY (tenant_id, user_id) REFERENCES users (tenant_id, id),
  FOREIGN KEY (tenant_id, apartment_id) REFERENCES apartments (tenant_id, id),
  FOREIGN KEY (tenant_id, occupancy_id) REFERENCES occupancies (tenant_id, id)
);

CREATE INDEX link_requests_status_idx ON link_requests (tenant_id, status, created_at);
CREATE INDEX link_requests_user_idx ON link_requests (tenant_id, user_id);

CREATE TABLE building_manager_assignments (
  tenant_id    uuid NOT NULL,
  id           uuid NOT NULL DEFAULT gen_random_uuid(),
  building_id  uuid NOT NULL,
  user_id      uuid NOT NULL,
  assigned_by  uuid NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  -- Ended, not deleted: who managed a building when stays answerable.
  ended_at     timestamptz,
  PRIMARY KEY (tenant_id, id),
  FOREIGN KEY (tenant_id, building_id) REFERENCES buildings (tenant_id, id),
  FOREIGN KEY (tenant_id, user_id) REFERENCES users (tenant_id, id)
);

CREATE UNIQUE INDEX building_manager_assignments_open_unique
  ON building_manager_assignments (tenant_id, building_id, user_id) WHERE ended_at IS NULL;
CREATE INDEX building_manager_assignments_user_idx
  ON building_manager_assignments (tenant_id, user_id) WHERE ended_at IS NULL;

ALTER TABLE removal_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON removal_requests
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

ALTER TABLE link_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON link_requests
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

ALTER TABLE building_manager_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON building_manager_assignments
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

-- Requests and assignments are decided or ended, never deleted.
GRANT SELECT, INSERT, UPDATE ON removal_requests, link_requests, building_manager_assignments TO inova_app;

-- ---------------------------------------------------------------------------
-- Building-scoped roles
-- ---------------------------------------------------------------------------

ALTER TABLE roles ADD COLUMN building_scoped boolean NOT NULL DEFAULT false;
ALTER TABLE roles ADD CONSTRAINT roles_admin_unscoped CHECK (key <> 'admin' OR NOT building_scoped);
UPDATE roles SET building_scoped = true WHERE key = 'manager' AND is_system;

-- ---------------------------------------------------------------------------
-- The right to ask for a removal (named in the admin's catalogue already).
-- ---------------------------------------------------------------------------

INSERT INTO permissions (key, description) VALUES
  ('property.removal.request', 'Ask the platform to end an occupancy, remove a resident or archive a property');

INSERT INTO role_permissions (tenant_id, role_key, permission_key)
SELECT r.tenant_id, r.key, 'property.removal.request'
FROM roles r
WHERE r.key = 'admin' OR (r.key = 'manager' AND r.is_system);
