# M2 — Property hierarchy and resident linking

**Status:** Not started. **Current target** (mobile-first).

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
- Reasoned resident/occupancy/apartment removal request; `super_admin`
  approve/reject/apply with archival/end-dating and audit history.
- Building-scoped house-manager assignments independent of employer: tenant
  staff, a resident owner, or a platform-employed operator may hold the role.

## Admin

Portfolio tree, building setup/activation, apartment detail, “add resident”
(role + effective date → invite → delivery/activation status), multiple owners,
designated owner document recipient, verification queue, corrections,
removal-request queue, approved end occupancy / move, manager assignment.

## Mobile

Role-derived owner, tenant, occupant, and manager views in the active
tenant/brand realm; explicit view switching when the account has multiple
roles; tenant switching among separately authenticated accounts in the shared
app; profile (contacts, effective-dated occupants and pets); fallback “add my
apartment”. View selection never grants access. Owner-only features such as
survey proposal/voting are hidden and server-blocked for tenant/occupant roles.

## Required tests

- Import edge cases (bad rows, dry-run vs commit).
- Apartment natural-key uniqueness includes floor.
- Same email/phone can register in two tenants but not twice in one tenant;
  auth/reset/invite responses never reveal the other realm.
- Occupancy state machine.
- Multiple co-owner access and owner-vs-tenant authorization differences.
- Multi-role account behavior and tenant-switch isolation: selected views do
  not grant permissions, and cached apartment data from tenant A is unavailable
  after switching to tenant B.
- Resident/pet effective-date boundaries.
- Draft vs active apartment-removal rules; reason required; only super_admin
  applies approved removals; full audit coverage.
- Resident, tenant-staff, and platform-employed house-manager assignment cases.
- Resident cannot see unlinked apartments (isolation + occupancy guards).
- Tenant schema contract still green.

## Acceptance

inova’s real structure is importable from a spreadsheet (B4); co-owners and
owner/tenant access demonstrate distinct server-enforced behavior; effective
dates produce the correct population at a chosen date; removal approval and
verification round-trips work end to end.

## Risks

Obtain sample spreadsheet files before locking column mappings.

Legal counsel must confirm whether EGN and identity-card details are necessary
for claims submitted to a public/private enforcement agent. Until confirmed,
do not place them on the general account or occupancy model. If required, use a
separate encrypted, purpose-limited legal-identity record with explicit access
permissions, audit logging, and retention/erasure rules.
