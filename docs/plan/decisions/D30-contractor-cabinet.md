---
id: D30
title: The contractor's cabinet — its buildings, agreed services and notes; its invoices in P1
status: decided
decided: 2026-09-28 — buildings, agreed services and notes decided for the pilot (stakeholder, screens confirmed 12:15; before the pilot per the team lead's answer of 2026-09-24); the «Фактури» part deferred to the P1 expenses wave (team lead, WHI-27 and PR #34 review, 2026-09-28 14:06)
source: WHI-27 — the stakeholder's ask of 2026-09-27 09:06; the model described to her on 2026-09-28 06:43 and approved 07:25 («Супер!», plus the manager's contact); invoices 2026-09-28 11:02, 11:09, 12:15, 12:30, 13:02; the team lead's split 14:06; frames «Сгради» `2129:46730`, «Сграда» `2129:47116`, 402 `2129:47702`; P1 frames «Фактури» `2170:48256`, row menu `2194:47983`, «Редактирай фактура» `2194:48039`, 402 `2196:38960`, «Изтрий фактура» `2194:48017`
pr: '#34'
affects: [D22, D29, D24]
---

# D30 — The contractor's cabinet: its buildings, agreed services and notes; its invoices in P1

**Rule (decided, pilot).** A contractor account sees, besides its category's
issues (D22) and its firm's visits (D29), the **buildings entrusted to its
firm** — «Сгради» in its menu under «Сигнали» and on its dashboard: name and
address, entrances, floors, elevator yes/no (garages and parking spots are
counted from the property types, D26), and the **house manager of that
building** — name, phone, email from its `building_manager_assignment`,
read-only, because one firm may serve buildings of different managers. A
firm's buildings are its `contractor_assignment` rows (firm × building), which
the house manager creates when entrusting a building — to any contractor, with or
without an account (a gardener, a mat-washing firm; stakeholder, WHI-27
28.09 14:21); only one with an account has the cabinet; the assignment carries
the **agreed services** as text («понеделник — основно почистване; прозорци
всеки сезон»), entered by the manager, pinned on top for the firm and not
editable by it. Under the services the firm writes its own **notes** per
building (`contractor_note`, «другия път — вземи крушка за партера»); the
manager sees them. No visits are generated from the agreed services —
recurrence stays out of v1 (M11).

**For the pilot, invoices** go the ordinary way: the firm sends its invoice to
the house manager, who uploads it into «Документи» as a `supplier_invoice`
with a note (M9). A contractor account has no «Фактури» and no
`documents.upload`.

## Deferred to P1 — the firm's own «Фактури»

Waits for the expenses wave (scope A13, «Разходи»; `docs/milestones/P1-wave.md`), built once together with
contractor payments. Drawn and kept, frames marked «P1»: the firm uploads an
invoice for a building and a month (required, the current month by default);
it says what it is for, «За какво е» — «Поддръжка», «Консуматив»,
«Допълнителна услуга» (`invoice_purpose`: `maintenance` / `consumables` /
`extra_service`), required; a note is optional; the kind follows from the
purpose — «Поддръжка» `fixed`, the other two `temporary`, the same pair as
`fee_rule.kind` — and the manager gets them in two sections, «Фиксирани» and
«Временни разходи». The firm edits or archives its own invoice until an
expense references it, every change audited. **Why deferred:** purpose → kind,
«editable until an expense references it» and a contractor's write access to
the tenant's document library are the front half of the expenses module; built
before the pilot they would give external accounts write access with nothing
behind it (team lead, 14:06).

**Why.** «В идеалният вариант фирмата автономно си организира посещения и
сигнали и работи активно с админ панела» (25.09); the building facts and the
agreed services are what a cleaning firm needs on site.

## Lands in

- `docs/plan/data-model.md` → `building` fields, `contractor_assignment`, `contractor_note`; `stored_document` contractor fields marked P1
- `docs/milestones/M2-property.md` → building fields and the import columns
- `docs/milestones/M11-tasks-calendar.md` → the cabinet's «Сгради»; Tables and Tests for `contractor_assignment` and `contractor_note`; «Фактури» out of v1
- `docs/milestones/M9-dashboard-reports.md` → the manager uploads a supplier's invoice; the firm's own upload is P1
- `docs/plan/security.md` → what a contractor role sees; no `documents.upload` until P1
- `docs/plan/api.md` → `staff` (assignments), `files` (the firm's upload, P1)
- `docs/plan/decisions.md` → D22 row: what a contractor sees
- `docs/milestones/P1-wave.md` → the expenses row: the firm's own invoice upload
