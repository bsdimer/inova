---
id: D40
title: Draft invitations wait for activation; resident import includes contactless people
status: decided
decided: 2026-10-03 (stakeholder)
source: WHI-37 — stakeholder approval 2026-10-03; decision comment 45ca9f02
pr: pending WHI-148
affects: [B4, B7, B14, D24]
---

# D40 — Invitations, import and building list

**Rule.** A draft building may contain residents, but issues no active invite
codes or messages. Activation shows the eligible count and sends one invite
per eligible account; an active building invites newly added residents at once.
The import includes resident name, role and optional contact. A resident
without contact is recorded «без акаунт» and gains app access only after later
contact verification and invitation. Building facts are entered once and
inherited by property/resident rows; the dry run displays those values.

The building list shows entrances, residents by status and house manager.
The manager picker uses a scoped, paginated candidate search.

**Why.** Staff can prepare a whole building without sending premature codes,
and the pilot spreadsheet can include people whose contact details are still
missing. The summaries let managers verify the imported structure.

## Lands in

- `docs/milestones/M2-property.md` → backend, admin and tests
- `docs/plan/data-model.md` → accountless owner/tenant occupancies
- `docs/milestones/M1-identity.md` → delivery dependency
- `docs/plan/decisions.md` → B4 resolution and card index
