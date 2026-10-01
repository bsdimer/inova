# Current status

**Last updated:** 2026-10-01
**Current milestone:** M2 Property hierarchy (backend in review), with M1 password recovery (B13) alongside
**Focus:** B8 tenant-account realms and invite-code hardening landed 2026-09-30 (#57, #58); M2 builds buildings, entrances, properties and residents on them (#59, #61 in review) so mobile can drop mock building/apartment data.

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
- `pnpm db:migrate && pnpm db:seed` — migrations `0001`–`0005` (identity, rename, auth DB role, tenant-account realms, invite-code hardening) + two tenants, a platform admin, tenant admins, residents with invite codes; `maria@inova.bg` exists in both tenants as two accounts.
- Auth service (`:4001`): login, activate, refresh (rotation + reuse revocation), set-password, `/me`, resend-code (MOCK delivery), JWKS, throttling, Swagger `/docs`. **Accounts belong to one organisation (B8, #57):** the same e-mail or phone in two organisations is two unrelated accounts; requests carry `realm` or `brand`, without them `AUTH_DEFAULT_REALM` (`TODO(M10)`); platform operators are `platform_users`; a token is `kind: 'tenant'` with one `tid` or `kind: 'platform'`. **Activation takes identifier + code (B14–B15, #58):** one active code per account, five wrong tries void it, resend voids the old code, `INVITE_CODE_TTL_DAYS` (default 30, 1–90).
- Core API (`:4000`): JWKS JWT verify, `X-Tenant-Id` must equal the token's `tid`, then the DB membership re-check; permission guards, RLS via `SET LOCAL app.tenant_id`. Tenant profile/staff/audit, staff+roles CRUD (admin-role lock, last-admin guard), super_admin tenant provisioning — a platform operator entering an organisation writes `platform.access` to its audit trail — public brand config, health. `GET /v1/tenant` names the caller's role (`roleName`, #50).
- Passwords: argon2id (2026-09-22; the code had used bcrypt while the plan said argon2id). A legacy bcrypt hash is verified once and upgraded on that login. `pnpm install` now needs to build one native module (`argon2`, prebuilt binaries for macOS/Linux/Alpine).
- Hardening (2026-09-21, defects in running code — not phase work): auth-service connects as its own `inova_auth` DB role and the cross-tenant identity-scope policies are granted to it alone (migration `0003`), so core-api's `inova_app` can no longer read other tenants' memberships or invite codes by setting a session variable; the strict limit on login/activate/resend really applies (the deployed value `'true'` had parsed to `NaN` and disabled it — malformed settings now stop the service); rate limiting is per client behind the edge proxy (`TRUST_PROXY_HOPS=1`); one-time codes are logged only when `CODE_DELIVERY=log` is set on purpose, otherwise a production process refuses to start.
- Auth gaps against the plan: no public password recovery yet (B13, WHI-95); the daily job that marks lapsed codes expired waits for the worker (expiry is enforced on read). The shipped mobile activation screen sends the code alone and now gets 400 — it needs the identifier field.
- Mobile: production-ready auth against live auth-service — activate → set-password,
  login, resend-code (phone → E.164), silent refresh, logout, session gate on tabs;
  release builds default to `https://portal.whitenova.tech/auth/v1` (`EXPO_PUBLIC_AUTH_URL`
  overrides; `__DEV__` keeps localhost). Home greets the signed-in user. The multi-account
  portfolio / tenant switcher is M10 (moved 2026-09-21). Building/home/dues/issues
  still MOCK (`TODO(M2/M3/…)`).
- Admin: real login, organization switching, Табло / Служители / Роли /
  Организации on live APIs, in Bulgarian. The portal uses the V2 glass visual
  system from the Figma page **Screens**: a fixed photograph with a scrim, the
  three glass fills (card / data / input) and the panel surface (light by day, dark at night) for
  drawers, modals and menus, all generated from that file's V2 Glass and V2
  Layout variables. The light and dark themes both exist; the account menu
  offers «Динамична» (the default: light by day, dark in the evening by the
  sun in the browser's time zone), «Светла» and «Тъмна». Icons are Phosphor Light, the set the screens
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
  (`check:no-design-data`). The shell and Табло follow the responsive ladder
  (Figma 1074:9754): the full sidebar from 1728, a 72 rail that opens in place
  at 1536–1727 and over the page at 1024–1535, a top bar with a drawer below
  1024; Табло recomposes at 1024, 820 and on a phone, fits as drawn from a
  1037 tall window and compresses between 960 and 1036, and from 2400 is
  drawn ×1.25 — every size is in rem and the root font size is 20px there.
  Page margins follow the window height: 24 when the page does not fit, up
  to 64 when it does, centred in between. Menu items have their hover and
  keyboard-focus look, the rail its tooltips. Since 28.09: the menu stands
  in four groups (#41); the account menu names who you are, your role and
  what it lets you do, and returns the keyboard to its button on close (#44,
  #48); «Роли» names every right in Bulgarian words as drawn (#49); no plan
  codes reach the screen (#45); Табло fits a phone (#43); the route tree and
  its guards live in `apps/admin/src/router.tsx` (#47); «Роли и обхват» shows what a role change does and asks before closing unsaved changes (#54) and matches the approved frames (#66); staff who may only view roles see no create, edit or delete buttons (#62); the account menu survives a resize across the tablet width (#64); «Роли» sits where drawn and an open side menu says it is open (#68). The portal signs in to the default organisation only: staff of another organisation need a `realm` on the sign-in form, not designed yet (#57).
  Contract for the full Табло: [features/admin-dashboard.md](features/admin-dashboard.md);
  it added M2b (unified search) and M11 (staff tasks/calendar) to the plan and
  extended M6 (issue priority), M7 (debtors audience, unread count) and M9.
- Quality gates: `pnpm verify` (format, lint, typecheck, unit, integration, architecture contracts, build). `pnpm test:unit` now covers `apps/api` and `apps/auth-service` too (co-located `src/**/*.test.ts`, hermetic, excluded from the build). The testing policy is in `AGENTS.md` → Testing. Admin flows run in a real browser: Playwright in `apps/admin/e2e` (`pnpm test:e2e`, CI job `e2e`, which the deploy waits for) covers sign-in with every error it names, the Служители and Организации lists, and entering and leaving an organization; each run keeps screenshots of the key screens. The admin has no component runner and mobile no runner; the sign-in form's checks live in `packages/shared` (`validateLoginForm`, `loginFailure`) and are unit-tested there. GitHub Actions CI installs pnpm from `package.json` `packageManager` (`pnpm@10.34.5`); do not also pass `version` to `pnpm/action-setup`.
  Locally the repo needs **Node >= 22** (`engines`): on Node 20.11 `verify`
  dies at `test:unit` before any project code runs, because rolldown imports
  `util.styleText` (added in Node 20.12).

## Tests (release blockers)

95 integration tests against real Postgres + RLS + the non-privileged `inova_app` / `inova_auth` roles, plus 103 unit tests (counts of #58, 2026-09-30):

| Suite                                                                                      | Count | Job                |
| ------------------------------------------------------------------------------------------ | ----- | ------------------ |
| `apps/api/test/tenant-isolation.e2e.test.ts`                                               | 24    | `tenant-isolation` |
| `apps/api/test/tenant-schema.contract.test.ts`                                             | 7     | `tenant-isolation` |
| `apps/api/test/staff-roles.e2e.test.ts`                                                    | 16    | `auth` (RBAC)      |
| `apps/auth-service/test/auth-flows.e2e.test.ts`                                            | 37    | `auth`             |
| `apps/auth-service/test/rate-limit.e2e.test.ts`                                            | 3     | `auth`             |
| `apps/auth-service/test/db-helper.e2e.test.ts`                                             | 2     | `auth`             |
| `apps/auth-service/test/realm-migration.e2e.test.ts`                                       | 6     | `auth`             |
| `packages/shared` unit (Money, runtime env, sign-in, dashboard, theme, names, auth claims) | 73    | `unit`             |
| `apps/auth-service` unit (hasher, login failures, realms, refresh tokens)                  | 30    | `unit`             |

Browser (Playwright, `apps/admin/e2e`, CI job `e2e`): 163 passed on 2026-09-30 (the #57 run).

Architecture scripts: `check:routes`, `check:stubs`, `check:brands`, `check:migrations`, `check:no-design-data`, `check:agent-harness`, `check:worklog`, `check:decisions`.

## Milestone honesty

| Milestone                            | Status                                                                                                                                                                                                               | Gaps vs original acceptance                                                                                                                                                                                                                   |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M0 Foundations                       | Done for _local_ foundations; test environment now deployed                                                                                                                                                          | Container deploy to the test host exists (GHCR images, compose, nginx, Let's Encrypt). Still no Terraform/OIDC, no generated OpenAPI clients, no “one command” full stack. Those belong to M-Ops / later. Lint and format are now real gates. |
| M1 Identity                          | In progress: backend + admin screens; B8 realms (#57) and B14–B15 activation (#58) done 2026-09-30                                                                                                                   | Password recovery (B13, WHI-95); multi-role context needs M2 occupancies; then Redis denylist, worker, real delivery, silent refresh, audit viewer.                                                                                           |
| M2 Property                          | Started: backend in review — buildings / entrances / properties (#59, WHI-96), residents on a property (#61)                                                                                                         | Admin screens, import, removal flow; the building photo is in M6.                                                                                                                                                                             |
| M5 Mobile / M9 Dashboard / M10 Brand | Mobile: UI shells on `MOCK` data; the surveys screens were built ahead of the plan — surveys come before the pilot (D23), their milestone is still to be cut. Admin Табло: shell on live APIs, empty slots until M2+ | Mock data until M2+ APIs exist.                                                                                                                                                                                                               |

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
- Real pilot spreadsheet samples are still required before locking the M2 import column mapping.
- SMS gateway: Infobip (D36); the contract and sender registration are long-lead (M-Pilot) and block real invite delivery, not M2.
- B2 (Bulgarian receipt/invoice legal shape) still open — blocks M4 templates, not M2.
- Stakeholders prefer iCard for online payments; its merchant/account model,
  APIs, webhook/refund/reconciliation support, and Bulgarian onboarding must be
  validated before M8 is locked.
- Dashboard design decision D13 (debtor-reminder recipients and copy) is
  open; D15 (document-library categories) was settled 2026-09-28 and D16
  (the manager may author a survey) 2026-09-22. D13 blocks the M9 dashboard
  UI, not M2 or any backend contract.
- Legal counsel must confirm whether EGN and identity-card data are required for
  enforcement-agent claims. Do not add those fields to the general user profile
  before purpose, access, encryption, and retention rules are approved.

## Next up

1. **M2 backend review and merge** — #59 (buildings, entrances, properties, activation) and #61 (residents on a property); then the M2 admin screens. See [milestones/M2-property.md](milestones/M2-property.md).
2. **M1 password recovery** (B13, WHI-95) and the identifier field on the mobile activation screen. See [milestones/M1-identity.md](milestones/M1-identity.md).
3. **Worker skeleton** before M3 (fee generation is a worker job) with its own `inova_worker` role (D21).
4. Wire mobile “My building” / resident profile to M2 APIs as they land.
5. Deferred M1 (before pilot): Redis denylist, real invite delivery, admin silent refresh, audit viewer.
6. Self-contained Testcontainers for integration tests (harness Phase 2 remainder).
7. Before production exists: provision the pilot host per **D19** (a single VM
   with the compose stack, its own database and secrets, nightly off-box
   `pg_dump`, one rehearsed restore — EKS deferred), re-enable `main` deploys in `ci.yml`, move edge maintenance to production deploys,
   and remove the leftover `/opt/inova` stack and `portal.whitenova.tech` site
   (its certificate can no longer renew without DNS).
