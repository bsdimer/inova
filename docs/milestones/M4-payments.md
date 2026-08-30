# M4 — Manual payments, cash accounts, receipts

**Status:** Not started. Depends on M3. B2 (receipt legal shape) is still open
— design templates so they can be swapped without schema change.

## Goal

Managers record bank/cash payments and allocate across charges. Balances and
receipts match a spreadsheet oracle.

## Tables

`payments`, `payment_allocations`, `cash_accounts`, `ledger_entries`,
`receipts`; append-only triggers; idempotency table. App role: no
UPDATE/DELETE on financial tables.

## Backend

Payment entry (oldest-first allocation, A-ALLOC, manual override), reversal,
ledger writer, receipt PDF job, cash/deposit summaries.

## Required tests (future release blockers)

- Σ allocations = payment amount; never over-allocate a charge.
- Reversal round-trip; ledger balance properties.
- Gapless receipt numbering under concurrency.
- `Idempotency-Key` on money-creating POSTs.

## Acceptance

Month-in-the-life: generate fees → record ~20 payments → balances, debtor
states, and receipts match the oracle.
