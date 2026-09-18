# AGENTS.md — instructions for coding agents and developers

inova is a multi-tenant, white-label SaaS platform operated by WhiteNova
Technology for property-management companies: NestJS backend services, React
admin panel, Expo resident app, PostgreSQL. Bulgarian pilot under the
platform's own "inova" brand.

## Session ritual (every task)

**Start**

1. Read this file.
2. Read [docs/current.md](docs/current.md) — the only living status document.
3. Start with **one** relevant extra file: a milestone under `docs/milestones/`,
   an ADR under `docs/decisions/`, the linked feature brief under
   `docs/features/`, or the frontend skill (see below). Load a linked reference
   later only when the task stage needs it.
4. Check `git status`.
5. State the task's acceptance criteria before editing.

**Finish**

1. Run `pnpm verify` (the executable Definition of Done).
2. Confirm no secrets and no unmarked mocks (`TODO(M<n>)` or `MOCK`).
3. Update [docs/current.md](docs/current.md) only when what works, blockers, or
   Next up actually changed.
4. Add one short change-set entry to `docs/work-log/YYYY-MM.md`: what changed,
   how it was verified, what remains.
5. Keep Next up accurate.

Do **not** load the full implementation plan or old status files unless the task
needs architecture or a stakeholder decision. Index: [docs/README.md](docs/README.md).

## Non-negotiable working rules

1. **Never commit secrets.** No signing keys, APNs keys, Stripe keys, service
   accounts, or `.env` files. `brands/` holds non-secret config only.
2. **Follow the milestone order** unless the user says otherwise. Current target
   is in `docs/current.md`. Do not build ahead of the plan.
3. Mark every stub/mock: `// TODO(M<n>): ...` or a `MOCK` constant.
4. Financial and tenant-isolation suites are release blockers — never skip,
   weaken, or delete them to make CI pass.
5. Do not re-litigate items marked RESOLVED/Decided in
   [docs/implementation-plan.md](docs/implementation-plan.md) or
   [docs/architecture.md](docs/architecture.md).

## Branching and environments (GitFlow)

| Branch      | Purpose                             | Deploys to                                                   |
| ----------- | ----------------------------------- | ------------------------------------------------------------ |
| `develop`   | Integration; target of feature PRs  | test — `https://test-portal.whitenova.tech`, automatically   |
| `main`      | Production releases only            | production — `https://portal.whitenova.tech`, after approval |
| `feature/*` | Work in progress, from `develop`    | nothing                                                      |
| `release/*` | Stabilise a release, from `develop` | nothing; merge to `main`, then back into `develop`           |
| `hotfix/*`  | Urgent production fix, from `main`  | nothing; merge to `main`, then back into `develop`           |

- Branch from `develop` and open the PR against `develop`. Never branch
  feature work from `main`.
- `main` and `develop` are protected: changes land by pull request only, with
  every CI gate green. Force-pushes and deletions are blocked.
- A push to `develop` or `main` runs CI and then deploys; production waits for
  a reviewer to approve the `production` environment in GitHub Actions.
- The environments are isolated: separate databases, Redis and JWT signing
  keys. A token from test is rejected by production. Only test is ever seeded.
- Mobile release builds default to production; point test builds at
  `https://test-portal.whitenova.tech/auth/v1` with `EXPO_PUBLIC_AUTH_URL`.

## Architecture invariants (do not violate)

- **Tenant isolation:** every tenant-owned table has `tenant_id` as the _leading_
  column of its primary key and tenant-scoped indexes; audited identity-scope
  lookup indexes may lead with their global lookup key. RLS on all such tables;
  the app DB role never bypasses RLS. Client-supplied brand/bundle/tenant config
  is **never** an authorization input — only authenticated membership (JWT
  verified server-side, DB re-check for sensitive operations).
- **Money:** integer minor units in code (`Money` in `packages/shared`), decimal
  strings / `NUMERIC(14,2)` at rest, explicit `currency` column. **No floats.**
- **Financial records are append-only:** corrections via reversal/credit-note
  rows, never UPDATE/DELETE.
- **Idempotency:** money-creating POSTs take an `Idempotency-Key`; webhooks
  dedupe on `(provider, provider_event_id)`.
- **Services:** auth-service owns identity; core-api verifies JWTs via JWKS
  locally; async side effects go through the worker via BullMQ, never inline in
  request handlers.
- **Migrations are plain SQL** (RLS, triggers, partitioning are hand-written).

## Repository layout

```
apps/auth-service   NestJS identity (port 4001) — JWT + JWKS, memberships
apps/api            NestJS core API (port 4000) — domain modules under src/modules/
apps/worker         (from M1) BullMQ jobs — reuses api modules
apps/admin          React 19 + Vite + Tailwind 4 + TanStack Router/Query
apps/mobile         Expo (SDK 57) + expo-router + Reanimated 4
packages/shared     Money, Zod schemas, shared types (build before dependents)
brands/<key>/       White-label brand config + assets (non-secret)
db/migrations       Plain SQL migrations
infra/docker        Postgres, Redis, MinIO, MailHog
docs/               See docs/README.md
docs/features/      Optional briefs when milestone/issue context is insufficient
```

## Commands

```bash
pnpm install
pnpm doctor                         # toolchain + local infra
docker compose -f infra/docker/docker-compose.yml up -d
pnpm db:migrate && pnpm db:seed
pnpm check:admin                    # fast admin lint + typecheck + build loop
pnpm verify                         # format, lint, typecheck, tests, contracts, build
pnpm --filter @inova/api dev       # or: auth-service, admin, mobile
```

If port 4000 is taken: `API_PORT=4100`.

## UI conventions

- Colors/gradients come from brand tokens — mobile:
  `apps/mobile/src/theme/tokens.ts` (mirror of `brands/inova/brand.json`);
  admin: Tailwind `@theme` in `apps/admin/src/styles.css`. No hardcoded hex in
  screens. Palette: Santiago Orange `#EB5E28`, cold foam `#EFECE3`, gold black
  `#1D1D1F`, warm dark `#2C2324`, landmark `#766754`, stone `#A79D90`.
- Mobile widths: `rs(wide, narrow)` from `src/theme/responsive.ts`. `wide` is
  the 402pt (iPhone 17) size, `narrow` is the 375pt size. The helper
  interpolates between them and scales outside that range (clamped), so do
  not hardcode fonts, padding, margins, or control heights, and do not add a
  second width check.
- Android is first-class: `elevation` plus iOS shadows; Platform-guard iOS-only APIs.
- Light and dark via `useTheme()`; no raw `StyleSheet` colors.
- Animations: Reanimated (mobile), framer-motion (admin). CTAs slide up;
  pressables use `PressableScale`.
- Keep user-facing strings extractable for `packages/i18n` (bg/en).

For larger frontend work, read and follow the canonical
[`inova-frontend`](.cursor/skills/inova-frontend/SKILL.md) workflow. Cursor may
invoke it directly; Claude has a thin adapter; Codex follows this link. Small
visual fixes do not need it.

## Code style

- TypeScript strict; no `any` unless unavoidable and commented.
- Each core-api module owns its DB tables — never import another module's
  schema/tables; cross-module communication via interfaces/events.
- Comments explain _why_, not _what_.
- Prettier at the root — `pnpm format` to fix, `pnpm format:check` in CI.
- Conventional, present-tense commit messages.

## Definition of done

`pnpm verify` is green. That runs format check, lint, typecheck, unit tests,
integration tests, architecture contracts, and build. Also:

1. New behavior has tests where the plan requires them (finance, isolation, auth).
2. Mocks/stubs are marked `TODO(M<n>)` or `MOCK`.
3. `docs/current.md` is updated when living state changed; the monthly work-log
   has one concise entry for the change set.
4. No secrets, no commented-out code, no unrelated refactors.

## Where to read more

| Need                               | File                                                       |
| ---------------------------------- | ---------------------------------------------------------- |
| Living status, Next up             | [docs/current.md](docs/current.md)                         |
| Architecture + decided trade-offs  | [docs/architecture.md](docs/architecture.md)               |
| Stakeholder decisions, full domain | [docs/implementation-plan.md](docs/implementation-plan.md) |
| Milestone scope + acceptance       | [docs/milestones/](docs/milestones/)                       |
| Session history                    | [docs/work-log/](docs/work-log/)                           |
| Feature scope + acceptance         | [docs/features/](docs/features/)                           |
| Frontend workflow                  | `.cursor/skills/inova-frontend/SKILL.md`                   |
