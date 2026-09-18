# inova

Multi-tenant, white-label SaaS platform for professional property-management companies.
Operated by **WhiteNova Technology**.
**Together. Better. Home.**

> Existing development databases created before the rename should be upgraded
> with `pnpm db:migrate`. Do not rewrite migration `0001` or delete Docker
> volumes merely to adopt the new identifiers; migration `0002` performs the
> forward rename.

Living status: [docs/current.md](docs/current.md). Docs index: [docs/README.md](docs/README.md).
Architecture and stakeholder decisions: [docs/implementation-plan.md](docs/implementation-plan.md).
Agent/developer harness: [AGENTS.md](AGENTS.md).

## Repository layout

```
apps/
  auth-service/   NestJS identity service (JWT + JWKS, memberships) — port 4001
  api/            NestJS core API (domain modules, brand config)    — port 4000
  admin/          React + Vite admin panel                          — port 5173
  mobile/         Expo React Native resident app
packages/
  shared/         Money value object, brand-config schema, shared types
brands/
  inova/         Non-secret brand config + assets (white-label source of truth)
db/               Plain SQL migrations (drizzle-kit; wired in M1)
infra/docker/     Local docker-compose: Postgres, Redis, MinIO, MailHog
docs/             current.md, architecture, milestones, work-log, plan, ADRs
```

## Getting started

Prerequisites: Node ≥ 22, pnpm ≥ 10, Docker.

```bash
# 1. Install dependencies
pnpm install

# 2. Start local infrastructure (Postgres, Redis, MinIO, MailHog)
docker compose -f infra/docker/docker-compose.yml up -d

# 3. Environment
cp .env.example .env
pnpm doctor                           # Node/pnpm, Docker, Postgres, Redis, migrations

# 4. Schema + seed
pnpm db:migrate && pnpm db:seed

# 5. Run everything (or filter per app)
pnpm dev                              # all apps via turborepo
pnpm --filter @inova/api dev         # core API      → http://localhost:4000/docs
pnpm --filter @inova/auth-service dev # auth service → http://localhost:4001/docs
pnpm --filter @inova/admin dev       # admin panel   → http://localhost:5173
pnpm --filter @inova/mobile dev      # Expo dev server (scan QR with Expo Go)

# Definition of Done before you finish a task
pnpm verify                           # format, lint, typecheck, tests, contracts, build
```

## Brand / white-label

One codebase, no forks. `brands/<key>/brand.json` holds non-secret branding
(colors, gradients, names, feature flags); the core API serves it at
`GET /v1/brands/:key/config` for the shared multi-brand app. Dedicated partner
apps are compiled from the same config via a CI brand matrix (milestone M10).
Signing keys and store credentials never live in this repository.

## Conventions

- TypeScript everywhere, pnpm workspaces + Turborepo.
- Money is decimal-string/`NUMERIC(14,2)` at rest, integer minor units in code
  (`Money` in `packages/shared`). No floats.
- Every tenant-owned table: `tenant_id` leads all keys; RLS enforced (M1+).
- Mobile screens use `rs(wide, narrow)` (`src/theme/responsive.ts`): `wide` is
  the 402pt size, `narrow` the 375pt size, and other widths scale between and
  beyond those within a clamp.
