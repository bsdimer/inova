# M5b — Mobile issues and notices

**Status:** Not started. **Effort / sequencing:** M, after M6 and M7.

Part of the [implementation plan](../implementation-plan.md). Milestone order and dependencies are in its §7.

The mobile half of two backend phases, kept as one phase because it ships as one
app update and M-Pilot depends on it. Scope is defined in the owning files —
this file only ties them together.

## Dependencies

[M6 — Issues](M6-issues.md) and [M7 — Notices and push](M7-notices-push.md) APIs.

## Mobile

- From M6: issue report flow (camera / gallery), my-issues list with statuses.
  Residents do not set priority.
- From M7: notices feed with category filters, notification-permission UX, deep
  links from a push to its content, notification centre.

## Tests

No mobile test runner exists yet, so closing this phase needs the named manual
checks recorded per [AGENTS.md](../../AGENTS.md) → Closing a phase: report an
issue with a photo on Android and iOS and see it in admin; a notice to one
entrance reaches only that entrance's devices; a push opens the right screen
from a cold start.

## Acceptance

The M6 and M7 acceptance criteria hold end to end from a device.
