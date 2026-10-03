---
id: D39
title: Issues — four required categories with «Авария», which is urgent by itself; no «acknowledged»; one optional assignee; staff photos in the pilot
status: decided
decided: 2026-10-02 (team lead; stakeholder's answers 2026-10-01 and 2026-10-02)
source: WHI-146 c8c50d4a (the stakeholder 2026-10-02 16:40, meaning of the three ends); WHI-116 — the stakeholder 2026-10-01 10:58 (1b7020b4), 15:59 (bfc8df5b), 16:01 (e46db63b), 16:23 (fae8b07f), 2026-10-02 06:05 (c1e9e350); the questions 2026-10-01 16:57 (ee2abe36); the team lead's answer 2026-10-02 07:09 (236947fc)
pr: '#91'
affects: [D22, D18]
---

# D39 — Issue categories, «Авария» and the issue flow

**Rule.**

1. **Categories:** «Чистота», «Поддръжка», «Други», **«Авария»** (the
   stakeholder's word instead of «Спешно»). `category` is required — a
   resident cannot file an issue without one. Still open 8a is closed.
2. **«Авария»** from a resident makes the issue **`urgent` by itself** — a
   change to D22, where only staff set the priority. Only the house manager
   and accounts holding the right for «Авария» see it until the manager
   changes the category; then it goes to the contractor of the new category.
   A **notification** of a new «Авария» goes to every account with that right
   in the issue's building scope, each able to turn it off (a per-account
   setting, M6 Tables), **in the pilot, by e-mail** through the worker;
   `MOCK` until there is an e-mail provider.
3. **Statuses:** `acknowledged` is removed. The path is
   `reported → planned → in_progress`, with three ends: `resolved` («Решен»),
   `closed` («Затворен») and `rejected` («Отхвърлен», only with a note).
   What each end means (the stakeholder, WHI-146 c8c50d4a): «Решен» — there
   is a solution; «Затворен» — handling is over without a promised solution;
   «Отхвърлен» — there is no ground for handling. All three make the issue
   inactive. No `resolved → closed` step.
4. **Assignment:** by category the issue goes to the contractor whose
   assignment holds that category (D22; `contractor.activity` is free text
   and routes nothing);
   the issue has **one optional «изпълнител»** (a firm or a staff member) the
   house manager may set. The manager always sees everything; every change is
   an `issue_event`. All in M6.
5. **Photos from staff or a contractor** («след ремонта»): **in the pilot**,
   the same attachments as the resident's, plus upload rights for staff and
   contractors.

**Why.** «Спешно» invited trivial reports («someone parked in front of my
garage»); «Авария» names an emergency, so it can safely jump the queue. The
manager decides who acts on an emergency, not a contractor.

## Lands in

- `docs/milestones/M6-issues.md` → Tables, Backend, Admin, Mobile, Tests
- `docs/plan/data-model.md` → `issue`
- `docs/features/admin-dashboard.md` → the `pending` counter
- `docs/plan/security.md` → §6.2 the «Авария» right and upload rights
- `docs/plan/decisions.md` → D22 row, Still open 8a, the card index
