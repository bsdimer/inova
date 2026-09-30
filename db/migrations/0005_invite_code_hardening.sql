-- Invite-code hardening (decisions B14, B15).
--
-- A code is no longer the credential by itself: activation names the account
-- (phone or e-mail) and the code, inside one realm. That makes an attempt
-- counter possible and lets the table say what state a code is in:
--
--   active    the one code the account can activate with
--   consumed  used (consumed_at says when)
--   voided    replaced by a newer code, or burnt by five wrong attempts
--   expired   past expires_at — set on read and by the daily job (worker, later)
--
-- Two partial unique indexes on active rows: an account has at most one active
-- code, and no two active codes of a realm share a hash.

ALTER TABLE invite_codes
  ADD COLUMN status text NOT NULL DEFAULT 'active'
  CHECK (status IN ('active', 'consumed', 'expired', 'voided'));

UPDATE invite_codes SET status = 'consumed' WHERE consumed_at IS NOT NULL;
UPDATE invite_codes SET status = 'expired' WHERE status = 'active' AND expires_at <= now();

-- Rows written before the rule existed: keep the newest active code of each
-- account, and of each hash inside a realm; the older ones are voided.
UPDATE invite_codes c SET status = 'voided'
WHERE c.status = 'active' AND EXISTS (
  SELECT 1 FROM invite_codes n
  WHERE n.tenant_id = c.tenant_id AND n.user_id = c.user_id AND n.status = 'active'
    AND (n.created_at, n.id) > (c.created_at, c.id)
);
UPDATE invite_codes c SET status = 'voided'
WHERE c.status = 'active' AND EXISTS (
  SELECT 1 FROM invite_codes n
  WHERE n.tenant_id = c.tenant_id AND n.code_hash = c.code_hash AND n.status = 'active'
    AND (n.created_at, n.id) > (c.created_at, c.id)
);

DROP INDEX invite_codes_tenant_hash_idx;
DROP INDEX invite_codes_tenant_user_idx;

CREATE UNIQUE INDEX invite_codes_active_hash_unique
  ON invite_codes (tenant_id, code_hash) WHERE status = 'active';
CREATE UNIQUE INDEX invite_codes_active_account_unique
  ON invite_codes (tenant_id, user_id) WHERE status = 'active';
CREATE INDEX invite_codes_account_idx ON invite_codes (tenant_id, user_id);

-- Resending voids the old code and writes a new row (the history stays), so
-- auth-service now inserts here too.
GRANT INSERT ON invite_codes TO inova_auth;
