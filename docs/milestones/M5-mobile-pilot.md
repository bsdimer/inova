# M5 — Mobile pilot slice hardening

**Status:** Not started. **Effort / sequencing:** L, parallelizable from M1 with mocks.

Part of the [implementation plan](../implementation-plan.md). Milestone order and dependencies are in its §7. Section numbers (§) are the plan's own; its index maps each § to a file.

## Goal

Resident app is store-quality for the pilot: registration → link → obligations → pay-by-reference → history, plus themes, help, payment instructions, support contacts.

## Dependencies

M2, M3, M4 APIs (mocked earlier).

## Mobile

Navigation polish, offline-tolerant caching (TanStack Query persistence), Android + iOS parity per team rules (conditional styling for widths > 375, Android back handling), accessibility pass, bg/en locales.

## Tests

Detox/Maestro e2e happy path; device matrix (small Android, iPhone SE, tablets not required).

## Acceptance

Internal TestFlight/Play internal-testing build of the **shared app** used by the team with real inova staging data.

## Risks

Apple review lead time for TestFlight external testing — start Apple/Google account prep in parallel (M-Ops).
