# Sosedo — Implementation Status

> Living progress tracker against [docs/implementation-plan.md](implementation-plan.md).
> **Rule for agents and developers: update this file in the same change set as any
> implementation work.** Newest session entries go on top of the Work Log.

**Last updated:** 2026-08-26
**Current focus:** mobile-first (stakeholder decision) → M2 property hierarchy next,
feeding the mobile app real data. M1 remainder (denylist, worker) deferred to pre-pilot.

---

## Milestone overview

| Milestone | Scope (short) | Status |
|---|---|---|
| M0 Foundations | Monorepo, CI, docker-compose, app shells, brand system | ✅ **Done** |
| M1 Identity, tenancy, RBAC | auth-service (JWT+JWKS), tenants, memberships, RLS | 🟡 Backend + admin screens (staff/roles/wizard) done; Redis denylist, worker pending |
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
  (seeded codes work in the app); home greets the logged-in user. Sessions persist
  across app launches (refresh token in the keychain, rotated at every launch);
  the home avatar signs out.
- Admin: real login against auth-service, session in localStorage, route guard on the
  shell, user chip shows the real name/role, sign-out clears the session.
- Admin management screens on real APIs: **tenant switcher** (memberships, or all
  tenants for super_admin), **Staff** (invite with activation code, role change,
  suspend/reactivate/revoke), **Roles** (permission-matrix editor, create/edit/delete
  custom roles), **Tenants** (super_admin provisioning wizard).
- Core API staff/roles management: `GET|POST /v1/tenant/staff`,
  `PATCH /v1/tenant/staff/:userId`, `GET /v1/tenant/permissions`,
  `GET|POST /v1/tenant/roles`, `PATCH|DELETE /v1/tenant/roles/:key` — all audited,
  with admin-role lock + last-active-admin lockout guard (13 e2e tests).
- GitHub Actions CI: install → build → typecheck → **tests with Postgres service**.

---

## Work log (newest first)

### 2026-08-26 — Mobile: photo-backdrop redesign to stakeholder mockups, Bulgarian UI (session 11)

- **Stakeholder-provided mockups implemented 1:1** — the whole app now sits on a
  photographic backdrop (`assets/images/building-photo.jpg`, stakeholder image):
  new `src/components/AppBackground.tsx` with two variants — `hero` (building visible
  up top, dissolving into warm haze; home/building tabs) and `blur` (fully blurred
  glow; auth, menu, secondary screens). All user-facing strings are now **Bulgarian**.
- `GlassView` reworked for the photo backdrop: frosted white-translucent fill +
  hairline highlight, white typography (new `glass` tokens in `theme/tokens.ts`);
  accepts overlay/border overrides (menu sheet uses a near-opaque warm frost).
- **Home** rebuilt per mock: brand lockup + glass "…" menu button, "Добре дошли, Иван",
  building name/address, "Текущо задължение 20 €" glass card with black "Плащане" pill,
  2×2 quick grid (Каса / Анкети / История / Известия with unread badge), white
  arrow-bubble affordances (`ArrowBubble`).
- **Building (Сграда)** rebuilt per mock: title + address, SVG **arc gauge**
  (`ApartmentsGauge`, react-native-svg 15.15.4 added) — 32 общо / 24 платили /
  8 неплатили with progress dot; Каса cards (месечни разходи 6 270 €, депозит 9 100 €),
  "Как се оформя таксата" card, Сигнали cards (Паркинг/Оправена, ВиК/В процес) and
  "Документи към сградата" (12 документа) with "Виж всички" links.
- **Activation screen** per mock: back/help glass circles, centered lockup, title with
  orange dash, glass card wrapping the 6-digit `CodeInput` (frosted boxes with
  underscore placeholders) + "Изпрати отново", black "Активирай акаунта" CTA and glass
  "Пропусни засега". Same treatment for login and welcome (Bulgarian copy, dark/glass
  `GradientButton` variants, glass `TextField`).
- **Menu** is now a right-side frosted sheet over the dimmed screen (transparentModal +
  slide-in): Начало/Сгради/Сигнали/Известия/Анкети, divider, Избор на език (BG/EN
  cycle, TODO i18n), Как да платя?, Контакти, Тема (cycles system/light/dark), black
  "Излез от профила" button.
- **Tab bar**: Начало / Сграда / Привилегии / Сигнали; active tab in a black pill,
  white icons/labels. `market` tab replaced by `privileges`.
- Everything not in the mocks is a **"Очаквайте скоро"** placeholder on the same
  backdrop (`ComingSoon`, `TabComingSoon`, restyled `SubScreen`): Привилегии, Сигнали,
  Каса, История, Известия, Анкети, Как да платя?, Контакти, Документи.
- Removed now-unused: `BuildingDetail`, `ScreenHeader`, `homeOverlay`, 3D render +
  ground-shadow assets, old wordmark/mark (replaced by `BrandLockup`).
- Follow-up: home scroll snaps back to its rest position on tab refocus (a leftover
  offset/frozen bounce used to leave a stray gap between the cards and the tab bar);
  home now fits the viewport via a stretchy hero spacer (no scroll on tall screens).
- Follow-up 2 (stakeholder review): lockup switched to the client's **"inova — by
  White Nova Technology"** mark (gold rule + dot); Сграда tab uses the fully blurred
  backdrop (no building photo); gauge side stats inset from the arc geometry so
  Платили/Неплатили never collide with the stroke.
- Follow-up 3: welcome screen rebuilt to the entry mock — crisp photo with dark
  cinematic scrims (new `welcome` background variant), large centered stacked lockup
  (gold underline + dot), bottom CTAs **Вход** (black) / **Регистрация** (glass,
  routes to invite-code activation per B7). Photo is laid out width-fit (whole
  building, no zoom) with the hazy sky/fog extended via blended gradient fills;
  dark/glass buttons got depth — translucent dark fill + hairline highlight, real
  blur inside the glass pill, soft drop shadows on both.
- Root `pnpm build` + `pnpm typecheck` green.

### 2026-08-25 — Mobile: home simplified, building "recedes" on scroll (session 10, follow-up 6)

- Home screen no longer shows the Activity section (header, filter chips, feed) — the
  activity feed now lives exclusively in the expanded building detail view. Home is a
  single non-scrolling composition: greeting, building hero, balance card, pay button.
- Expanded view scroll behavior reworked: instead of lingering half-visible between the
  feed cards, the building now **recedes into the distance** — drifts up at 0.4x, shrinks
  to ~72%, fully fades out over ~260pt of scroll, with a growing depth-of-field blur
  layer (iOS) so it drops out of focus before it disappears.
- Swapped deprecated `experimentalBlurMethod` → `blurMethod` on all BlurViews.

### 2026-08-25 — Mobile: hero expand transition, EUR, lower tab bar (session 10, follow-up 5)

- **Building hero expand:** tapping the home 3D building expands it shared-element style
  into a full-screen detail view (`src/components/BuildingDetail.tsx`): measured source
  frame → settled frame near the top via spring (stiffness 195 / damping 23 ≈ SwiftUI
  response 0.45 / dampingFraction 0.82), blurred + dimmed backdrop, floating tab bar
  animates out (UI-thread shared value in `src/state/homeOverlay.ts`), and an activity
  feed (typed `BuildingActivityItem[]` prop, stubbed from home mock data) scrolls over
  the building with ~0.4x parallax + shrink/fade. Drag down >120pt or fast flick
  dismisses (rubber-band below), soft haptics on expand/dismiss, reduce-motion falls
  back to a plain crossfade, VoiceOver reads the building as a button, Android hardware
  back closes it. The request spec was written for SwiftUI/matchedGeometryEffect; this
  is the Reanimated/gesture-handler equivalent (the app is Expo/React Native).
- Currency switched BGN → EUR across all mock data (home, building, market, messages).
- Floating tab bar moved a bit lower (bottom padding `insets.bottom - 6` clamped).

### 2026-08-25 — Mobile: visible shadows on balance card + pay button (session 10, follow-up 4)

- Fixed clipped shadows: `GlassView` and `GradientButton` set `overflow: 'hidden'` on the
  same view the shadow styles landed on, which silently swallowed iOS shadows. The
  balance card's shadow now lives on an un-clipped wrapper with a solid surface backing,
  and `GradientButton` moved clipping to its inner fill so caller shadows render. Both
  card and Pay-fee button now cast soft drop shadows on iOS and Android (elevation).
- Building hero got a ground shadow: a pre-blurred ellipse asset
  (`assets/images/ground-shadow.png`, generated with Pillow) rendered under the 3D
  render's base — identical on iOS and Android, where view shadows can't follow a
  transparent PNG's silhouette.

### 2026-08-25 — Mobile: flat backgrounds, ambient orbs removed (session 10, follow-up 3)

- Stakeholder feedback: removed the decorative background circles ("ambient orbs") from
  every screen — welcome, home, building, market, issues, menu, and the `SubScreen`
  scaffold. Screens now sit on a single flat theme background (`colors.background`;
  welcome uses cold foam directly). The welcome screen's hero gradient was replaced by
  the same flat color. Glass surfaces still blur real content behind them (hero image,
  scrolling cards).

### 2026-08-25 — Mobile: EntryPay-style balance card (session 10, follow-up 2)

- Balance card restyled 1:1 to the stakeholder's reference: building + apartment title,
  "Monthly maintenance fee" subtitle, divider, orange card-icon tile with "Fee:" +
  amount, "Secure payment" shield chip — nothing else (IBAN/deposit details removed
  from home; IBAN + copy remain on the "How do I pay?" screen). "Pay fee" CTA below
  the card with leading card icon, trailing chevron and a warm shadow — now fully
  visible above the tab bar. `GradientButton` supports `icon`/`trailingIcon`.

### 2026-08-25 — Mobile: 3D building hero (session 10, follow-up)

- Home hero swapped from the framed photo to a stakeholder-provided **3D render**
  (`assets/images/building-3d.png`), floating free over the warm background at full
  ~86% content width — matching the reference mock. The render's black background was
  removed via border flood fill (dark building details kept); transparency holes the
  fill punched through the ground-floor vent slats were re-filled dark, and edge fringe
  cleaned. Old photo asset removed.

### 2026-08-25 — Mobile: liquid-glass tab navigation + competitor feature parity (session 10)

- Feature-parity pass against a competitor resident app (LIVO): unit feed, building
  finances, marketplace listings, issue reporting, messages/surveys/contacts/how-to-pay,
  language + theme switches — all in the warm Sosedo design, **all on mock data**
  (marked `TODO(M2/M3/M6/M7)` for the real APIs).
- New **floating liquid-glass bottom tab bar** (`app/(tabs)/_layout.tsx`, custom
  `tabBar` on expo-router Tabs): Home / Building / Market / Issues, orange active pill.
  Home moved to `app/(tabs)/home.tsx` (URL stays `/home`).
- Home additions: deposit + monthly-fee mini stats in the balance card, **activity feed
  with filter chips** (charges, payments, listings, issues, notices, surveys), header
  menu button.
- New tabs: **Building** (households-with-dues progress, cash balance, total dues,
  monthly budget, issues carousel, documents), **Market** (create-listing form
  offering/seeking, notify toggle, filters incl. "only mine"), **Issues** (report form
  with title/description/photo mock + history with status chips).
- New **menu modal** (`app/menu.tsx`): Messages, Surveys, How do I pay?, Contacts
  screens (shared `SubScreen` scaffold), language BG/EN chips (TODO i18n), **theme
  System/Light/Dark switch** (ThemeContext now has a mode override), sign out.
- Added `@react-navigation/bottom-tabs` (types for the custom tab bar) — one cast where
  expo-router's bundled copy differs nominally.
- Verified home + building tabs on the simulator; mobile typecheck green.

### 2026-08-25 — Rebrand: warm "Santiago Orange" palette + liquid-glass mobile UI (session 9)

- **Stakeholder decision: new brand direction** — warm neutrals + orange, Apple/Claude
  vibe, frosted "liquid glass" surfaces, building photo as the home hero. New palette:
  Santiago Orange `#EB5E28`, cold foam `#EFECE3`, gold black `#1D1D1F`, warm dark
  `#2C2324`, landmark `#766754`, stone `#A79D90`.
- `brands/sosedo/brand.json` + `apps/mobile/src/theme/tokens.ts` rewritten (palette,
  gradients, light/dark themes, tagline accents, slightly larger radii). Splash and
  Android adaptive-icon backgrounds switched to cold foam in `app.json`.
- New `apps/mobile/src/components/GlassView.tsx` — expo-blur frosted surface (iOS blur
  tint + Android `dimezisBlurView`, warm translucent overlay + hairline highlight).
- Welcome: light warm hero, orange logo mark, glass CTA panel. Login/activate inherit
  the theme (they were already token-driven).
- Home redesigned to the reference mockup: greeting header + glass sign-out button,
  **generated building photo hero centered** (`assets/images/building-hero.png`),
  liquid-glass balance card overlapping the hero, glass quick-action tiles and notice
  cards, warm ambient orbs behind the scroll for the blur to refract.
  Fixed a real layout bug: `width:'100%'` on the hero image resolved against auto-sized
  scroll content and blew up to the image's natural 2048px — now explicit dimensions.
- Verified on iPhone 16 Pro simulator (light + dark), root build/typecheck green.
- **Admin dashboard still uses the old navy palette** — restyle to the warm brand is a
  follow-up.

### 2026-08-23 — Mobile: secure-store session persistence + refresh-at-launch (session 8)

- Stakeholder decision: prioritize mobile over remaining admin polish; next up is M2
  (property hierarchy) so the app gets real data.
- `apps/mobile/src/api/client.ts`: only the rotating **refresh token** is persisted
  (expo-secure-store keychain); access tokens stay in memory. `bootstrapSession()`
  exchanges the stored token for a fresh session at every launch (rotation re-reads
  memberships server-side); dead/reused tokens clear the keychain, offline keeps it.
  `logout()` revokes server-side (best-effort) and clears the keychain.
  `refreshSession()` exported for silent refresh once mobile calls core-api.
- Welcome screen doubles as splash: CTAs render only after the session check decides
  the user actually needs to log in; a restored session goes straight to `/home`.
- Home avatar is now an explicit sign-out (log-out icon, `TODO(M5)` profile screen).
- Verified: app boots clean on the simulator with no stored session (CTAs appear);
  root build + typecheck green. Login → relaunch → straight-to-home needs a manual
  device test (typing in the simulator).

### 2026-08-23 — M1: staff & roles APIs + admin management screens (session 8)

**core-api (`apps/api/src/modules/tenant`)**
- New `TenantService` + endpoints (all guarded by JWT + tenant context + permissions,
  every mutation writes an audit record in the same transaction):
  - `GET /v1/tenant/permissions` (roles.read) — fixed platform permission catalog.
  - `GET /v1/tenant/roles` (roles.read) — roles with permissions + member counts.
  - `POST|PATCH|DELETE /v1/tenant/roles[/:key]` (roles.manage) — custom roles;
    **the `admin` role is locked** (always all permissions, cannot be edited/deleted);
    system roles editable but not deletable; delete blocked while assigned.
  - `POST /v1/tenant/staff` (staff.manage) — invite: reuses/creates the user, membership
    `invited`/`active`, 6-digit activation code (`TODO(M1)` gateway — MOCK: logged).
  - `PATCH /v1/tenant/staff/:userId` (staff.manage) — role change, suspend/reactivate/
    revoke; **cannot edit own membership; last-active-admin lockout guard**; invited
    members can only be revoked (they activate via code).
- Note: `PermissionsGuard` caches role→permissions for 60s, so permission edits can
  take up to a minute to apply to in-flight sessions.
- Tests: `apps/api/test/staff-roles.e2e.test.ts` (13) — RBAC per role, admin-role lock,
  catalog validation, invite + duplicate conflict, self/lockout guards, cross-tenant
  denial, audit rows. Full api suite now 24 green.

**Admin (`apps/admin`)**
- `src/lib/api.ts` — core-api client (Bearer + `X-Tenant-Id`; 401 clears session,
  `TODO(M1)` silent refresh). `src/lib/tenant.ts` — selected-tenant store
  (localStorage + `useSyncExternalStore`) and tenant options (memberships, or
  `/platform/tenants` for super_admin).
- `TenantSwitcher` in the sidebar; selection drives every tenant-scoped query.
- **Staff page** (`/staff`): table on real data, role dropdown (PATCH), suspend/
  reactivate/revoke, invite modal (dev note: code printed in api console).
- **Roles page** (`/roles`): role cards with permission chips + member counts, locked
  Administrator card, permission-matrix editor modal, create/delete custom roles.
- **Tenants page** (`/tenants`, super_admin-only route): tenant list + 3-step
  provisioning wizard (organization → optional first admin → review → done, with
  "switch to tenant" on success). Shared UI primitives in `src/components/ui.tsx`.
- `pnpm build`, `pnpm typecheck`, `pnpm --filter @sosedo/api test` all green; flows
  verified against running services (login → roles CRUD → staff list).

### 2026-08-23 — Hide Expo dev-menu gear button overlaying app UI (session 8)

- The "settings" gear reported on the welcome and home screens was **not app code** —
  it is Expo's dev-menu floating action button, an overlay Expo Go draws on every
  screen (it collided visually with the profile avatar on home). It never ships in
  production builds.
- `app/_layout.tsx` now disables it via `DevMenuPreferences.setPreferencesAsync`
  (`__DEV__`-guarded) — effective in dev-client builds. Expo Go doesn't expose that
  module to app code, so on the dev simulator it was turned off with:
  `xcrun simctl spawn booted defaults write host.exp.Exponent EXDevMenuShowFloatingActionButton -bool NO`
  (on a physical device: dev menu → toggle "Show menu button"). Dev menu remains
  reachable via shake / Cmd+D.
- Verified on iPhone 16 Pro Max simulator; `@sosedo/mobile` typecheck green.
- Home balance card polish: replaced the springy `FadeInUp.springify()` entrance (visible
  overshoot "pop") with the same timed `FadeInUp` the other cards use, and gave the card
  a solid navy `backgroundColor` behind the gradient so it can't flash white while the
  gradient paints during the entering animation.

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

## Next up (mobile-first per stakeholder, 2026-08-23)

1. **M2: property hierarchy** — buildings/entrances/apartments + occupancy, manager
   "add resident" flow (creates user + occupancy + sends invite code), spreadsheet
   import. This is what starts feeding the mobile app real data.
2. Mobile: wire "My building" and resident data to M2 APIs as they land.
3. Deferred M1 remainder (do before pilot): auth-service Redis revocation denylist,
   staff email invitation flow, password reset; worker skeleton (BullMQ) + real
   SMS/Viber invite delivery (gateway decision pending — Twilio vs Infobip, plan B7);
   admin silent token refresh + audit-trail viewer page.
