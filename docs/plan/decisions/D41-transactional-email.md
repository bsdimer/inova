---
id: D41
title: Infobip Email sends transactional messages from a verified WhiteNova domain
status: decided
decided: 2026-10-03 (stakeholder)
source: WHI-116 — stakeholder approval and whitenova.tech ownership 2026-10-03; decision comment 7f3f756a
pr: pending WHI-148
affects: [B13, D36, D39]
---

# D41 — Transactional e-mail

**Rule.** Use Infobip Email for real recovery, e-mail-change and invitation
messages, then reuse the worker channel for M6 «Авария» alerts. The owned
`whitenova.tech` domain permits DNS onboarding; plan the sending subdomain as
`notify.whitenova.tech`, verify the domain and test delivery before enabling
production sends. The «Авария» right is `issues.emergency`, initially for
Administrator and House Manager, never the contractor starter roles.

This decides transactional delivery only. Bulk e-mail as a channel in M7
remains open under D36.

**Why.** A single worker delivery boundary gives short-lived account links
and emergency alerts the same secret handling, retries and failure reporting.
Domain ownership removes the ownership question, not the DNS/provider setup.

## Lands in

- `docs/milestones/M1-identity.md` → first messages and delivery tests
- `docs/milestones/M2-property.md` → activation batch
- `docs/milestones/M6-issues.md` → emergency alert delivery
- `docs/milestones/M-Pilot.md` → DNS and provider onboarding
- `docs/plan/security.md` → permission key and defaults
- `docs/current.md` → remaining blocker and Next up
- `docs/plan/decisions.md` → card index
