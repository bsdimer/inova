# M11 — Staff tasks and calendar

**Status:** Not started. **Effort / sequencing:** M, parallel with M6/M7.

Part of the [implementation plan](../implementation-plan.md). Milestone order and dependencies are in its §7. Section numbers (§) are the plan's own; its index maps each § to a file.

## Goal

Managers plan and tick off their work — inspections, meetings, reports to owners, supplier payments — per building, in a day and a month view. Feeds the dashboard's Calendar card. New relative to the original brief; added from the dashboard design. **Since D23/D29:** contractors and the house manager put contractor visits on the same calendar, and residents see the visits that concern their entrance.

## Dependencies

M2 (buildings/entrances to attach to), M1 (staff accounts, permissions). Contractor visits also need the `contractor` record and `staff_membership.contractor_id` (staff module; land here if not earlier — D29). The contractor's own dashboard in the admin (Figma `1999:17`, 402 `2005:36`) needs both M6 (issues by category) and this milestone; until then it has nothing to show. **D30** adds to that cabinet «Сгради» — the buildings entrusted to the firm (`contractor_assignment`) with their facts and the building's house manager (name, phone, email, read-only), the agreed services pinned on top (entered by the manager on the assignment, read-only for the firm) and the firm's notes under them (`contractor_note`, visible to the manager); it needs the M2 building fields. The cabinet's «Фактури» is P1 (D30). The «Изпрати известие до жителите» box on the visit form needs M7 (D29 addition); without M7 the box is hidden.

## Tables

`tasks` — `tenant_id`-leading PK, RLS; `kind` (`task` / `event` / `contractor_visit` — D29), title, notes, optional `building_id` / `entrance_id`, `scheduled_on date` (tenant-timezone calendar day), optional `starts_at`, optional `due_at`, optional assignee, `status` (`open` / `done` / `cancelled`), `completed_at`, `completed_by`, `created_by`. Index `(tenant_id, scheduled_on)`. One entity for tasks and events (D17). A `contractor_visit` also carries `contractor_id` (the tenant's `contractor` record, not a staff membership; D29), `ends_at`, and its scope — a list of `entrance_id`s or the whole building; it has no status and no assignee. Repeating entries (D32): `task_series (tenant_id, id, kind, the entry's fields, frequency weekly | monthly, starts_on, until date, generated_until date, created_by)`, `tenant_id`-leading PK, RLS; `tasks.series_id` nullable.

Contractor cabinet (D30), in the staff module: `contractor` (D29, if not landed earlier); `contractor_assignment (tenant_id, id, contractor_id, building_id, agreed_services text, created_by, effective_from, effective_to)` — unique `(tenant_id, contractor_id, building_id)`; `contractor_note (tenant_id, id, contractor_id, building_id, author_id, text, created_at)`. Both `tenant_id`-leading PKs and indexes, RLS.

## Backend

New `tasks` module. `GET /v1/tasks?date=|from=&to=&status=&building_id=&limit=`, `GET /v1/tasks/calendar?month=&building_id=` (per-day `total` / `done` for the dots), `POST`, `PATCH`, `POST /v1/tasks/:id/complete`, `/reopen`, `/cancel`. Permissions `tasks.read` / `tasks.manage`. Building-scoped staff see tasks of their buildings; a task without a building is visible to tenant-wide staff, its creator and its assignee. Day boundaries computed in the tenant timezone. Repeat (D32): `POST` takes an optional `repeat {frequency: weekly | monthly, until}` and creates the series and its entries up to the horizon (a setting; the team lead's example is 12 months); a worker job creates later entries as the horizon moves. A repeating visit with `notify: true` sends **one** notice at save, for the whole series, its text naming the schedule («всяка седмица до 17.12»); the entries the job adds later send nothing; editing «from this date on» sends again only if the box is ticked again (D29: nothing is pushed automatically). `PATCH` and `DELETE` take `scope=this | following`: one entry, or this one and every later one of its series; earlier entries are untouched.

Contractor visits (D29): `POST` / `PATCH` / `DELETE /v1/visits` under `visits.manage` — a contractor role (D22) only for its own firm, staff with `tasks.manage` for any firm in their buildings; a visit needs a building and a scope (entrances or whole building). `GET /v1/me/visits?from=&to=` for residents: the visits whose scope covers an entrance they occupy, plus every whole-building visit of their building. Creating or changing a visit enqueues nothing by itself — no push, no notice; `POST /v1/visits` takes an optional `notify: true` (D29 addition, WHI-27) that needs `notifications.send` (403 otherwise) and sends an ordinary M7 notice to the visit's scope through the worker.

## Admin

Tasks section (list + create/edit form), reached from a **"Задачи" item in the shell navigation, placed directly after "Табло" and before "Известия"** (stakeholder, 2026-09-22), and the dashboard Calendar card: Month (Monday-first, dots, today, selected) with "Upcoming"; Day (summary "N tasks · M done", checkbox, time, place, deadline-only items); picking a day in Month opens Day. The dashboard checkbox writes, optimistically. The task, event and visit forms have «Повтаря се» (every week / every month, until a date); editing or deleting an entry of a series asks «само този» or «от тази дата нататък» (D32). The building page's «Календар» tile (D31) opens the same Month and Day views filtered to that building — its tasks and contractor visits. Contractor visits appear in Month and Day as their own kind, without a checkbox; «Ново посещение» takes firm, building, scope, date, time from–to and description, and — for a role with `notifications.send` — the «Изпрати известие до жителите» box (WHI-27 frames `1939:44464`).

## Mobile

Residents see contractor visits of their entrance and of the whole building in «Моята сграда» (list by date, `GET /v1/me/visits`); nothing else from the staff calendar reaches the app (D29). The screen is not drawn yet — the admin Figma has no mobile visits frame; it gets its own frame when this milestone is extended.

## Out of scope (v1)

Recurrence rules beyond weekly / monthly until a date and exceptions inside a series (D32), the contractor's own «Фактури» (D30, P1 expenses), reminders/push to the assignee, entries derived from other modules (issue planned date, survey closing, fee-generation day), resident-visible staff events. A general-assembly event becomes resident-facing only through a notice; the one resident-visible kind is the contractor visit (D29). Staff tasks stay staff-only.

## Tests

Tenant-isolation suite + schema contract on `tasks`; building-scope visibility; complete/reopen round-trip with `completed_by`; timezone boundary (23:30 Europe/Sofia lands on the right day); calendar counts vs list. Visits (D29): a contractor role cannot see, create or edit another firm's visit, and two memberships of the same firm see the same visits; `tasks.manage` can edit any firm's; a resident of entrance A gets an entrance-A visit and a whole-building visit but not an entrance-B visit; creating a visit without `notify` enqueues no notification; `notify` without `notifications.send` is refused, with it the notice reaches the residents of entrance A and not B; a visit rejects `complete`. Repeat (D32): a weekly series until a date creates exactly its entries inside the horizon and none beyond; the job extends it without duplicates on rerun; editing one entry changes only it; editing «from this date on» changes it and the later ones, the earlier stay; deleting «from this date on» removes it and the later ones; a repeating visit reaches the same residents as a single one; tenant-isolation suite and schema contract on `task_series`. Cabinet (D30): tenant-isolation suite and schema contract on `contractor_assignment` and `contractor_note`; firm A's role cannot read firm B's assignments or notes; the firm sees only the buildings it is assigned to; the firm cannot edit `agreed_services`; the manager reads the firm's notes; a contractor role with no `contractor_id` gets 403 on all of it.

## Acceptance

A manager creates a task for a building, sees the dot in Month, opens the day, ticks it, and the summary reads "1 done" after reload. A cleaning contractor adds a visit for entrance A; the resident of entrance A sees it in the app, the resident of entrance B does not, and nobody is notified; the manager ticks «Изпрати известие» on a second visit and only entrance A gets the notice.
