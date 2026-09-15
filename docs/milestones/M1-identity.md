# M1 — Identity, tenancy, RBAC

**Status:** Original global-user backend + admin staff/roles/wizard implemented,
but the stakeholder's B8 tenant-scoped account-realm decision requires an M1
schema/auth refactor **before M2**. Also deferred to pre-pilot: Redis revocation
denylist, worker, real SMS/Viber delivery, admin silent refresh, audit-trail
viewer.

## Goal

Staff can be invited and log in to a tenant realm; residents activate
manager-created tenant-local accounts with an invite code (B7/B8). The same
email/phone may identify independent accounts in two tenants without either
white-label app disclosing the other. Platform identities remain separate; RLS
is proven at SQL and API layers. A person may authenticate independent accounts
in several tenants and switch the active tenant in the shared mobile app
without creating a cross-tenant authorization token or exposing the other
accounts to any tenant.

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

- The same normalized email and phone can register independently in two
  tenants, but cannot be duplicated inside one tenant.
- Dedicated/shared app realm selection is mapped server-side before credential
  lookup; `X-Tenant-Id` must equal the tenant in the signed account token.
- Login, activation, resend, and password-reset responses do not reveal that an
  account with the same contact value exists in another tenant.
- Tenant accounts/JWTs never aggregate or expose other tenants. Each access and
  refresh token belongs to one tenant-account context. Platform users are
  separate identities.
- The mobile client can retain multiple tenant-account sessions in secure
  storage and switch explicitly between them; logout and revocation can target
  one context or all locally held contexts.
- One active tenant account may hold multiple roles. Role/view selection changes
  mobile navigation but never expands the server-validated permission set.
- Dedicated apps expose only server-mapped tenant realms; the shared app adds a
  realm via invitation/organization selection and authenticates it separately.
- Existing isolation, roles, refresh rotation, and audit tests remain green.

## Remaining before M2

- Forward migration and auth/API refactor from global users + membership arrays
  to tenant-scoped account realms and one-tenant-per-token claims (B8), plus a
  secure client-side session portfolio for explicit tenant switching.

## Remaining before pilot

- Redis access-token denylist on revoke/dismiss.
- Worker + real SMS/Viber (gateway still open: Twilio vs Infobip).
- Admin silent refresh; audit-trail page.

## Required tests (release blockers)

- `apps/api/test/tenant-isolation.e2e.test.ts`
- `apps/api/test/staff-roles.e2e.test.ts`
- `apps/auth-service/test/auth-flows.e2e.test.ts`
- `apps/api/test/tenant-schema.contract.test.ts` (covers these tables and all later tenant tables)
