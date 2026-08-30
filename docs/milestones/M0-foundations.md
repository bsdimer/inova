# M0 — Foundations

**Status:** Done for local foundations (2026-08-22). Original M0 also listed
Terraform/ECR/OIDC and generated OpenAPI clients — those moved to M-Ops / later
and are **not** treated as open M0 work.

## Goal

A new engineer can clone the repo, start local infra, and run the app shells.
CI is green.

## In repo today

- pnpm workspaces + Turborepo; shared TS config; Prettier + ESLint.
- `infra/docker/docker-compose.yml`: Postgres 16, Redis 7, MinIO, MailHog.
- `apps/auth-service` and `apps/api` NestJS shells (health, Swagger, `/v1`).
- `apps/admin` Vite/React shell; `apps/mobile` Expo SDK 57 shell + theme.
- `packages/shared`: `Money`, `brandConfigSchema`.
- `brands/sosedo/brand.json` + assets.
- GitHub Actions (now split: static, unit, migrations, auth, tenant-isolation, build).
- `pnpm doctor` / `pnpm verify`.

## Acceptance (local)

- [x] Clone → `pnpm install` → docker compose → health endpoints respond.
- [x] Brand config served / loaded without hardcoded palette in new screens.
- [x] CI runs on PRs.

## Not in this milestone (tracked elsewhere)

- Terraform state bucket, ECR, GitHub OIDC — M-Ops.
- Typed clients generated from OpenAPI — later, with OpenAPI-first hardening.
- Worker deployable — M1 remainder.

## Required tests

CI pipeline itself; `/health` smoke via service boot. No financial suite yet.
