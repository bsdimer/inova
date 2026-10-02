-- Changing one's e-mail address (WHI-128).
--
-- A new address takes effect only after the code sent to it is entered, so
-- nobody attaches an address they do not own — the e-mail is also where a
-- recovery link goes (B13). One active change per account; a new request
-- voids the previous one; five wrong codes void it. The code is stored as a
-- hash only, like invite codes and password resets.

CREATE TABLE email_changes (
  tenant_id     uuid NOT NULL REFERENCES tenants (id),
  id            uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL,
  new_email     text NOT NULL,
  code_hash     text NOT NULL,
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

CREATE UNIQUE INDEX email_changes_active_unique
  ON email_changes (tenant_id, user_id) WHERE status = 'active';

ALTER TABLE email_changes ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON email_changes
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

GRANT SELECT, INSERT, UPDATE ON email_changes TO inova_auth;
