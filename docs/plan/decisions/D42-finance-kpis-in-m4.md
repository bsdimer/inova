---
id: D42
title: Finance cards ship with payments and share the later dashboard rules
status: decided
decided: 2026-10-03 (stakeholder)
source: WHI-137 — stakeholder approval 2026-10-03; decision comment 0d8fff90
pr: pending WHI-148
affects: [D12, D38]
---

# D42 — Finance cards in M4

**Rule.** M4 Finance shows three scoped cards: building count, properties
with an overdue unpaid charge, and the percentage of the selected month's
charges settled to date. The percentage follows M9's allocation-based balance
definition and shows an empty state when there are no charges. M9 later reuses
the same rules rather than inventing a second answer.

**Why.** The first payment workflows need honest portfolio context; the
dashboard can add caching later without changing what the numbers mean.

## Lands in

- `docs/milestones/M4-payments.md` → cards and oracle tests
- `docs/milestones/M9-dashboard-reports.md` → shared definitions
- `docs/plan/decisions.md` → card index
