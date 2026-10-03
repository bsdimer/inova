-- Messages handed to the worker for delivery (D41, WHI-149).
--
-- auth-service and core-api insert a row and queue a job; the worker sends it
-- and records the outcome here. The code or link token is never stored: it
-- travels only in the queued job, which is removed once the delivery has
-- succeeded or finally failed. A row that is `sent` is never sent again, so a
-- job delivered twice by the queue is one message.

CREATE TABLE message_deliveries (
  tenant_id   uuid NOT NULL REFERENCES tenants (id),
  id          uuid NOT NULL DEFAULT gen_random_uuid(),
  purpose     text NOT NULL
              CHECK (purpose IN ('invite_code', 'recovery_link', 'recovery_code', 'email_change_code')),
  channel     text NOT NULL CHECK (channel IN ('email', 'sms')),
  recipient   text NOT NULL CHECK (length(recipient) BETWEEN 3 AND 320),
  status      text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'sent', 'failed')),
  attempts    integer NOT NULL DEFAULT 0,
  -- The provider's answer on the last failed try; never the message body.
  last_error  text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  sent_at     timestamptz,
  failed_at   timestamptz,
  PRIMARY KEY (tenant_id, id)
);

-- Failures an organisation may want to see, newest first.
CREATE INDEX message_deliveries_status_idx ON message_deliveries (tenant_id, status, created_at);

ALTER TABLE message_deliveries ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON message_deliveries
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

-- Producers only record: recovery and e-mail change (auth-service), staff and
-- resident invitations (core-api).
GRANT SELECT, INSERT ON message_deliveries TO inova_auth;
GRANT SELECT, INSERT ON message_deliveries TO inova_app;
-- The worker reads what to send and records the outcome; a final failure is
-- written to the organisation's audit trail.
GRANT SELECT, UPDATE ON message_deliveries TO inova_worker;
GRANT INSERT ON audit_records TO inova_worker;
