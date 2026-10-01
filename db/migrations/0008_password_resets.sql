-- Password recovery by e-mail or phone (decision B13).
--
-- A reset belongs to one account of one tenant. E-mail sends a single-use link
-- (a long random token); phone sends a six-digit code that counts wrong tries
-- like an invite code (five void it). Both are stored as hashes only. An
-- account has at most one active reset per channel; a new request voids the
-- previous one.
--
--   active    usable until expires_at
--   consumed  used to set a new password
--   voided    replaced by a newer request, burnt by wrong codes, or another
--             reset of the account succeeded
--   expired   past expires_at — written when someone tries it

CREATE TABLE password_resets (
  tenant_id     uuid NOT NULL REFERENCES tenants (id),
  id            uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL,
  channel       text NOT NULL CHECK (channel IN ('email', 'phone')),
  secret_hash   text NOT NULL,
  status        text NOT NULL DEFAULT 'active'
                CHECK (status IN ('active', 'consumed', 'expired', 'voided')),
  attempts      integer NOT NULL DEFAULT 0,
  max_attempts  integer NOT NULL DEFAULT 5,
  expires_at    timestamptz NOT NULL,
  consumed_at   timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id),
  FOREIGN KEY (tenant_id, user_id) REFERENCES users (tenant_id, id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX password_resets_active_unique
  ON password_resets (tenant_id, user_id, channel) WHERE status = 'active';
-- A link is found by its token; a code is found through the account.
CREATE UNIQUE INDEX password_resets_link_unique
  ON password_resets (tenant_id, secret_hash) WHERE status = 'active' AND channel = 'email';

ALTER TABLE password_resets ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON password_resets
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

GRANT SELECT, INSERT, UPDATE ON password_resets TO inova_auth;

-- A successful reset is audited (B13). Append-only like for core-api: insert only.
GRANT INSERT ON audit_records TO inova_auth;
