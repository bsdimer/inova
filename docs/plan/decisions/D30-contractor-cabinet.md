---
id: D30
title: The contractor's cabinet — its buildings, agreed services, notes and invoices
status: decided
decided: 2026-09-28 (stakeholder, screens confirmed 12:15; before the pilot — the team lead's answer of 2026-09-24 on the contractor calendar, extended to the cabinet by the delivery owner 2026-09-28)
source: WHI-27 — the stakeholder's ask of 2026-09-27 09:06; the model described to her on 2026-09-28 06:43 and approved 07:25 («Супер!», plus the manager's contact); invoices 2026-09-28 11:02 and 11:09; screens confirmed 12:15 («Супер!», the month required); frames «Сгради» `2129:46730`, «Сграда» `2129:47116`, 402 `2129:47702`, «Фактури» `2170:48256`, row menu `2194:47983`, «Редактирай фактура» `2194:48039`, 402 `2196:38960`, «Изтрий фактура» `2194:48017`
pr: '#34'
affects: [D22, D29, D24]
---

# D30 — The contractor's cabinet: its buildings, agreed services, notes and invoices

**Rule.** A contractor account sees, besides its category's issues (D22) and
its firm's visits (D29), the **buildings entrusted to its firm** — «Сгради»
in its menu under «Сигнали» and on its dashboard: name and address, entrances,
floors, elevator yes/no (garages and parking spots are counted from the property types, D26), and the **house manager of that building** — name, phone, email from its `building_manager_assignment`, read-only, because one firm may serve buildings of different managers. A firm's buildings
are its `contractor_assignment` rows (firm × building), which the house
manager creates when entrusting a building; the assignment carries the
**agreed services** as text («понеделник — основно почистване; прозорци всеки
сезон»), entered by the manager, pinned on top for the firm and not editable
by it. Under the services the firm writes its own **notes** per building
(`contractor_note`, «другия път — вземи крушка за партера»); the manager sees
them. **«Фактури»:** the firm uploads an invoice with a note and picks the
building and the month it is for (required, the current month by default); it lands in the manager's «Документи» as a `supplier_invoice`
(M9) with the firm on it; the note is required (one word is enough —
«поддръжка», «разход») and the invoice carries a kind, «Фиксирани» or
«Временни разходи» — the same pair as the charge rules (`fee_rule.kind`), one
concept: the building's costs — so the manager gets them sorted and P1 can
link the expense to the rule it pays for. The contractor edits
or deletes its own invoice (file, building, period, kind, note) until an
expense references it — «преди деня на плащане»; deleting archives the
document (`active → archived`), never removes the row, and every edit or
archive writes an audit record. Until P1 there are no expenses, so editing
stays open. Payment to the firm comes later with «Плащания» (expenses, P1). No visits are generated from the agreed services — recurrence
stays out of v1 (M11).

**Why.** «В идеалният вариант фирмата автономно си организира посещения и
сигнали и работи активно с админ панела» (25.09); the building facts and the
agreed services are what a cleaning firm needs on site, the invoice with a
note («такса техн. поддръжка + касов бон за крушка») is how it gets paid.

## Lands in

- `docs/plan/data-model.md` → `building` fields, `contractor_assignment`, `contractor_note`, `stored_document` (kind, required note and period, edit until referenced)
- `docs/milestones/M2-property.md` → building fields and the import columns
- `docs/milestones/M11-tasks-calendar.md` → the contractor's cabinet: «Сгради», services, notes
- `docs/milestones/M9-dashboard-reports.md` → the firm's invoice upload
- `docs/plan/security.md` → what a contractor role sees and `documents.upload` narrowed to its firm
- `docs/plan/api.md` → `staff` (assignments), `files` (the firm's upload)
- `docs/plan/decisions.md` → D22 row: what a contractor sees
