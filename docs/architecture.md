# Architecture (stable invariants)

Source of decisions: [implementation-plan.md](implementation-plan.md) §4–§6.
Do not re-litigate RESOLVED items. This file is the short agent-facing extract.

## Services

Fixed set of three (stakeholder):

1. **auth-service** — users, credentials, refresh tokens, memberships, invite
   codes. Issues RS256 JWTs with `memberships: [{t, r}]` and optional
   `platform_role`. JWKS at `/.well-known/jwks.json`.
2. **core-api** — domain modules behind internal boundaries. Verifies JWTs via
   JWKS locally (no runtime call to auth-service). Tenant context from the
   membership claim + `X-Tenant-Id`, with a DB re-check for sensitive ops.
3. **worker** (M1 remainder) — BullMQ: email/SMS, push, PDFs, fee generation,
   webhooks. Never inline those side effects in request handlers.

Client-supplied brand, bundle ID, or tenant key is **never** an authorization
input.

## Tenant isolation

- Every tenant-owned table: `tenant_id` is `NOT NULL` and the **leading** column
  of the primary key and of tenant-scoped indexes.
- RLS enabled; policies use `NULLIF(current_setting('app.tenant_id', true), '')`.
- Runtime role `sosedo_app` has **no** `BYPASSRLS`.
- Identity tables may also allow `app.identity_scope = 'auth'` (auth-service
  cross-tenant reads). That is a policy, not a role-level bypass.
- Contract test: `apps/api/test/tenant-schema.contract.test.ts` (pg_catalog).

## Money and finance

- In code: `Money` in `packages/shared` — integer minor units, never floats.
- At rest: `NUMERIC(14,2)` / decimal strings + explicit `currency`.
- Financial rows are append-only. Corrections = reversal / credit-note rows.
- Append-only tables (today: `audit_records`) grant the app role SELECT+INSERT
  only — no UPDATE/DELETE.
- Money-creating POSTs: `Idempotency-Key`. Webhooks: unique
  `(provider, provider_event_id)`.

## Module boundaries

Each core-api module owns its tables. Do not import another module's
schema/tables. Cross-module communication is via interfaces or events.
ESLint enforces `no-restricted-imports` across `apps/api/src/modules/*`.

## Migrations

- Plain SQL in `db/migrations/`, applied by `db/migrate.mjs`.
- Privileged migrator role applies schema; `sosedo_app` never owns schema.
- Runner uses a PostgreSQL advisory lock, stores a SHA-256 checksum per file,
  and applies SQL + `schema_migrations` insert in one transaction.
- Changing an already-applied SQL file fails the runner (checksum mismatch).

## AuthN / AuthZ on HTTP

Every NestJS route is classified (`@Public()`, `@RequirePermissions`, or
platform/JWT guards). `pnpm check:routes` fails if a handler has no security
metadata. Classes:

| Class                | Meaning                                                 |
| -------------------- | ------------------------------------------------------- |
| public               | Health, JWKS, brand config, credential/invite endpoints |
| authenticated        | JWT required (e.g. `/auth/me`, set-password)            |
| platform             | JWT + `super_admin` (`PlatformGuard`)                   |
| tenant               | JWT + tenant context                                    |
| tenant + permissions | JWT + tenant + `@RequirePermissions(...)`               |

## White-label

`brands/<key>/brand.json` is the non-secret source of truth (Zod:
`brandConfigSchema`). `pnpm check:brands` validates every brand file.
Mobile tokens currently mirror that file by hand — generating them from
`brand.json` is a follow-up.

## Scale notes (do not implement early)

Shared schema + RLS is the baseline. Hash-partition hot tables when volume
requires it (`audit_records` already partitioned). Schema-per-tenant is
rejected. Citus/sharding is a later scale-out path.
