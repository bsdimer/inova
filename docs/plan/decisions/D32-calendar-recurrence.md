---
id: D32
title: Repeating calendar entries before the pilot — weekly or monthly until a date
status: decided
decided: 2026-09-28 (team lead, before the pilot)
source: WHI-27 — the stakeholder's ask of 2026-09-28 09:27; the question to the team lead 09:57; his answer 14:19
pr: '#34'
affects: [D17, D29]
---

# D32 — Repeating calendar entries: weekly or monthly until a date

**Rule.** A task, an event or a contractor visit may repeat **every week or
every month until a date**. The series creates ordinary, separate entries in
the calendar. One entry, or the series **from this date on**, can be edited
or deleted; earlier entries stay as they were. No exceptions, no other
repeat rules. A repeating visit's «Изпрати известие» box sends one notice at save for
the whole series, naming the schedule; nothing per entry (D29). Entries are created ahead only for a bounded horizon (the
team lead's example: up to 12 months; the value is a setting), and the rest
when their turn comes. Before the pilot.

**Why.** Cleaning, snow removal, gardening, technical and elevator checks
are schedules for months ahead; «вместо ръчно да се въвежда всяка седмица /
месец» (stakeholder, 09:27). The first version stays small (team lead,
14:19): separate entries keep the calendar, the resident view (D29) and
completion as they are.

## Lands in

- `docs/milestones/M11-tasks-calendar.md` → Tables, Backend, Admin, Tests; recurrence out of «Out of scope (v1)»
- `docs/plan/data-model.md` → `task` row: `series_id`, `task_series`
- `docs/plan/api.md` → `tasks` row: repeat on create, `scope` on edit and delete
- `docs/plan/decisions.md` → the card index
