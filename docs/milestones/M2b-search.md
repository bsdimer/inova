# M2b — Unified admin search

**Status:** Not started. **Effort / sequencing:** S, right after M2.

Part of the [implementation plan](../implementation-plan.md). Milestone order and dependencies are in its §7. Section numbers (§) are the plan's own; its index maps each § to a file.

## Goal

The shell search box ("Сграда, апартамент, жител или телефон") finds a building, an apartment or a resident from any admin page. Phone is a way to reach a resident, not a fourth result type.

## Dependencies

M2 (the three searchable things exist).

## Tables

No new tables. `pg_trgm` + `btree_gin` GIN indexes leading with `tenant_id` on building name/address, apartment number and the resident name/phone/email columns. **No separate search engine** — Postgres covers pilot and launch scale at zero extra hosting and operational cost; revisit only if measured latency says so.

## Backend

`GET /v1/search?q=&types=` in the `property` module (resident fields reached through the tenancy module's account-lookup interface, not its tables). Minimum 2 characters, at most 5 results per type, grouped response with a deep-link target per hit, per-user rate limit. RLS-scoped like every route; results further restricted to the caller's building scope; a result type is omitted entirely when the caller lacks its read permission, so resident PII is never searchable without `residents.read`. Query text is not logged.

## Admin

Debounced search box in the shell, grouped dropdown, keyboard navigation, empty and error states.

## Tests

Tenant-isolation suite covers the route (tenant B term never matches tenant A rows); building-scoped manager never sees out-of-scope hits; permission omission per type; Cyrillic/Latin and partial-number matching.

## Acceptance

Typing part of a resident's name, a phone suffix, an apartment number or a building name lands on the right detail page in < 300 ms at pilot scale.
