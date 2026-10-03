# M9 — Dashboard ("Табло"), debtor reporting, first exports

**Status:** Not started. **Effort / sequencing:** L.

Part of the [implementation plan](../implementation-plan.md). Milestone order and dependencies are in its §7. Section numbers (§) are the plan's own; its index maps each § to a file.

## Goal

Manager's daily cockpit and the debtor list; XLSX export of debtors and transactions. The screen contract — every card, its data, states, permissions and delivery phase — is [features/admin-dashboard.md](../features/admin-dashboard.md); design source: Figma `GJgbXLnOXLa6wxZDaKYK7T`, page Screens, section «V2 · Табло» (frames in the brief). **Scope added 2026-09-24 (D23):** the menu sections Документи (document library with overview, search and templates) and Справки (entry to the reports).

## Dependencies

M4 for the money. The cards also consume M2b (search), M4 (attachment infrastructure, D38), M6 (issue summary), M7 (unread count, `debtors` audience type) and M11 (tasks). A source that is late ships as a hidden card or an empty state — never as mock numbers — so only M4 is a hard blocker.

## Tables

`dashboard_building_period_rollups (tenant_id, building_id, period, currency, charged, collected, outstanding, charged_apartments, paid_apartments, refreshed_at)`; `stored_documents` (D15). Both `tenant_id`-leading with RLS. Rollups are a rebuildable cache, not a financial record.

## Backend

- **Scope and period:** every dashboard endpoint covers the buildings the caller may access (tenant-wide or assigned) and takes `period=YYYY-MM` defaulting to the current month in the tenant timezone. An optional `building_ids` filter can only narrow that set.
- **Balance:** `GET /v1/reports/dashboard/balance` → `charged`, `collected`, `outstanding` per currency + building count. `collected` = allocations against the period's charges, so `charged = collected + outstanding`; ratio = collected / charged. The `reports` module reads billing/payments through their read interfaces, never their tables.
- **Shared Finance meaning (D42):** M4 already shows building count, properties
  with overdue unpaid charges and the selected period's `collected / charged`
  percentage. These M9 rollups reuse that scoped calculation; a no-charge
  period has no percentage, rather than a misleading zero.
- **Buildings overview:** `GET /v1/reports/dashboard/buildings` → building and apartment counts, and per building `paidApartments / chargedApartments` for the period.
- **Rollup refresh:** worker job every 5 min plus an event-triggered refresh of the affected `(building, period)` on payment recorded/reversed and charge generated, so a manager who just recorded a payment does not wait for the next tick.
- **Debtor query** with filters/sorting, and the **`debtors` audience resolver** plugged into M7. **Debtor reminder:** `POST /v1/notices/debtor-reminders/preview` (recipient and apartment counts for the caller's scope) and `POST /v1/notices/debtor-reminders` with `Idempotency-Key`; audience resolved server-side at send time; push + in-app feed via the worker; no amounts in the push payload (§8.3); audited; needs `notifications.send` + `billing.read`. Defaults pending D13.
- **Document library:** presigned upload creating a `stored_document` (category — `supplier_invoice` «Фактури» for contractors and utilities, `building_document` «Документ за сградата», `template` «Шаблони» (protocol, invitation to the general assembly, attendance list: files the manager uploads and downloads to fill in — a category, not a feature), `other` «Други»; D15 — optional building, optional period) on the shared attachment infrastructure, visible after a clean AV scan; list/download endpoints; the upload and edit forms carry «Вижда се в приложението на жителите» — `visible_to_residents`, off by default, offered only when a building is chosen, refused by the API for a document without one (D34); «Изтрий» archives (`active → archived`, audited — it leaves every list and search, nothing is deleted; D30's rule for the whole library); `documents.upload`. **D30:** for the pilot the house manager uploads a supplier's invoice here as `supplier_invoice` with a note. **Deferred to P1 (expenses), D30:** a contractor role uploads its own invoices here — `supplier_invoice` with a required period (the current month by default), a required purpose (`invoice_purpose`: «Поддръжка» / «Консуматив» / «Допълнителна услуга»), an optional note, a kind derived from the purpose, not chosen («Поддръжка» → `fixed`, «Консуматив» / «Допълнителна услуга» → `temporary`) and a building of its firm, `contractor_id` set from the membership — lists only those, and edits or archives its own until an `expense` references it, every change audited; the manager sees them in «Документи» in two sections, «Фиксирани» and «Временни разходи»; payment stays with expenses (P1).
- **Exports:** export worker (XLSX via exceljs, PDF via Playwright) producing S3 artifacts with expiring links, `export_jobs` API; `reports.export`.

## Admin

The dashboard page — Balance (hero amount, ring, paid/outstanding, "view details", "send notices" with confirmation dialog), Documents (upload, "make a report" picker), Issues/Surveys switch (Issues live; Surveys hidden until the surveys module ships and the tenant is entitled — before the pilot, D23), Calendar (from M11), Buildings overview ("add building" tile, paid ratio per building) — in light (photo background) and dark themes from brand tokens, responsive, framer-motion, strings in `packages/i18n`. Replaces the `MOCK` stats and the recent-payments table in `apps/admin/src/pages/Dashboard.tsx`. Plus the debtor report screen, the document library list and export buttons.

## Tests

Aggregate correctness vs. ledger oracle (incl. reversals, zero-charge period, partial payments, two currencies); `charged = collected + outstanding`; building-scoped manager sees only their buildings in every card and in the reminder recipient count; rollup rebuild equals incremental refresh; debtor-reminder idempotency and exact audience; permission matrix per card; tenant-isolation suite and schema contract extended to the new tables and routes; export snapshot tests; render-based contrast check on both themes (§9).

## Acceptance

Debtor XLSX matches on-screen data exactly; dashboard numbers match the oracle for a tenant-wide admin and for a manager assigned to one building; dashboard loads < 2 s with pilot-scale data; no `MOCK` left on the page.

## Risks

Open decisions D13 and D15 (reminder defaults, document owner) change copy and defaults, not the contracts above — the endpoints return all amounts and accept a period, so none of them blocks backend work.
