# M4 — Manual payments, cash accounts, receipts

**Status:** Not started. Depends on M3. B2 (receipt legal shape) is still open
— design templates so they can be swapped without schema change.

## Goal

Managers record bank/cash payments and reconcile external inbound transfers to
apartments by payment reference. Allocations, logical operational/deposit
balances, and receipts match a spreadsheet oracle.

## Tables

`bank_transactions`, `payments`, `payment_allocations`, logical
`cash_accounts`, `ledger_entries`, `receipts`; append-only triggers;
idempotency table. Operational and deposit/repair funds are logical sub-ledgers
over one real building bank account. App role: no UPDATE/DELETE on financial
tables.

## Backend

- External bank-transaction ingestion boundary and reference-based apartment
  match proposals. Ambiguous/unmatched entries stay in a staff reconciliation
  queue and do not mutate the ledger silently.
- Payment entry (oldest-first allocation, A-ALLOC, manual override), reversal,
  ledger writer, receipt PDF job, logical-fund summaries.
- Per-building allow/disallow configuration for operational/deposit transfers;
  permitted transfers create balanced, audited ledger entries.
- One manager-designated verified owner occupancy receives apartment documents;
  historical documents retain their original recipient.

## Required tests (future release blockers)

- Σ allocations = payment amount; never over-allocate a charge.
- Exact/ambiguous/unmatched payment-reference cases; no ledger mutation before
  confirmed association.
- Logical funds reconcile to the real-account ledger; allowed/disallowed
  inter-fund transfer cases.
- Designated-recipient changes do not rewrite prior documents.
- Reversal round-trip; ledger balance properties.
- Gapless receipt numbering under concurrency.
- `Idempotency-Key` on money-creating POSTs.

## Acceptance

Month-in-the-life: generate fees → record ~20 payments → balances, debtor
states, logical funds, external-bank matches, and receipts match the oracle.

## Still open before implementation

- ~~Overpayment disposition~~ — **resolved 2026-09-21: apartment credit.** The
  excess of a matched payment stays on the apartment as unallocated credit and
  is consumed automatically, oldest-first, by the next charges. A refund is a
  separate, permission-gated action. Invariant to test: allocations + remaining
  credit = payment amount; a charge is never over-allocated.
- ~~Bank-feed mechanism~~ — **resolved 2026-09-21: statement file upload**
  (CSV / MT940 / CAMT.053) behind a provider-neutral ingestion boundary, with
  per-transaction dedupe so re-uploading a statement changes nothing. An
  open-banking feed can implement the same boundary later.
- All amounts are EUR (A-EUR). Imported BGN opening balances are converted once
  at 1.95583, before they reach this module.
- iCard is the stakeholder-preferred provider for the later online-payment
  milestone. Before that contract is locked, validate its tenant merchant/account
  model, payment initiation, webhooks, refunds, reconciliation, sandbox, and
  Bulgarian onboarding. Keep M4's bank/manual-payment ledger provider-neutral.

## Full scope by layer

Moved verbatim from the implementation plan §7 when it was split. Where this and the sections above differ, the sections above are newer.

**Effort / sequencing:** L

- **Goal:** managers record or reconcile inbound bank/cash payments, associate external transfers to apartments by payment reference, allocate across charges; logical operational/deposit balances and receipts are correct.
- **Dependencies:** M3.
- **DB:** `bank_transactions, payments, payment_allocations, cash_accounts, ledger_entries, receipts`; append-only triggers; idempotency table. Operational/deposit accounts are logical funds over one real building bank account.
- **Backend:** external bank-transaction ingestion boundary; reference-based apartment match proposals; unmatched/ambiguous reconciliation queue with staff confirmation; payment entry with auto-allocation (oldest-first default, manual override), reversal flow, ledger writer, permission-gated inter-fund transfer honoring the building setting, receipt PDF job, logical-fund summaries + transaction history.
- **Admin:** payment entry and bank-match queue, allocation editor, building operational/deposit dashboards, configurable allow/disallow fund transfer, designated-owner document recipient, receipt viewing/printing.
- **Mobile:** payment history + receipt download; building cash-account summary (read-only aggregates).
- **Tests:** bank-reference exact/ambiguous/unmatched cases; no ledger mutation before confirmed match; allocation invariants (Σ allocations = payment amount for confirmed payments under the selected overpayment policy; never over-allocate a charge), logical funds sum to the real-account ledger, disallowed/allowed fund-transfer cases, reversal round-trip, designated-recipient history, gapless receipt numbering under concurrency.
- **Acceptance:** month-in-the-life scenario: generate fees → record 20 payments → balances, debtor states, and receipts all match a spreadsheet oracle.
- **Risks:** B2 (receipt legal shape) — receipts designed to be re-templated without schema change.
