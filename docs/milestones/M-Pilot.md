# M-Pilot — inova onboarding and launch

**Status:** Not started. **Effort / sequencing:** M.

Part of the [implementation plan](../implementation-plan.md). Milestone order and dependencies are in its §7. Section numbers (§) are the plan's own; its index maps each § to a file.

## Goal

Inova live in production on the shared app.

## Dependencies

M5, M5b (mobile issues/notices), M7, M9, M-Ops, and — since D23 — the surveys module (from the P1 wave), the Community forum (milestone to be cut), M11 with the resident-visible contractor calendar, and the tenant-named menu item in the brand config (Still open 13).

## Work

Data migration scripts (B4 source → import endpoints) with dry-run + reconciliation report (opening balances vs. source); staff training session + quick-reference guide (docs/guides/); support channel + triage rota; feedback capture (PostHog surveys + in-app support contact); pilot checklist execution (§10).

## Currency conversion at import (A-EUR)

The platform is EUR-native. Pilot spreadsheets kept in BGN are converted once,
at import, at the fixed rate 1 EUR = 1.95583 BGN, half-up per amount to the
cent. The dry-run and the signed reconciliation report list, per row, the BGN
source and the EUR result, and the total rounding difference. Nothing is
stored in BGN.

## Long-lead items — start now, none needs code

Each can block go-live on its own, and each takes weeks of someone else's time.

- [ ] SMS/Viber gateway chosen (Twilio vs Infobip), contract signed, **sender
      ID / Viber business sender registered** for Bulgaria.
- [ ] Apple Developer organisation account (D-U-N-S) and Google Play
      organisation account for the shared app; bundle id `bg.inova.resident`
      reserved.
- [ ] Domains and mail: `inova.bg`, `app.inova.bg`, `support@inova.bg`.
- [ ] Real pilot spreadsheet samples (blocks the M2 import column mapping).
- [ ] Accountant's answer on receipt/invoice shape (B2) — blocks M4 templates.
- [ ] Counsel's answers: DPA template, EGN/identity data (B12), retention.
- [ ] Production host provisioned per D19, with off-box backups and one
      rehearsed restore.

## Acceptance

§10 success criteria instrumented and baselined.

## Risks

Opening-balance disputes — mitigate with a signed reconciliation report before go-live.
