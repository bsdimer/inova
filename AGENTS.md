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
   a plan topic under `docs/plan/`, an ADR under `docs/decisions/`, the linked feature brief under
   `docs/features/`, or the frontend skill (see below). Load a linked reference
   later only when the task stage needs it.
4. Check `git status`.
5. State the task's acceptance criteria before editing, and which tests will
   prove them (see [Testing](#testing)).

**Finish**

1. Run `pnpm verify` (the executable Definition of Done).
2. Confirm no secrets and no unmarked mocks (`TODO(M<n>)` or `MOCK`).
3. Update [docs/current.md](docs/current.md) only when what works, blockers, or
   Next up actually changed.
4. Add one short change-set entry to `docs/work-log/YYYY-MM.md`: what changed,
   how it was verified, what remains.
5. Keep Next up accurate.

The implementation plan is split: [docs/implementation-plan.md](docs/implementation-plan.md)
is a short index, topics live in `docs/plan/`, phases in `docs/milestones/`. Load
only the one file the task needs — never the whole set — and skip old status
files. Index: [docs/README.md](docs/README.md).

## Non-negotiable working rules

1. **Never commit secrets.** No signing keys, APNs keys, Stripe keys, service
   accounts, or `.env` files. `brands/` holds non-secret config only.
2. **Follow the milestone order** unless the user says otherwise. Current target
   is in `docs/current.md`. Do not build ahead of the plan.
3. Mark every stub/mock: `// TODO(M<n>): ...` or a `MOCK` constant.
4. Financial and tenant-isolation suites are release blockers — never skip,
   weaken, or delete them to make CI pass.
5. Do not re-litigate items marked RESOLVED/Decided in
   [docs/plan/decisions.md](docs/plan/decisions.md) or
   [docs/architecture.md](docs/architecture.md).
6. **A phase closes only on green tests.** No milestone is marked Done —
   in its file, in `docs/current.md`, in a commit or a PR — until the tests it
   requires exist and pass. See [Closing a phase](#closing-a-phase).

## Branching and environments (GitFlow)

| Branch      | Purpose                                 | Deploys to                                                 |
| ----------- | --------------------------------------- | ---------------------------------------------------------- |
| `develop`   | Integration; target of feature PRs      | test — `https://test-portal.whitenova.tech`, automatically |
| `main`      | Releases; no production environment yet | nothing yet — deploys are disabled until production exists |
| `feature/*` | Work in progress, from `develop`        | nothing                                                    |
| `release/*` | Stabilise a release, from `develop`     | nothing; merge to `main`, then back into `develop`         |
| `hotfix/*`  | Urgent production fix, from `main`      | nothing; merge to `main`, then back into `develop`         |

- Branch from `develop` and open the PR against `develop`. Never branch
  feature work from `main`.
- `main` and `develop` are protected: changes land by pull request only, with
  every CI gate green. Force-pushes and deletions are blocked.
- A push to `develop` runs CI and then deploys to test. A push to `main` runs
  CI only: there is no production environment yet.
- Each environment gets its own database, Redis and JWT signing key, so tokens
  never cross environments. Only test is ever seeded.
- Mobile release builds point at `portal.whitenova.tech`, which is not live;
  point builds at `https://test-portal.whitenova.tech/auth/v1` with
  `EXPO_PUBLIC_AUTH_URL`.

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

## Testing

Logic ships with its tests **in the same change**. "Tests to follow" is not
done, and a change whose tests were not run is not verified.

| Kind        | Covers                                                                                                                                              | Lives in                                                                         | Runs with               |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | ----------------------- |
| Unit        | Logic with no I/O: calculations, allocation, state machines, validators, mappers, the decision part of a guard or policy                            | next to the code, `src/**/*.test.ts`                                             | `pnpm test:unit`        |
| Integration | Anything whose correctness depends on Postgres/RLS, HTTP routing, guards, transactions or queues: every endpoint, table and migration-enforced rule | `apps/<service>/test/*.e2e.test.ts`, real Postgres as `inova_app` (no BYPASSRLS) | `pnpm test:integration` |

- **Every new or changed behaviour has a test that fails without it.** Most
  backend work needs both kinds: unit tests for the rules, an integration test
  for the route that exposes them. A bug fix starts with a failing regression
  test.
- **New endpoint:** integration tests for the happy path, permission denied,
  invalid input, and a cross-tenant case added to the tenant-isolation suite.
  **New tenant-owned table:** the schema contract test must pass unchanged.
- **Money:** unit tests on the arithmetic (`Money`, never floats), integration
  tests for append-only and `Idempotency-Key` behaviour. Finance,
  tenant-isolation and auth suites are release blockers (rule 4).
- Test through the public surface — a service method, an HTTP route — not
  private internals. Cover the failure modes that really occur: empty result,
  duplicate/retry, malformed payload, upstream timeout or 4xx/5xx.
- Unit tests are hermetic: no network, database, real clock, shared mutable
  fixtures or ordering assumptions. Mock only at the process boundary (HTTP
  client, queue, S3, clock). **Never mock the database in an integration
  test** — RLS and constraints are the thing under test.
- Use the existing runner (vitest) and helpers; do not add a second one.
- Judgement, not a coverage number: layout, copy and token changes, DI wiring
  and trivial pass-through code do not need a test written for them. There is
  no coverage threshold to game.
- **Frontend:** follow the `inova-frontend` skill's `references/testing.md`.
  Admin and mobile have no test runner yet, so put pure logic that deserves a
  test (formatting, display math, schemas) in `packages/shared`, and record
  manual flow/visual QA in the work-log entry.
- Never skip, weaken or delete a test to get green. Report the real output.

## Closing a phase

A phase (a file in `docs/milestones/`) is **Done** only when all of this is
true. Until then its status is "In progress" with the gaps listed — "done
except tests" is not a status.

1. Every item under the phase file's **Tests / Required tests** exists as an
   automated test. Where no runner exists yet (admin, mobile), the item is
   recorded as a named manual check with its result — never silently dropped.
2. Every **Acceptance** criterion is demonstrated and mapped to a test or to
   such a recorded check.
3. Release-blocker suites cover the phase's additions: each new route and
   tenant-owned table is in the tenant-isolation suite and passes the schema
   contract; money paths have their financial and idempotency tests.
4. **`pnpm verify` is green as one command** on the branch being merged. A
   failure that "passes on rerun" is a finding to explain in the work-log, not
   a pass.
5. No mock of this phase is left: `TODO(M<n>)` / `MOCK` markers for the phase
   are gone or explicitly re-assigned to a later phase.

Then, in the same change: set **Status** in the phase file to Done with the
date, update the "Milestone honesty" and "Tests" tables in `docs/current.md`,
and put the test summary (suites, counts, the verify result) in the work-log
entry.

Scope may be moved out of a phase, openly, into another phase's file — as M0's
infrastructure moved to M-Ops. Tests for the scope that stays may not be
deferred. Do not build the next phase on a dependency that is not closed unless
the user says so.

## Definition of done

`pnpm verify` is green. That runs format check, lint, typecheck, unit tests,
integration tests, architecture contracts, and build. Also:

1. New or changed logic has unit and/or integration tests in the same change,
   per [Testing](#testing); finance, isolation and auth suites stay green.
   Finishing a task is not closing a phase — that needs [Closing a phase](#closing-a-phase).
2. Mocks/stubs are marked `TODO(M<n>)` or `MOCK`.
3. `docs/current.md` is updated when living state changed; the monthly work-log
   has one concise entry for the change set.
4. No secrets, no commented-out code, no unrelated refactors.

## Where to read more

| Need                               | File                                                       |
| ---------------------------------- | ---------------------------------------------------------- |
| Living status, Next up             | [docs/current.md](docs/current.md)                         |
| Architecture + decided trade-offs  | [docs/architecture.md](docs/architecture.md)               |
| Plan index + section (§) map       | [docs/implementation-plan.md](docs/implementation-plan.md) |
| Stakeholder decisions, assumptions | [docs/plan/decisions.md](docs/plan/decisions.md)           |
| Domain, data model, API, security  | [docs/plan/](docs/plan/)                                   |
| Milestone scope + acceptance       | [docs/milestones/](docs/milestones/)                       |
| Session history                    | [docs/work-log/](docs/work-log/)                           |
| Feature scope + acceptance         | [docs/features/](docs/features/)                           |
| Frontend workflow                  | `.cursor/skills/inova-frontend/SKILL.md`                   |
