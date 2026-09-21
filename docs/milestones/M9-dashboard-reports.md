# M9 — Dashboard ("Табло"), debtor reporting, first exports

**Status:** Not started. **Effort / sequencing:** L.

Part of the [implementation plan](../implementation-plan.md). Milestone order and dependencies are in its §7. Section numbers (§) are the plan's own; its index maps each § to a file.

## Goal

Manager's daily cockpit and the debtor list; XLSX export of debtors and transactions. The screen contract — every card, its data, states, permissions and delivery phase — is [features/admin-dashboard.md](../features/admin-dashboard.md); design source Figma `GJgbXLnOXLa6wxZDaKYK7T` frames `492:2`, `561:35`, `561:10747`, dark `620:504`.

## Dependencies

M4 for the money. The cards also consume M2b (search), M6 (issue summary, attachment infrastructure), M7 (unread count, `debtors` audience type) and M11 (tasks). A source that is late ships as a hidden card or an empty state — never as mock numbers — so only M4 is a hard blocker.

## Tables

`dashboard_building_period_rollups (tenant_id, building_id, period, currency, charged, collected, outstanding, charged_apartments, paid_apartments, refreshed_at)`; `stored_documents` (D15). Both `tenant_id`-leading with RLS. Rollups are a rebuildable cache, not a financial record.

## Backend

- **Scope and period:** every dashboard endpoint covers the buildings the caller may access (tenant-wide or assigned) and takes `period=YYYY-MM` defaulting to the current month in the tenant timezone. An optional `building_ids` filter can only narrow that set.
- **Balance:** `GET /v1/reports/dashboard/balance` → `charged`, `collected`, `outstanding` per currency + building count. `collected` = allocations against the period's charges, so `charged = collected + outstanding`; ratio = collected / charged. The `reports` module reads billing/payments through their read interfaces, never their tables.
- **Buildings overview:** `GET /v1/reports/dashboard/buildings` → building and apartment counts, and per building `paidApartments / chargedApartments` for the period.
- **Rollup refresh:** worker job every 5 min plus an event-triggered refresh of the affected `(building, period)` on payment recorded/reversed and charge generated, so a manager who just recorded a payment does not wait for the next tick.
- **Debtor query** with filters/sorting, and the **`debtors` audience resolver** plugged into M7. **Debtor reminder:** `POST /v1/notices/debtor-reminders/preview` (recipient and apartment counts for the caller's scope) and `POST /v1/notices/debtor-reminders` with `Idempotency-Key`; audience resolved server-side at send time; push + in-app feed via the worker; no amounts in the push payload (§8.3); audited; needs `notifications.send` + `billing.read`. Defaults pending D13.
- **Document library:** presigned upload creating a `stored_document` (category, optional building, optional period) on the shared attachment infrastructure, visible after a clean AV scan; list/download endpoints; `documents.upload`.
- **Exports:** export worker (XLSX via exceljs, PDF via Playwright) producing S3 artifacts with expiring links, `export_jobs` API; `reports.export`.

## Admin

The dashboard page — Balance (hero amount, ring, paid/outstanding, "view details", "send notices" with confirmation dialog), Documents (upload, "make a report" picker), Issues/Surveys switch (Issues live; Surveys hidden until P1), Calendar (from M11), Buildings overview ("add building" tile, paid ratio per building) — in light (photo background) and dark themes from brand tokens, responsive, framer-motion, strings in `packages/i18n`. Replaces the `MOCK` stats and the recent-payments table in `apps/admin/src/pages/Dashboard.tsx`. Plus the debtor report screen, the document library list and export buttons.

## Tests

Aggregate correctness vs. ledger oracle (incl. reversals, zero-charge period, partial payments, two currencies); `charged = collected + outstanding`; building-scoped manager sees only their buildings in every card and in the reminder recipient count; rollup rebuild equals incremental refresh; debtor-reminder idempotency and exact audience; permission matrix per card; tenant-isolation suite and schema contract extended to the new tables and routes; export snapshot tests; render-based contrast check on both themes (§9).

## Acceptance

Debtor XLSX matches on-screen data exactly; dashboard numbers match the oracle for a tenant-wide admin and for a manager assigned to one building; dashboard loads < 2 s with pilot-scale data; no `MOCK` left on the page.

## Risks

Open decisions D11–D18 (hero number, reminder defaults, document owner) change copy and defaults, not the contracts above — the endpoints return all amounts and accept a period, so none of them blocks backend work.
