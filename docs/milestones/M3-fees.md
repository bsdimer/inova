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
  `per_occupant`, `per_ideal_part`, with room for later bases.
- Fee-rule CRUD with effective dating/versioning.
- Fee-generation job (BullMQ, tenant TZ, idempotent on
  `(rule_version, apartment, period)`), using the residents/pets/ideal parts
  effective for the applicable period.
- One-time / temporary charges; obligations views.

## Admin / mobile

Building assessment setup, rule builder, charge list, dry-run preview. Mobile:
obligations + IBAN / payment reference with copy.

## Required tests (future release blockers)

- Golden-file financial tests (building basis × effective-dated population ×
  apartment → expected charges).
- No-proration boundary (mid-month change applies next period).
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
- **Risks:** proration, allocation order, and logical-fund transfer rules are resolved (A-FEE/A-ALLOC/A-DEPOSIT). M4 still needs a true-overpayment disposition and the external bank-feed/file mechanism.
