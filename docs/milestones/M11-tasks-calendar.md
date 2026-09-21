# M11 — Staff tasks and calendar

**Status:** Not started. **Effort / sequencing:** M, parallel with M6/M7.

Part of the [implementation plan](../implementation-plan.md). Milestone order and dependencies are in its §7. Section numbers (§) are the plan's own; its index maps each § to a file.

## Goal

Managers plan and tick off their work — inspections, meetings, reports to owners, supplier payments — per building, in a day and a month view. Feeds the dashboard's Calendar card. New relative to the original brief; added from the dashboard design.

## Dependencies

M2 (buildings/entrances to attach to), M1 (staff accounts, permissions).

## Tables

`tasks` — `tenant_id`-leading PK, RLS; `kind` (`task` / `event`), title, notes, optional `building_id` / `entrance_id`, `scheduled_on date` (tenant-timezone calendar day), optional `starts_at`, optional `due_at`, optional assignee, `status` (`open` / `done` / `cancelled`), `completed_at`, `completed_by`, `created_by`. Index `(tenant_id, scheduled_on)`. One entity for tasks and events (D17).

## Backend

New `tasks` module. `GET /v1/tasks?date=|from=&to=&status=&limit=`, `GET /v1/tasks/calendar?month=` (per-day `total` / `done` for the dots), `POST`, `PATCH`, `POST /v1/tasks/:id/complete`, `/reopen`, `/cancel`. Permissions `tasks.read` / `tasks.manage`. Building-scoped staff see tasks of their buildings; a task without a building is visible to tenant-wide staff, its creator and its assignee. Day boundaries computed in the tenant timezone.

## Admin

Tasks section (list + create/edit form) and the dashboard Calendar card: Month (Monday-first, dots, today, selected) with "Upcoming"; Day (summary "N tasks · M done", checkbox, time, place, deadline-only items); picking a day in Month opens Day. The dashboard checkbox writes, optimistically.

## Out of scope (v1)

Recurrence, reminders/push to the assignee, entries derived from other modules (issue planned date, survey closing, fee-generation day), resident-visible events. A general-assembly event becomes resident-facing only through a notice.

## Tests

Tenant-isolation suite + schema contract on `tasks`; building-scope visibility; complete/reopen round-trip with `completed_by`; timezone boundary (23:30 Europe/Sofia lands on the right day); calendar counts vs list.

## Acceptance

A manager creates a task for a building, sees the dot in Month, opens the day, ticks it, and the summary reads "1 done" after reload.
