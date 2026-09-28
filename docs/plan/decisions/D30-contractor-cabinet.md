---
id: D30
title: The contractor's cabinet — its buildings, agreed services, notes and invoices
status: proposed
decided: proposed 2026-09-28 (delivery owner, under the team lead's mandate); waits for the stakeholder's confirmation of the drawn screens and the team lead's word on before/after the pilot
source: WHI-27 — the stakeholder's ask of 2026-09-27 09:06; the model described to her on 2026-09-28 06:43
pr: '#34'
affects: [D22, D29, D24]
---

# D30 — The contractor's cabinet: its buildings, agreed services, notes and invoices

**Rule.** A contractor account sees, besides its category's issues (D22) and
its firm's visits (D29), the **buildings entrusted to its firm** — «Сгради»
in its menu under «Сигнали» and on its dashboard: name and address, entrances,
floors, garages or parking spots yes/no, elevator yes/no. A firm's buildings
are its `contractor_assignment` rows (firm × building), which the house
manager creates when entrusting a building; the assignment carries the
**agreed services** as text («понеделник — основно почистване; прозорци всеки
сезон»), entered by the manager, pinned on top for the firm and not editable
by it. Under the services the firm writes its own **notes** per building
(`contractor_note`, «другия път — вземи крушка за партера»); the manager sees
them. **«Фактури»:** the firm uploads an invoice with a note and picks the
building; it lands in the manager's «Документи» as a `supplier_invoice`
(M9) with the firm on it. Payment to the firm comes later with «Плащания»
(expenses, P1). No visits are generated from the agreed services — recurrence
stays out of v1 (M11).

**Why.** «В идеалният вариант фирмата автономно си организира посещения и
сигнали и работи активно с админ панела» (25.09); the building facts and the
agreed services are what a cleaning firm needs on site, the invoice with a
note («такса техн. поддръжка + касов бон за крушка») is how it gets paid.

## Lands in

- `docs/plan/data-model.md` → `building` fields, `contractor_assignment`, `contractor_note`, `stored_document`
- `docs/milestones/M2-property.md` → building fields and the import columns
- `docs/milestones/M11-tasks-calendar.md` → the contractor's cabinet: «Сгради», services, notes
- `docs/milestones/M9-dashboard-reports.md` → the firm's invoice upload
- `docs/plan/security.md` → what a contractor role sees and `documents.upload` narrowed to its firm
- `docs/plan/api.md` → `staff` (assignments), `files` (the firm's upload)
- `docs/plan/decisions.md` → D22 row: what a contractor sees
