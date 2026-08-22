# Sosedo

Multi-tenant, white-label SaaS platform for professional property-management companies.
**Together. Better. Home.**

Full architecture, milestones, and scope: [docs/implementation-plan.md](docs/implementation-plan.md).

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
  sosedo/         Non-secret brand config + assets (white-label source of truth)
db/               Plain SQL migrations (drizzle-kit; wired in M1)
infra/docker/     Local docker-compose: Postgres, Redis, MinIO, MailHog
docs/             Implementation plan, ADRs, runbooks
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

# 4. Run everything (or filter per app)
pnpm dev                              # all apps via turborepo
pnpm --filter @sosedo/api dev         # core API      → http://localhost:4000/docs
pnpm --filter @sosedo/auth-service dev # auth service → http://localhost:4001/docs
pnpm --filter @sosedo/admin dev       # admin panel   → http://localhost:5173
pnpm --filter @sosedo/mobile dev      # Expo dev server (scan QR with Expo Go)
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
- Mobile screens use width-responsive styles: values differ for screens
  wider than 375pt (`rs(wide, narrow)` in `src/theme/responsive.ts`).
