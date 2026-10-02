---
id: D37
title: After the pilot the portal names the organisation by a sign-in link per organisation
status: decided
decided: 2026-09-30 (team lead)
source: PR #59 → «For the owners of other parts» (01.10); review of PR #63 (01.10)
pr: '#73'
affects: [B8]
---

# D37 — The portal names the organisation by a link per organisation

**Rule.** Staff sign in to the admin portal through a link of their
organisation — `…/<organisation key>/login`, for example `…/inova/login` —
which sends the key as `realm` with `POST /auth/login` (B8, #57). Not a field
on the sign-in form, not a subdomain. Built with M10, after the pilot; until
then every sign-in without a realm lands in `AUTH_DEFAULT_REALM`, which
covers the single pilot organisation, and that default with its `TODO(M10)`
goes when the links exist. The approved sign-in screen (Figma `911:3793`)
does not change.

**Why.** One realm per account is B8; the link names it without asking the
user, and a subdomain per organisation would need DNS and certificates per
tenant.

## Lands in

- `docs/milestones/M10-white-label.md` → Work: admin portal sign-in per organisation
- `docs/current.md` → Admin: choosing the organisation on sign-in
- `docs/plan/decisions.md` → the card index
