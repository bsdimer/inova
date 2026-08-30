# M3 — Fee engine, charges, obligations

**Status:** Not started. Do not start until M2 acceptance is met.

## Goal

Monthly fees generate correctly; ad-hoc charges; resident obligation math is
right (no proration — A-FEE).

## Dependencies

M2 (apartments + occupancies).

## Tables

`fee_rules` (versioned), `charges`, `charge_lines`; period fields;
`document_counters`. Append-only charges; `currency` on money columns.

## Backend

- Fee-rule CRUD with versioning.
- Fee-generation job (BullMQ, tenant TZ, idempotent on
  `(rule_version, apartment, period)`).
- One-time / temporary charges; obligations views.

## Admin / mobile

Rule builder, charge list, dry-run preview. Mobile: obligations + IBAN /
payment reference with copy.

## Required tests (future release blockers)

- Golden-file financial tests (rule × apartment → expected charges).
- No-proration boundary (mid-month change applies next period).
- Idempotent re-run of generation; timezone boundary (`Europe/Sofia`).

## Acceptance

Sosedo’s actual fee schedule reproduced to the stotinka against a hand
calculated sheet.
