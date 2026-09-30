---
id: D34
title: A building's document can be marked visible to its residents — before the pilot, narrow
status: decided
decided: 2026-09-30 (team lead, before the pilot)
source: WHI-79 — the stakeholder's ask of 2026-09-28 16:01 («тикче дали да се вижда в приложението от Жителите»); the question to the team lead 2026-09-29 06:44; his answer 2026-09-30 01:15
pr: '#51'
affects: [D15, D23]
---

# D34 — A building's document can be marked visible to its residents

**Rule.** A `stored_document` gets **`visible_to_residents`**, off by default,
settable only when the document has a `building_id`; a document of the
organisation (no building) cannot be marked — the API refuses it. Residents
who hold an occupancy in that building see the marked documents in the app,
**read-only, with download**; nothing else from «Документи» reaches the app.
Archiving a document hides it. The box sits on the upload form and on edit
(M9); the resident screen belongs to M5. Before the pilot.

**Why.** «Общо взето всичко трябва да се вижда — фактури, договори, шаблони»
(stakeholder, 29.09 10:15); the team lead keeps it narrow so the pilot gets a
flag and a list, not a second document library.

## Lands in

- `docs/plan/data-model.md` → `stored_document` row: `visible_to_residents`
- `docs/milestones/M9-dashboard-reports.md` → Document library: the box and its rule
- `docs/milestones/M5-mobile-pilot.md` → Mobile: the building's documents; Tests
- `docs/plan/api.md` → `me` row: `GET /v1/me/documents`
- `docs/plan/security.md` → what a resident reads
- `docs/plan/decisions.md` → the card index
