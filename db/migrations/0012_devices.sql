-- The phones a tenant account uses the app on (WHI-129; part of M7, built
-- ahead so the rebuilt resident app registers from its first sign-in).
--
-- A push token identifies one app install. Inside an organisation it belongs
-- to whoever signed in on it last: registering it again moves it to that
-- account. The same phone in two organisations (the shared app, M10) is two
-- rows. `last_seen_at` is refreshed on every registration; it later decides
-- who counts as «без приложението» and gets an SMS instead (D36).

CREATE TABLE devices (
  tenant_id     uuid NOT NULL REFERENCES tenants (id),
  id            uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL,
  platform      text NOT NULL CHECK (platform IN ('ios', 'android')),
  push_token    text NOT NULL CHECK (length(push_token) BETWEEN 1 AND 4096),
  -- The app's bundle id / package: which brand's app holds the token (WL).
  app_id        text,
  locale        text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  last_seen_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id),
  FOREIGN KEY (tenant_id, user_id) REFERENCES users (tenant_id, id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX devices_token_unique ON devices (tenant_id, push_token);
CREATE INDEX devices_account_idx ON devices (tenant_id, user_id);

ALTER TABLE devices ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON devices
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

-- A device is removed on sign-out: DELETE is the normal lifecycle here.
GRANT SELECT, INSERT, UPDATE, DELETE ON devices TO inova_app;
