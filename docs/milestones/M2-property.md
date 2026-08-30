# M2 — Property hierarchy and resident linking

**Status:** Not started. **Current target** (mobile-first).

## Goal

Admin builds the portfolio and creates resident accounts on apartments
(primary onboarding per B7). Self-service link requests are an admin-verified
fallback.

## Dependencies

M1 (identity, tenancy, invite codes).

## Tables

`buildings`, `entrances`, `apartments`, `occupancies`, `pets`,
`occupancy_requests` (+ soft-delete columns). All tenant-owned: `tenant_id`
leading PK/indexes, RLS. The schema contract test must pass on the new tables
without being rewritten.

## Backend

- CRUD + bulk import (CSV/XLSX) for buildings/apartments; dry-run + row errors.
- Create-resident-on-apartment: user + occupancy + invite code.
- Occupancy request / verify / reject (fallback).
- Occupancy-scoped resident guards.

## Admin

Portfolio tree, apartment detail, “add resident” (data → invite → delivery/
activation status), verification queue, end occupancy / move.

## Mobile

Profile (contacts, occupants, pets); fallback “add my apartment”.

## Required tests

- Import edge cases (bad rows, dry-run vs commit).
- Occupancy state machine.
- Resident cannot see unlinked apartments (isolation + occupancy guards).
- Tenant schema contract still green.

## Acceptance

Sosedo’s real structure importable from a spreadsheet (B4). Verification
round-trip works end to end.

## Risks

Obtain sample spreadsheet files before locking column mappings.
