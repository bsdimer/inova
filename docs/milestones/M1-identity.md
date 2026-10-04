# M1 — Identity, tenancy, RBAC

**Status:** In progress. Backend + admin staff/roles/wizard implemented; the
B8 tenant-account realms landed 2026-09-30 (#57, migration `0004`) and
activation by identifier + code with one active code (B14–B15) the same day
(#58, migration `0005`), password recovery (B13) on 2026-10-01 (#74, migration
`0008`). Nothing is left before M2. Admin silent refresh landed 2026-10-02 (#72) and the worker
skeleton the same night (#81, migration `0010`, nightly expiry of lapsed codes).
Also deferred to pre-pilot: Redis revocation denylist, real SMS/Viber and
transactional e-mail delivery, audit-trail viewer.

## Goal

Staff can be invited and log in to a tenant realm; residents activate
manager-created tenant-local accounts with an invite code (B7/B8). The same
email/phone may identify independent accounts in two tenants without either
white-label app disclosing the other. Platform identities remain separate; RLS
is proven at SQL and API layers. A person may hold independent accounts in
several tenants; no auth response reveals the other accounts, and no token
spans tenants. (Switching among them in the shared mobile app is M10.)

## Tables (`0001_identity_tenancy.sql`)

Target: `tenants`, `brands`, tenant-scoped `users`/accounts, separate
`platform_users`, `refresh_tokens`, `permissions`, `roles`,
`role_permissions`, `staff_memberships`, `invite_codes`, `audit_records`
(hash-partitioned, append-only). Tenant accounts require tenant-leading keys,
RLS, and unique `(tenant_id, normalized_email)` /
`(tenant_id, normalized_phone)` indexes. Migration `0001_identity_tenancy.sql`
currently implements global users and must be superseded by a forward
migration, not edited after application.

## APIs

**auth-service:** `POST /v1/auth/login|activate|resend-code|refresh|logout|password`,
`GET /v1/auth/me`, `GET /.well-known/jwks.json`.

**core-api:** `GET /v1/tenant` (+ staff, roles, permissions, audit);
`GET|POST /v1/platform/tenants`; JWT + tenant + permission guards.

## Previously met acceptance

- Two seeded tenants; staff of A cannot read B (isolation suite).
- Audit rows on role/staff/provisioning mutations.
- Invite-code activation is single-use; refresh reuse revokes the family.

## Required B8 refactor acceptance (before M2)

**Met 2026-09-30 (#57)** except the multi-role item, which needs M2
occupancies, and the shared-app realm item (M10).

- The same normalized email and phone can register independently in two
  tenants, but cannot be duplicated inside one tenant.
- Dedicated/shared app realm selection is mapped server-side before credential
  lookup; `X-Tenant-Id` must equal the tenant in the signed account token.
- Login, activation, resend, and password-reset responses do not reveal that an
  account with the same contact value exists in another tenant.
- Tenant accounts/JWTs never aggregate or expose other tenants. Each access and
  refresh token belongs to one tenant-account context. Platform users are
  separate identities.
- **Moved to M10 (2026-09-21):** the mobile client retaining several
  tenant-account sessions and switching between them. The pilot has one
  tenant, and the plan's own scope table already lists shared-app tenant
  selection as P1. What stays in M1 so the move is cheap later: every token,
  refresh family, cache, offline queue and push registration is keyed by
  tenant account from day one, and logout/revocation targets one context.
- One active tenant account may hold multiple roles. Role/view selection changes
  mobile navigation but never expands the server-validated permission set.
- Dedicated apps expose only server-mapped tenant realms; the shared app adds a
  realm via invitation/organization selection and authenticates it separately.
- Existing isolation, roles, refresh rotation, and audit tests remain green.

## Account recovery and invite-code hardening (B13–B15)

**Done 2026-09-30 (#58):** the `invite_codes` migration, `activate` with
identifier + code, `resend-code`, the invite lifetime setting
(`INVITE_CODE_TTL_DAYS`, 1–90 days). **Done 2026-10-01 (#74):** recovery by e-mail link or phone code
(`RECOVERY_LINK_TTL_MINUTES` 60, 15–1440; `RECOVERY_CODE_TTL_MINUTES` 10, 5–30),
single use, five tries, every session revoked, audited. **Done since:** the
worker sends the link and code (#101); the link opens `/auth/v1/auth/reset`,
which hands over to the app as `inova://reset?token=…` (#102); the mobile
activation identifier field (#97) and the mobile recovery screens (WHI-157).
**Left:** Infobip SMS, and recovery on the admin sign-in page.

- Forward migration on `invite_codes`: `status` column, partial unique indexes
  `(tenant_id, code_hash)` and `(tenant_id, user_id)` on active rows; a
  `password_resets` table (tenant-leading PK, RLS, hashed token/code, channel,
  attempts, expiry, consumed_at).
- `POST /v1/auth/activate` takes realm + identifier + code; five wrong
  attempts void the code; one generic error for every failure.
- `POST /v1/auth/resend-code` is realm-scoped, voids the previous code and
  issues a new one in one transaction.
- `POST /v1/auth/recovery` (email or phone) and `POST /v1/auth/recovery/confirm`
  (link token, or phone + code, plus the new password): public, strict
  throttle, identical responses, lifetime returned to the client.
- A successful reset revokes the account's refresh-token families and writes
  an audit record. Staff TOTP is not bypassed.
- Settings with bounds validated at start-up: recovery link, recovery code and
  invite lifetimes (defaults 60 min, 10 min, 30 days).
- Delivery and the daily voiding job run in the worker; the worker skeleton and
  expiry job exist, but delivery stays MOCK until D41/D36 channels are ready.
- Mobile and admin: the activation screen gains the identifier field (the
  shipped mobile screen is code-only today); forgot-password flow with the
  email path first and "recover by phone" second; no remaining-attempts text.

Required tests (release blockers, `auth-flows.e2e`): same email/phone in two
tenants recovers only in the requested realm; unknown and known accounts get
byte-identical responses; link and code are single-use and expire at the
configured lifetime; sixth wrong activation attempt fails even with the right
code; resend voids the old code; a second active code cannot be inserted;
reset revokes existing sessions; out-of-bounds lifetime settings fail start-up.

## Remaining before M2

- Nothing: B8 (#57), B14–B15 (#58) and B13 (#74) are done.

## Remaining before M3

- **Worker skeleton — built 2026-10-02 (#81):** `apps/worker`, BullMQ on
  Redis, `inova_worker` DB role without BYPASSRLS, `forEachTenant` (one
  transaction per tenant), first job `expire-lapsed-codes` nightly at 02:15
  Europe/Sofia. The image is built on `develop` (#86); the test
  stack runs it (#95).

## Remaining before pilot

- Redis access-token denylist on revoke/dismiss; fails open for ordinary
  requests, closed for sensitive ones (D20).
- Real SMS/Viber delivery through the worker (gateway: Infobip — D36; the
  contract and the sender registration are long-lead items, see M-Pilot). Until then `MockCodeDelivery` logs
  codes and refuses to start in production without `CODE_DELIVERY=log`.
- Transactional e-mail through Infobip Email (D41), first for recovery links
  and e-mail-change codes, then staff/resident invitations (including the M2
  activation batch, D40). Use `notify.whitenova.tech` as the planned sending
  subdomain of the owned `whitenova.tech` domain. Verify the sender/domain in
  Infobip and publish the account-provided SPF and DKIM DNS records; check
  DMARC alignment and a real test delivery before enabling production sends.
  Keep the API key and sender configuration in environment secrets. Auth/core
  APIs enqueue delivery after committing the code; the worker uses a stable
  delivery id, bounded retries and failure visibility without logging links,
  tokens or codes. MailHog remains the local boundary. The SMS/phone path
  stays separate. Provisioning and DNS are long-lead M-Pilot items, not
  evidence that real delivery already works.
- Delivery tests: duplicate jobs send once, transient provider failure retries,
  permanent failure is visible to staff without exposing the code; an unknown
  account has the same public response and does not create a deliverable
  message; cross-tenant recipients never receive another realm's link; e-mail
  change reaches only the pending new address. A controlled test delivery
  verifies the sending domain before the pilot.
- Audit-trail page (before the pilot — the platform rail already shows «Одитен дневник»). One screen for both scopes: the platform administrator sees every organisation with an organisation filter (Figma «V2 · Одитен дневник» `2343:54613`); an organisation account with `audit.read` (the seeded Administrator role) sees its own trail through `GET /v1/tenant/audit`, reached from the organisation's settings, not a tenth rail item — the nine-item menu stands (WHI-24).

## Hardening done outside the phase scope (2026-09-21)

Defects in running code, fixed without starting the B8 or B13–B15 work:

- `inova_auth` DB role; identity-scope policies granted to it alone
  (migration `0003`). core-api's role can no longer read other tenants'
  memberships and invite codes by setting a session variable.
- Strict limit on login/activate/resend actually applies: the deployed value
  `'true'` parsed to `NaN` and disabled it. Malformed settings now stop the
  service.
- Per-client rate limiting behind the edge proxy (`TRUST_PROXY_HOPS`).
- One-time codes are logged only with an explicit opt-in in production.
- Passwords are hashed with argon2id as the plan always said; the code had
  used bcrypt (cost 10). Existing bcrypt hashes are upgraded on the next
  successful login. `TODO(M1)`: drop the bcrypt verification path once no
  `$2` hash remains.
- Login runs one argon2id verification on every failure (a dummy hash when
  the account is unknown, inactive or has no password), so response time no
  longer tells which e-mails have an account (2026-09-24).

## Required tests (release blockers)

- `apps/api/test/tenant-isolation.e2e.test.ts`
- `apps/api/test/staff-roles.e2e.test.ts`
- `apps/auth-service/test/auth-flows.e2e.test.ts`
- `apps/auth-service/test/rate-limit.e2e.test.ts`
- `apps/api/test/tenant-schema.contract.test.ts` (covers these tables and all later tenant tables)

## Full scope by layer

Moved verbatim from the implementation plan §7 when it was split. Where this and the sections above differ, the sections above are newer.

**Effort / sequencing:** L

- **Goal:** staff can be invited to a tenant and log in to the admin shell; residents activate manager-created tenant-realm accounts with an invite code (B7/B8); the same email/phone can hold independent accounts in different tenants without cross-brand disclosure; the shared mobile app retains and switches those tenant contexts (→ M10, moved 2026-09-21); multi-role accounts are presented correctly; RLS is proven.
- **Dependencies:** M0.
- **DB:** `tenants, brands, tenant_accounts/users, platform_users, staff_memberships, roles, permissions, refresh_tokens, audit_records`; tenant account `tenant_id`-leading keys/RLS; unique `(tenant_id, normalized_email)` and `(tenant_id, normalized_phone)` indexes; seed script (2 tenants with duplicate contact values for isolation tests).
- **Backend:** **auth-service** as its own deployable: realm-scoped login/refresh rotation/logout, **invite-code activation** (manager pre-creates the resident account; one-time code hashed at rest, expiring, rate-limited, unique inside the realm; delivery via SMS/Viber through the worker — MailHog/console fallback locally), JWT issuance with one `tenant_id` + kind + multiple applicable role claims or a separate `platform_role` token, JWKS endpoint, revocation denylist; enumeration-safe login/reset/invite responses that never expose another realm. Each refresh-token family is tenant-account-bound; no endpoint returns an unscoped cross-tenant account list. **core-api**: JWKS verification, tenant context equality check + DB re-check for sensitive ops, permission guards, **super_admin platform guard + tenant provisioning endpoints**, audit-record writer, invitation flow, tenant entitlement flags.
- **Admin:** realm-scoped login, staff & roles management screens; explicit tenant-context entry for platform operators; **super_admin console shell: tenant provisioning/initialization wizard** (billing config screens follow in M-Bill).
- **Mobile:** invite-code activation + login screens; secure local portfolio of authenticated tenant accounts and the add/switch/remove-tenant-context flow (→ M10); tenant-namespaced API cache, offline queue, analytics identity, deep links, and push routing; multi-role view selector that never changes authorization.
- **Tests:** auth unit tests; same email and same phone registered independently in two tenants; login/reset/invite enumeration does not leak the other realm; token tenant cannot be changed with `X-Tenant-Id`; switching clears/changes all active cache and push context; role-view selection cannot elevate permissions; single-context and all-local-context logout/revocation behavior; **tenant-isolation suite v1** (cross-tenant 403s) — permanent CI gate; RLS policy tests at SQL level.
- **Acceptance:** demo: two tenants, staff of A cannot read B by any endpoint; audit rows written for role changes.
- **Risks:** getting RLS + connection pooling right (use transaction-scoped `SET LOCAL app.tenant_id`); decide session pooling mode early.
