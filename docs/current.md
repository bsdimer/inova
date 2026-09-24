# Current status

**Last updated:** 2026-09-24
**Current milestone:** M1 tenant-account realm refactor, then M2 Property hierarchy
**Focus:** apply the B8 tenant-scoped account decision, including secure multi-tenant session switching and multi-role mobile views, before M2 locks identity references; then build property hierarchy so mobile can drop mock building/apartment data.

This is the only living status file. History: [work-log/](work-log/). Scope: [milestones/](milestones/). Non-technical view: Linear project `inova` (workspace `white-label-app`), one task per change set, created when the work starts — `AGENTS.md` → Tracking in Linear.

## What actually works

- Product identity: `inova`, operated by `WhiteNova Technology`; workspace
  packages, runtime identifiers, brand configuration, app identifiers, UI copy,
  documentation, and the Git `origin` all use the new name. Existing databases
  are upgraded through the forward-only `0002_rename_product_to_inova.sql`
  migration; `0001_identity_tenancy.sql` remains immutable.
- Local infra: `docker compose -f infra/docker/docker-compose.yml up -d` (Postgres 16, Redis, MinIO, MailHog).
- Environments (GitFlow, host 204.168.180.167): `develop` deploys to test at
  `https://test-portal.whitenova.tech` automatically after CI. There is **no
  production environment yet** — pushes to `main` run CI only. Test runs the
  `infra/deploy/` stack in `/opt/inova-test` behind a shared edge nginx
  (`/opt/edge`, Let's Encrypt, renewed by a systemd timer) that test deploys
  maintain. Host secrets are generated on the box and live only there.
  `main` and `develop` are protected (PR + green CI). Only test is seeded.
- `pnpm db:migrate && pnpm db:seed` — migrations `0001_identity_tenancy.sql` and `0002_rename_product_to_inova.sql` + two tenants, super_admin, tenant admins, residents with invite codes.
- Auth service (`:4001`): login, invite-code activate, refresh (rotation + reuse revocation), set-password, `/me`, resend-code (MOCK delivery), JWKS, throttling, Swagger `/docs`. **Current code uses global users; stakeholder decision B8 now requires independent tenant-scoped account realms before M2.**
- Core API (`:4000`): JWKS JWT verify, `X-Tenant-Id` + DB membership re-check, permission guards, RLS via `SET LOCAL app.tenant_id`. Tenant profile/staff/audit, staff+roles CRUD (admin-role lock, last-admin guard), super_admin tenant provisioning, public brand config, health. **Current multi-membership JWT/context flow must be adapted to a single tenant-account realm; platform identities remain separate.**
- Passwords: argon2id (2026-09-22; the code had used bcrypt while the plan said argon2id). A legacy bcrypt hash is verified once and upgraded on that login. `pnpm install` now needs to build one native module (`argon2`, prebuilt binaries for macOS/Linux/Alpine).
- Hardening (2026-09-21, defects in running code — not phase work): auth-service connects as its own `inova_auth` DB role and the cross-tenant identity-scope policies are granted to it alone (migration `0003`), so core-api's `inova_app` can no longer read other tenants' memberships or invite codes by setting a session variable; the strict limit on login/activate/resend really applies (the deployed value `'true'` had parsed to `NaN` and disabled it — malformed settings now stop the service); rate limiting is per client behind the edge proxy (`TRUST_PROXY_HOPS=1`); one-time codes are logged only when `CODE_DELIVERY=log` is set on purpose, otherwise a production process refuses to start.
- Auth gaps against the plan (B13–B15, decided 2026-09-21, not built): activation still looks a code up by hash alone across tenants and never uses `attempts`; there is no public password recovery; `resend-code` finds the user by phone globally, and answers an unknown phone faster than a pending one (it skips the code rewrite and delivery). All of this is part of the M1 refactor.
- Mobile: production-ready auth against live auth-service — activate → set-password,
  login, resend-code (phone → E.164), silent refresh, logout, session gate on tabs;
  release builds default to `https://portal.whitenova.tech/auth/v1` (`EXPO_PUBLIC_AUTH_URL`
  overrides; `__DEV__` keeps localhost). Home greets the signed-in user. B8 multi-account
  portfolio / tenant switcher waits on the backend realm refactor. Building/home/dues/issues
  still MOCK (`TODO(M2/M3/…)`).
- Admin: real login, organization switching, Табло / Служители / Роли /
  Организации on live APIs, in Bulgarian. The portal uses the V2 glass visual
  system from the Figma page **Screens**: a fixed photograph with a scrim, the
  three glass fills (card / data / input) and the light panel surface for
  drawers, modals and menus, all generated from that file's V2 Glass and V2
  Layout variables. The light and dark themes both exist and are chosen from
  the account menu or the OS. Icons are Phosphor Light, the set the screens
  are drawn with. Navigation is the nine items of the Figma sidebar, in the
  order settled in WHI-24 (after the 2026-09-22 list: «Финанси» moved to
  fourth, «Нередности» renamed «Сигнали»):
  Табло · Задачи · Известия · Финанси · Сгради · Жители · Сигнали ·
  Служители · Роли. A platform administrator gets a rail of its own instead —
  Общ преглед · Организации · Одитен дневник, with the ПЛАТФОРМА marker — and,
  once inside an organization, the banner that says the visit is audited and
  carries the way back out. Служители follows the M1 eight-column contract:
  search + facets, sort presets, all ten table states, and one light disc per
  row that opens the roles-and-scope drawer, which holds every row action and
  explains the blocked ones; below `md` the rows become cards with a filter
  sheet. Табло is laid out as drawn and takes its data per card; until M2,
  M3–M4, M6 and M11 ship, every figure slot shows «—» and only the month grid
  is real. A local-only «design data» preview (`?fixture=design`, dev server
  and the browser-test build) fills the cards with the numbers of Figma
  859:1073 to check the layout; the deployed build carries none of it
  (`check:no-design-data`).
  Contract for the full Табло: [features/admin-dashboard.md](features/admin-dashboard.md);
  it added M2b (unified search) and M11 (staff tasks/calendar) to the plan and
  extended M6 (issue priority), M7 (debtors audience, unread count) and M9.
- Quality gates: `pnpm verify` (format, lint, typecheck, unit, integration, architecture contracts, build). `pnpm test:unit` now covers `apps/api` and `apps/auth-service` too (co-located `src/**/*.test.ts`, hermetic, excluded from the build); `apps/auth-service` has the first six — the `PasswordHasher` units that came with argon2id — and `apps/api` still has none. The testing policy is in `AGENTS.md` → Testing. Admin flows run in a real browser: Playwright in `apps/admin/e2e` (`pnpm test:e2e`, CI job `e2e`, which the deploy waits for) covers sign-in with every error it names, the Служители and Организации lists, and entering and leaving an organization; each run keeps screenshots of the key screens. The admin has no component runner and mobile no runner; the sign-in form's checks live in `packages/shared` (`validateLoginForm`, `loginFailure`) and are unit-tested there. GitHub Actions CI installs pnpm from `package.json` `packageManager` (`pnpm@10.34.5`); do not also pass `version` to `pnpm/action-setup`.
  Locally the repo needs **Node >= 22** (`engines`): on Node 20.11 `verify`
  dies at `test:unit` before any project code runs, because rolldown imports
  `util.styleText` (added in Node 20.12).

## Tests (release blockers)

48 integration tests against real Postgres + RLS + the non-privileged `inova_app` / `inova_auth` roles, plus 54 unit tests:

| Suite                                           | Count | Job                |
| ----------------------------------------------- | ----- | ------------------ |
| `apps/api/test/tenant-isolation.e2e.test.ts`    | 13    | `tenant-isolation` |
| `apps/api/test/tenant-schema.contract.test.ts`  | 7     | `tenant-isolation` |
| `apps/api/test/staff-roles.e2e.test.ts`         | 13    | `auth` (RBAC)      |
| `apps/auth-service/test/auth-flows.e2e.test.ts` | 10    | `auth`             |
| `apps/auth-service/test/rate-limit.e2e.test.ts` | 3     | `auth`             |
| `apps/auth-service/test/db-helper.e2e.test.ts`  | 2     | `auth`             |
| `packages/shared` Money                         | 4     | `unit`             |
| `packages/shared` RuntimeEnv, MockCodeDelivery  | 13    | `unit`             |
| `packages/shared` login form checks             | 15    | `unit`             |
| `packages/shared` dashboard display math        | 10    | `unit`             |
| `apps/auth-service` PasswordHasher              | 7     | `unit`             |
| `apps/auth-service` AuthService login failures  | 5     | `unit`             |

Browser (Playwright, `apps/admin/e2e`, CI job `e2e`): 23 — sign-in 7, Табло 2, Служители 5, Организации 3, screenshots 6.

Architecture scripts: `check:routes`, `check:stubs`, `check:brands`, `check:migrations`, `check:no-design-data`.

## Milestone honesty

| Milestone                            | Status                                                                                                                                                    | Gaps vs original acceptance                                                                                                                                                                                                                                                                  |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M0 Foundations                       | Done for _local_ foundations; test environment now deployed                                                                                               | Container deploy to the test host exists (GHCR images, compose, nginx, Let's Encrypt). Still no Terraform/OIDC, no generated OpenAPI clients, no “one command” full stack. Those belong to M-Ops / later. Lint and format are now real gates.                                                |
| M1 Identity                          | Original global-user backend + admin screens implemented; B8 refactor required before M2                                                                  | Tenant-scoped accounts (same email/phone allowed independently per tenant), one-tenant-per-token authorization, secure local account portfolio/tenant switching, multi-role context, separate platform identities; then Redis denylist, worker, real delivery, silent refresh, audit viewer. |
| M2 Property                          | Not started                                                                                                                                               | —                                                                                                                                                                                                                                                                                            |
| M5 Mobile / M9 Dashboard / M10 Brand | UI shells only; mobile surveys screens were built ahead of the plan (surveys are P1) and stay on `MOCK` data — no further work on them before the P1 wave | Mock data until M2+ APIs exist.                                                                                                                                                                                                                                                              |

## Temporary mocks (greppable)

- Invite delivery: `TODO(M1)` / `MOCK` in auth-service + api (log only).
- Admin silent refresh: `TODO(M1)` in `apps/admin/src/lib/api.ts`.
- Mobile home/building/cash/dues/issues/notices: `TODO(M2/M3/M6/M7)` + `MOCK` constants.
- Theme persistence on mobile: `TODO(M5)`.

## Blockers

- Before public release, confirm ownership/configuration of `inova.bg`,
  `app.inova.bg`, `support@inova.bg`, and reservation of the proposed mobile IDs
  (`bg.inova.resident`) in both app stores.
- Long-lead items that need no code and can each block go-live are listed in
  [milestones/M-Pilot.md](milestones/M-Pilot.md): SMS/Viber gateway and sender
  registration, store accounts, domains, spreadsheet samples, accountant (B2),
  counsel (DPA, B12), production host.
- Stakeholder decision B8 supersedes the implemented global-user model. A forward migration plus auth/core-api refactor to tenant-scoped account realms is required before M2 creates occupancy references.
- Real pilot spreadsheet samples are still required before locking the M2 import column mapping.
- SMS/Viber gateway choice (Twilio vs Infobip) still open — blocks real invite delivery, not M2 schema.
- B2 (Bulgarian receipt/invoice legal shape) still open — blocks M4 templates, not M2.
- Stakeholders prefer iCard for online payments; its merchant/account model,
  APIs, webhook/refund/reconciliation support, and Bulgarian onboarding must be
  validated before M8 is locked.
- Dashboard design decisions D13 (debtor-reminder recipients/copy), D15 (document-library categories) and D16
  (may a manager author a survey directly — touches resolved D8, stakeholder
  answer required) are open. They block the M9 dashboard UI and the P1 surveys
  card, not M2 or any backend contract.
- Legal counsel must confirm whether EGN and identity-card data are required for
  enforcement-agent claims. Do not add those fields to the general user profile
  before purpose, access, encryption, and retention rules are approved.

## Next up

1. **M1 B8 identity refactor** — together with B13–B15 (activation by identifier + code, realm-unique single active invite code, password recovery by email/phone with configurable lifetimes): tenant-scoped accounts, tenant-local email/phone uniqueness, realm-scoped login/invite/reset without cross-brand disclosure, one-tenant-per-token JWT claims, secure multi-account session storage and tenant switching in the shared mobile app, multi-role context, separate platform identities. See [milestones/M1-identity.md](milestones/M1-identity.md).
2. **Worker skeleton** before M3 (fee generation is a worker job) with its own `inova_worker` role (D21).
3. **M2 property hierarchy** — building draft/activation, floor-aware apartment uniqueness, effective-dated occupancies/pets, multiple owners, role-specific owner/tenant access, manager assignments, controlled removal, spreadsheet import. See [milestones/M2-property.md](milestones/M2-property.md).
4. Wire mobile “My building” / resident profile to M2 APIs as they land.
5. Deferred M1 (before pilot): Redis denylist, real invite delivery, admin silent refresh, audit viewer.
6. Self-contained Testcontainers for integration tests (harness Phase 2 remainder).
7. Before production exists: provision the pilot host per **D19** (a single VM
   with the compose stack, its own database and secrets, nightly off-box
   `pg_dump`, one rehearsed restore — EKS deferred), re-enable `main` deploys in `ci.yml`, move edge maintenance to production deploys,
   and remove the leftover `/opt/inova` stack and `portal.whitenova.tech` site
   (its certificate can no longer renew without DNS). Add nightly off-box
   `pg_dump` backups.
