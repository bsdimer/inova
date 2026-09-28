---
id: D31
title: The building page shows a «Календар» tile instead of «Общност»
status: decided
decided: 2026-09-27 (stakeholder)
source: WHI-37 — comment of 2026-09-27 10:04; frames Сграда 1728 `975:6055`, Сграда 402 `984:17750` (28.09)
pr: '#34'
affects: [D23, D24]
---

# D31 — The building page shows a «Календар» tile instead of «Общност»

**Rule.** On the building page the «Общност» tile is replaced by «Календар»:
the calendar of that building only — its staff tasks and the contractor visits
(M11), the same views as the shell calendar filtered by `building_id`.
«Общност» stays a menu item (D23); a building filter there is the
stakeholder's suggestion («може да е с филтър»), not decided. Nothing else
about the forum changes.

**Why.** «Функцията ѝ е по-маловажна от графика на сградата в този екран» —
the manager opens the building to see what happens in it this week.

## Lands in

- `docs/milestones/M2-property.md` → Admin: the building page tiles
- `docs/milestones/M11-tasks-calendar.md` → Backend `building_id` filter, Admin: the building page entry
- `docs/plan/decisions.md` → D24 row: the counters on the building page
