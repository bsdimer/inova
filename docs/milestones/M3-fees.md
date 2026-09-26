# M3 — Fee engine, charges, obligations

**Status:** Not started. Do not start until M2 acceptance is met.

## Goal

Each building's configured assessment basis generates monthly fees correctly;
ad-hoc charges; resident obligation math is right (no proration — A-FEE).

## Dependencies

M2 (apartments + occupancies), and the **worker skeleton** from M1 — fee
generation is a worker job, so the worker must exist before this phase starts.

## Tables

Effective-dated building assessment configuration, `fee_rules` (versioned),
`charges`, `charge_lines`; period fields; `document_counters`. Append-only
charges; `currency` on money columns.

## Backend

- Building assessment basis configured during setup: `fixed`, `per_area`,
  `per_occupant`, `per_ideal_part`, `per_room`, with room for later bases.
- Fee-rule CRUD with effective dating/versioning. Two kinds (D26): a
  **fixed** rule charges every month; a **temporary** rule carries
  `valid_from` / `valid_to` and charges only the periods it covers. Its scope
  is one of: chosen properties (a stored list of property ids, any type — the
  screen picks them by search with chips), an entrance, the whole building, or
  a property type (`apartment`, `garage`, `shop`, `storage`, `parking_spot`).
- Fee-generation job (BullMQ, tenant TZ, idempotent on
  `(rule_version, apartment, period)`), using the residents/pets/ideal parts
  effective for the applicable period.
- One-time / temporary charges; obligations views.

## Admin / mobile

Building assessment setup; the building screen **Входни такси** with three
sections — **Фиксирани разходи** (rule list, with the rule-change history at
its foot), **Временни разходи** (rule list) and **Входни такси · <месец>** (the
month's charges per property) — and a dry-run preview (D26). On the phone
each section is one glass card. A charge rule is a «разход»; only «такса
Домоуправление» is named «такса». What a resident is charged is «Входни такси».
**Плащания** is the name for payments to outside firms and contractors when
such a section appears — none is drawn today, expenses stay P1. Mobile: obligations +
IBAN / payment reference with copy.

## Required tests (future release blockers)

- Golden-file financial tests (building basis × effective-dated population ×
  apartment → expected charges).
- No-proration boundary (mid-month change applies next period).
- `per_room` basis, a property-type-scoped and a chosen-properties temporary
  rule in the golden files; a temporary rule charges nothing outside
  `valid_from` / `valid_to` and nothing to a property outside its list.
- Idempotent re-run of generation; timezone boundary (`Europe/Sofia`).

## Acceptance

inova’s actual fee schedule reproduced to the stotinka against a hand
calculated sheet.

## Full scope by layer

Moved verbatim from the implementation plan §7 when it was split. Where this and the sections above differ, the sections above are newer.

**Effort / sequencing:** L

- **Goal:** each building's configured assessment basis generates monthly fees correctly; ad-hoc charges; residents' obligation math is right.
- **Dependencies:** M2.
- **DB:** effective-dated building assessment configuration, `fee_rules (versioned), charges, charge_lines`; period fields; `document_counters`.
- **Backend:** building assessment basis (`fixed`, `per_area`, `per_occupant`, `per_ideal_part`, extensible) configured during setup; fee-rule CRUD with versioning; **fee-generation job** uses residents/pets/ideal parts effective for the applicable period (BullMQ cron, per tenant timezone, idempotent per `(rule_version, apartment, period)` unique index); one-time/temporary charges; obligations query views.
- **Admin:** building assessment setup + fee-rule builder, charge list/detail, manual charge entry, generation preview ("dry run" diff before commit).
- **Mobile:** obligations screen (current + history per apartment), IBAN + payment reference display with copy actions.
- **Tests:** golden-file financial tests (building basis × effective-dated residents/pets × apartment → expected charges), no-proration boundary cases (mid-month change applies next period, per A-FEE), idempotent re-run of generation, timezone boundary (month end in Europe/Sofia).
- **Acceptance:** inova's actual fee schedule reproduced to the stotinka against a hand-calculated sheet.
- **Risks:** proration, allocation order, and logical-fund transfer rules are resolved (A-FEE/A-ALLOC/A-DEPOSIT). ~~M4 still needs a true-overpayment disposition and the external bank-feed/file mechanism~~ — both resolved 2026-09-21 (A-BANK-MATCH).
