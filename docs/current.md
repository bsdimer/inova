# Current status

**Last updated:** 2026-09-15
**Current milestone:** M1 tenant-account realm refactor, then M2 Property hierarchy
**Focus:** apply the B8 tenant-scoped account decision, including secure multi-tenant session switching and multi-role mobile views, before M2 locks identity references; then build property hierarchy so mobile can drop mock building/apartment data.

This is the only living status file. History: [work-log/](work-log/). Scope: [milestones/](milestones/).

## What actually works

- Product identity: `inova`, operated by `WhiteNova Technology`; workspace
  packages, runtime identifiers, brand configuration, app identifiers, UI copy,
  documentation, and the Git `origin` all use the new name. Existing databases
  are upgraded through the forward-only `0002_rename_product_to_inova.sql`
  migration; `0001_identity_tenancy.sql` remains immutable.
- Local infra: `docker compose -f infra/docker/docker-compose.yml up -d` (Postgres 16, Redis, MinIO, MailHog).
- `pnpm db:migrate && pnpm db:seed` — migrations `0001_identity_tenancy.sql` and `0002_rename_product_to_inova.sql` + two tenants, super_admin, tenant admins, residents with invite codes.
- Auth service (`:4001`): login, invite-code activate, refresh (rotation + reuse revocation), set-password, `/me`, resend-code (MOCK delivery), JWKS, throttling, Swagger `/docs`. **Current code uses global users; stakeholder decision B8 now requires independent tenant-scoped account realms before M2.**
- Core API (`:4000`): JWKS JWT verify, `X-Tenant-Id` + DB membership re-check, permission guards, RLS via `SET LOCAL app.tenant_id`. Tenant profile/staff/audit, staff+roles CRUD (admin-role lock, last-admin guard), super_admin tenant provisioning, public brand config, health. **Current multi-membership JWT/context flow must be adapted to a single tenant-account realm; platform identities remain separate.**
- Mobile: real activate + login; session in keychain (refresh only); home greets the user. Building/home/dues/issues still MOCK (`TODO(M2/M3/…)`).
- Admin: real login, tenant switcher, Staff / Roles / Tenants (provisioning
  wizard) on live APIs. The portal uses the warm inova visual system across
  login, shell, shared controls, cards, tables, modals, and responsive
  navigation. Dashboard stats still mock.
- Quality gates: `pnpm verify` (format, lint, typecheck, unit, integration, architecture contracts, build). GitHub Actions CI installs pnpm from `package.json` `packageManager` (`pnpm@10.34.5`); do not also pass `version` to `pnpm/action-setup`.

## Tests (release blockers)

37 integration tests against real Postgres + RLS + `inova_app` (no BYPASSRLS), plus 4 Money unit tests:

| Suite                                           | Count | Job                |
| ----------------------------------------------- | ----- | ------------------ |
| `apps/api/test/tenant-isolation.e2e.test.ts`    | 11    | `tenant-isolation` |
| `apps/api/test/tenant-schema.contract.test.ts`  | 5     | `tenant-isolation` |
| `apps/api/test/staff-roles.e2e.test.ts`         | 13    | `auth` (RBAC)      |
| `apps/auth-service/test/auth-flows.e2e.test.ts` | 8     | `auth`             |
| `packages/shared` Money                         | 4     | `unit`             |

Architecture scripts: `check:routes`, `check:stubs`, `check:brands`, `check:migrations`.

## Milestone honesty

| Milestone                            | Status                                                                                   | Gaps vs original acceptance                                                                                                                                                                                                                                                                  |
| ------------------------------------ | ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M0 Foundations                       | Done for _local_ foundations                                                             | No Terraform/ECR/OIDC, no generated OpenAPI clients, no “one command” full stack. Those belong to M-Ops / later. Lint and format are now real gates.                                                                                                                                         |
| M1 Identity                          | Original global-user backend + admin screens implemented; B8 refactor required before M2 | Tenant-scoped accounts (same email/phone allowed independently per tenant), one-tenant-per-token authorization, secure local account portfolio/tenant switching, multi-role context, separate platform identities; then Redis denylist, worker, real delivery, silent refresh, audit viewer. |
| M2 Property                          | Not started                                                                              | —                                                                                                                                                                                                                                                                                            |
| M5 Mobile / M9 Dashboard / M10 Brand | UI shells only                                                                           | Mock data until M2+ APIs exist.                                                                                                                                                                                                                                                              |

## Temporary mocks (greppable)

- Invite delivery: `TODO(M1)` / `MOCK` in auth-service + api (log only).
- Admin silent refresh: `TODO(M1)` in `apps/admin/src/lib/api.ts`.
- Mobile home/building/cash/dues/issues/notices: `TODO(M2/M3/M6/M7)` + `MOCK` constants.
- Theme persistence on mobile: `TODO(M5)`.

## Blockers

- Before public release, confirm ownership/configuration of `inova.bg`,
  `app.inova.bg`, `support@inova.bg`, and reservation of the proposed mobile IDs
  (`bg.inova.resident`) in both app stores.
- Stakeholder decision B8 supersedes the implemented global-user model. A forward migration plus auth/core-api refactor to tenant-scoped account realms is required before M2 creates occupancy references.
- Real pilot spreadsheet samples are still required before locking the M2 import column mapping.
- SMS/Viber gateway choice (Twilio vs Infobip) still open — blocks real invite delivery, not M2 schema.
- B2 (Bulgarian receipt/invoice legal shape) still open — blocks M4 templates, not M2.
- Stakeholders prefer iCard for online payments; its merchant/account model,
  APIs, webhook/refund/reconciliation support, and Bulgarian onboarding must be
  validated before M8 is locked.
- Legal counsel must confirm whether EGN and identity-card data are required for
  enforcement-agent claims. Do not add those fields to the general user profile
  before purpose, access, encryption, and retention rules are approved.

## Next up

1. **M1 B8 identity refactor** — tenant-scoped accounts, tenant-local email/phone uniqueness, realm-scoped login/invite/reset without cross-brand disclosure, one-tenant-per-token JWT claims, secure multi-account session storage and tenant switching in the shared mobile app, multi-role context, separate platform identities. See [milestones/M1-identity.md](milestones/M1-identity.md).
2. **M2 property hierarchy** — building draft/activation, floor-aware apartment uniqueness, effective-dated occupancies/pets, multiple owners, role-specific owner/tenant access, manager assignments, controlled removal, spreadsheet import. See [milestones/M2-property.md](milestones/M2-property.md).
3. Wire mobile “My building” / resident profile to M2 APIs as they land.
4. Deferred M1 (before pilot): Redis denylist, worker skeleton, real invite delivery, admin silent refresh, audit viewer.
5. Self-contained Testcontainers for integration tests (harness Phase 2 remainder).
