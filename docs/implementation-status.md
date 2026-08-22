# Sosedo — Implementation Status

> Living progress tracker against [docs/implementation-plan.md](implementation-plan.md).
> **Rule for agents and developers: update this file in the same change set as any
> implementation work.** Newest session entries go on top of the Work Log.

**Last updated:** 2026-08-22
**Current focus:** M1 backend core done (auth, tenancy, RLS, isolation suite) →
remaining M1: admin staff/roles screens, provisioning wizard UI, Redis denylist, worker

---

## Milestone overview

| Milestone | Scope (short) | Status |
|---|---|---|
| M0 Foundations | Monorepo, CI, docker-compose, app shells, brand system | ✅ **Done** |
| M1 Identity, tenancy, RBAC | auth-service (JWT+JWKS), tenants, memberships, RLS | 🟡 Backend core + tests done; admin screens, wizard UI, Redis denylist pending |
| M2 Property hierarchy | Buildings/entrances/apartments, occupancy verification, imports | ⬜ Not started |
| M3 Fee engine | Fee rules, charge generation, obligations views | ⬜ Not started |
| M4 Manual payments | Payments, allocations, ledger, cash accounts, receipts | ⬜ Not started |
| M5 Mobile pilot slice | Store-quality resident app on real APIs | 🟡 UI shells exist (mock data) |
| M6 Issues | Issue reporting with photos, status flow, AV scanning | ⬜ Not started |
| M7 Notices + push | Notices, audiences, FCM/APNs fan-out | ⬜ Not started |
| M8 Stripe Connect | Tenant onboarding, direct charges, webhooks, reconciliation | ⬜ Not started |
| M9 Dashboard/reports | Aggregates, debtor report, XLSX exports | 🟡 Admin dashboard UI exists (mock data) |
| M-Bill Platform billing | Subscriptions, apartment metering, entitlements, super_admin console | ⬜ Not started |
| M-Ops Environments | Terraform, EKS, Helm, monitoring, runbooks | ⬜ Not started (local docker only) |
| M-Pilot Pilot launch | Data import, training, launch checklist | ⬜ Not started |
| M10 White-label pipeline | Brand build matrix, partner store accounts | 🟡 Brand config system exists |

Legend: ✅ done · 🟡 partially done · ⬜ not started

---

## What works right now (verified)

- `pnpm install && pnpm build && pnpm typecheck && pnpm test` — all green
  (19 e2e tests across api + auth-service, against real Postgres with RLS).
- `docker compose -f infra/docker/docker-compose.yml up -d` — Postgres 16, Redis, MinIO, MailHog.
- `pnpm db:migrate && pnpm db:seed` — plain-SQL migration 0001 + dev seed
  (2 tenants, super_admin, tenant admins, residents with invite codes — creds printed by seed).
- Auth service (port 4001):
  - `POST /v1/auth/login` → JWT (RS256, membership claims) + rotating refresh token
  - `POST /v1/auth/activate` → invite-code activation (B7), single-use codes
  - `POST /v1/auth/refresh` → rotation with reuse detection (family revocation)
  - `POST /v1/auth/password`, `GET /v1/auth/me`, `POST /v1/auth/resend-code` (MOCK delivery)
  - `GET /.well-known/jwks.json`; throttled credential endpoints; Swagger at `/docs`
- Core API (port 4000):
  - JWKS-verified JWTs (no runtime call to auth-service), `X-Tenant-Id` tenant context
    with DB membership re-check, permission guards, RLS via `SET LOCAL app.tenant_id`
  - `GET /v1/tenant` (+`/staff`, `/audit`), `GET|POST /v1/platform/tenants` (super_admin
    provisioning: tenant + starter roles + first-user admin invite + audit record)
  - Brands endpoint + health as before
- Mobile (Expo Go): invite-code activation and login hit the real auth-service
  (seeded codes work in the app); home greets the logged-in user.
- Admin: real login against auth-service, session in localStorage, route guard on the
  shell, user chip shows the real name/role, sign-out clears the session.
- GitHub Actions CI: install → build → typecheck → **tests with Postgres service**.

---

## Work log (newest first)

### 2026-08-22 — Role model clarified: per-tenant roles, first user = admin (session 7)

- Stakeholder decision recorded in plan §6.2: roles are per-tenant (each tenant edits its
  own role set from the fixed permission catalog); **the first user created for a tenant
  gets that tenant's `admin` role**; `super_admin` stays a platform-level claim held by a
  handful of operators who administer the whole system — never a tenant role.
- Renamed the seeded top role `owner` → `admin` (seed, provisioning templates,
  `adminEmail/adminName/adminPhone` provisioning fields, super_admin in-tenant fallback
  role, tests, docs). Dev DB recreated with the new seed.

### 2026-08-22 — Fix React/react-dom version mismatch (session 6)

- Admin crashed at startup ("Incompatible React versions": react 19.2.3 vs
  react-dom 19.2.8). Cause: `apps/admin` pinned `react` exactly while `react-dom`
  used a caret range. Pinned both to `19.2.8` in admin; pinned `react-dom@19.2.3`
  explicitly in `apps/mobile` to match Expo SDK 57's bundled react (19.2.3).
- `pnpm build` and `pnpm typecheck` green. (pnpm invoked via
  `npx pnpm@10.34.5` on this machine — corepack shim still broken, see session 1.)

### 2026-08-22 — M1 backend core: identity, tenancy, RLS, isolation suite (session 5)

**Database (plain SQL, `db/migrations/0001_identity_tenancy.sql`)**
- Tables: `tenants, brands, users, refresh_tokens, permissions, roles, role_permissions,
  staff_memberships, invite_codes, audit_records` (audit hash-partitioned by tenant_id,
  8 partitions, append-only: app role has no UPDATE/DELETE grant).
- RLS: tenant-owned tables use `app.tenant_id` (via `NULLIF(current_setting(...),'')` —
  guards against the empty-string GUC quirk on pooled connections); identity tables
  additionally allow `app.identity_scope='auth'` for auth-service cross-tenant reads
  (policy-based, never a role-level bypass). App role `sosedo_app` (no BYPASSRLS).
- `db/migrate.mjs` (tracked plain-SQL runner) + `db/seed.mjs` (2 tenants, role templates
  admin/manager/resident, super_admin, tenant admins, residents with fixed dev invite codes).
  Root scripts: `pnpm db:migrate` / `pnpm db:seed`.

**auth-service (real implementation)**
- Drizzle + pg as `sosedo_app`; all queries in `identityTx` (SET LOCAL identity scope).
- RS256 JWT with `memberships:[{t,r}]` + `platform_role` claims; JWKS at
  `/.well-known/jwks.json`; dev key auto-generated to `.keys/` (gitignored).
- Login (bcrypt), invite-code activation (B7: hashed single-use codes, activates user +
  membership, `mustSetPassword`), resend-code (no enumeration; MOCK delivery logged,
  `TODO(M1)` SMS/Viber gateway), set-password, `/me`, refresh rotation with reuse
  detection (family revocation committed in a separate tx — caught by tests), logout,
  per-endpoint throttling. Redis denylist still TODO(M1).

**core-api (tenant enforcement)**
- `JwtGuard` (JWKS local verification), `TenantContextGuard` (claim + DB re-check),
  `PermissionsGuard` (@RequirePermissions, role→permission resolution inside tenant RLS
  scope, 60s cache), `PlatformGuard` (super_admin), `DbService.withTenant()`
  (SET LOCAL app.tenant_id), transactional `AuditService`.
- Endpoints: `GET /v1/tenant`, `/tenant/staff`, `/tenant/audit`;
  `GET|POST /v1/platform/tenants` (provisioning: tenant + starter roles + first user
  with the per-tenant 'admin' role + invite code + audit record). Wizard UI still pending.

**Tests (release-blocker tier, wired into CI with a Postgres service)**
- `apps/api/test/tenant-isolation.e2e.test.ts` (11): RLS at SQL level (no context = no
  rows; cross-tenant INSERT rejected; audit UPDATE/DELETE denied; identity-scope
  behavior) + API level (cross-tenant 403, forged-claim 403 via DB re-check, rogue-key
  401, resident permission denial, platform guard).
- `apps/auth-service/test/auth-flows.e2e.test.ts` (8): login, uniform 401s, single-use
  activation, set-password, rotation + reuse → family revocation, logout.
- Each suite provisions its own database (`sosedo_test_api` / `sosedo_test_auth`) from
  real migrations + seeds.

**Clients wired to real auth**
- Mobile: `src/api/client.ts` (in-memory session, `TODO(M1)` secure-store persistence);
  activation + login screens call the service and surface errors; home greets the user.
- Admin: `src/lib/auth.ts` (localStorage session), real login with error display, shell
  route guard, user chip, sign-out.

### 2026-08-22 — Invite-code onboarding + animation polish (session 4)

- **Flow decision (B7, stakeholder):** residents no longer self-register. The house
  manager creates the resident account (verified apartment/address) and the platform
  sends a one-time activation code via SMS or Viber. Plan updated (§ B7, M1, M2, P0
  table, E2E scenario 1, backlog items 10/16).
- Mobile: replaced the registration form with an **invite-code activation screen**
  (`app/(auth)/activate.tsx`, new `src/components/CodeInput.tsx` — 6-digit boxes over a
  hidden input so SMS autofill/paste work). Mock verify + resend marked `TODO(M1)`.
  Includes a **"Skip for now"** link straight to Home for demoing.
- Welcome screen primary CTA is now "I have an invite code" → `/activate`.
- Animation fix: bottom CTA panels used `SlideInDown.springify()`, which slides from a
  full screen-height below and overshoots to the top before bouncing back. Replaced
  with subtle `FadeInUp` (25px fade-up) on welcome/login/activate.
- `@sosedo/mobile` typecheck green; verified in iOS Simulator.

### 2026-08-22 — Full-stack local run verified (session 3)

- Ran the entire stack together: docker infra, auth-service (4001), core API (4000),
  admin dashboard (5173), and the mobile app in the iOS Simulator (iPhone 16 Pro Max,
  Expo Go, Metro on 8081). Health endpoints and admin responded; mobile bundled cleanly.
- Note: on a cold simulator boot, `expo start --ios` can time out opening the
  `exp://` URL while Expo Go is being installed. Fix: `xcrun simctl bootstatus <udid> -b`
  to finish booting, then rerun `npx expo start --ios`.

### 2026-08-22 — Docs: status tracker, AGENTS.md, brand reference (session 2)

- Added this status tracker (`docs/implementation-status.md`) and `AGENTS.md`
  (working rules + conventions for coding agents and developers).
- Replaced `brands/sosedo/assets/brand-concept.jpg` with the higher-quality original
  (was a recompressed copy) and embedded it in `docs/implementation-plan.md` under a new
  **Brand identity** section with the palette/token reference table.

### 2026-08-22 — M0 Foundations (session 1)

**Monorepo & tooling**
- pnpm workspaces + Turborepo (`package.json`, `pnpm-workspace.yaml`, `turbo.json`).
- Shared TS base config, Prettier, `.gitignore`, `.env.example`.
- `infra/docker/docker-compose.yml`: Postgres 16, Redis 7, MinIO, MailHog.
- `db/migrations/` placeholder with schema conventions (drizzle-kit wiring lands in M1).
- CI: `.github/workflows/ci.yml` (pnpm 10, Node 22, build + typecheck).
- `README.md` with getting-started instructions.

**Brand system (white-label source of truth)**
- `brands/sosedo/brand.json`: palette from brand concept (navy `#0F1D3A`, blue `#356DFF`,
  green `#22B88F`, purple `#7A6CFF`, mist `#EEF2F7`), gradients, light/dark theme tokens,
  tagline, bundle IDs (`bg.sosedo.resident`), feature flags.
- Brand concept image at `brands/sosedo/assets/brand-concept.jpg`.
- `packages/shared`: `brandConfigSchema` (Zod) + `Money` value object (integer minor units).

**Backend skeletons (decided topology: auth-service + core-api + worker)**
- `apps/auth-service` (NestJS, port 4001): health endpoint, Swagger, `/v1` prefix.
- `apps/api` (NestJS, port 4000): health endpoint, Swagger, **brands module** serving
  `GET /v1/brands/:key/config` with cache + validation.
- Worker deployment deferred to M1 (first jobs: email OTP sending).

**Mobile app (Expo SDK 57, expo-router, Reanimated 4)**
- Theme system: `src/theme/tokens.ts` (brand mirror), `ThemeContext` (light/dark),
  `responsive.ts` with `rs(wide, narrow)` implementing the width>375 styling convention.
- Components: `GradientButton` (slide-up + press-scale + haptics), `PressableScale`,
  `SosedoMark`/`SosedoWordmark` (gradient ring logo, green E), `TextField` (animated focus ring).
- Screens: animated welcome hero (gradient orbs, floating logo, staggered tagline,
  slide-up actions), login, register, home preview (gradient balance card, IBAN copy
  with clipboard + haptics, quick actions, notices feed).
- **Mock data marked with `TODO(M1)`/`MOCK` comments** — auth and home data are fake
  until M1/M3/M7 APIs exist.

**Admin panel (React 19 + Vite + Tailwind 4 + TanStack Router/Query + framer-motion)**
- Brand tokens in `src/styles.css` (Tailwind `@theme`).
- Split login page (animated brand panel + form), app shell (navy sidebar with gliding
  active pill, topbar), dashboard with animated stat cards + recent payments table
  (mock, marked), ComingSoon pages mapped to milestones.

**Known issues / notes**
- Port 4000 is occupied by an unrelated process on the dev machine — use
  `API_PORT=4100 pnpm --filter @sosedo/api dev` locally if needed.
- Auth flows in mobile/admin are visual only (navigate on fake timeout) until M1.
- pnpm is installed workspace-locally at `.tooling/node_modules/.bin/pnpm` on the dev
  machine (corepack signature issue); CI uses pnpm/action-setup.

### 2026-08-21/22 — Planning
- `docs/implementation-plan.md` v1.0 written and iterated with stakeholder decisions:
  auth-service split + tenant-in-JWT, Stripe Connect (Standard), Sosedo pilot brand,
  per-apartment platform billing with super_admin console, no fee proration,
  oldest-first allocation, period-close metering, spreadsheet pilot import,
  shared-schema DB with hash partitioning (schema-per-tenant rejected).
- Repo pushed to `git@github.com:bsdimer/sosedo.git`.

---

## Next up (finish M1, then M2)

1. Admin: tenant switcher, staff & roles management screens, super_admin provisioning
   wizard UI (endpoints exist).
2. auth-service: Redis revocation denylist for access tokens; staff email invitation
   flow; password reset.
3. Worker skeleton (BullMQ) + real SMS/Viber invite-code delivery (gateway decision
   pending — Twilio vs Infobip, see plan B7).
4. Mobile: secure-store session persistence + silent refresh; phone-entry step for
   resend-code.
5. Audit coverage on role/permission changes (writer exists; wire into staff endpoints
   when the management screens land).
6. Then M2: property hierarchy, manager "add resident" flow (creates user + occupancy +
   sends invite code), spreadsheet import.
