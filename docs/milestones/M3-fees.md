# M3 — Fee engine, charges, obligations

**Status:** Not started. Do not start until M2 acceptance is met.

## Goal

Each building's configured assessment basis generates monthly fees correctly;
ad-hoc charges; resident obligation math is right (no proration — A-FEE).

## Dependencies

M2 (apartments + occupancies).

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
