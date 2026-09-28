---
id: D29
title: Contractor visits on the calendar
status: decided
decided: 2026-09-25 (stakeholder); added 2026-09-26
source: WHI-27 — comments of 2026-09-25 12:40, 2026-09-26 11:04 and 16:06
pr: '#30'
affects: [D22, D17, D23]
---

# D29 — Contractor visits on the calendar

**Rule.** A contractor visit is a calendar entry of its own kind
(`contractor_visit` on the `tasks` entity, D17): contractor, building, scope
(one or more entrances, or the whole building — common areas and garages
count as the whole building), date, time from–to, description; no status,
no assignee, no done checkbox. The contractor's own role (D22) creates and
edits the visits of its firm, scoped through `staff_membership.contractor_id`
to the tenant's `contractor` record; a contractor needs no account at all — the manager creates contractor profiles, and for one without an account (a gardener, a mat-washing firm) the manager enters its visits (stakeholder, WHI-27 28.09 14:21 and 15:14); the house manager, or any staff with
`tasks.manage` in the building, enters visits for any firm (`visits.manage`).
Residents of the scoped entrances see the visit, a whole-building visit is
seen by every resident of the building.

**Notifications (added 2026-09-26).** Nothing is pushed automatically, on
create or the day before. The visit form has an optional «Изпрати известие
до жителите» box, shown only to a role holding `notifications.send`; ticking
it sends an ordinary notice (M7) to the visit's scope. Contractor starter
roles do not hold the key; an admin may add it to a role.

**Why.** «В идеалният вариант фирмата автономно си организира посещения»;
entries are informative, so no automatic notices; the box saves the manager
a trip to Известия when a visit needs action (cars out for garage cleaning).

## Lands in

- `docs/plan/data-model.md` → `task` kind `contractor_visit`, `contractor`, `staff_membership.contractor_id`
- `docs/plan/api.md` → `tasks` row: `/v1/visits`, `GET /v1/me/visits`
- `docs/milestones/M11-tasks-calendar.md` → tables, backend, admin, mobile, tests, acceptance
- `docs/plan/security.md` → `visits.manage`
- `docs/plan/backlog.md` → 40d
