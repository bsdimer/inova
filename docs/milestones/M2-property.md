# M2 — Property hierarchy and resident linking

**Status:** Not started. Next after the M1 B8 refactor (mobile-first).

## Goal

Admin builds the portfolio and creates independent, tenant-scoped owner/tenant
accounts on apartments (B7-B10). The same email or phone may be registered as
an unrelated account in another tenant without cross-brand disclosure.
Role-specific access and effective-dated residents/pets are correct.
Self-service link requests are an admin-verified fallback.

## Dependencies

M1 (identity, tenancy, invite codes), including the B8 refactor from the
currently implemented global-user model to tenant-scoped account realms.

## Tables

`buildings`, `entrances`, `apartments`, `occupancies`, `pets`,
`occupancy_requests`, `building_manager_assignments`, `removal_requests`
(+ soft-delete/effective-date columns). All tenant-owned: `tenant_id` leading
PK/indexes, RLS. Apartment rows keep UUID technical ids and enforce the unique
business key `(tenant_id, building_id, entrance_id, floor, apartment_number)`.
A building has `city` and `district` as separate columns (D24). An apartment
has `rooms` (integer) and a property type of `apartment`, `garage`, `shop`,
`storage` or `parking_spot` (D26).
The schema contract test must pass on the new tables without being rewritten.

## Backend

- Draft-building CRUD + bulk import (CSV/XLSX) for buildings/apartments;
  dry-run + row errors. Apartments may be freely added/removed until building
  activation; active-building removal uses the approval flow.
- Create-resident-on-apartment: tenant-local account + effective-dated
  occupancy + invite code. Normalized email/phone is unique within the tenant,
  not globally.
- Separate owner/tenant/occupant app capabilities; multiple simultaneous owner
  occupancies are valid and owner-only permissions are server-enforced.
- Effective-dated residents and pets (`valid_from` / `valid_to`) for later fee
  calculations.
- Occupancy request / verify / reject (fallback).
- Occupancy-scoped resident guards.
- Apartment correction is an ordinary edit with an audit-journal row, no
  approval; there is no "move" — a real move is an approved end of occupancy
  plus a new invite on the new apartment (D25, B10).
- Reasoned resident/occupancy/apartment removal request; `super_admin`
  approve/reject/apply with archival/end-dating and audit history. The author
  may edit or withdraw the request while it is pending; both request lists
  take a status filter, the queues show `pending` only (D27).
- Building-scoped house-manager assignments independent of employer: tenant
  staff, a resident owner, or a platform-employed operator may hold the role.

## Admin

Portfolio tree, building setup/activation, apartment detail, “add resident”
(role + effective date → invite → delivery/activation status), multiple owners,
designated owner document recipient, verification queue, corrections,
removal-request queue with История for decided and withdrawn requests (D27), approved end occupancy (no move — D25), manager assignment. The buildings list filters by град and квартал (D24). The «Детайли на жител» panel (WHI-63) fills in stages: contacts, properties, pets and history here; «Подадени сигнали» after M6; the photo from Общност after the forum module (initials until then, as drawn).

## Mobile

Role-derived owner, tenant, occupant, and manager views in the active
tenant/brand realm; explicit view switching when the account has multiple
roles; profile (contacts, effective-dated occupants and pets); fallback “add my
apartment”. View selection never grants access. Owner-only features such as
survey proposal/voting are hidden and server-blocked for tenant/occupant roles.

## Required tests

- Import edge cases (bad rows, dry-run vs commit); `city`, `district`,
  `rooms` and the property type are mapped and validated.
- Apartment correction writes an audit row and needs no approval; ending an
  occupancy still does (D25).
- Apartment natural-key uniqueness includes floor.
- Same email/phone can register in two tenants but not twice in one tenant;
  auth/reset/invite responses never reveal the other realm.
- Occupancy state machine.
- Multiple co-owner access and owner-vs-tenant authorization differences.
- Multi-role account behavior: selected views do not grant permissions. (The
  tenant-switch isolation test — cached apartment data from tenant A
  unavailable after switching to tenant B — moved to M10 with the switcher.)
- Resident/pet effective-date boundaries.
- Draft vs active apartment-removal rules; reason required; only super_admin
  applies approved removals; full audit coverage.
- Withdrawal: only the author, only while pending; a decided request refuses
  it. An edit while pending writes an audit row. The status filter on both
  request lists returns only the requested statuses (D27).
- Resident, tenant-staff, and platform-employed house-manager assignment cases.
- Resident cannot see unlinked apartments (isolation + occupancy guards).
- Tenant schema contract still green.

## Acceptance

inova’s real structure is importable from a spreadsheet (B4); co-owners and
owner/tenant access demonstrate distinct server-enforced behavior; effective
dates produce the correct population at a chosen date; removal approval and
verification round-trips work end to end.

## Follow-ups that depend only on M2

Not part of M2 acceptance, but unblocked by it (scope in
[implementation-plan.md](../implementation-plan.md) §7):

- **M2b unified search** — building / apartment / resident from the admin
  shell. Keep building name/address, apartment number and resident
  name/phone/email in plain, indexable columns so M2b needs no schema change.
- **M11 staff tasks and calendar** — tasks reference `building_id` /
  `entrance_id`.
- **Building page counters (D24)** — M6 issues and the surveys module filter
  by one `building_id`; M2 only keeps the id plain and indexable.
- Dashboard building and apartment counts and the "add building" tile
  ([features/admin-dashboard.md](../features/admin-dashboard.md)).

## Risks

Obtain sample spreadsheet files before locking column mappings.

Legal counsel must confirm whether EGN and identity-card details are necessary
for claims submitted to a public/private enforcement agent. Until confirmed,
do not place them on the general account or occupancy model. If required, use a
separate encrypted, purpose-limited legal-identity record with explicit access
permissions, audit logging, and retention/erasure rules.

## Full scope by layer

Moved verbatim from the implementation plan §7 when it was split. Where this and the sections above differ, the sections above are newer.

**Effort / sequencing:** M

- **Goal:** admin builds the inova portfolio and creates independent owner/tenant accounts on apartments (B7-B10); role-specific app access and effective-dated residents/pets are correct; self-service link requests remain an admin-verified fallback.
- **Dependencies:** M1, including the tenant-scoped account-realm refactor required by B8.
- **DB:** `buildings, entrances, apartments, occupancies, pets, occupancy_requests, building_manager_assignments, removal_requests` (+ soft delete/effective-date columns). Apartment unique business key: `(tenant, building, entrance, floor, apartment_number)`.
- **Backend:** draft-building CRUD + bulk import endpoint (CSV/XLSX) for buildings/apartments; building activation freezes direct apartment removal; **create-resident-on-apartment endpoint (creates/uses a tenant-local account + effective-dated occupancy + invite code)**; multiple simultaneous owners; owner vs tenant permission guards; effective-dated residents/pets; occupancy request/verify/reject; reasoned removal request + super_admin approve/reject/apply; building-scoped manager assignments for tenant staff, resident managers, or platform-employed managers.
- **Admin:** portfolio tree UI, apartment detail, building setup/activation, **"add resident" flow** with owner/tenant/occupant role and effective date, multiple-owner support, designated owner document recipient, verification/removal queues, corrections, resident lifecycle (approved end occupancy; no move — D25), manager assignment.
- **Mobile:** distinct role-derived owner/tenant/occupant/manager views in the active branded tenant context; explicit role/view and apartment switching where applicable; tenant switching among independently authenticated accounts in the shared app (→ M10); profile screens (contacts, occupants, pets with effective dates); fallback "add my apartment" request flow. Owner-only features stay hidden and server-blocked for tenants/occupants, regardless of the selected view.
- **Tests:** import edge cases; natural-key uniqueness including floor; duplicate email/phone across tenants but not within one tenant; multiple co-owner access; owner/tenant authorization differences; effective-date boundaries; draft vs active removal policy; removal approval audit; occupancy state machine; resident cannot see unlinked apartments.
- **Acceptance:** inova's real structure importable from spreadsheet; verification round-trip works end to end.
- **Risks:** source data is spreadsheets (B4 resolved) — obtain sample files early to fix column mappings for the bulk importer.
