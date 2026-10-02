---
id: D38
title: Payments — a receipt per payment and a «Справка за плащания» for a period; fund transfers carry a note and an optional file; `files` moves to M4
status: decided
decided: 2026-10-02 (team lead; stakeholder's answers 2026-10-01)
source: WHI-115 — the stakeholder 2026-10-01 10:40 (913e5132); the questions 16:57 (747fbdfd); the team lead's answer 2026-10-02 07:09 (2efd5eb7)
pr: '#91'
affects: [B2, A-DEPOSIT, A-BANK-MATCH]
---

# D38 — Payment documents and fund transfers

**Rule.** In the pilot, two separate documents:

- a **receipt** for every payment, with the stakeholder's fields — document
  name, number, date of issue, payee, payer, purpose, amount, currency,
  method, the date the money was actually received, full or partial payment;
- a **«Справка за плащания»** for a chosen period (one or more months),
  whatever the payment method; the resident downloads it in the app (M5).

B2 stays open: the templates, the numbering and the VAT cases still need an
accountant.

A **transfer between «Каса» (operational) and «Депозит» (repairs)** carries a
required **note** («5000€ за монтиране на нова входна врата») and an optional
document, both in M4. The shared **`files` module** (attachments with an
antivirus scan) therefore moves from M6 to M4; the building photo and the
issue photos use it later.

Also settled (stakeholder, no question): the resident sees an overpayment —
the apartment's credit — in the app (M5); `payments.record` may be granted to
an «Счетоводител» role, not only the house manager; the bank statement is
uploaded each day there is a payment (A-BANK-MATCH).

**Why.** The resident wants one document for a period whatever the method,
and the manager has to justify every move of the repair fund; the file needs
the same storage and scan as every other upload, so it is built once, first
where it is needed.

## Lands in

- `docs/milestones/M4-payments.md` → Tables, Backend, Required tests
- `docs/milestones/M6-issues.md` → Dependencies, Tables (`files` comes from M4)
- `docs/milestones/M2-property.md` → the building photo line
- `docs/plan/data-model.md` → `building` (photo)
- `docs/plan/security.md` → §6.2 `payments.record`
- `docs/milestones/M5-mobile-pilot.md` → Mobile: credit, receipts and the «Справка за плащания»
- `docs/plan/decisions.md` → the card index
