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

- True overpayment disposition after a bank transaction is matched to an
  apartment: apartment credit, unallocated staff action, or refund.
- External bank-feed mechanism and formats: statement upload, provider/open
  banking feed, or both.
- iCard is the stakeholder-preferred provider for the later online-payment
  milestone. Before that contract is locked, validate its tenant merchant/account
  model, payment initiation, webhooks, refunds, reconciliation, sandbox, and
  Bulgarian onboarding. Keep M4's bank/manual-payment ledger provider-neutral.
