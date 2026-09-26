# M6 — Issues module

**Status:** Not started. **Effort / sequencing:** M, parallel with M3/M4.

Part of the [implementation plan](../implementation-plan.md). Milestone order and dependencies are in its §7. Section numbers (§) are the plan's own; its index maps each § to a file.

## Goal

Residents report issues with photos; managers triage with status flow and history.

## Dependencies

M2; attachment infra.

## Tables

`issues` (with `priority`: `normal` / `urgent`, default `normal`; index `(tenant_id, building_id, status, priority)`), `issue_events`, `attachments` + AV-scan status. `attachments` belongs to the shared `files` module so later owners (stored documents, expenses) reuse it.

## Backend

Issue CRUD, status transitions with history — a transition takes an optional `note` (short text on the `issue_event`) for the reporter; **contractor roles hold `issues.progress`**: own categories only, to `planned` / `in_progress` / `resolved`, while close, reject, recategorise and priority need `issues.manage` (D22) — **priority set/changed by staff with an `issue_event` per change**, presigned uploads, ClamAV worker, image re-encode/thumbnail job. **`GET /v1/issues/summary`** for the dashboard: open count, counters (pending, planned, urgent, resolved-in-period) and the urgent-open list, scoped to the caller's buildings — contract in [features/admin-dashboard.md](../features/admin-dashboard.md).

## Admin

Issue queue with filters (building, status, **priority**, category, date), detail with photo gallery, status timeline and a priority control. **Category is also a visibility boundary (D22):** the Cleaning Contractor and Technician roles see only issues of their category; the house manager sees everything, including urgent and uncategorised ones, and is the one who sets or changes a category — recategorising is what routes an issue to a contractor. The contractor's dashboard opens an issue of its category in a panel with «Смени статус» (Планиран / В процес / Разрешен) and an optional note to the reporter (WHI-27 frames `2019:36105`, `2019:36253`).

## Mobile

Report flow (camera/gallery), my-issues list with statuses. Residents do not set priority. The issue's history shows each status change with its note; the resident cannot reply to it (D22).

## Tests

State-machine tests; priority is independent of status and audited; summary counters vs a seeded oracle incl. building-scope narrowing; malicious upload tests (polyglot file, oversized, wrong MIME); `issues.progress` moves an own-category issue to `planned` and is refused `closed`, `rejected`, a category or priority change and any issue of another category; a note is stored on the event and returned in the reporter's history.

## Acceptance

Photo issue reported on device appears in admin within seconds; infected test file (EICAR) quarantined; marking an issue urgent moves it into the summary's urgent list without changing its status.
