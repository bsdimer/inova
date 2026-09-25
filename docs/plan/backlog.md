# Ordered task backlog

Part of the [implementation plan](../implementation-plan.md). Section numbers (§) are the plan's own; its index maps each § to a file.

Small, independently implementable, agent-sized items in build order. A planning backlog, not a living tracker — do not tick boxes here. Progress lives in [current.md](../current.md). Item numbers are stable references; lettered items (`21a`) were added after the original numbering.

## Foundation

- [ ] **1.** Initialize monorepo: pnpm workspaces + Turborepo, root lint/format/tsconfig, commit hooks
- [ ] **2.** `infra/docker/docker-compose.yml`: Postgres 16, Redis, MinIO, MailHog; `.env.example`
- [ ] **3.** Scaffold `apps/auth-service` and `apps/api` NestJS services (shared tooling package) with config service, health endpoints, OpenAPI emit, RFC 7807 error filter
- [ ] **4.** Wire drizzle-kit migrations in `db/migrations` + CI migration check job
- [ ] **5.** Scaffold `apps/admin` (Vite React, router, typed API client from OpenAPI)
- [ ] **6.** Scaffold `apps/mobile` (Expo TS, brand-config stub, responsive style helpers, light/dark themes)
- [ ] **7.** GitHub Actions `ci.yml`: lint, typecheck, test, build, docker images → ECR
- [ ] **8.** Terraform bootstrap: state bucket, ECR, GitHub OIDC role

## Identity & tenancy

- [x] **9.** Migration: tenants, brands, users, staff_memberships, roles, permissions, refresh_tokens, audit_records (+RLS policies; tenant-leading composite PKs/indexes; audit_records partitioned from day 1 per §4.7)
- [ ] **10.** auth-service: refactor tenant-facing identities to tenant-scoped account realms (same email/phone allowed across tenants), realm-scoped invite/login/reset with no cross-brand disclosure, one-tenant-per-token JWT claims with multiple applicable roles (RS256/ES256), tenant-bound refresh families, JWKS, refresh rotation/logout, Redis revocation denylist _(current global-user implementation is superseded; delivery remains a logged MOCK until the worker lands)_
- [ ] **10a.** auth-service recovery and invite hardening (B13–B15): forward migration (`invite_codes.status`, partial unique indexes on active rows, `password_resets`), activation by realm + identifier + code with a five-attempt cap, realm-scoped resend that voids the previous code, public recovery request/confirm by email link or phone code, bounded lifetime settings, refresh-family revocation on reset, e2e tests for every case in the M1 file
- [ ] **11.** core-api: adapt JWT verification and tenant-context middleware so `X-Tenant-Id` must equal the tenant-account token realm; evaluate multiple roles plus building/apartment assignments per resource (platform support access remains explicit/audited), DB re-check for sensitive ops + `SET LOCAL app.tenant_id` _(current multi-membership implementation requires refactor)_
- [ ] **12.** Permission catalog + guards + seeded role templates + tenant entitlement flags _(catalog, guards and role templates done; entitlement flags pending)_
- [ ] **12a.** super_admin platform role: `platform_role` JWT claim, platform guard, tenant provisioning/initialization endpoints + console wizard UI (audited `platform_access`) _(all done except the wizard UI)_
- [ ] **13.** Audit-record writer (transactional) + coverage on role/permission changes _(writer done + used by provisioning; role-change coverage lands with the staff screens)_
- [x] **14.** Seed script: two demo tenants + tenant-isolation test suite (CI blocker)
- [ ] **15.** Admin: login _(done)_, explicit authenticated tenant-context switcher, staff invitations, role management screens
- [ ] **16.** Mobile: invite-code activation + login screens _(done)_; secure multi-account session portfolio, tenant switcher, multi-role view selector, and tenant-namespaced caches/push/analytics _(pending)_ _(the multi-account portfolio and tenant switcher moved to item 56 / M10 on 2026-09-21; tenant-namespaced storage keys stay here)_

## Property

- [ ] **16a.** Worker skeleton before M3: BullMQ consumer deployable, `inova_worker` DB role without BYPASSRLS, per-tenant job iteration with `SET LOCAL app.tenant_id` (D21), health check, deploy wiring
- [ ] **16b.** Redis revocation denylist with the D20 failure mode (fail open for ordinary requests, closed for sensitive ones, logged and alerting)
- [ ] **17.** Migration: buildings, entrances, apartments (unique building + entrance + floor + number), effective-dated occupancies/pets, occupancy_requests, building_manager_assignments, removal_requests
- [ ] **18.** Property draft/activation CRUD + multiple owners + owner/tenant guards + occupancy request/verify/reject + manager assignments + super_admin removal approval
- [ ] **19.** XLSX/CSV bulk import endpoint with dry-run + row-level error report
- [ ] **19a.** Importer currency step (A-EUR): one-time BGN → EUR conversion at 1.95583, half-up per amount, reconciliation report with source, result and total rounding difference
- [ ] **20.** Admin: portfolio tree, apartment detail, verification queue
- [ ] **21.** Mobile: add-apartment request flow, profile (contacts, occupants, pets)
- [ ] **21a.** Unified search (M2b): tenant-leading trigram indexes, `GET /v1/search` with permission- and building-scope filtering, isolation + scope tests; admin shell search box with grouped results

## Billing

- [ ] **22.** Migration: fee_rules (versioned), charges, charge_lines, document_counters
- [ ] **23.** Building assessment basis config + fee-rule CRUD/versioning + effective-dated population inputs + dry-run preview API
- [ ] **24.** Fee-generation cron job (idempotent, tenant TZ) + golden-file test suite
- [ ] **25.** One-time/temporary charge endpoints
- [ ] **26.** Obligations views (per apartment, per building) + mobile obligations screen + IBAN/reference copy UI
- [ ] **27.** Admin: fee-rule builder, charge management, generation preview screen

## Payments & finance

- [ ] **28.** Migration: bank_transactions, payments, payment_allocations, logical fund accounts, ledger_entries, receipts, idempotency_keys (+append-only triggers)
- [ ] **29.** External bank import/match queue + manual payment entry + auto/manual allocation + reversal flow (+property tests)
- [ ] **29a.** Bank statement upload parsers (CSV / MT940 / CAMT.053) behind the ingestion boundary with per-transaction dedupe; apartment credit for overpayments, consumed oldest-first by later charges (A-BANK-MATCH)
- [ ] **30.** Ledger writer + one-bank-account/logical operational-deposit summaries + configured fund-transfer rules + transaction history APIs
- [ ] **31.** Designated owner recipient + gapless receipt numbering + PDF render job (Playwright in worker) + S3 storage
- [ ] **32.** Admin: payment entry, allocation editor, cash dashboards, receipt views
- [ ] **33.** Mobile: payment history, receipt download, building account summary

## Issues, notices, push

- [ ] **34.** Migration: issues (incl. `priority`), issue_events, attachments (shared `files` module); presigned-upload handshake
- [ ] **35.** ClamAV scan + image re-encode worker jobs (+abuse tests)
- [ ] **36.** Issue APIs with status machine + history; admin issue queue UI; mobile report flow
- [ ] **36a.** Issue priority control + audited changes; `GET /v1/issues/summary` (open, pending, planned, urgent, resolved-in-period, urgent list) with building-scope tests
- [ ] **37.** Migration: notices, notice_targets, devices, notifications
- [ ] **38.** PushProvider abstraction (FCM+APNs) + fan-out worker with retries + token pruning
- [ ] **39.** Notice publish + audience resolution (`AudienceResolver`, incl. the `debtors` type) + admin composer; mobile notices feed + notification center
- [ ] **39a.** `GET /v1/me/notifications/unread-count` + admin nav badge and top-bar bell
- [ ] **40.** Event-driven pushes: payment recorded, issue status change, occupancy verified

## Tasks & calendar

- [ ] **40a.** Migration: tasks (tenant-leading PK, RLS, `(tenant_id, scheduled_on)` index) + schema contract + isolation coverage
- [ ] **40b.** `tasks` module: CRUD, day/range lists, month calendar counts, complete/reopen/cancel, `tasks.read` / `tasks.manage`, building-scope visibility, tenant-timezone day boundaries
- [ ] **40c.** Admin: Tasks section (list + form) and the Calendar card (Month with dots + Upcoming, Day with checkbox; day pick switches view)

## Reporting & ops

- [ ] **41.** Migration: dashboard_building_period_rollups, stored_documents; rollup refresh job (5 min + payment/charge events) + rebuild job
- [ ] **41a.** `GET /v1/reports/dashboard/balance` and `/buildings` (period + narrowing building filter) with ledger-oracle, scope and invariant tests
- [ ] **41b.** Debtors audience resolver + debtor-reminder preview/send (`Idempotency-Key`, audit, 24-h repeat guard)
- [ ] **41c.** Document library: stored-document upload/list/download on the shared attachment infrastructure
- [ ] **41d.** Admin dashboard page per [features/admin-dashboard.md](../features/admin-dashboard.md): Balance, Documents, Issues (Surveys hidden until the surveys module ships and the tenant is entitled — before the pilot, D23), Calendar, Buildings overview; light/dark from brand tokens; per-card loading/empty/error/permission states; bg/en strings; removes the `MOCK` data in `Dashboard.tsx`
- [ ] **41e.** Render-based contrast check (Playwright screenshot per brand × theme, text layer vs real background) wired as a pre-release gate
- [ ] **42.** Debtor report API + UI + XLSX export job
- [ ] **43.** Terraform: VPC, EKS, RDS, Redis, S3, SES, Secrets Manager, CloudFront
- [ ] **44.** Helm charts (api, worker) + staging/prod deploy workflows with approvals
- [ ] **45.** kube-prometheus-stack + Loki + Sentry + PostHog wiring + Slack alerts
- [ ] **46.** Nightly logical backup job + restore-drill runbook + runbook set (deploy, incident, webhook replay)

## Harness (independent of phases)

- [ ] **46a.** Admin test runner (vitest + jsdom + Testing Library) and a first component test; until then admin phases close on recorded manual checks
- [ ] **46b.** Mobile test runner (jest-expo) and a Maestro happy path
- [ ] **46c.** Generate typed API clients for admin and mobile from the services' OpenAPI documents, with a CI check that the generated output is current — the plan is OpenAPI-first but clients are hand-typed today
- [ ] **46d.** Self-contained Postgres for integration tests (Testcontainers) so `pnpm verify` needs no manually started infra
- [ ] **46e.** Pilot production host per D19: provisioned VM, off-box encrypted `pg_dump`, rehearsed restore, re-enabled `main` deploys

## Pilot

- [ ] **47.** inova import scripts (B4 source) with dry-run + opening-balance reconciliation report
- [ ] **48.** Mobile pilot hardening: offline caching, Android/iOS parity, accessibility, bg/en review, e2e happy path
- [ ] **49.** Store submissions of shared app (TestFlight external + Play closed track → production)
- [ ] **50.** Execute pilot launch checklist (§10); baseline success metrics in PostHog

## Fast-follows (post-pilot, independently schedulable)

- [ ] **51.** iCard online payments (preferred, after B1 validation): tenant onboarding/configuration, provider-neutral payment intents, signature-authenticated webhook/callback consumer with server-side tenant resolution + dedupe, auto-allocation, refunds if supported, reconciliation job + exceptions UI
- [ ] **51a.** Platform billing (M-Bill): subscriptions (price history)/entitlements/usage_snapshots migrations, monthly managed-property count (never account count) metering job behind one interface (A-METER), Stripe Billing metered reporting, invoice webhooks + dunning, super_admin screens: per-tenant price config, bulk price update, entitlement toggles, usage history
- [ ] **51b.** Hash-partitioning playbook executed for ledger_entries/charges/payments/notifications when volume thresholds hit (§4.7); synthetic 2,000-tenant performance suite
- [ ] **52.** Invoices/credit notes per B2 answer (documents module extension)
- [ ] **53.** Expenses + contractors module; house-manager batch payment initiation; recurring expense/payment schedules; immutable realized payment records
- [ ] **54.** Brand build matrix CI (EAS/fastlane) + credentials vault structure + second-brand smoke test
- [ ] **55.** First partner's dedicated app: partner account procedure, compliance checklist, differentiation record, store submission
- [ ] **56.** Shared-app tenant-account portfolio: add realm by invite deep link/org code, authenticate separately, securely store/remove sessions, switch tenant without cache/push/analytics leakage
- [ ] **57.** Owner-proposed surveys/voting/protocols: manager approval, push-on-publish, owner-only voting, per-survey apartment/ideal-parts weighting (after co-owner ballot rule confirmation)
- [ ] **57a.** `GET /v1/surveys/summary` + the Surveys side of the dashboard switch (open count, proposed badge, voted %, "expires in N days"); create/review button per D16
- [ ] **58.** Privileges module + privilege pushes
- [ ] **59.** Export catalog (XLSX/PDF) + accounting journal export (§8.4)
- [ ] **60.** GDPR export/erasure worker flows + admin request handling
