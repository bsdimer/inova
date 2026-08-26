# AGENTS.md — instructions for coding agents and developers

Sosedo is a multi-tenant, white-label SaaS platform for property-management companies:
NestJS backend services, React admin panel, Expo resident app, PostgreSQL. Bulgarian
pilot under the platform's own "Sosedo" brand.

## Read these first

1. [docs/implementation-plan.md](docs/implementation-plan.md) — architecture, milestones,
   domain model, all stakeholder decisions. **This is the source of truth for scope and
   design.** Do not re-litigate decided items (marked "RESOLVED"/"Decided").
2. [docs/implementation-status.md](docs/implementation-status.md) — what is actually built.

## Non-negotiable working rules

1. **Update `docs/implementation-status.md` in the same change set as any implementation
   work** — mark milestone progress, add a work-log entry, keep "Next up" accurate.
2. **Never commit secrets.** No signing keys, APNs keys, Stripe keys, service accounts,
   or `.env` files. Brand folders (`brands/`) hold non-secret config only.
3. **Follow the milestone order** unless the user says otherwise. Current target is in
   the status file. Don't build ahead of the plan (no speculative abstractions).
4. Mark every stub/mock clearly: `// TODO(M<n>): ...` or a `MOCK` constant, so it is
   greppable when the real API lands.
5. Financial and tenant-isolation test suites (once they exist, M1+) are release
   blockers — never skip, weaken, or delete them to make CI pass.

## Repository layout

```
apps/auth-service   NestJS identity service (port 4001) — JWT + JWKS, memberships
apps/api            NestJS core API (port 4000) — domain modules under src/modules/
apps/worker         (from M1) BullMQ jobs — reuses api modules
apps/admin          React 19 + Vite + Tailwind 4 + TanStack Router/Query + framer-motion
apps/mobile         Expo (SDK 57) + expo-router + Reanimated 4
packages/shared     Money, Zod schemas, shared types (build before dependents)
brands/<key>/       White-label brand config + assets (non-secret, source of truth)
db/migrations       Plain SQL migrations (drizzle-kit)
infra/docker        Local docker-compose (Postgres, Redis, MinIO, MailHog)
docs/               Plan, status, ADRs (docs/decisions/), runbooks
```

## Commands

```bash
pnpm install                          # root install (workspace)
docker compose -f infra/docker/docker-compose.yml up -d
pnpm build && pnpm typecheck          # must pass before finishing any task
pnpm --filter @sosedo/api dev         # or: auth-service, admin, mobile
```

Dev machine note: if port 4000 is taken, run the API with `API_PORT=4100`.

## Architecture invariants (from the plan — do not violate)

- **Tenant isolation:** every tenant-owned table has `tenant_id` as the *leading* column
  of its primary key and indexes; RLS policies on all such tables; the app DB role never
  bypasses RLS. Client-supplied brand/bundle/tenant config is **never** an authorization
  input — only authenticated membership (JWT claims verified server-side, DB re-check for
  sensitive operations).
- **Money:** integer minor units in code (`Money` in `packages/shared`), decimal strings /
  `NUMERIC(14,2)` at rest, explicit `currency` column everywhere. **No floats, ever.**
- **Financial records are append-only:** charges, payments, allocations, ledger entries,
  documents get corrections via reversal/credit-note rows, never UPDATE/DELETE.
- **Idempotency:** money-creating POST endpoints take an `Idempotency-Key`; webhook
  handlers dedupe on `(provider, provider_event_id)`.
- **Services:** auth-service owns identity; core-api verifies JWTs via JWKS locally (no
  runtime call to auth-service); async side effects (email, push, PDFs) go through the
  worker via BullMQ queues, never inline in request handlers.
- **Migrations are plain SQL** (RLS, triggers, partitioning are hand-written) — do not
  switch to ORM-generated migrations.

## UI conventions

- **Branding:** all colors/gradients come from brand tokens — mobile:
  `apps/mobile/src/theme/tokens.ts` (mirror of `brands/sosedo/brand.json`), admin:
  Tailwind `@theme` in `apps/admin/src/styles.css`. Never hardcode hex values in screens.
  Palette (2026-08 rebrand): Santiago Orange `#EB5E28`, cold foam `#EFECE3`, gold black
 `#1D1D1F`, warm dark `#2C2324`, landmark `#766754`, stone `#A79D90`. Frosted "liquid
 glass" surfaces via `apps/mobile/src/components/GlassView.tsx` (expo-blur). The admin
 panel still carries the old navy palette until its restyle lands.
- **Mobile responsive rule (project convention):** size values conditionally for screens
  wider than 375pt using `rs(wide, narrow)` from `src/theme/responsive.ts` — fonts,
  paddings, margins, control heights. Example: `fontSize: rs(24, 20)`.
- **Android is a first-class target:** use `elevation` alongside iOS shadows, test back
  navigation, avoid iOS-only APIs without a Platform guard.
- Support light **and** dark themes via `useTheme()` (mobile); no raw `StyleSheet` colors.
- Animations: Reanimated entering/spring animations (mobile), framer-motion (admin) —
  smooth and purposeful; primary CTAs slide up; pressables use `PressableScale`.
- All user-facing strings will move to `packages/i18n` (bg/en) — keep strings out of
  deeply nested logic so extraction stays easy.

## Code style

- TypeScript strict everywhere; no `any` unless unavoidable and commented.
- Each core-api module owns its DB tables — never import another module's schema/tables;
  cross-module communication via interfaces/events.
- Comments explain *why*, not *what*. No narration comments.
- Prettier is configured at the root — run `pnpm format` if unsure.
- Conventional, present-tense commit messages (e.g. "Add tenant context middleware").

## Definition of done for any task

1. `pnpm build` and `pnpm typecheck` pass from the repo root.
2. New behavior has tests where the plan requires them (financial logic, isolation, auth).
3. Mocks/stubs are marked with `TODO(M<n>)`.
4. `docs/implementation-status.md` is updated.
5. No secrets, no commented-out code, no unrelated refactors in the diff.
