# Database migrations

Plain SQL migrations managed by drizzle-kit (wired in milestone M1 together with the first
schema: tenants, users, memberships, roles).

Conventions (from docs/plan/system-design.md §4.4/§4.7 and docs/plan/data-model.md §5.5):

- Every tenant-owned table has `tenant_id` as the **leading** column of its primary key and indexes.
- Row-level security policies, append-only triggers, and gapless counters are written **by hand**
  in these SQL files — never generated.
- `audit_records` and `notifications` are partitioned from day one (hash by `tenant_id`).
