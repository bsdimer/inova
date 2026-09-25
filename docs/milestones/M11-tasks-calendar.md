# M11 — Staff tasks and calendar

**Status:** Not started. **Effort / sequencing:** M, parallel with M6/M7.

Part of the [implementation plan](../implementation-plan.md). Milestone order and dependencies are in its §7. Section numbers (§) are the plan's own; its index maps each § to a file.

## Goal

Managers plan and tick off their work — inspections, meetings, reports to owners, supplier payments — per building, in a day and a month view. Feeds the dashboard's Calendar card. New relative to the original brief; added from the dashboard design. **Since D23/D29:** contractors and the house manager put contractor visits on the same calendar, and residents see the visits that concern their entrance.

## Dependencies

M2 (buildings/entrances to attach to), M1 (staff accounts, permissions). Contractor visits also need the `contractor` record and `staff_membership.contractor_id` (staff module; land here if not earlier — D29). The contractor's own dashboard in the admin (Figma `1999:17`, 402 `2005:36`) needs both M6 (issues by category) and this milestone; until then it has nothing to show.

## Tables

`tasks` — `tenant_id`-leading PK, RLS; `kind` (`task` / `event` / `contractor_visit` — D29), title, notes, optional `building_id` / `entrance_id`, `scheduled_on date` (tenant-timezone calendar day), optional `starts_at`, optional `due_at`, optional assignee, `status` (`open` / `done` / `cancelled`), `completed_at`, `completed_by`, `created_by`. Index `(tenant_id, scheduled_on)`. One entity for tasks and events (D17). A `contractor_visit` also carries `contractor_id` (the firm's staff membership), `ends_at`, and its scope — a list of `entrance_id`s or the whole building; it has no status and no assignee.

## Backend

New `tasks` module. `GET /v1/tasks?date=|from=&to=&status=&limit=`, `GET /v1/tasks/calendar?month=` (per-day `total` / `done` for the dots), `POST`, `PATCH`, `POST /v1/tasks/:id/complete`, `/reopen`, `/cancel`. Permissions `tasks.read` / `tasks.manage`. Building-scoped staff see tasks of their buildings; a task without a building is visible to tenant-wide staff, its creator and its assignee. Day boundaries computed in the tenant timezone.

Contractor visits (D29): `POST` / `PATCH` / `DELETE /v1/visits` under `visits.manage` — a contractor role (D22) only for its own firm, staff with `tasks.manage` for any firm in their buildings; a visit needs a building and a scope (entrances or whole building). `GET /v1/me/visits?from=&to=` for residents: the visits whose scope covers an entrance they occupy, plus every whole-building visit of their building. Creating or changing a visit enqueues nothing — no push, no notice.

## Admin

Tasks section (list + create/edit form), reached from a **"Задачи" item in the shell navigation, placed directly after "Табло" and before "Известия"** (stakeholder, 2026-09-22), and the dashboard Calendar card: Month (Monday-first, dots, today, selected) with "Upcoming"; Day (summary "N tasks · M done", checkbox, time, place, deadline-only items); picking a day in Month opens Day. The dashboard checkbox writes, optimistically. Contractor visits appear in Month and Day as their own kind, without a checkbox; «Ново посещение» takes firm, building, scope, date, time from–to and description (WHI-27 frames).

## Mobile

Residents see contractor visits of their entrance and of the whole building in «Моята сграда» (list by date, `GET /v1/me/visits`); nothing else from the staff calendar reaches the app (D29). The screen is not drawn yet — the admin Figma has no mobile visits frame; it gets its own frame when this milestone is extended.

## Out of scope (v1)

Recurrence, reminders/push to the assignee, entries derived from other modules (issue planned date, survey closing, fee-generation day), resident-visible staff events. A general-assembly event becomes resident-facing only through a notice; the one resident-visible kind is the contractor visit (D29). Staff tasks stay staff-only.

## Tests

Tenant-isolation suite + schema contract on `tasks`; building-scope visibility; complete/reopen round-trip with `completed_by`; timezone boundary (23:30 Europe/Sofia lands on the right day); calendar counts vs list. Visits (D29): a contractor role cannot see, create or edit another firm's visit, and two memberships of the same firm see the same visits; `tasks.manage` can edit any firm's; a resident of entrance A gets an entrance-A visit and a whole-building visit but not an entrance-B visit; creating a visit enqueues no notification; a visit rejects `complete`.

## Acceptance

A manager creates a task for a building, sees the dot in Month, opens the day, ticks it, and the summary reads "1 done" after reload. A cleaning contractor adds a visit for entrance A; the resident of entrance A sees it in the app, the resident of entrance B does not, and nobody is notified.
