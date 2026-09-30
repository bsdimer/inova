---
id: D33
title: Calendar events reach residents the way contractor visits do — before the pilot
status: decided
decided: 2026-09-30 (team lead, before the pilot)
source: WHI-27 — the stakeholder's ask of 2026-09-28 15:22 («„Събития“ се виждат и от живущите с опция за известия»); the question to the team lead 2026-09-29 06:44; his answer 2026-09-30 01:14
pr: '#51'
affects: [D29, D17, D23]
---

# D33 — Calendar events reach residents the way contractor visits do

**Rule.** A calendar **event** (`tasks.kind = event`, D17) carries the same
two things as a contractor visit (D29): a **scope** — one or more entrances
or the whole building — and the **«Изпрати известие»** box. Residents of the
scoped entrances see the event in the app beside the visits of their
building; the box, for a role holding `notifications.send`, sends one
ordinary notice to that scope, once at save (for a series, D32). An event
with no building has no scope and stays with the staff. **Staff tasks stay
staff-only.** Before the pilot.

**Why.** «Събитията ползват същото като посещенията на доставчиците» (team
lead): one resident-facing shape for everything on the building's calendar,
so the app gets one list and one rule instead of a second kind of entry.

## Lands in

- `docs/milestones/M11-tasks-calendar.md` → Backend (`GET /v1/me/calendar`), Admin (the event form), Mobile, Tests, Acceptance; out of «Out of scope (v1)»
- `docs/plan/data-model.md` → `task` row: which kinds residents see
- `docs/plan/api.md` → `tasks` row: `GET /v1/me/calendar`
- `docs/plan/decisions.md` → D23 (3) and the card index
