# M6 — Issues module

**Status:** Not started. **Effort / sequencing:** M, parallel with M3/M4.

Part of the [implementation plan](../implementation-plan.md). Milestone order and dependencies are in its §7. Section numbers (§) are the plan's own; its index maps each § to a file.

## Goal

Residents report issues with photos; managers triage with status flow and history.

## Dependencies

M2; the `files` module from M4 (D38).

## Tables

`issues` (with a required `category` ∈ cleaning / maintenance / other / **avaria** «Авария», D39; `priority`: `normal` / `urgent`, default `normal`; an optional assignee — a firm or a staff member, D39; index `(tenant_id, building_id, status, priority)`), `issue_events`; a per-account setting that turns off the «Авария» e-mail (D39; its table or column is chosen when M6 starts). Photos are `attachments` of the shared `files` module, built in M4 (D38).

## Backend

Issue CRUD, status transitions with history — `reported → planned → in_progress`, ends `resolved` («Решен», there is a solution) / `closed` («Затворен», handling over without a promised solution) / `rejected` («Отхвърлен», no ground for handling; note required), each final and inactive, no `acknowledged` (D39, WHI-146 c8c50d4a); a resident's «Авария» sets `priority = urgent` by itself and is visible only to the manager and accounts with the «Авария» right until recategorised; a new «Авария» is e-mailed through the worker to every account with that right in the issue's building scope who has not turned it off (`MOCK` until an e-mail provider, D39); the manager may set one optional assignee, every change an `issue_event` (D39); staff and contractors may attach photos («след ремонта», D39); a transition takes an optional `note` (short text on the `issue_event`) for the reporter; **contractor roles hold `issues.progress`**: own categories only, to `planned` / `in_progress` / `resolved`, while close, reject, recategorise and priority need `issues.manage` (D22) — **priority set/changed by staff with an `issue_event` per change**, image re-encode/thumbnail job; presigned uploads and the ClamAV scan come with the `files` module from M4 (D38). **`GET /v1/issues/summary`** for the dashboard: open count, counters (pending, planned, urgent, resolved-in-period) and the urgent-open list, scoped to the caller's buildings — contract in [features/admin-dashboard.md](../features/admin-dashboard.md).

## Admin

**Building photo** (moved from M2, team lead's review of #51; the `files` module it needs is built in M4, D38): a building takes an optional photo — an `attachment` with `owner_type = 'building'` — on creation and on edit, where it can be replaced or removed; without one the «Сгради» list shows the icon (stakeholder, WHI-37 29.09 15:11; frames «V2 · Сгради»). The `buildings` table gets no column for it.

Issue queue with filters (building, status, **priority**, category, date), detail with photo gallery, status timeline and a priority control. **Category is also a visibility boundary (D22):** the Cleaning Contractor and Technician roles see only issues of their category; the house manager sees everything and is the one who changes a category. The category is required (D39); only «Авария» is hidden from contractors until the manager recategorises it, which routes it to the contractor of the new category. The contractor's dashboard opens an issue of its category in a panel with «Смени статус» (Планиран / В процес / Решен) and an optional note to the reporter (WHI-27 frames `2019:36105`, `2019:36253`).

## Mobile

Report flow (camera/gallery) with a required category — «Чистота», «Поддръжка», «Други», «Авария» (D39) — my-issues list with statuses. Residents do not set priority; «Авария» makes it urgent (D39). The issue's history shows each status change with its note; the resident cannot reply to it (D22).

## Tests

State-machine tests; priority is independent of status and audited; summary counters vs a seeded oracle incl. building-scope narrowing; `issues.progress` moves an own-category issue to `planned` and is refused `closed`, `rejected`, a category or priority change and any issue of another category; a note is stored on the event and returned in the reporter's history; an issue without a category is refused; «Авария» is urgent at once and invisible to contractors until recategorised; `rejected` without a note is refused; there is no `acknowledged`; the assignee change is an event; the «Авария» e-mail reaches only accounts with the right, in the issue's building scope, that have not turned it off (D39). The building photo: upload, replace and remove through the edit form; another tenant's building is refused; a failed scan leaves the icon.

## Acceptance

Photo issue reported on device appears in admin within seconds; marking an issue urgent moves it into the summary's urgent list without changing its status.
