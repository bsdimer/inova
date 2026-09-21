# Architecture (stable invariants)

Source of decisions: [plan/system-design.md](plan/system-design.md) (§4),
[plan/data-model.md](plan/data-model.md) (§5), [plan/security.md](plan/security.md)
(§6) and [plan/decisions.md](plan/decisions.md).
Do not re-litigate RESOLVED items. This file is the short agent-facing extract.

## Services

Fixed set of three (stakeholder):

1. **auth-service** — tenant-scoped accounts, credentials, refresh tokens,
   role assignments, invite codes, and separate platform identities. Issues
   RS256 tenant-account JWTs with `tenant_id`, account kind, and `roles[]`, or
   separate platform JWTs with optional `platform_role`. JWKS at
   `/.well-known/jwks.json`.
2. **core-api** — domain modules behind internal boundaries. Verifies JWTs via
   JWKS locally (no runtime call to auth-service). Tenant context from the
   signed tenant claim + `X-Tenant-Id` equality, with a DB re-check for
   sensitive ops.
3. **worker** (M1 remainder) — BullMQ: email/SMS, push, PDFs, fee generation,
   webhooks. Never inline those side effects in request handlers.

Client-supplied brand, bundle ID, organization code, or tenant key may select a
candidate authentication realm only after server-side mapping; it is **never**
authorization. After login, the signed token tenant is authoritative.

## Account realms and white-label privacy

- Tenant-facing accounts belong to exactly one tenant. Normalized email and
  phone are unique within that tenant, not globally.
- The same email/phone in another tenant is an independent account. Login,
  activation, reset, rate limits, error messages, and product APIs must never
  reveal, merge, or link the other realm.
- A person may participate in multiple tenants through multiple independently
  authenticated tenant accounts. The shared mobile app keeps a secure local
  portfolio of those sessions and lets the person switch the active tenant;
  every access token still authorizes exactly one tenant. There is no
  user-visible global account or automatic cross-tenant account linking.
- Dedicated apps map brand → tenant realm server-side. The shared app selects a
  realm by invitation or organization code before authentication. A dedicated
  app exposes only realms allowed by its server-side brand mapping.
- Platform operators use separate platform identities. A platform-employed
  house manager receives a normal tenant/building-scoped assignment and does
  not use `super_admin` for routine management.

## Tenant isolation

- Every tenant-owned table: `tenant_id` is `NOT NULL` and the **leading** column
  of the primary key and of tenant-scoped indexes.
- RLS enabled; policies use `NULLIF(current_setting('app.tenant_id', true), '')`.
- Runtime role `inova_app` has **no** `BYPASSRLS`.
- Tenant-account and assignment tables are tenant-owned and RLS-scoped. Pre-auth
  credential lookup sets a trusted tenant context derived from the server-side
  realm mapping; it does not perform an unscoped email/phone search.
- Contract test: `apps/api/test/tenant-schema.contract.test.ts` (pg_catalog).

## Money and finance

- In code: `Money` in `packages/shared` — integer minor units, never floats.
- At rest: `NUMERIC(14,2)` / decimal strings + explicit `currency`.
- Financial rows are append-only. Corrections = reversal / credit-note rows.
- Append-only tables (today: `audit_records`) grant the app role SELECT+INSERT
  only — no UPDATE/DELETE.
- Money-creating POSTs: `Idempotency-Key`. Webhooks: unique
  `(provider, provider_event_id)`.
- A building's operational and deposit/repair funds are logical sub-ledgers
  over one real bank account. A building setting controls whether balanced,
  audited inter-fund transfers are allowed.
- External bank transactions stay outside apartment balances until matched by
  payment reference or confirmed in a reconciliation queue.

## Property and role invariants

- Apartment business uniqueness is building + entrance + floor + apartment
  number within the tenant; rows still use tenant-leading UUID primary keys.
- Occupancies and pets are effective-dated. Multiple separate accounts may hold
  simultaneous `owner` occupancies for one apartment.
- One tenant account may hold several simultaneous roles through staff
  memberships, building-manager assignments, and apartment occupancies. The
  mobile role/view switch changes navigation and presentation only; effective
  permissions are the server-validated union for the active tenant, building,
  apartment, and date. Owner and tenant contexts receive different
  server-enforced capabilities; survey proposal/voting is owner-only.
- House-manager authority is tenant/building-scoped and independent of employer:
  tenant staff, resident owners, and platform-employed operators may be assigned.
- Managers add/correct records but cannot directly remove residents or active
  apartments. They submit a reasoned request; `super_admin` decides it and
  records with history are ended/archived, never hard-deleted.

## Module boundaries

Each core-api module owns its tables. Do not import another module's
schema/tables. Cross-module communication is via interfaces or events.
ESLint enforces `no-restricted-imports` across `apps/api/src/modules/*`.

## Migrations

- Plain SQL in `db/migrations/`, applied by `db/migrate.mjs`.
- Privileged migrator role applies schema; `inova_app` never owns schema.
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

The brand is presentation and distribution, not the data-security boundary.
One tenant may have one or more brands; under the current model those brands
share the tenant's account realm. The shared app may switch among separately
authenticated tenant contexts, while a dedicated app remains restricted to
the tenant realms mapped to that brand.

## Scale notes (do not implement early)

Shared schema + RLS is the baseline. Hash-partition hot tables when volume
requires it (`audit_records` already partitioned). Schema-per-tenant is
rejected. Citus/sharding is a later scale-out path.
