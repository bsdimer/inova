# M1 — Identity, tenancy, RBAC

**Status:** Backend + admin staff/roles/wizard **done**. Deferred to pre-pilot:
Redis revocation denylist, worker, real SMS/Viber delivery, admin silent
refresh, audit-trail viewer.

## Goal

Staff can be invited and log in to admin; residents activate manager-created
accounts with an invite code (B7); RLS is proven at SQL and API layers.

## Tables (`0001_identity_tenancy.sql`)

`tenants`, `brands`, `users`, `refresh_tokens`, `permissions`, `roles`,
`role_permissions`, `staff_memberships`, `invite_codes`, `audit_records`
(hash-partitioned, append-only).

## APIs

**auth-service:** `POST /v1/auth/login|activate|resend-code|refresh|logout|password`,
`GET /v1/auth/me`, `GET /.well-known/jwks.json`.

**core-api:** `GET /v1/tenant` (+ staff, roles, permissions, audit);
`GET|POST /v1/platform/tenants`; JWT + tenant + permission guards.

## Acceptance (met)

- Two seeded tenants; staff of A cannot read B (isolation suite).
- Audit rows on role/staff/provisioning mutations.
- Invite-code activation is single-use; refresh reuse revokes the family.

## Remaining (do before pilot, not before M2)

- Redis access-token denylist on revoke/dismiss.
- Worker + real SMS/Viber (gateway still open: Twilio vs Infobip).
- Admin silent refresh; audit-trail page.

## Required tests (release blockers)

- `apps/api/test/tenant-isolation.e2e.test.ts`
- `apps/api/test/staff-roles.e2e.test.ts`
- `apps/auth-service/test/auth-flows.e2e.test.ts`
- `apps/api/test/tenant-schema.contract.test.ts` (covers these tables and all later tenant tables)
