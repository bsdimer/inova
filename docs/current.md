# Current status

**Last updated:** 2026-08-30
**Current milestone:** M2 Property hierarchy (not started)
**Focus:** mobile-first — M2 so the resident app can drop mock building/apartment data.

This is the only living status file. History: [work-log/](work-log/). Scope: [milestones/](milestones/).

## What actually works

- Local infra: `docker compose -f infra/docker/docker-compose.yml up -d` (Postgres 16, Redis, MinIO, MailHog).
- `pnpm db:migrate && pnpm db:seed` — migration `0001_identity_tenancy.sql` + two tenants, super_admin, tenant admins, residents with invite codes.
- Auth service (`:4001`): login, invite-code activate, refresh (rotation + reuse revocation), set-password, `/me`, resend-code (MOCK delivery), JWKS, throttling, Swagger `/docs`.
- Core API (`:4000`): JWKS JWT verify, `X-Tenant-Id` + DB membership re-check, permission guards, RLS via `SET LOCAL app.tenant_id`. Tenant profile/staff/audit, staff+roles CRUD (admin-role lock, last-admin guard), super_admin tenant provisioning, public brand config, health.
- Mobile: real activate + login; session in keychain (refresh only); home greets the user. Building/home/dues/issues still MOCK (`TODO(M2/M3/…)`).
- Admin: real login, tenant switcher, Staff / Roles / Tenants (provisioning wizard) on live APIs. Dashboard stats still mock.
- Quality gates: `pnpm verify` (format, lint, typecheck, unit, integration, architecture contracts, build). GitHub Actions CI installs pnpm from `package.json` `packageManager` (`pnpm@10.34.5`); do not also pass `version` to `pnpm/action-setup`.

## Tests (release blockers)

37 integration tests against real Postgres + RLS + `sosedo_app` (no BYPASSRLS), plus 4 Money unit tests:

| Suite                                           | Count | Job                |
| ----------------------------------------------- | ----- | ------------------ |
| `apps/api/test/tenant-isolation.e2e.test.ts`    | 11    | `tenant-isolation` |
| `apps/api/test/tenant-schema.contract.test.ts`  | 5     | `tenant-isolation` |
| `apps/api/test/staff-roles.e2e.test.ts`         | 13    | `auth` (RBAC)      |
| `apps/auth-service/test/auth-flows.e2e.test.ts` | 8     | `auth`             |
| `packages/shared` Money                         | 4     | `unit`             |

Architecture scripts: `check:routes`, `check:stubs`, `check:brands`, `check:migrations`.

## Milestone honesty

| Milestone                            | Status                       | Gaps vs original acceptance                                                                                                                          |
| ------------------------------------ | ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| M0 Foundations                       | Done for _local_ foundations | No Terraform/ECR/OIDC, no generated OpenAPI clients, no “one command” full stack. Those belong to M-Ops / later. Lint and format are now real gates. |
| M1 Identity                          | Backend + admin screens done | Redis revocation denylist, worker, real SMS/Viber delivery, admin silent refresh, audit-trail page — deferred to pre-pilot.                          |
| M2 Property                          | Not started                  | —                                                                                                                                                    |
| M5 Mobile / M9 Dashboard / M10 Brand | UI shells only               | Mock data until M2+ APIs exist.                                                                                                                      |

## Temporary mocks (greppable)

- Invite delivery: `TODO(M1)` / `MOCK` in auth-service + api (log only).
- Admin silent refresh: `TODO(M1)` in `apps/admin/src/lib/api.ts`.
- Mobile home/building/cash/dues/issues/notices: `TODO(M2/M3/M6/M7)` + `MOCK` constants.
- Theme persistence on mobile: `TODO(M5)`.

## Blockers

- SMS/Viber gateway choice (Twilio vs Infobip) still open — blocks real invite delivery, not M2 schema.
- B2 (Bulgarian receipt/invoice legal shape) still open — blocks M4 templates, not M2.

## Next up

1. **M2 property hierarchy** — buildings / entrances / apartments / occupancies, manager “add resident” (user + occupancy + invite), spreadsheet import. See [milestones/M2-property.md](milestones/M2-property.md).
2. Wire mobile “My building” / resident profile to M2 APIs as they land.
3. Deferred M1 (before pilot): Redis denylist, worker skeleton, real invite delivery, admin silent refresh, audit viewer.
4. Admin restyle to the warm 2026-08 brand (still on the old navy palette).
5. Self-contained Testcontainers for integration tests (harness Phase 2 remainder).

## Harness (shareable)

Session ritual and invariants: root `AGENTS.md`. Frontend workflow:
`.cursor/skills/sosedo-frontend/SKILL.md` (explicit invoke for larger UI work).
Cursor always-on rule: `.cursor/rules/sosedo-harness.mdc`.
